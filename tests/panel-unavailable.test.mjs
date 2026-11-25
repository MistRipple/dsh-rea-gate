import assert from 'node:assert/strict'

import { findButton, findElement, mountClient, text } from './client-fixture.mjs'

// The `rea` command exists but cannot run (the Windows case: node not found, or too old).
const broken = {
  installed: false,
  cli: 'unavailable',
  version: null,
  cliError: "'node' is not recognized as an internal or external command.",
  registration: null,
  registeredTools: 0,
}
let state = broken
const posts = []
globalThis.fetch = async (_url, init) => {
  if (init?.method === 'POST') {
    const body = JSON.parse(init.body)
    posts.push(body)
    if (body.action === 'reinstall') state = { ...state, installed: true, cli: 'available', version: '6.10.1', cliError: null, registration: { state: 'aligned' } }
    return { ok: true, json: async () => state }
  }
  return { ok: true, json: async () => state }
}

const { render } = mountClient()
const tree = await render('main')
assert.match(text(tree), /版本待确认/)
// Not a dead end: reinstalling is offered next to the plain re-check, and the reason is shown.
assert.ok(findButton(tree, '重新安装 REA'))
assert.ok(findButton(tree, '重新检测本机'))
assert.match(text(tree), /Node\.js 缺失或版本过旧/)
assert.match(text(findElement(tree, ({ type }) => type === 'pre')), /'node' is not recognized/)

await findButton(tree, '重新安装 REA').props.onClick()
assert.deepEqual(posts, [{ action: 'reinstall' }])
const fixed = await render('main')
assert.match(text(fixed), /REA 6\.10\.1/)
assert.equal(findButton(fixed, '重新安装 REA'), undefined)
assert.equal(findElement(fixed, ({ type }) => type === 'pre'), undefined, 'the stale output is gone once REA runs')
