import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apply, inject } from '../index.js'

import { findButton, findElement, mountClient, text } from './client-fixture.mjs'

const openWorkspace = '/projects/open'
const closedWorkspace = '/projects/closed'
const stateDirectory = mkdtempSync(join(tmpdir(), 'dsh-rea-gate-test-'))
const stateFile = join(stateDirectory, 'rea-gate.json')
process.env.DSH_HOME = stateDirectory
process.env.REA_GATE_SKIP_DOCTOR = '1'
process.env.REA_IDA_MCP_CONFIG = '/test-config/ida.json'
delete process.env.GHIDRA_INSTALL_DIR
delete process.env.JAVA_HOME
process.on('exit', () => rmSync(stateDirectory, { recursive: true, force: true }))
writeFileSync(stateFile, JSON.stringify({ default: false, workspaces: { [openWorkspace]: true, [closedWorkspace]: false } }))

const routes = new Map()
const toolNames = ['mcp__rea__fixture', 'other_tool']
let onAgentCreated
let gateTool
const ctx = {
  tools: {
    schemas: (scope) => scope?.ctx?.visibleTools ?? toolNames,
    register: (tool) => { gateTool = tool },
  },
  on: (event, listener) => {
    assert.equal(event, 'agent/created')
    onAgentCreated = listener
  },
  effect: (effect) => effect(),
  inject: (services, callback) => {
    assert.deepEqual(services, ['connection'])
    callback({
      effect: (effect) => effect(),
      connection: { fetch: { register: (route) => routes.set(route.path, route) } },
      get: (service) => service === 'clientModules'
        ? { graph: () => ({ rev: 1, entries: [{ id: 'dsh-rea-gate' }] }) }
        : undefined,
    })
  },
}
assert.deepEqual(inject, ['tools'])
apply(ctx)

const createAgent = (id, cwd) => {
  const scope = {
    visibleTools: toolNames,
    tools: {
      restrict: ({ deny }) => {
        scope.visibleTools = toolNames.filter((tool) => !deny.includes(tool))
        return () => { scope.visibleTools = toolNames }
      },
    },
  }
  const agent = { ctx: scope, session: { header: { id, cwd } } }
  onAgentCreated({ agent })
  return agent
}
const closedAgent = createAgent('closed', closedWorkspace)
const active = createAgent('active', openWorkspace)
assert.deepEqual(closedAgent.ctx.visibleTools, ['other_tool'])
assert.equal(gateTool.name, 'rea_gate')
const status = await gateTool.execute({ action: 'status' }, { agent: closedAgent })
assert.match(status, /hidden in this session/)
assert.match(status, /REA tools visible in this session: 0\./)

const requests = []
const posts = []
let rejectPreference = false
globalThis.fetch = async (url, init) => {
  const request = new Request(new URL(url, 'http://harness.test'), init)
  const { pathname } = new URL(request.url)
  requests.push({ path: pathname, method: request.method })
  if (init?.method === 'POST') {
    const body = JSON.parse(init.body)
    posts.push(body)
    if (rejectPreference && Object.hasOwn(body, 'open')) {
      return Response.json({ ok: false, message: 'Could not save the REA gate preference.' }, { status: 500 })
    }
  }
  return routes.get(pathname)?.fetch(request) ?? new Response(null, { status: 404 })
}

const { render, slots } = mountClient()

const configSlot = 'plugins.bundle.config'
assert.equal(slots.get(configSlot).options.key, 'dsh-rea-gate')
assert.equal(await render(configSlot, { view: 'summary' }), null)
const renderConfig = () => render(configSlot, { view: 'page' })
const tree = await renderConfig()
assert.equal(findButton(tree, '新会话默认启用 REA').props['aria-checked'], false)
// Remembered workspaces are shown in Session Settings with individual switches and reset buttons.
assert.ok(text(tree).includes(openWorkspace))
assert.ok(text(tree).includes(closedWorkspace))
assert.equal(findButton(tree, `工作区 ${openWorkspace} 启用 REA`).props['aria-checked'], true)
assert.equal(findButton(tree, `工作区 ${closedWorkspace} 启用 REA`).props['aria-checked'], false)
assert.ok(findButton(tree, `重置工作区 ${openWorkspace}`))
assert.ok(findButton(tree, '检查更新'))
assert.equal(findButton(tree, '更新 REA'), undefined)
assert.equal(findElement(tree, ({ type, props }) => type === 'details' || type === 'dialog' || props.popover), undefined)
assert.match(text(tree), /宿主已加载 1 个工具/)
assert.match(text(tree), /分析引擎与依赖 .*Ghidra .*待验证/)
assert.match(text(tree), /Java \(JDK\) .*待验证/)
assert.match(text(tree), /IDA .*已配置，待验证/)
assert.ok(!text(tree).includes('/test-config/ida.json'))

