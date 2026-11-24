import assert from 'node:assert/strict'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-rea-gate-lib-test-')))
process.on('exit', () => rmSync(root, { recursive: true, force: true }))
const home = join(root, 'home')
mkdirSync(join(home, 'bin'), { recursive: true })
process.env.HOME = home
process.env.USERPROFILE = home
delete process.env.REA_BIN

const { isOpen, readState, writeState } = await import('../lib/state.js')
const { doctorEngineState, normalizeEnvValue, probeJavaHome } = await import('../lib/engines.js')
const { decodeOutput, findBinary, runCommand, installReaPackage, withPath, HEALTHY_REGISTRATION, parseJsonOutput } = await import('../lib/rea-cli.js')
const { compareEnv, parseRegisteredEnv, readRegisteredEnv } = await import('../lib/registration-env.js')
const tr = (_chinese, english) => english

// The saved policy is one default plus the engine env; old per-workspace rules are dropped.
assert.equal(isOpen({ default: true }), true)
assert.equal(isOpen({ default: false }), false)
process.env.DSH_HOME = join(root, 'dsh')
mkdirSync(process.env.DSH_HOME)
writeFileSync(join(process.env.DSH_HOME, 'rea-gate.json'), JSON.stringify({ default: true, workspaces: { '/old': true } }))
const loaded = readState()
assert.equal(loaded.default, true)
assert.deepEqual(Object.keys(loaded), ['default', 'env'], 'no workspaces key is kept')
assert.deepEqual(Object.keys(loaded.env), [])
assert.ok(writeState(readState()))
assert.deepEqual(JSON.parse(readFileSync(join(process.env.DSH_HOME, 'rea-gate.json'), 'utf8')), { default: true })

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

// Backslash `~\\` paths (Windows) expand too.
const backslash = normalizeEnvValue('REA_APKTOOL_COMMAND', '~\\bin\\apktool', tr)
if (process.platform === 'win32') assert.deepEqual(backslash, { ok: true, value: tool })
else assert.ok(backslash.message.includes(home), 'the `~` is expanded even where `\\` is not a separator')

// JDK discovery: JAVA_HOME wins, `java.exe` counts, and each platform scans its own folders.
const jdk = (dir, exe = 'java') => {
  mkdirSync(join(dir, 'bin'), { recursive: true })
  writeFileSync(join(dir, 'bin', exe), '')
  return dir
}
const winJdk = jdk(join(root, 'pf', 'Eclipse Adoptium', 'jdk-17.0.9'), 'java.exe')
const newerWinJdk = jdk(join(root, 'pf', 'Eclipse Adoptium', 'jdk-21.0.1'), 'java.exe')
const winEnv = { ProgramFiles: join(root, 'pf') }
assert.deepEqual(probeJavaHome({ JAVA_HOME: winJdk }, null, { platform: 'win32' }), { available: true, home: winJdk, configured: true })
assert.equal(probeJavaHome(winEnv, null, { platform: 'win32' }).home, newerWinJdk, 'the newest JDK folder is preferred')
assert.equal(probeJavaHome({ JAVA_HOME: join(root, 'missing'), ...winEnv }, null, { platform: 'win32' }).home, newerWinJdk)
assert.deepEqual(probeJavaHome({}, null, { platform: 'win32' }), { available: false, home: null, configured: false })
const brewOpt = join(root, 'brew')
const brewJdk = jdk(join(brewOpt, 'opt', 'openjdk@21', 'libexec/openjdk.jdk/Contents/Home'))
jdk(join(brewOpt, 'opt', 'not-a-jdk', 'libexec/openjdk.jdk/Contents/Home'))
assert.equal(probeJavaHome({}, brewOpt, { platform: 'darwin' }).home, brewJdk)
assert.equal(probeJavaHome({}, null, { platform: 'linux' }).configured, false)

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

// A damaged npm cache (the real failure a Windows user hit) is retried once
// against a throwaway cache; other failures are reported as they are.
const cacheError = "npm error enoent Invalid response body while trying to fetch https://registry.npmjs.org/rea-agents: ENOENT: no such file or directory, stat C:\\Users\\x\\AppData\\Local\\npm-cache\\_cacache\\content-v2\\sha512\\47"
const calls = []
const flaky = async (command, args, timeout, options) => {
  calls.push({ command, args, cache: options.env.npm_config_cache })
  return calls.length === 1
    ? { ok: false, code: 1, out: '', err: cacheError }
    : { ok: true, code: 0, out: 'added 1 package', err: '' }
}
const recovered = await installReaPackage({ PATH: 'x' }, flaky)
assert.equal(recovered.ok, true)
assert.equal(calls.length, 2)
assert.equal(calls[0].cache, undefined, 'the first attempt uses the user cache')
assert.match(calls[1].cache, /dsh-rea-gate-npm-cache/)
assert.ok(calls[1].args.includes('--prefer-online'))
calls.length = 0
const offline = await installReaPackage({}, async (command, args, timeout, options) => {
  calls.push(args)
  return { ok: false, code: 1, out: '', err: 'npm error network request failed' }
})
assert.equal(offline.ok, false)
assert.equal(calls.length, 1, 'a network failure is not retried')

