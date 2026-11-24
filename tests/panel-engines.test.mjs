import assert from 'node:assert/strict'

import { findButton, findElement, mountClient, text } from './client-fixture.mjs'

const jadxSha = '6e5eacf500b64292bfb73c49797c1958f6ee44646e43e868039ae7feb573ff75'
const jadxJarUrl = 'https://github.com/1013503897/jadx-headless-mcp/releases/download/v0.7.1/jadx-headless-mcp-0.7.1-all.jar'

const posts = []
let pickAnswer = { ok: true, json: async () => ({ ok: true, path: '/picked/jadx.jar' }) }
let state = {
  installed: true,
  cli: 'available',
  version: '6.10.1',
  registeredTools: 263,
  checkedAt: Date.now(),
  default: false,
  registration: { state: 'aligned', path: '/Users/example/.dsh/cordis.patch.yml' },
  capabilities: { homebrew: true },
  workspaces: [{ path: '/Users/example/code/sample-app', open: true }],
  engines: [
    {
      id: 'ghidra',
      checked: true,
      configured: true,
      available: true,
      version: '12.2',
      canInstall: true,
      installCommand: 'brew install ghidra',
      variables: [
        { name: 'GHIDRA_INSTALL_DIR', set: true, value: '/opt/homebrew/opt/ghidra/libexec' },
        { name: 'JAVA_HOME', set: true, value: '/opt/homebrew/opt/openjdk@25/libexec/openjdk.jdk/Contents/Home' },
      ],
      checks: [{ name: 'configuration', ok: true, detail: '12.2', remediation: null }],
    },
    {
      id: 'ida',
      checked: true,
      configured: true,
      available: false,
      version: null,
      canInstall: false,
      variables: [{ name: 'REA_IDA_MCP_CONFIG', set: true, value: null, fromHostEnv: true }],
      checks: [{
        name: 'registration',
        ok: false,
        detail: 'IDA MCP server did not respond.',
        remediation: 'Verify REA_IDA_MCP_CONFIG points to a valid registration JSON.',
      }],
    },
    {
      id: 'jadx',
      checked: true,
      configured: false,
      available: false,
      version: null,
      canInstall: false,
      variables: [
        { name: 'REA_JADX_MCP_JAR', set: false, value: null },
        { name: 'JAVA_HOME', set: true, value: '/opt/homebrew/opt/openjdk@25/libexec/openjdk.jdk/Contents/Home' },
      ],
      checks: [{
        name: 'configuration',
        ok: false,
        detail: `Download the jadx-headless-mcp 0.7.1 release JAR from ${jadxJarUrl}, verify SHA-256 ${jadxSha}, and set REA_JADX_MCP_JAR to its absolute path.`,
        remediation: `Download the jadx-headless-mcp 0.7.1 release JAR from ${jadxJarUrl}, verify SHA-256 ${jadxSha}, and set REA_JADX_MCP_JAR to its absolute path.`,
      }],
    },
    {
      id: 'apktool',
      checked: true,
      configured: false,
      available: false,
      version: null,
      canInstall: true,
      installCommand: 'brew install apktool',
      variables: [{ name: 'REA_APKTOOL_COMMAND', set: false, value: null }],
      checks: [],
    },
    {
      id: 'kuna',
      checked: false,
      configured: true,
      available: false,
      verdict: 'none',
      canInstall: false,
      variables: [{ name: 'REA_KUNA_COMMAND', set: true, value: 'C:\\\\tools\\\\kuna.exe' }],
      checks: [],
    },
    {
      id: 'hopper',
      checked: true,
      configured: false,
      available: false,
      canInstall: false,
      variables: [{ name: 'HOPPER_LAUNCHER_PATH', set: false, value: null }],
      checks: [{ name: 'hopper', ok: false, remediation: 'Run rea setup to install Hopper, or set HOPPER_LAUNCHER_PATH.' }],
    },
  ],
}

let fetchCount = 0
globalThis.fetch = async (_url, init) => {
  fetchCount++
  if (init?.method === 'POST') {
    const body = JSON.parse(init.body)
    posts.push(body)
    if (body.action === 'install-engine' && body.engine === 'apktool') {
      state = {
        ...state,
        engines: state.engines.map((engine) => engine.id === 'apktool'
          ? {
            ...engine,
            configured: true,
            available: true,
            variables: [{ name: 'REA_APKTOOL_COMMAND', set: true, value: '/opt/homebrew/bin/apktool' }],
            checks: [{ name: 'apktool', ok: true, detail: '/opt/homebrew/bin/apktool', remediation: null }],
          }
          : engine),
      }
      return { ok: true, json: async () => ({ ...state, ok: true, message: 'installed apktool' }) }
    }
    if (body.action === 'pick-path') {
      return pickAnswer
    }
    if (body.action === 'set-env') {
      const [key, value] = Object.entries(body.values)[0]
      state = {
        ...state,
        engines: state.engines.map((engine) => ({
          ...engine,
          variables: engine.variables.map((v) => v.name === key
            ? { ...v, set: Boolean(value), value: value || null }
            : v),
        })),
      }
      return { ok: true, json: async () => ({ ...state, ok: true, message: '' }) }
    }
  }
  return { ok: true, json: async () => state }
}

