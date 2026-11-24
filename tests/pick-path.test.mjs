import assert from 'node:assert/strict'

import { pickPath } from '../lib/pick-path.js'

const calls = []
const answer = (result) => async (command, args) => {
  calls.push({ command, args })
  return typeof result === 'function' ? result(command, args) : result
}
const ok = (out) => ({ ok: true, code: 0, out, err: '' })

// macOS: osascript, folders lose the trailing slash AppleScript adds.
assert.deepEqual(await pickPath('dir', 'Choose', { platform: 'darwin', run: answer(ok('/Library/Java/Home/\n')) }), { ok: true, path: '/Library/Java/Home' })
assert.equal(calls.at(-1).command, 'osascript')
assert.match(calls.at(-1).args.join(' '), /choose folder with prompt "Choose"/)
assert.deepEqual(await pickPath('file', 'Choose', { platform: 'darwin', run: answer(ok('/Applications/Hopper.app\n')) }), { ok: true, path: '/Applications/Hopper.app' })
assert.match(calls.at(-1).args.join(' '), /choose file/)
assert.deepEqual(
  await pickPath('file', 'x', { platform: 'darwin', run: answer({ ok: false, code: 1, out: '', err: 'execution error: User canceled. (-128)' }) }),
  { ok: true, path: null },
  'cancelling is not an error',
)
// A quote in the title cannot break out of the script.
await pickPath('file', 'a" & (do shell script "x") & "', { platform: 'darwin', run: answer(ok('/x')) })
assert.ok(calls.at(-1).args.join(' ').includes('\\"'))

// Windows: PowerShell with the right dialog class, and the path kept as typed.
const win = await pickPath('dir', "It's", { platform: 'win32', run: answer(ok('C:\\Program Files\\Ghidra')) })
assert.deepEqual(win, { ok: true, path: 'C:\\Program Files\\Ghidra' })
assert.equal(calls.at(-1).command, 'powershell')
const script = calls.at(-1).args.at(-1)
assert.match(script, /FolderBrowserDialog/)
assert.match(script, /It''s/, 'a single quote in the title is doubled')
await pickPath('file', 'x', { platform: 'win32', run: answer(ok('C:\\tools\\adb.exe')) })
assert.match(calls.at(-1).args.at(-1), /OpenFileDialog/)
assert.deepEqual(await pickPath('file', 'x', { platform: 'win32', run: answer(ok('')) }), { ok: true, path: null })

// Linux: zenity first, kdialog when zenity is missing, a clear refusal when neither exists.
const missing = { ok: false, code: 'ENOENT', out: '', err: 'spawn zenity ENOENT' }
assert.deepEqual(await pickPath('dir', 'x', { platform: 'linux', run: answer(ok('/usr/lib/jvm/java-21/\n')) }), { ok: true, path: '/usr/lib/jvm/java-21' })
assert.equal(calls.at(-1).command, 'zenity')
assert.ok(calls.at(-1).args.includes('--directory'))
const viaKde = await pickPath('file', 'x', { platform: 'linux', run: answer((command) => command === 'zenity' ? missing : ok('/opt/x/adb\n')) })
assert.deepEqual(viaKde, { ok: true, path: '/opt/x/adb' })
assert.equal(calls.at(-1).command, 'kdialog')
const none = await pickPath('file', 'x', { platform: 'linux', run: answer(missing) })
assert.equal(none.ok, false)
assert.equal(none.unsupported, true)
assert.match(none.message, /zenity or kdialog/)
assert.deepEqual(await pickPath('file', 'x', { platform: 'linux', run: answer({ ok: false, code: 1, out: '', err: '' }) }), { ok: true, path: null }, 'zenity exits 1 on cancel')
const broken = await pickPath('file', 'x', { platform: 'linux', run: answer({ ok: false, code: 1, out: '', err: 'cannot open display' }) })
assert.equal(broken.ok, false)
assert.match(broken.message, /cannot open display/)
