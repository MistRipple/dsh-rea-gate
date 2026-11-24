import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { apply } from '../index.js'

const root = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-rea-gate-workspace-test-')))
const stateFile = join(root, 'rea-gate.json')
process.env.DSH_HOME = root
process.env.REA_GATE_SKIP_DOCTOR = '1'
process.on('exit', () => rmSync(root, { recursive: true, force: true }))

// repo/ (a checkout), repo/sub, a symlink to it, and a git worktree of it.
const repo = join(root, 'repo')
const sub = join(repo, 'packages', 'app')
const link = join(root, 'repo-link')
const worktree = join(root, 'repo-wt')
const elsewhere = join(root, 'elsewhere')
mkdirSync(join(repo, '.git', 'worktrees', 'wt'), { recursive: true })
mkdirSync(sub, { recursive: true })
mkdirSync(worktree)
mkdirSync(elsewhere)
symlinkSync(repo, link)
writeFileSync(join(worktree, '.git'), `gitdir: ${join(repo, '.git', 'worktrees', 'wt')}\n`)

const toolNames = ['mcp__rea__fixture', 'other_tool']
const saved = () => JSON.parse(readFileSync(stateFile, 'utf8'))
const writePolicy = (policy) => writeFileSync(stateFile, JSON.stringify(policy))
// A rule saved with a trailing slash, as an older or hand-edited file might have.
writePolicy({ default: false, workspaces: { [`${repo}/`]: true } })

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

// One rule covers the directory, its subdirectories, symlinks to it and its git worktrees.
const inSub = host.create(makeAgent('sub', sub))
const inLink = host.create(makeAgent('link', link))
const inWorktree = host.create(makeAgent('worktree', worktree))
const inElsewhere = host.create(makeAgent('elsewhere', elsewhere))
for (const agent of [inSub, inLink, inWorktree]) assert.deepEqual(agent.ctx.visible(), toolNames, agent.session.header.id)
assert.deepEqual(inElsewhere.ctx.visible(), ['other_tool'])

const subState = await host.read('session=sub&checks=0')
assert.equal(subState.workspace, sub)
assert.equal(subState.ruleSource, repo, 'the subdirectory inherits the parent rule')
assert.equal((await host.read('session=worktree&checks=0')).workspace, repo, 'a worktree is keyed by its main checkout')
assert.equal((await host.read('session=link&checks=0')).workspace, repo, 'a symlink resolves to the real directory')
assert.deepEqual((await host.read('checks=0')).workspaces.map(({ path }) => path), [repo], 'saved keys are normalised')

// A rule changed from the panel reaches every live session below it.
const closeRepo = await host.post({ workspace: repo, open: false })
assert.equal(closeRepo.status, 200)
for (const agent of [inSub, inLink, inWorktree]) assert.deepEqual(agent.ctx.visible(), ['other_tool'])
assert.equal(saved().workspaces[repo], false)

// A chip toggle in one session carries to the others in that workspace.
const reopen = await host.post({ session: 'sub', open: true })
assert.equal(reopen.status, 200)
for (const agent of [inSub, inLink, inWorktree]) assert.deepEqual(agent.ctx.visible(), toolNames, agent.session.header.id)
assert.deepEqual(inElsewhere.ctx.visible(), ['other_tool'])

// A more specific rule wins over the parent's.
await host.post({ workspace: sub, open: false })
assert.deepEqual(inSub.ctx.visible(), ['other_tool'])
assert.deepEqual(inLink.ctx.visible(), toolNames)
// Resetting it hands the session back to the parent rule.
await host.post({ action: 'reset-workspace', workspace: sub })
assert.deepEqual(inSub.ctx.visible(), toolNames)

// The global default governs new sessions only; a running session keeps its tools.
await host.post({ open: true })
assert.equal(saved().default, true)
assert.deepEqual(inElsewhere.ctx.visible(), ['other_tool'])
await host.post({ open: false })

// A stale rule is flagged so the panel can offer to drop it.
const gone = join(root, 'deleted-project')
writePolicy({ default: false, workspaces: { [repo]: true, [gone]: true } })
const flagged = (await host.read('checks=0')).workspaces
assert.equal(flagged.find(({ path }) => path === gone).missing, true)
assert.equal(flagged.find(({ path }) => path === repo).missing, false)

// A session-only choice survives a plugin reload; a saved one follows the policy.
writePolicy({ default: false, workspaces: { [repo]: false } })
const temporary = host.create(makeAgent('temporary', repo))
assert.deepEqual(temporary.ctx.visible(), ['other_tool'])
await host.post({ session: 'temporary', open: true, remember: false })
assert.deepEqual(temporary.ctx.visible(), toolNames)
const reloaded = new Map(live)
const reloadedHost = makeHost(reloaded) // a second instance, as after a plugin reload
assert.deepEqual(temporary.ctx.visible(), toolNames, 'the temporary choice is kept')
assert.deepEqual(inSub.ctx.visible(), ['other_tool'], 'saved choices are re-read from the policy')
assert.equal((await reloadedHost.read('session=temporary&checks=0')).open, true)

// Two agents reporting one session id: the first keeps the entry the chip controls.
const parent = host.create(makeAgent('shared', elsewhere))
const child = makeAgent('shared', elsewhere)
const createdChild = host.create(child)
live.set('shared', parent) // the host table still resolves the id to the parent
assert.equal(createdChild, child)
const shared = await host.post({ session: 'shared', open: true, remember: false })
assert.equal(shared.status, 200)
assert.deepEqual(parent.ctx.visible(), toolNames)
assert.deepEqual(child.ctx.visible(), ['other_tool'], 'the sub-agent is gated but not what the chip toggled')

// Messages for the panel follow the browser's Accept-Language; everything else is English.
const bad = { action: 'set-env', values: { REA_APKTOOL_COMMAND: 'apktool' } }
assert.match((await (await host.post(bad, { 'accept-language': 'zh-CN,zh;q=0.9' })).json()).message, /必须是绝对路径/)
assert.match((await (await host.post(bad, { 'accept-language': 'en-US,en;q=0.9' })).json()).message, /must be an absolute path/)
assert.match((await (await host.post(bad)).json()).message, /must be an absolute path/)
