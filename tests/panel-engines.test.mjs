import assert from 'node:assert/strict'

import { findButton, findElement, mountClient, text } from './client-fixture.mjs'

const jadxSha = '6e5eacf500b64292bfb73c49797c1958f6ee44646e43e868039ae7feb573ff75'
const jadxJarUrl = 'https://github.com/1013503897/jadx-headless-mcp/releases/download/v0.7.1/jadx-headless-mcp-0.7.1-all.jar'

const posts = []
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

globalThis.fetch = async (_url, init) => {
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

// Section meta summarizes readiness without extra filter tabs.
assert.match(text(withJadx), /可用 1 \/ 6 · 需检查 1/)
assert.equal(findButton(withJadx, '全部 6'), undefined)

// Inline path editor saves a custom path for jadx.
const jadxInput = findElement(withJadx, ({ type, props }) => type === 'input' && props['aria-label'] === 'REA_JADX_MCP_JAR 路径')
assert.ok(jadxInput)
jadxInput.props.onChange({ target: { value: '/tools/jadx-headless-mcp.jar' } })
await findButton(await render('main'), '保存 REA_JADX_MCP_JAR').props.onClick()
assert.deepEqual(posts.at(-1), { action: 'set-env', values: { REA_JADX_MCP_JAR: '/tools/jadx-headless-mcp.jar' } })
assert.ok(findButton(await render('main'), '清除 REA_JADX_MCP_JAR'))

// One-click Homebrew install works inside the expanded detail panel for supported open-source engines.
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
