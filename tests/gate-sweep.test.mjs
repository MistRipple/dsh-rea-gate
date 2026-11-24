import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { apply } from '../index.js'

const directory = mkdtempSync(join(tmpdir(), 'dsh-rea-gate-sweep-test-'))
const stateFile = join(directory, 'rea-gate.json')
const marker = join(directory, 'rea-was-run')
const fakeRea = join(directory, 'rea')
// Any REA CLI call from the agent tool would leave this marker behind.
writeFileSync(fakeRea, `#!/bin/sh\necho "$@" >> "${marker}"\n`)
chmodSync(fakeRea, 0o755)
process.env.DSH_HOME = directory
process.env.REA_GATE_SKIP_DOCTOR = '1'
process.env.REA_BIN = fakeRea
process.on('exit', () => rmSync(directory, { recursive: true, force: true }))
writeFileSync(stateFile, JSON.stringify({ default: false, workspaces: {} }))

// The registered tool set changes over time: REA connects late and grows.
let registered = ['other_tool']
const routes = new Map()
let onAgentCreated
let tool
const warnings = []

const ctx = {
  logger: () => ({ warn: (message) => warnings.push(message) }),
  tools: {
    schemas: (scope) => (scope?.ctx?.visible ? scope.ctx.visible() : registered),
    register: (definition) => { tool = definition },
  },
  on: (event, listener) => {
    if (event === 'agent/created') onAgentCreated = listener
  },
  effect: (effect) => effect(),
  inject: (services, callback) => {
    if (services.includes('agents')) return
    assert.deepEqual(services, ['connection'])
    callback({
      effect: (effect) => effect(),
      connection: { fetch: { register: (route) => routes.set(route.path, route) } },
      get: () => undefined,
    })
  },
}
apply(ctx)

function makeAgent(id, cwd, { failFirstRestrict = false } = {}) {
  const denied = new Set()
  let failures = failFirstRestrict ? 1 : 0
  const scope = {
    visible: () => registered.filter((name) => !denied.has(name)),
    tools: {
      restrict: ({ deny }) => {
        if (failures-- > 0) throw new Error('simulated restrict failure')
        // The real host rejects names it does not know.
        for (const name of deny) assert.ok(registered.includes(name), `unknown tool ${name}`)
        for (const name of deny) denied.add(name)
        return () => { for (const name of deny) denied.delete(name) }
      },
    },
  }
  return { ctx: scope, session: { header: { id, ...(cwd ? { cwd } : {}) } } }
}

const readState = async (id) => (await routes.get('/api/dsh-rea-gate/state').fetch(
  new Request(`http://harness.test/api/dsh-rea-gate/state?session=${id}&checks=0`),
)).json()

// 1. REA is not registered when the session starts: nothing can be hidden yet,
//    and that is reported instead of swallowed.
const early = makeAgent('early', '/projects/a')
onAgentCreated({ agent: early })
assert.ok(warnings.some((message) => /not registered yet/.test(message)))

// 2. REA connects afterwards. The next state read closes the gap.
registered = ['other_tool', 'mcp__rea__one', 'mcp__rea__two']
const afterConnect = await readState('early')
assert.deepEqual(early.ctx.visible(), ['other_tool'])
assert.equal(afterConnect.open, false)
assert.equal(afterConnect.tools, 0)
assert.equal(afterConnect.exposed, false)

// 3. An update adds a tool: the closed session must not see it either.
registered = [...registered, 'mcp__rea__three']
assert.deepEqual(early.ctx.visible(), ['other_tool', 'mcp__rea__three'])
const exposedState = await readState('early')
assert.equal(exposedState.exposed, false, 'the read itself re-closes the gate before reporting')
assert.deepEqual(early.ctx.visible(), ['other_tool'])

// 4. A failed restrict is retried on the next sweep and reported meanwhile.
const flaky = makeAgent('flaky', '/projects/b', { failFirstRestrict: true })
onAgentCreated({ agent: flaky })
assert.deepEqual(flaky.ctx.visible(), registered, 'the first attempt failed, so the agent is still exposed')
assert.ok(warnings.some((message) => /could not hide REA tools/.test(message)))
await readState('flaky')
assert.deepEqual(flaky.ctx.visible(), ['other_tool'])

// 5. Opening lifts every mask, including the top-ups.
const open = await (await routes.get('/api/dsh-rea-gate/toggle').fetch(
  new Request('http://harness.test/api/dsh-rea-gate/toggle', {
    method: 'POST', body: JSON.stringify({ session: 'early', open: true }),
  }),
)).json()
assert.equal(open.open, true)
assert.deepEqual(early.ctx.visible(), registered)
registered = [...registered, 'mcp__rea__four']
await readState('early')
assert.deepEqual(early.ctx.visible(), registered, 'an open session is never re-closed by the sweep')

// 6. The agent tool can read and flip the gate, nothing else.
assert.deepEqual(tool.parameters.action.enum, ['status', 'on', 'off'])
assert.equal(typeof tool.parameters.remember, 'object')
for (const action of ['install', 'update', 'uninstall']) {
  const answer = await tool.execute({ action }, { agent: early })
  assert.match(answer, /only status, on and off/)
}
assert.ok(!existsSync(marker), 'the agent tool must never run the REA CLI')

// 7. A model-initiated change is session-only unless it asks to remember.
const workspaceless = makeAgent('workspaceless')
onAgentCreated({ agent: workspaceless })
assert.match(await tool.execute({ action: 'status' }, { agent: workspaceless }), /hidden in this session/)
await tool.execute({ action: 'on' }, { agent: workspaceless })
assert.deepEqual(workspaceless.ctx.visible(), registered)
assert.match(
  await tool.execute({ action: 'on', remember: true }, { agent: workspaceless }),
  /cannot be remembered/,
)
const saved = () => JSON.parse(readFileSync(stateFile, 'utf8'))
// Step 5 went through the panel route, which saves its workspace rule; the tool must add nothing.
const panelOnly = { '/projects/a': true }
assert.deepEqual(saved().workspaces, panelOnly, 'the tool wrote nothing to the state file')
await tool.execute({ action: 'off' }, { agent: flaky })
assert.deepEqual(saved().workspaces, panelOnly)
await tool.execute({ action: 'on', remember: true }, { agent: flaky })
assert.equal(saved().workspaces['/projects/b'], true)
