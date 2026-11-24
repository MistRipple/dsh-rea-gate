import assert from 'node:assert/strict'

import { findButton, mountClient } from './client-fixture.mjs'

let state = { installed: true, open: false, tools: 263, workspace: '/Users/example/code/dsh-rea-gate' }
const posts = []
globalThis.fetch = async (url, init) => {
  if (init?.method === 'POST') {
    const body = JSON.parse(init.body)
    posts.push({ url, body })
    state = { ...state, open: body.open === true }
    return { ok: true, json: async () => state }
  }
  return { ok: true, json: async () => state }
}

// The chip polls so a decision made from the panel or the `rea_gate` tool shows
// up here too. Capture that timer instead of waiting five seconds.
const pollTimers = []
const realSetTimeout = globalThis.setTimeout
globalThis.setTimeout = (callback, delay, ...rest) => {
  if (delay === 5_000) {
    pollTimers.push(callback)
    return { unref() {} }
  }
  return realSetTimeout(callback, delay, ...rest)
}

const { render, slots } = mountClient()

const SLOT = 'conversation.input.left'
const tree = await render(SLOT, { sessionId: 'sess-1' })
const trigger = findButton(tree, 'REA 关')
assert.ok(trigger)
assert.equal(trigger.props['aria-haspopup'], 'listbox')
assert.equal(trigger.props['aria-expanded'], false)
assert.equal(posts.length, 0, 'opening the menu changes nothing')
await trigger.props.onClick()
const menu = await render(SLOT, { sessionId: 'sess-1' })
assert.equal(findButton(menu, '开启 REA').props['aria-selected'] ?? false, false)
assert.equal(findButton(menu, '关闭 REA').props['aria-selected'], true)
await findButton(menu, '开启 REA').props.onClick()
assert.deepEqual(posts.map(({ body }) => body), [{ session: 'sess-1', open: true }], 'a choice changes this session only')
assert.ok(findButton(await render(SLOT, { sessionId: 'sess-1' }), 'REA 开'))
assert.equal(findButton(await render(SLOT, { sessionId: 'sess-1' }), '开启 REA'), undefined, 'the menu closes after a choice')

// Choosing the state the session is already in sends nothing.
await findButton(await render(SLOT, { sessionId: 'sess-1' }), 'REA 开').props.onClick()
await findButton(await render(SLOT, { sessionId: 'sess-1' }), '开启 REA').props.onClick()
assert.equal(posts.length, 1)

// The control lives in the composer tool row, not the session header.
assert.equal(slots.has('conversation.session.header.actions'), false)
assert.equal(slots.get(SLOT).options.name, 'conversation.input.left')
assert.equal(slots.get(SLOT).options.inject('sess-9').sessionId, 'sess-9')

// Not installed: the control is visible but disabled, and installing stays in the panel.
const live = state
state = { ...state, installed: false }
await pollTimers.at(-1)()
const uninstalled = findButton(await render(SLOT, { sessionId: 'sess-1' }), 'REA 未安装')
assert.equal(uninstalled.props.disabled, true)
state = live

// Another surface closes the gate; the next poll must correct the chip.
assert.ok(pollTimers.length > 0)
state = { ...state, open: false, tools: 0 }
await pollTimers.at(-1)()
const refreshed = await render('conversation.input.left', { sessionId: 'sess-1' })
assert.ok(findButton(refreshed, 'REA 关'))

assert.equal(slots.get('sidebar.panellist').component({ size: 16 }).type, 'svg')
