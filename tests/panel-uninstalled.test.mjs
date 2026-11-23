import assert from 'node:assert/strict'

import { findButton, findElement, mountClient, text } from './client-fixture.mjs'

let state = { installed: false, cli: 'missing', registration: { state: 'missing' }, registeredTools: 0 }
const posts = []
let checkFails = false
let latest = '6.10.2'
let waitForCheck
globalThis.fetch = async (url, init) => {
  if (init?.method === 'POST') {
    const body = JSON.parse(init.body)
    posts.push({ url, body })
    if (body.action === 'check-update') {
      await waitForCheck
      return checkFails
        ? { ok: false, json: async () => ({ ok: false, message: 'npm unavailable' }) }
        : { ok: true, json: async () => ({ latest }) }
    }
    if (body.action === 'update' || body.action === 'reinstall') {
      state = { ...state, installed: true, cli: 'available', version: latest, registration: { state: 'aligned' } }
      return { ok: true, json: async () => state }
    }
    const installed = body.action === 'install'
    const removedPkg = body.action === 'uninstall' && body.removePackage === true
    state = {
      ...state,
      installed,
      cli: removedPkg ? 'missing' : 'available',
      version: removedPkg ? null : (state.version ?? (posts.length === 1 ? '6.10.1' : latest)),
      registration: { state: installed ? 'aligned' : 'missing' },
    }
    return { ok: true, json: async () => state }
  }
  return { ok: true, json: async () => state }
}

const { render, slots } = mountClient()

const tree = await render('main')
assert.match(text(tree), /REA 未安装 DSH 未注册/)
assert.equal(findButton(tree, '检查更新'), undefined)
const button = findButton(tree, '安装 REA')
assert.ok(button)
await button.props.onClick()
assert.deepEqual(posts.map(({ body }) => body), [{ action: 'install' }])
assert.match(text(await render('main')), /REA 6\.10\.1 DSH 已注册/)
assert.match(text(await render('main')), /宿主未加载/)
assert.equal(findButton(await render('main'), '更新 REA'), undefined)

let finishCheck
waitForCheck = new Promise((resolve) => { finishCheck = resolve })
const checking = findButton(await render('main'), '检查更新').props.onClick()
const whileChecking = await render('main')
assert.ok(findButton(whileChecking, '检查中…').props.disabled)
assert.equal(findButton(whileChecking, '新会话默认启用 REA').props.disabled, false)
assert.equal(findButton(whileChecking, '重新检测').props.disabled, false)
await findButton(whileChecking, '重新检测').props.onClick()
assert.ok(findButton(await render('main'), '检查中…'))
finishCheck()
await checking
assert.match(text(await render('main')), /发现 npm 稳定版 6\.10\.2/)
await findButton(await render('main'), '更新 REA').props.onClick()
assert.match(text(await render('main')), /REA 6\.10\.2 DSH 已注册/)
assert.match(text(await render('main')), /已是最新版/)
assert.equal(findButton(await render('main'), '更新 REA'), undefined)

const current = await render('main')
assert.equal(findElement(current, ({ type }) => type === 'dialog'), undefined)
assert.equal(findButton(current, '更多操作'), undefined)
assert.ok(findButton(current, '重新注册'))
findButton(current, '卸载集成').props.onClick()
assert.deepEqual(posts.map(({ body }) => body.action), ['install', 'check-update', 'update'])
assert.match(text(await render('main')), /其他客户端创建的注册和技能文件/)
await findButton(await render('main'), '取消').props.onClick()
assert.equal(findButton(await render('main'), '确认卸载'), undefined)
findButton(await render('main'), '卸载集成').props.onClick()
await findButton(await render('main'), '确认卸载').props.onClick()
assert.deepEqual(posts.map(({ body }) => body.action), ['install', 'check-update', 'update', 'uninstall'])
assert.ok(findButton(await render('main'), '注册到 DSH'))
assert.ok(findButton(await render('main'), '重装最新版'))
await findButton(await render('main'), '重装最新版').props.onClick()
assert.deepEqual(posts.at(-1)?.body, { action: 'reinstall' })
assert.match(text(await render('main')), /REA 6\.10\.2 DSH 已注册/)

// Full uninstall removes the npm package too, returning to one-click 安装 REA.
findButton(await render('main'), '卸载集成').props.onClick()
const uninstallModal = await render('main')
const removePkgBox = findElement(uninstallModal, ({ type, props }) => type === 'input' && props.type === 'checkbox')
assert.ok(removePkgBox)
removePkgBox.props.onChange({ target: { checked: true } })
const fullUninstallModal = await render('main')
await findButton(fullUninstallModal, '彻底卸载').props.onClick()
assert.deepEqual(posts.at(-1)?.body, { action: 'uninstall', removePackage: true })
assert.ok(findButton(await render('main'), '安装 REA'))
await findButton(await render('main'), '安装 REA').props.onClick()

latest = '6.9.10'
await findButton(await render('main'), '重新检查').props.onClick()
assert.match(text(await render('main')), /当前版本高于 npm 稳定版 6\.9\.10/)
assert.equal(findButton(await render('main'), '更新 REA'), undefined)
checkFails = true
await findButton(await render('main'), '重新检查').props.onClick()
assert.ok(findButton(await render('main'), '重试检查更新'))
assert.match(text(await render('main')), /无法查询 npm 稳定版/)
assert.match(text(findElement(await render('main'), ({ type }) => type === 'pre')), /npm unavailable/)

state = { ...state, registration: { state: 'stale' } }
await findButton(await render('main'), '重新检测').props.onClick()
assert.ok(findButton(await render('main'), '修复注册'))
await findButton(await render('main'), '修复注册').props.onClick()
assert.deepEqual(posts.at(-1)?.body, { action: 'install' })

assert.equal(slots.get('sidebar.panellist').component({ size: 16 }).type, 'svg')