const { render } = mountClient()
const initial = await render('main')

// Overview shows loaded tool count and version.
assert.match(text(initial), /REA 6\.10\.1 DSH 已注册 宿主已加载 263 个工具/)

// Ready engine (Ghidra) starts collapsed and shows its detected version badge.
const ghidraTrigger = findButton(initial, 'Ghidra')
assert.equal(ghidraTrigger.props['aria-expanded'], false)
assert.match(text(ghidraTrigger), /12\.2/)
assert.match(text(ghidraTrigger), /可用/)

// Attention engine (IDA: configured but unavailable) auto-expands so users immediately see the diagnostic.
const idaTrigger = findButton(initial, 'IDA')
assert.equal(idaTrigger.props['aria-expanded'], true)
assert.match(text(initial), /异常诊断（rea doctor）/)
assert.match(text(initial), /Verify REA_IDA_MCP_CONFIG/)

// Unconfigured engine (jadx) starts collapsed, keeping long URLs and SHA-256 out of the main list.
const jadxTrigger = findButton(initial, 'jadx')
assert.equal(jadxTrigger.props['aria-expanded'], false)
assert.ok(!text(initial).includes(jadxSha))

// Expanding jadx shows structured setup guidance, clickable JAR link, and copyable SHA-256 chip.
jadxTrigger.props.onClick()
const withJadx = await render('main')
assert.equal(findButton(withJadx, 'jadx').props['aria-expanded'], true)
assert.ok(findElement(withJadx, ({ type, props }) => type === 'a' && props.href === jadxJarUrl))
assert.ok(findButton(withJadx, '复制 SHA-256'))
assert.match(text(withJadx), /SHA-256: 6e5eacf5/)

// A saved path nobody has judged yet says why, and offers a re-check.
const kunaRow = findButton(await render('main'), 'Kuna')
assert.match(text(kunaRow), /已配置，待验证/)
kunaRow.props.onClick()
const withKuna = await render('main')
assert.match(text(withKuna), /REA 的检测结果里没有这个引擎/)
const rechecksBefore = fetchCount
await findButton(withKuna, '重新检测').props.onClick()
assert.ok(fetchCount > rechecksBefore, 'the row offers its own re-check')
// Once a path-only verdict arrives it is not shown as REA's "available".
state = {
  ...state,
  engines: state.engines.map((engine) => engine.id === 'kuna'
    ? { ...engine, checked: true, available: true, verdict: 'path', checks: [{ name: 'kuna', ok: true, detail: 'C:\\\\tools\\\\kuna.exe', remediation: null }] }
    : engine),
}
await findButton(await render('main'), '重新检测').props.onClick()
const kunaPathOnly = findButton(await render('main'), 'Kuna')
assert.match(text(kunaPathOnly), /路径有效/)
assert.doesNotMatch(text(kunaPathOnly), /可用/)

// A saved path the DSH registration does not carry is called out, even when the check passed.
const syncedState = state
state = {
  ...state,
  envSync: { problems: [{ name: 'REA_JADX_MCP_JAR', state: 'missing' }] },
  engines: state.engines.map((engine) => engine.id === 'jadx'
    ? { ...engine, variables: engine.variables.map((variable) => ({ ...variable, value: '/x/jadx.jar', set: true, sync: 'missing' })) }
    : engine),
}
await findButton(await render('main'), '重新检测').props.onClick()
const unsynced = await render('main')
assert.match(text(unsynced), /以下路径已保存，但 DSH 的 REA 注册里没有对应的值：REA_JADX_MCP_JAR/)
assert.match(text(findElement(unsynced, ({ type, props }) => type === 'div' && props['data-tone'] === 'attention' && props.role === 'status')), /重新注册到 DSH/)
await findButton(unsynced, '重新注册到 DSH').props.onClick()
assert.deepEqual(posts.at(-1), { action: 'install' })
state = syncedState
await findButton(await render('main'), '重新检测').props.onClick()
assert.doesNotMatch(text(await render('main')), /DSH 的 REA 注册里没有对应的值/)

