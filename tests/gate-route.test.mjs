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

writeFileSync(stateFile, JSON.stringify({ default: false, workspaces: {} }))
const noWorkspace = createAgent('no-workspace')
const withWorkspace = createAgent('with-workspace', '/projects/workspace')

// A chip toggle in a session without a workspace applies to that session only.
const temporary = await toggle({ session: 'no-workspace', open: true })
assert.equal(temporary.status, 200)
const temporaryBody = await temporary.json()
assert.equal(temporaryBody.open, true)
assert.equal(temporaryBody.remembered, false)
assert.equal(temporaryBody.default, false)
assert.equal(readState().default, false)
assert.deepEqual(noWorkspace.ctx.visible(), toolNames)

const closedAgain = await toggle({ session: 'no-workspace', open: false })
assert.equal((await closedAgain.json()).open, false)
assert.deepEqual(noWorkspace.ctx.visible(), ['other_tool'])
assert.equal(readState().default, false)

// An explicit request to remember cannot succeed without a workspace.
const cannotRemember = await toggle({ session: 'no-workspace', open: true, remember: true })
assert.equal(cannotRemember.status, 400)
assert.match((await cannotRemember.json()).message, /no workspace directory/)
assert.deepEqual(noWorkspace.ctx.visible(), ['other_tool'])
assert.equal(readState().default, false)

// `remember: true` with a workspace saves the workspace rule and applies it.
const saved = await toggle({ session: 'with-workspace', open: true, remember: true })
assert.equal(saved.status, 200)
const savedBody = await saved.json()
assert.equal(savedBody.remembered, true)
assert.equal(readState().workspaces['/projects/workspace'], true)
assert.deepEqual(withWorkspace.ctx.visible(), toolNames)

// A temporary close leaves the saved workspace rule untouched.
const temporaryClose = await toggle({ session: 'with-workspace', open: false, remember: false })
assert.equal(temporaryClose.status, 200)
assert.equal((await temporaryClose.json()).remembered, false)
assert.equal(readState().workspaces['/projects/workspace'], true)
assert.deepEqual(withWorkspace.ctx.visible(), ['other_tool'])

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
assert.equal((await preToggle.json()).remembered, true)
assert.equal(readState().workspaces['/projects/pre-reload'], true)
assert.deepEqual(preReload.ctx.visible(), toolNames)

// The bare global control still changes the default.
const global = await toggle({ open: true })
assert.equal(global.status, 200)
assert.equal((await global.json()).default, true)
assert.equal(readState().default, true)

// Malformed or unauthenticated temporary requests stay rejected.
const invalidRemember = await toggle({ session: 'with-workspace', open: true, remember: 'yes' })
assert.equal(invalidRemember.status, 400)
const globalTemporary = await toggle({ open: true, remember: false })
assert.equal(globalTemporary.status, 400)
const unknownSession = await toggle({ session: 'missing', open: true })
assert.equal(unknownSession.status, 404)