function* elements(node) {
  if (Array.isArray(node)) {
    for (const child of node) yield* elements(child)
  } else if (node?.props) {
    yield node
    yield* elements(node.props.children)
  }
}

// Idle engines start collapsed so raw env vars and upstream links do not clutter the list.
assert.equal(findButton(tree, 'Ghidra').props['aria-expanded'], false)
assert.equal(findElement(tree, ({ type, props }) => type === 'ul' && props['aria-label'] === 'Ghidra 环境变量'), undefined)

// Expanding an engine reveals its setup guide, env var chips, and official links.
for (const name of ['Ghidra', 'Hopper', 'IDA', 'Kuna', 'jadx', 'apktool', 'adb', 'Java (JDK)']) {
  findButton(await renderConfig(), name).props.onClick()
}
const expandedTree = await renderConfig()
assert.equal(findButton(expandedTree, 'Ghidra').props['aria-expanded'], true)
const ghidraVariables = findElement(expandedTree, ({ type, props }) => type === 'ul' && props['aria-label'] === 'Ghidra 环境变量')
assert.match(text(ghidraVariables), /GHIDRA_INSTALL_DIR .*未设置/)
assert.ok(!text(ghidraVariables).includes('HOPPER_LAUNCHER_PATH'))
assert.ok(findButton(expandedTree, '复制环境变量 GHIDRA_INSTALL_DIR'))

const links = [...elements(expandedTree)]
  .filter(({ type, props }) => type === 'a' && String(props.className ?? '').includes('rea-download'))
  .map(({ props }) => props)
assert.deepEqual(links.map(({ href }) => href), [
  'https://rea.tools/get-started/',
  'https://github.com/NationalSecurityAgency/ghidra/releases',
  'https://www.hopperapp.com/download.html',
  'https://hex-rays.com/ida-free',
  'https://github.com/morluto/rea/blob/main/docs/providers/ida-provider.md',
  'https://github.com/Noelo-Lab/kuna/releases',
  'https://github.com/1013503897/jadx-headless-mcp/releases',
  'https://apktool.org/docs/install/',
  'https://developer.android.com/tools/releases/platform-tools',
  'https://adoptium.net/temurin/releases/',
  'https://github.com/morluto/rea',
])
assert.ok(links.every(({ target, rel }) => target === '_blank' && rel === 'noopener noreferrer'))

// Usage guide starts collapsed and expands on click.
assert.equal(findButton(expandedTree, 'REA 会话示例').props['aria-expanded'], false)
findButton(expandedTree, 'REA 会话示例').props.onClick()
const withUsage = await renderConfig()
assert.match(text(withUsage), /REA 会话示例 .*Electron .*\.NET/)
assert.ok(findButton(withUsage, '复制示例：'))

// Toggle workspace directly from the Session Settings UI.
await findButton(await renderConfig(), `工作区 ${openWorkspace} 启用 REA`).props.onClick()
assert.deepEqual(posts, [{ workspace: openWorkspace, open: false }])
assert.equal(findButton(await renderConfig(), `工作区 ${openWorkspace} 启用 REA`).props['aria-checked'], false)
assert.deepEqual(JSON.parse(readFileSync(stateFile, 'utf8')), {
  default: false,
  workspaces: { [openWorkspace]: false, [closedWorkspace]: false },
})
assert.deepEqual(active.ctx.visibleTools, toolNames)
assert.deepEqual(createAgent('new', openWorkspace).ctx.visibleTools, ['other_tool'])

const session = await (await fetch('api/dsh-rea-gate/state?session=active')).json()
assert.equal(session.open, true)
assert.equal(session.tools, 1)
const closed = await (await fetch('api/dsh-rea-gate/state?session=closed')).json()
assert.equal(closed.installed, true)
assert.equal(closed.registeredTools, 1)
assert.equal(closed.tools, 0)

await gateTool.execute({ action: 'on' }, { agent: closedAgent })
assert.deepEqual(closedAgent.ctx.visibleTools, toolNames)
assert.equal(JSON.parse(readFileSync(stateFile, 'utf8')).workspaces[closedWorkspace], true)
const sessionToggle = await fetch('api/dsh-rea-gate/toggle', {
  method: 'POST', body: JSON.stringify({ session: 'closed', open: false }),
})
assert.equal((await sessionToggle.json()).open, false)
assert.deepEqual(closedAgent.ctx.visibleTools, ['other_tool'])

