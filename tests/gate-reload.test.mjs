import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { apply } from '../index.js'

const stateDirectory = mkdtempSync(join(tmpdir(), 'dsh-rea-gate-reload-test-'))
const stateFile = join(stateDirectory, 'rea-gate.json')
process.env.DSH_HOME = stateDirectory
process.env.REA_GATE_SKIP_DOCTOR = '1'
process.on('exit', () => rmSync(stateDirectory, { recursive: true, force: true }))
writeFileSync(stateFile, JSON.stringify({ default: false }))

const toolNames = ['mcp__rea__fixture', 'other_tool']
const routes = new Map()
const listedAgents = []
const agentsById = new Map()
let onAgentCreated
let onAgentDisposed

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

const closed = makeAgent('closed', '/projects/closed')
const open = makeAgent('open', '/projects/open')
const fallback = makeAgent('fallback', '/projects/closed')
listedAgents.push(closed, open)
agentsById.set(closed.session.header.id, closed)
agentsById.set(open.session.header.id, open)
agentsById.set(fallback.session.header.id, fallback)

const ctx = {
  tools: {
    schemas: (scope) => (scope?.ctx?.visible ? scope.ctx.visible() : toolNames),
    register: () => {},
  },
  on: (event, listener) => {
    if (event === 'agent/created') onAgentCreated = listener
    else if (event === 'agent/disposed') onAgentDisposed = listener
    else assert.fail(`unexpected event ${event}`)
  },
  effect: (effect) => effect(),
  inject: (services, callback) => {
    if (services.includes('agents')) {
      callback({
        effect: (effect) => effect(),
        agents: { list: () => listedAgents, get: (id) => agentsById.get(id) },
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

// The plugin instance starts with agents that already existed before it loaded.
apply(ctx)
assert.deepEqual(closed.ctx.visible(), ['other_tool'])
assert.deepEqual(open.ctx.visible(), ['other_tool'], 'with no default, sessions that predate the plugin start closed')

// An agent present in the host table but not announced at creation is resolved lazily.
const stateResponse = await routes.get('/api/dsh-rea-gate/state').fetch(
  new Request('http://harness.test/api/dsh-rea-gate/state?session=fallback&checks=0'),
)
const state = await stateResponse.json()
assert.equal(state.sessionKnown, true)
assert.equal(state.workspace, '/projects/closed')
assert.equal(state.open, false)
assert.equal(state.tools, 0)

const toggleResponse = await routes.get('/api/dsh-rea-gate/toggle').fetch(
  new Request('http://harness.test/api/dsh-rea-gate/toggle', {
    method: 'POST',
    body: JSON.stringify({ session: 'fallback', open: true }),
  }),
)
assert.equal(toggleResponse.status, 200)
assert.deepEqual(fallback.ctx.visible(), toolNames)
assert.equal(JSON.parse(readFileSync(stateFile, 'utf8')).default, false, 'a session switch leaves the saved default alone')
assert.deepEqual(closed.ctx.visible(), ['other_tool'], 'and the other sessions')

// New sessions still go through agent/created and start from the default.
const fresh = makeAgent('fresh', '/projects/open')
onAgentCreated({ agent: fresh })
assert.deepEqual(fresh.ctx.visible(), ['other_tool'])

// A disposed agent is forgotten: its session stops resolving and the bookkeeping
// no longer keeps the transcript alive.
const readSession = async (id) => (await routes.get('/api/dsh-rea-gate/state').fetch(
  new Request(`http://harness.test/api/dsh-rea-gate/state?session=${id}&checks=0`),
)).json()
assert.equal((await readSession('closed')).sessionKnown, true)
listedAgents.splice(listedAgents.indexOf(closed), 1)
agentsById.delete('closed')
onAgentDisposed({ agent: closed })
const disposed = await readSession('closed')
assert.equal(disposed.sessionKnown, false)
assert.equal(disposed.workspace, null)
const disposedToggle = await routes.get('/api/dsh-rea-gate/toggle').fetch(
  new Request('http://harness.test/api/dsh-rea-gate/toggle', {
    method: 'POST',
    body: JSON.stringify({ session: 'closed', open: true }),
  }),
)
assert.equal(disposedToggle.status, 404)
// The still-live session keeps its entry.
assert.equal((await readSession('open')).sessionKnown, true)
