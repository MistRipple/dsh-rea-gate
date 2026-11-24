import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { apply } from '../index.js'

const stateDirectory = mkdtempSync(join(tmpdir(), 'dsh-rea-gate-route-test-'))
const stateFile = join(stateDirectory, 'rea-gate.json')
process.env.DSH_HOME = stateDirectory
process.env.REA_GATE_SKIP_DOCTOR = '1'
process.on('exit', () => rmSync(stateDirectory, { recursive: true, force: true }))

const toolNames = ['mcp__rea__fixture', 'other_tool']
const routes = new Map()
const liveAgents = new Map()
let onAgentCreated
const ctx = {
  tools: {
    schemas: (scope) => (scope?.ctx?.visible ? scope.ctx.visible() : toolNames),
    register: () => {},
  },
  on: (event, listener) => {
    if (event === 'agent/created') onAgentCreated = listener
    else assert.equal(event, 'agent/disposed')
  },
  effect: (effect) => effect(),
  inject: (services, callback) => {
    if (services.includes('agents')) {
      callback({
        effect: (effect) => effect(),
        agents: { get: (id) => liveAgents.get(id) },
      })
      return
    }
    assert.deepEqual(services, ['connection'])
    callback({
      effect: (effect) => effect(),
      connection: { fetch: { register: (route) => routes.set(route.path, route) } },
      get: () => undefined,
    })
  },
}
apply(ctx)

function makeAgent(id, cwd) {
  const denied = new Set()
  const scope = {
    visible: () => toolNames.filter((name) => !denied.has(name)),
    tools: {
      restrict: ({ deny }) => {
        for (const name of deny) denied.add(name)
        return () => { for (const name of deny) denied.delete(name) }
      },
    },
  }
  return { ctx: scope, session: { header: { id, ...(cwd ? { cwd } : {}) } } }
}

function createAgent(id, cwd) {
  const agent = makeAgent(id, cwd)
  onAgentCreated({ agent })
  return agent
}

const toggle = (body) => routes.get('/api/dsh-rea-gate/toggle').fetch(
  new Request('http://harness.test/api/dsh-rea-gate/toggle', {
    method: 'POST',
    body: JSON.stringify(body),
  }),
)
const readState = () => JSON.parse(readFileSync(stateFile, 'utf8'))

writeFileSync(stateFile, JSON.stringify({ default: false }))
const noWorkspace = createAgent('no-workspace')
const withWorkspace = createAgent('with-workspace', '/projects/workspace')

// A switch aimed at a session changes that session only and saves nothing.
const on = await toggle({ session: 'no-workspace', open: true })
assert.equal(on.status, 200)
const onBody = await on.json()
assert.equal(onBody.open, true)
assert.equal(onBody.default, false)
assert.equal(readState().default, false)
assert.deepEqual(noWorkspace.ctx.visible(), toolNames)
assert.deepEqual(withWorkspace.ctx.visible(), ['other_tool'], 'other sessions are untouched')

const off = await toggle({ session: 'no-workspace', open: false })
assert.equal((await off.json()).open, false)
assert.deepEqual(noWorkspace.ctx.visible(), ['other_tool'])
assert.equal(readState().default, false)

// A session that predates a plugin reload is resolved from the host agent table.
const preReload = makeAgent('pre-reload', '/projects/pre-reload')
liveAgents.set('pre-reload', preReload)
const preState = await (await routes.get('/api/dsh-rea-gate/state').fetch(
  new Request('http://harness.test/api/dsh-rea-gate/state?session=pre-reload&checks=0'),
)).json()
assert.equal(preState.sessionKnown, true)
assert.equal(preState.workspace, '/projects/pre-reload')
assert.equal(preState.open, false)
const preToggle = await toggle({ session: 'pre-reload', open: true })
assert.equal(preToggle.status, 200)
assert.deepEqual(preReload.ctx.visible(), toolNames)
assert.equal(readState().default, false)

// The bare control sets the default that new sessions start from; running ones keep theirs.
const global = await toggle({ open: true })
assert.equal(global.status, 200)
assert.equal((await global.json()).default, true)
assert.equal(readState().default, true)
assert.deepEqual(noWorkspace.ctx.visible(), ['other_tool'])
assert.deepEqual(createAgent('after-default', '/projects/anywhere').ctx.visible(), toolNames)
await toggle({ open: false })
assert.deepEqual(createAgent('after-default-off').ctx.visible(), ['other_tool'])

// Per-workspace rules no longer exist: such requests are refused and nothing is written.
for (const stale of [{ workspace: '/projects/workspace', open: true }, { session: 'no-workspace', open: true, remember: true }]) {
  assert.equal((await toggle(stale)).status, 400, JSON.stringify(stale))
}
assert.equal(readState().default, false, 'a stale request must not change the default')
assert.equal(readState().workspaces, undefined)
assert.equal((await toggle({ action: 'reset-workspace', workspace: '/projects/workspace' })).status, 400)

const malformed = await toggle({ session: 'with-workspace' })
assert.equal(malformed.status, 400)
const unknownSession = await toggle({ session: 'missing', open: true })
assert.equal(unknownSession.status, 404)
