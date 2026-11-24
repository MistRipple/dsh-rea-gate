import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { apply } from '../index.js'

const root = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-rea-gate-workspace-test-')))
const stateFile = join(root, 'rea-gate.json')
process.env.DSH_HOME = root
process.env.REA_GATE_SKIP_DOCTOR = '1'
process.on('exit', () => rmSync(root, { recursive: true, force: true }))

const toolNames = ['mcp__rea__fixture', 'other_tool']
const saved = () => JSON.parse(readFileSync(stateFile, 'utf8'))
const writePolicy = (policy) => writeFileSync(stateFile, JSON.stringify(policy))
writePolicy({ default: false })

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

function makeHost(liveAgents) {
  const routes = new Map()
  let onAgentCreated
  const ctx = {
    tools: {
      schemas: (scope) => (scope?.ctx?.visible ? scope.ctx.visible() : toolNames),
      register: () => {},
    },
    on: (event, listener) => { if (event === 'agent/created') onAgentCreated = listener },
    effect: (effect) => effect(),
    inject: (services, callback) => {
      if (services.includes('agents')) {
        callback({
          effect: (effect) => effect(),
          agents: {
            list: () => [...liveAgents.values()],
            get: (id) => liveAgents.get(id),
          },
        })
        return
      }
      callback({
        effect: (effect) => effect(),
        connection: { fetch: { register: (route) => routes.set(route.path, route) } },
        get: () => undefined,
      })
    },
  }
  apply(ctx)
  const post = (body, headers) => routes.get('/api/dsh-rea-gate/toggle').fetch(
    new Request('http://harness.test/api/dsh-rea-gate/toggle', { method: 'POST', body: JSON.stringify(body), headers }),
  )
  const read = async (query) => (await routes.get('/api/dsh-rea-gate/state').fetch(
    new Request(`http://harness.test/api/dsh-rea-gate/state?${query}`),
  )).json()
  const create = (agent) => {
    liveAgents.set(agent.session.header.id, agent)
    onAgentCreated({ agent })
    return agent
  }
  return { post, read, create }
}

const live = new Map()
const host = makeHost(live)

const where = join(root, 'project')

// Every session has its own switch; the saved default only decides how a new one starts.
const first = host.create(makeAgent('first', where))
const second = host.create(makeAgent('second', where))
assert.deepEqual(first.ctx.visible(), ['other_tool'])
assert.deepEqual(second.ctx.visible(), ['other_tool'])

const chip = await host.post({ session: 'first', open: true })
assert.equal(chip.status, 200)
assert.deepEqual(first.ctx.visible(), toolNames)
assert.deepEqual(second.ctx.visible(), ['other_tool'], 'a session in the same directory is untouched')
assert.equal(saved().default, false, 'a session switch saves nothing')
assert.equal(saved().workspaces, undefined)

// The default governs new sessions only.
await host.post({ open: true })
assert.equal(saved().default, true)
assert.deepEqual(second.ctx.visible(), ['other_tool'], 'a running session keeps its switch')
assert.deepEqual(host.create(makeAgent('third', where)).ctx.visible(), toolNames)
await host.post({ open: false })
assert.deepEqual(host.create(makeAgent('fourth', where)).ctx.visible(), ['other_tool'])
assert.deepEqual(first.ctx.visible(), toolNames, 'turning the default off does not close a session that chose to open')

// A session's choice survives a plugin reload; the saved default does not override it.
writePolicy({ default: false })
const reloaded = new Map(live)
const reloadedHost = makeHost(reloaded) // a second instance, as after a plugin reload
assert.deepEqual(first.ctx.visible(), toolNames, 'the session choice is kept')
assert.deepEqual(second.ctx.visible(), ['other_tool'])
assert.equal((await reloadedHost.read('session=first&checks=0')).open, true)
assert.equal((await reloadedHost.read('session=second&checks=0')).open, false)

// Two agents reporting one session id: the first keeps the entry the switch controls.
const parent = host.create(makeAgent('shared', where))
const child = makeAgent('shared', where)
const createdChild = host.create(child)
live.set('shared', parent) // the host table still resolves the id to the parent
assert.equal(createdChild, child)
const shared = await host.post({ session: 'shared', open: true })
assert.equal(shared.status, 200)
assert.deepEqual(parent.ctx.visible(), toolNames)
assert.deepEqual(child.ctx.visible(), ['other_tool'], 'the sub-agent is gated but not what the switch toggled')

// Messages for the panel follow the browser's Accept-Language; everything else is English.
const bad = { action: 'set-env', values: { REA_APKTOOL_COMMAND: 'apktool' } }
assert.match((await (await host.post(bad, { 'accept-language': 'zh-CN,zh;q=0.9' })).json()).message, /必须是绝对路径/)
assert.match((await (await host.post(bad, { 'accept-language': 'en-US,en;q=0.9' })).json()).message, /must be an absolute path/)
assert.match((await (await host.post(bad)).json()).message, /must be an absolute path/)
