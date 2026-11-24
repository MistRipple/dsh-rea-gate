import assert from 'node:assert/strict'

import { findButton, findElement, mountClient, text } from './client-fixture.mjs'

// Every string the panel can show must have an English form: render the panel,
// chip and dialog in an English browser across the states that change the copy,
// and fail on any Chinese character that reaches the page.
const CJK = /[一-鿿　-〿＀-￯]/

function strings(node, out = []) {
  if (Array.isArray(node)) {
    for (const child of node) strings(child, out)
    return out
  }
  if (typeof node === 'string') out.push(node)
  else if (node?.props) {
    for (const [key, value] of Object.entries(node.props)) {
      if (key !== 'children' && typeof value === 'string') out.push(value)
    }
    if (node.type !== 'style') strings(node.props.children, out)
  }
  return out
}

const engine = (id, extra) => ({
  id, checked: true, configured: false, available: false, version: null, canInstall: true,
  installCommand: `brew install ${id}`, variables: [{ name: 'JAVA_HOME', set: false, value: null }], checks: [], ...extra,
})
const baseState = () => ({
  installed: true, cli: 'available', version: '6.10.1', registeredTools: 263, tools: 263, checkedAt: Date.now(),
  checks: 'pending', default: false, open: true, exposed: false, sessionKnown: true, workspace: '/p',
  registration: { state: 'aligned', healthy: true, path: '/Users/example/.dsh/cordis.patch.yml' },
  capabilities: { homebrew: true },
  workspaces: [{ path: '/p/open', open: true, missing: false }, { path: '/p/gone', open: false, missing: true }],
  engines: [
    engine('ghidra', { available: true, configured: true, version: '12.2', checks: [{ name: 'c', ok: true, detail: '12.2' }] }),
    engine('ida', { configured: true, checks: [{ name: 'c', ok: false, detail: 'IDA did not respond.', remediation: 'Check REA_IDA_MCP_CONFIG.' }] }),
    engine('java'), engine('jadx'), engine('apktool'), engine('adb'), engine('hopper'), engine('kuna'),
  ],
})

let state = baseState()
let latest = '7.0.0'
globalThis.fetch = async (_url, init) => {
  if (init?.method === 'POST') {
    const body = JSON.parse(init.body)
    if (body.action === 'check-update') return { ok: true, json: async () => ({ latest }) }
    return { ok: true, json: async () => ({ ...state, ok: true, message: '' }) }
  }
  return { ok: true, json: async () => state }
}

const { render } = mountClient({ locale: 'en-US' })
const seen = []
const check = async (name, props) => {
  const tree = await render(name, props)
  seen.push(...strings(tree))
  return tree
}

// Healthy install: expand every disclosure and engine row, then ask for updates.
let tree = await check('main')
for (const label of ['Ghidra', 'IDA', 'Java (JDK)', 'jadx', 'apktool', 'adb', 'Hopper', 'Kuna', 'REA session examples', 'Advanced diagnostics']) {
  const button = findButton(tree, label)
  assert.ok(button, `no button for ${label}`)
  if (button.props['aria-expanded'] !== true) await button.props.onClick()
  tree = await check('main')
}
await findButton(tree, 'Check for updates').props.onClick()
tree = await check('main')
assert.match(text(tree), /Stable npm version 7\.0\.0 found/)
await findButton(tree, 'Check module graph')?.props.onClick()
await check('main')

// Other lifecycle states change the copy: newer local build, stale registration, nothing installed.
latest = '6.0.0'
state = { ...baseState(), checks: 'done', registration: { state: 'stale', healthy: false, path: null } }
tree = await check('main')
state = { ...baseState(), checks: 'done', installed: false, cli: 'missing', version: null, registeredTools: 0, registration: null, workspaces: [] }
tree = await check('main')
state = { ...baseState(), checks: 'done', installed: false, cli: 'available', registration: { state: 'missing', healthy: false } }
tree = await check('main')
state = { ...baseState(), checks: 'done', cli: 'unavailable', version: null, registeredTools: 0 }
await check('main')

// The uninstall dialog.
state = { ...baseState(), checks: 'done' }
tree = await check('main')
await findButton(tree, 'Remove integration').props.onClick()
await check('main')

// The session chip in each of its states.
for (const patch of [{}, { open: false }, { open: false, exposed: true, tools: 3 }, { installed: false, registeredTools: 0 }]) {
  state = { ...baseState(), ...patch }
  const chip = await check('conversation.input.left', { sessionId: 'sess' })
  assert.ok(findElement(chip, ({ props }) => props?.onClick), 'the chip renders a control')
}

const leaked = [...new Set(seen.filter((value) => CJK.test(value)))]
assert.deepEqual(leaked, [], `Chinese text reached the English page:\n${leaked.join('\n')}`)
assert.ok(seen.includes('REA management') && seen.includes('Status and updates'))