// With no `rea doctor` verdict, a saved engine path is checked locally instead of staying "unverified".
const jar = join(root, 'jadx-headless-mcp-0.8.0-all.jar')
writeFileSync(jar, 'jar')
const javaDir = jdk(join(root, 'jdk-for-jadx'))
const engineFor = (id, values) => doctorEngineState(null, { env: values }, null, tr).find((engine) => engine.id === id)
const withJava = engineFor('jadx', { REA_JADX_MCP_JAR: jar, JAVA_HOME: javaDir })
assert.deepEqual([withJava.checked, withJava.configured, withJava.available], [true, true, true])
assert.deepEqual(withJava.checks.map((check) => check.name), ['jadx', 'java'])
const noJava = engineFor('jadx', { REA_JADX_MCP_JAR: jar, JAVA_HOME: join(root, 'no-such-jdk') })
if (!probeJavaHome({ JAVA_HOME: join(root, 'no-such-jdk') }, null).available) {
  assert.equal(noJava.available, false)
  assert.match(noJava.checks.at(-1).detail, /jadx needs Java/)
}
const badJar = engineFor('jadx', { REA_JADX_MCP_JAR: join(root, 'missing.jar') })
assert.deepEqual([badJar.checked, badJar.available], [true, false])
assert.match(badJar.checks[0].detail, /not found/)
assert.match(engineFor('jadx', { REA_JADX_MCP_JAR: tool }).checks[0].detail, /\.jar file/)
assert.ok(!engineFor('jadx', {}).checked, 'nothing configured stays unchecked')
assert.equal(engineFor('hopper', { HOPPER_LAUNCHER_PATH: home }).available, true, 'Hopper accepts a file or a bundle')
assert.equal(engineFor('ida', { REA_IDA_MCP_CONFIG: home }).available, false, 'an IDA config must be a file')

// Windows spells the variable `Path`: it is extended in place, never shadowed by a second `PATH`.
const winEnv2 = withPath({ Path: 'C:\\Windows;C:\\nodejs', USERPROFILE: 'C:\\Users\\x' }, ['C:\\npm', null, 'C:\\nodejs'])
assert.deepEqual(Object.keys(winEnv2).filter((key) => key.toLowerCase() === 'path'), ['Path'])
assert.equal(winEnv2.Path, ['C:\\npm', 'C:\\nodejs', 'C:\\Windows;C:\\nodejs'].join(process.platform === 'win32' ? ';' : ':'))
assert.equal(winEnv2.USERPROFILE, 'C:\\Users\\x')
assert.deepEqual(Object.keys(withPath({}, ['/a'])), ['PATH'], 'no PATH at all still gets one')
assert.equal(withPath({ PATH: '/usr/bin' }, ['/a']).PATH, ['/a', '/usr/bin'].join(process.platform === 'win32' ? ';' : ':'))

// Output decoding: UTF-8 as is; on Windows a GBK answer from cmd.exe stays readable.
assert.equal(decodeOutput(Buffer.from('已安装 ✓')), '已安装 ✓')
assert.equal(decodeOutput('plain'), 'plain')
assert.equal(decodeOutput(Buffer.alloc(0)), '')
if (process.platform === 'win32') {
  assert.equal(decodeOutput(Buffer.from([0xb2, 0xbb, 0xca, 0xc7, 0xc4, 0xda, 0xb2, 0xbf])), '不是内部')
}

// Who judged each engine is reported, so the panel never presents a path check as REA's verdict.
assert.equal(withJava.verdict, 'path')
assert.equal(engineFor('jadx', {}).verdict, 'none')
assert.equal(engineFor('java', { JAVA_HOME: javaDir }).verdict, 'local')
assert.equal(doctorEngineState({ providerInspections: [{ id: 'jadx', configured: true, available: true, checks: [] }] }, { env: {} }, null, tr).find((engine) => engine.id === 'jadx').verdict, 'rea')

// The registration read-back: what DSH's REA entry actually carries.
const patch = '[ { insert: [ { id: rea-mcp, name: "@deepseek-ai/dsh-mcp-client", config: { serverName: rea, transport: stdio, command: "C:\\\\Program Files\\\\nodejs\\\\node.exe", args: [ rea, mcp ], env: { JAVA_HOME: "C:\\\\Program Files\\\\jdk, 21", REA_ADB_PATH: \'it\'\'s\', GHIDRA_INSTALL_DIR: /opt/ghidra } } } ] } ]'
assert.deepEqual({ ...parseRegisteredEnv(patch) }, { JAVA_HOME: 'C:\\Program Files\\jdk, 21', REA_ADB_PATH: "it's", GHIDRA_INSTALL_DIR: '/opt/ghidra' })
assert.deepEqual(parseRegisteredEnv('[ { insert: [ { config: { serverName: rea, command: x } } ] } ]'), {}, 'an entry without env carries nothing')
assert.equal(parseRegisteredEnv('[ { insert: [ { config: { serverName: other, env: { A: b } } } ] } ]'), null, 'another server is not REA')
assert.equal(parseRegisteredEnv('not yaml at all'), null)
assert.deepEqual(readRegisteredEnv(join(root, 'no-such.yml')), { ok: false })
writeFileSync(join(root, 'patch.yml'), patch)
const registeredEnv = readRegisteredEnv(join(root, 'patch.yml'))
assert.equal(registeredEnv.ok, true)
assert.deepEqual(compareEnv({ GHIDRA_INSTALL_DIR: '/opt/ghidra', REA_JADX_MCP_JAR: '/x/jadx.jar', REA_ADB_PATH: '/other', EMPTY: '' }, registeredEnv.env, false), [
  { name: 'REA_JADX_MCP_JAR', state: 'missing' },
  { name: 'REA_ADB_PATH', state: 'different' },
])
assert.deepEqual(compareEnv({ JAVA_HOME: 'c:\\program files\\JDK, 21' }, registeredEnv.env, true), [], 'Windows paths ignore case')
assert.deepEqual(compareEnv({ JAVA_HOME: 'c:\\program files\\JDK, 21' }, registeredEnv.env, false).map((p) => p.state), ['different'])