// Section meta summarizes readiness without extra filter tabs.
assert.match(text(withJadx), /可用 1 \/ 7 · 需检查 1/)
assert.equal(findButton(withJadx, '全部 7'), undefined)

// Inline path editor saves a custom path for jadx.
const jadxInput = findElement(withJadx, ({ type, props }) => type === 'input' && props['aria-label'] === 'REA_JADX_MCP_JAR 路径')
assert.ok(jadxInput)
jadxInput.props.onChange({ target: { value: '/tools/jadx-headless-mcp.jar' } })
await findButton(await render('main'), '保存 REA_JADX_MCP_JAR').props.onClick()
assert.deepEqual(posts.at(-1), { action: 'set-env', values: { REA_JADX_MCP_JAR: '/tools/jadx-headless-mcp.jar' } })
assert.ok(findButton(await render('main'), '清除 REA_JADX_MCP_JAR'))

// The browse button: files use the host dialog, folders prefer DSH's own native chooser, and a failure is shown inline.
const pathInput = (tree, name) => findElement(tree, ({ type, props }) => type === 'input' && props['aria-label'] === `${name} 路径`)
await findButton(await render('main'), '选择 REA_JADX_MCP_JAR').props.onClick()
assert.deepEqual(posts.at(-1), { action: 'pick-path', kind: 'file', lang: 'zh' })
assert.equal(pathInput(await render('main'), 'REA_JADX_MCP_JAR').props.value, '/picked/jadx.jar', 'the chosen path fills the field and is not saved yet')
assert.notDeepEqual(posts.at(-1).action, 'set-env')
pickAnswer = { ok: true, json: async () => ({ ok: true, path: null }) }
await findButton(await render('main'), '选择 REA_JADX_MCP_JAR').props.onClick()
assert.equal(pathInput(await render('main'), 'REA_JADX_MCP_JAR').props.value, '/picked/jadx.jar', 'cancelling keeps what was typed')
pickAnswer = { ok: false, json: async () => ({ ok: false, message: 'No file dialog is available.' }) }
await findButton(await render('main'), '选择 REA_JADX_MCP_JAR').props.onClick()
assert.match(text(await render('main')), /No file dialog is available\./)
// A host that predates the action refuses it generically; say what to do instead of showing that.
pickAnswer = { ok: false, json: async () => ({ ok: false, message: 'Expected an open/closed choice.' }) }
await findButton(await render('main'), '选择 REA_JADX_MCP_JAR').props.onClick()
assert.match(text(await render('main')), /宿主端还是旧版本/)
assert.doesNotMatch(text(await render('main')), /Expected an open\/closed choice/)
findButton(await render('main'), 'Ghidra').props.onClick()
const nativeCalls = []
globalThis.__DSH_DIRECTORY_PICKER__ = { pick: async () => { nativeCalls.push('pick'); return 'C:\\tools\\ghidra' } }
const postsBefore = posts.length
await findButton(await render('main'), '选择 GHIDRA_INSTALL_DIR').props.onClick()
assert.equal(nativeCalls.length, 1)
assert.equal(posts.length, postsBefore, 'a folder picked natively needs no host round trip')
assert.equal(pathInput(await render('main'), 'GHIDRA_INSTALL_DIR').props.value, 'C:\\tools\\ghidra')
delete globalThis.__DSH_DIRECTORY_PICKER__
await findButton(await render('main'), '选择 GHIDRA_INSTALL_DIR').props.onClick()
assert.deepEqual(posts.at(-1), { action: 'pick-path', kind: 'dir', lang: 'zh' }, 'without the native chooser the host dialog is used')

// One-click install works inside the expanded detail panel for supported open-source engines.
findButton(await render('main'), 'apktool').props.onClick()
const withApktool = await render('main')
const installApktool = findButton(withApktool, '一键安装 apktool')
assert.ok(installApktool)
await installApktool.props.onClick()
assert.deepEqual(posts.at(-1), { action: 'install-engine', engine: 'apktool' })
const afterInstall = await render('main')
assert.equal(findButton(afterInstall, '一键安装 apktool'), undefined)
assert.match(text(afterInstall), /\/opt\/homebrew\/bin\/apktool/)

// Advanced diagnostics exposes the DSH registration path when expanded.
findButton(afterInstall, '高级诊断').props.onClick()
const withDiag = await render('main')
assert.match(text(withDiag), /\/Users\/example\/\.dsh\/cordis\.patch\.yml/)
assert.ok(findButton(withDiag, '复制 DSH 配置路径'))
