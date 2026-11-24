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

const tree = await render('conversation.session.header.actions', { sessionId: 'sess-1' })
const button = findButton(tree, 'REA 关')
assert.ok(button)
assert.equal(button.props['aria-pressed'], false)
await button.props.onClick()
assert.deepEqual(posts.map(({ body }) => body), [{ session: 'sess-1', open: true }])
assert.ok(findButton(await render('conversation.session.header.actions', { sessionId: 'sess-1' }), 'REA 开'))

// Another surface closes the gate; the next poll must correct the chip.
assert.ok(pollTimers.length > 0)
state = { ...state, open: false, tools: 0 }
await pollTimers.at(-1)()
const refreshed = await render('conversation.session.header.actions', { sessionId: 'sess-1' })
assert.ok(findButton(refreshed, 'REA 关'))

assert.equal(slots.get('sidebar.panellist').component({ size: 16 }).type, 'svg')