const temporary = await fetch('api/dsh-rea-gate/toggle', {
  method: 'POST', body: JSON.stringify({ session: 'closed', open: true, remember: false }),
})
assert.equal((await temporary.json()).remembered, false)
assert.deepEqual(closedAgent.ctx.visibleTools, toolNames)
assert.equal(JSON.parse(readFileSync(stateFile, 'utf8')).workspaces[closedWorkspace], false)
assert.deepEqual(createAgent('another', closedWorkspace).ctx.visibleTools, ['other_tool'])
await gateTool.execute({ action: 'off', remember: false }, { agent: closedAgent })
assert.deepEqual(closedAgent.ctx.visibleTools, ['other_tool'])

const beforeRefresh = requests.length
await findButton(await renderConfig(), '重新检测').props.onClick()
assert.deepEqual(requests.slice(beforeRefresh), [{ path: '/api/dsh-rea-gate/state', method: 'GET' }])
await findButton(await renderConfig(), '新会话默认启用 REA').props.onClick()
assert.deepEqual(posts.at(-1), { open: true })
assert.equal(findButton(await renderConfig(), '新会话默认启用 REA').props['aria-checked'], true)
assert.match(text(await renderConfig()), /新会话默认启用 REA .*已保存/)
rejectPreference = true
await findButton(await renderConfig(), '新会话默认启用 REA').props.onClick()
const failedPreference = await renderConfig()
assert.equal(findButton(failedPreference, '新会话默认启用 REA').props['aria-checked'], true)
assert.match(text(failedPreference), /无法保存会话默认设置/)
rejectPreference = false
await findButton(await renderConfig(), `重置工作区 ${openWorkspace}`).props.onClick()
assert.ok(!text(await renderConfig()).includes(openWorkspace))
assert.deepEqual(createAgent('inherited', openWorkspace).ctx.visibleTools, toolNames)
await findButton(await renderConfig(), `重置工作区 ${closedWorkspace}`).props.onClick()
assert.match(text(await renderConfig()), /暂无工作区独立规则/)

const diagnosis = await (await fetch('api/dsh-rea-gate/diagnose')).json()
assert.deepEqual(diagnosis.graph, { rev: 1, selfPresent: true })
assert.equal(findButton(await renderConfig(), '检查模块图'), undefined)
findButton(await renderConfig(), '高级诊断').props.onClick()
await findButton(await renderConfig(), '检查模块图').props.onClick()
assert.match(text(await renderConfig()), /模块已加入图（1）/)
const unknownSession = await fetch('api/dsh-rea-gate/toggle', {
  method: 'POST', body: JSON.stringify({ session: 'unknown', open: false }),
})
assert.equal(unknownSession.status, 404)
assert.equal(JSON.parse(readFileSync(stateFile, 'utf8')).default, true)

// Engine env persistence via host route: trims quotes, persists in rea-gate.json, and clears cleanly.
const savedEnvRes = await fetch('api/dsh-rea-gate/toggle', {
  method: 'POST',
  body: JSON.stringify({ action: 'set-env', values: { GHIDRA_INSTALL_DIR: ' "/opt/homebrew/opt/ghidra/libexec" ' } }),
})
assert.equal(savedEnvRes.status, 200)
const savedEnvBody = await savedEnvRes.json()
assert.equal(savedEnvBody.engines.find(({ id }) => id === 'ghidra').variables[0].value, '/opt/homebrew/opt/ghidra/libexec')
assert.equal(JSON.parse(readFileSync(stateFile, 'utf8')).env.GHIDRA_INSTALL_DIR, '/opt/homebrew/opt/ghidra/libexec')

const badEnvRes = await fetch('api/dsh-rea-gate/toggle', {
  method: 'POST',
  body: JSON.stringify({ action: 'set-env', values: { NOT_ALLOWED_VAR: '1' } }),
})
assert.equal(badEnvRes.status, 400)

const badInstallerRes = await fetch('api/dsh-rea-gate/toggle', {
  method: 'POST',
  body: JSON.stringify({ action: 'install-engine', engine: 'ida' }),
})
assert.equal(badInstallerRes.status, 409)

const clearEnvRes = await fetch('api/dsh-rea-gate/toggle', {
  method: 'POST',
  body: JSON.stringify({ action: 'set-env', values: { GHIDRA_INSTALL_DIR: '' } }),
})
assert.equal(clearEnvRes.status, 200)
assert.equal(JSON.parse(readFileSync(stateFile, 'utf8')).env, undefined)

assert.equal(slots.get('sidebar.panellist').component({ size: 16 }).type, 'svg')
