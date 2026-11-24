import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-rea-gate-lib-test-')))
process.on('exit', () => rmSync(root, { recursive: true, force: true }))
const home = join(root, 'home')
mkdirSync(join(home, 'bin'), { recursive: true })
process.env.HOME = home
process.env.USERPROFILE = home
delete process.env.REA_BIN

const { canonicalWorkspace, isInside, ruleFor, isOpen } = await import('../lib/state.js')
const { normalizeEnvValue } = await import('../lib/engines.js')
const { findBinary, runCommand, HEALTHY_REGISTRATION, parseJsonOutput } = await import('../lib/rea-cli.js')
const tr = (_chinese, english) => english

// Workspace keys: trailing separators and relative paths are normalised lexically.
assert.equal(canonicalWorkspace(`${root}/`), root)
assert.equal(canonicalWorkspace(join(root, 'a', '..')), root)
assert.equal(canonicalWorkspace(''), null)
assert.equal(canonicalWorkspace(42), null)
assert.equal(canonicalWorkspace(join(root, 'not-created-yet')), join(root, 'not-created-yet'))
assert.ok(isInside(join(root, 'a', 'b'), root))
assert.ok(!isInside(`${root}-other`, root), 'a sibling that shares a prefix is not inside')

// A rule is found on the directory itself or the nearest parent that has one.
const state = { default: true, workspaces: { [join(root, 'p')]: false } }
assert.equal(ruleFor(state, join(root, 'p', 'deep', 'er'))?.path, join(root, 'p'))
assert.equal(isOpen(state, join(root, 'p', 'deep')), false)
assert.equal(isOpen(state, join(root, 'q')), true, 'no rule: the default decides')
assert.equal(isOpen(state, null), true)

// Engine settings: `~` expands, relative and wrong-kind paths are refused, empty clears.
const tool = join(home, 'bin', 'apktool')
writeFileSync(tool, '#!/bin/sh\n')
assert.deepEqual(normalizeEnvValue('REA_APKTOOL_COMMAND', '~/bin/apktool', tr), { ok: true, value: tool })
assert.deepEqual(normalizeEnvValue('REA_APKTOOL_COMMAND', `  '${tool}'  `, tr), { ok: true, value: tool })
assert.deepEqual(normalizeEnvValue('REA_APKTOOL_COMMAND', '   ', tr), { ok: true, value: '' })
assert.equal(normalizeEnvValue('REA_APKTOOL_COMMAND', 'bin/apktool', tr).ok, false)
assert.equal(normalizeEnvValue('REA_APKTOOL_COMMAND', `${tool}\nrm -rf /`, tr).ok, false)
assert.equal(normalizeEnvValue('JAVA_HOME', tool, tr).ok, false, 'JAVA_HOME must be a directory')
assert.equal(normalizeEnvValue('HOPPER_LAUNCHER_PATH', join(home, 'bin'), tr).ok, true, 'Hopper accepts a file or a bundle')
assert.match(normalizeEnvValue('REA_ADB_PATH', join(root, 'missing'), (zh) => zh).message, /路径不存在/)

// Executables are found on PATH, and REA_BIN wins for `rea`.
const bin = join(root, 'bin')
mkdirSync(bin)
const script = join(bin, 'fake-tool')
writeFileSync(script, '#!/bin/sh\necho "$FAKE_VALUE:$@"\n')
chmodSync(script, 0o755)
process.env.PATH = `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`
assert.equal(findBinary('fake-tool'), script)
assert.equal(findBinary('definitely-not-installed-anywhere'), 'definitely-not-installed-anywhere')
process.env.REA_BIN = '/override/rea'
assert.equal(findBinary('rea'), '/override/rea')
assert.equal(findBinary('fake-tool'), script, 'REA_BIN only applies to rea')
delete process.env.REA_BIN

const ran = await runCommand('fake-tool', ['one', 'two'], 10_000, { env: { ...process.env, FAKE_VALUE: 'v' } })
assert.deepEqual([ran.ok, ran.out], [true, 'v:one two'])
const missing = await runCommand('definitely-not-installed-anywhere', [], 10_000)
assert.deepEqual([missing.ok, missing.code], [false, 'ENOENT'])

// Doctor output: the `data` envelope is unwrapped, anything else is not a report.
assert.deepEqual(parseJsonOutput({ out: '{"data":{"a":1}}' }), { a: 1 })
assert.deepEqual(parseJsonOutput({ out: '{"a":1}' }), { a: 1 })
assert.equal(parseJsonOutput({ out: 'not json' }), null)
assert.equal(parseJsonOutput({ out: '' }), null)
assert.ok(HEALTHY_REGISTRATION.has('aligned') && !HEALTHY_REGISTRATION.has('missing'))
