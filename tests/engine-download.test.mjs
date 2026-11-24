import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { deflateRawSync } from 'node:zlib'

const root = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-rea-gate-download-test-')))
process.on('exit', () => rmSync(root, { recursive: true, force: true }))
process.env.DSH_HOME = join(root, 'dsh')

const { canDownload, enginesRoot, extractZip, installEngineByDownload, resolveAsset } = await import('../lib/engine-download.js')
const { probeJavaHome } = await import('../lib/engines.js')

// --- a tiny zip writer, so the tests need no archive tool ---------------------
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buffer) => {
  let c = 0xffffffff
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function makeZip(entries) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const { name, data = Buffer.alloc(0), mode = 0o644, deflate = true } of entries) {
    const nameBytes = Buffer.from(name)
    const isDir = name.endsWith('/')
    const body = isDir ? Buffer.alloc(0) : Buffer.from(data)
    const packed = deflate && body.length > 0 ? deflateRawSync(body) : body
    const method = deflate && body.length > 0 ? 8 : 0
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(method, 8)
    local.writeUInt32LE(crc32(body), 14)
    local.writeUInt32LE(packed.length, 18)
    local.writeUInt32LE(body.length, 22)
    local.writeUInt16LE(nameBytes.length, 26)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE((3 << 8) | 20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(method, 10)
    central.writeUInt32LE(crc32(body), 16)
    central.writeUInt32LE(packed.length, 20)
    central.writeUInt32LE(body.length, 24)
    central.writeUInt16LE(nameBytes.length, 28)
    central.writeUInt32LE(((isDir ? 0o040755 : 0o100000 | mode) << 16) >>> 0, 38)
    central.writeUInt32LE(offset, 42)
    locals.push(local, nameBytes, packed)
    centrals.push(central, nameBytes)
    offset += local.length + nameBytes.length + packed.length
  }
  const directory = Buffer.concat(centrals)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, directory, end])
}

// --- extraction ---------------------------------------------------------------
const big = Buffer.from('payload '.repeat(5000))
const archive = join(root, 'sample.zip')
writeFileSync(archive, makeZip([
  { name: 'top/' },
  { name: 'top/run', data: '#!/bin/sh\n', mode: 0o755 },
  { name: 'top/data/big.txt', data: big },
  { name: 'top/stored.txt', data: 'plain', deflate: false },
  { name: 'top/empty.txt' },
]))
await extractZip(archive, join(root, 'out'))
assert.deepEqual(readFileSync(join(root, 'out/top/data/big.txt')), big)
assert.equal(readFileSync(join(root, 'out/top/stored.txt'), 'utf8'), 'plain')
assert.equal(readFileSync(join(root, 'out/top/empty.txt'), 'utf8'), '')
if (process.platform !== 'win32') {
  assert.ok(statSync(join(root, 'out/top/run')).mode & 0o111, 'the executable bit survives')
  assert.equal(statSync(join(root, 'out/top/data/big.txt')).mode & 0o111, 0)
}
const evil = join(root, 'evil.zip')
writeFileSync(evil, makeZip([{ name: '../escaped.txt', data: 'x' }]))
await assert.rejects(extractZip(evil, join(root, 'out2')), /Unsafe path/)
assert.equal(existsSync(join(root, 'escaped.txt')), false)
await assert.rejects(extractZip(join(root, 'out/top/stored.txt'), join(root, 'out3')), /Not a zip/)

// --- which engines can be fetched where ---------------------------------------
for (const platform of ['darwin', 'linux', 'win32']) {
  for (const engine of ['ghidra', 'java', 'apktool', 'adb']) {
    assert.equal(canDownload(engine, platform, 'x64'), true, `${engine} on ${platform}/x64`)
  }
}
assert.equal(canDownload('ghidra', 'linux', 'arm64'), false)
assert.equal(canDownload('adb', 'linux', 'arm64'), false)
assert.equal(canDownload('java', 'linux', 'arm64'), true)
assert.equal(canDownload('java', 'win32', 'arm64'), false)
assert.equal(canDownload('hopper', 'darwin', 'arm64'), false, 'only engines with a free upstream archive')

// --- a fake vendor ------------------------------------------------------------
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')
const sha1 = (buffer) => createHash('sha1').update(buffer).digest('hex')
const files = new Map()
const requests = []
let corrupt = null
const serve = (url, bytes) => files.set(url, Buffer.from(bytes))

const ghidraZip = makeZip([
  { name: 'ghidra_12.2_PUBLIC/' },
  { name: 'ghidra_12.2_PUBLIC/ghidraRun', data: '#!/bin/sh\n', mode: 0o755 },
  { name: 'ghidra_12.2_PUBLIC/Ghidra/application.properties', data: 'v=12.2' },
])
serve('https://github.com/dl/ghidra_12.2_PUBLIC_20261016.zip', ghidraZip)
const adbZip = (adb) => makeZip([{ name: 'platform-tools/' }, { name: `platform-tools/${adb}`, data: 'adb', mode: 0o755 }])
serve('https://dl.google.com/android/repository/platform-tools_r37.0.3-linux.zip', adbZip('adb'))
serve('https://dl.google.com/android/repository/platform-tools_r37.0.3-win.zip', adbZip('adb.exe'))
const jar = Buffer.from('PK-fake-jar')
serve('https://github.com/dl/apktool_3.0.3.jar', jar)
const jdkZip = makeZip([
  { name: 'jdk-21.0.13+2/' },
  { name: 'jdk-21.0.13+2/bin/java.exe', data: 'java', mode: 0o755 },
])
serve('https://github.com/dl/OpenJDK21U-jdk_x64_windows_hotspot_21.0.13.1_2.zip', jdkZip)

function vendor(url) {
  requests.push(url)
  const json = (value) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } })
  if (url.includes('NationalSecurityAgency/ghidra')) {
    return json({
      tag_name: 'Ghidra_12.2_build',
      assets: [{ name: 'ghidra_12.2_PUBLIC_20261016.zip', browser_download_url: 'https://github.com/dl/ghidra_12.2_PUBLIC_20261016.zip', digest: `sha256:${sha256(ghidraZip)}` }],
    })
  }
  if (url.includes('iBotPeaches/Apktool')) {
    return json({
      tag_name: 'v3.0.3',
      assets: [{ name: 'apktool_3.0.3.jar', browser_download_url: 'https://github.com/dl/apktool_3.0.3.jar', digest: corrupt === 'apktool' ? 'sha256:' + '0'.repeat(64) : corrupt === 'nodigest' ? null : `sha256:${sha256(jar)}` }],
    })
  }
  if (url.startsWith('https://api.adoptium.net/')) {
    const os = new URL(url).searchParams.get('os')
    assert.equal(os, 'windows', 'the test only serves a Windows JDK')
    return json([{ binary: { package: { name: 'OpenJDK21U-jdk_x64_windows_hotspot_21.0.13.1_2.zip', link: 'https://github.com/dl/OpenJDK21U-jdk_x64_windows_hotspot_21.0.13.1_2.zip', checksum: sha256(jdkZip) } } }])
  }
  if (url.endsWith('repository2-3.xml')) {
    const archive = (host, name, bytes) => `<archive><complete><size>1</size><checksum type="sha1">${sha1(bytes)}</checksum><url>${name}</url></complete><host-os>${host}</host-os></archive>`
    return new Response(`<root><remotePackage path="platform-tools"><archives>${
      archive('linux', 'platform-tools_r37.0.3-linux.zip', files.get('https://dl.google.com/android/repository/platform-tools_r37.0.3-linux.zip'))
    }${
      archive('windows', 'platform-tools_r37.0.3-win.zip', files.get('https://dl.google.com/android/repository/platform-tools_r37.0.3-win.zip'))
    }</archives></remotePackage></root>`)
  }
  if (files.has(url)) return new Response(files.get(url))
  return new Response('missing', { status: 404 })
}
const fetchStub = async (url) => vendor(String(url))
const base = (extra = {}) => ({ root: enginesRoot(), fetch: fetchStub, run: async () => ({ ok: false, err: 'no tar here' }), ...extra })

// --- Linux: adb and Ghidra -----------------------------------------------------
const adb = await installEngineByDownload('adb', base({ platform: 'linux', arch: 'x64' }))
assert.deepEqual(Object.keys(adb.discovered), ['REA_ADB_PATH'])
assert.equal(adb.discovered.REA_ADB_PATH, join(enginesRoot(), 'adb', 'platform-tools-37.0.3', 'adb'))
assert.equal(readFileSync(adb.discovered.REA_ADB_PATH, 'utf8'), 'adb')
assert.deepEqual(readdirSync(join(enginesRoot(), '.tmp')), [], 'no scratch files are left behind')

// An engine that needs a JDK installs one first when none is found; here that is a Windows JDK.
const again = requests.length
const win = await installEngineByDownload('apktool', base({ platform: 'win32', arch: 'x64', hasJava: () => false }))
assert.match(win.discovered.JAVA_HOME, /rea-engines[\\/]java[\\/]OpenJDK21U/)
assert.ok(existsSync(join(win.discovered.JAVA_HOME, 'bin', 'java.exe')))
assert.match(win.discovered.REA_APKTOOL_COMMAND, /apktool\.bat$/)
assert.match(readFileSync(win.discovered.REA_APKTOOL_COMMAND, 'utf8'), /%~dp0apktool\.jar/)
assert.equal(readFileSync(join(win.discovered.REA_APKTOOL_COMMAND, '..', 'apktool.jar')).equals(jar), true)
assert.ok(requests.length > again)
// The probe finds the JDK the installer put there, with no JAVA_HOME set.
assert.equal(probeJavaHome({}, null, { platform: 'win32' }).home, win.discovered.JAVA_HOME)

// Already installed: nothing is downloaded again.
const downloads = () => requests.filter((url) => files.has(url)).length
const before = downloads()
await installEngineByDownload('apktool', base({ platform: 'win32', arch: 'x64', hasJava: () => true }))
assert.equal(downloads(), before)

if (process.platform !== 'win32') {
  const apktool = await installEngineByDownload('apktool', base({ platform: 'linux', arch: 'x64', hasJava: () => true }))
  const wrapper = apktool.discovered.REA_APKTOOL_COMMAND
  assert.ok(statSync(wrapper).mode & 0o111, 'the wrapper is executable')
  const ghidra = await installEngineByDownload('ghidra', base({ platform: 'linux', arch: 'x64', hasJava: () => true }))
  assert.equal(ghidra.discovered.GHIDRA_INSTALL_DIR, join(enginesRoot(), 'ghidra', 'ghidra_12.2_PUBLIC_20261016'))
  assert.ok(statSync(join(ghidra.discovered.GHIDRA_INSTALL_DIR, 'ghidraRun')).mode & 0o111)

  // A tar.gz (Temurin on macOS and Linux) goes through the system tar.
  const tarSrc = join(root, 'tarsrc')
  mkdirSync(join(tarSrc, 'jdk-21.0.13+2', 'bin'), { recursive: true })
  writeFileSync(join(tarSrc, 'jdk-21.0.13+2', 'bin', 'java'), '')
  const tgz = join(root, 'jdk.tar.gz')
  execFileSync('tar', ['-czf', tgz, '-C', tarSrc, 'jdk-21.0.13+2'])
  const tgzBytes = readFileSync(tgz)
  const tarFetch = async (url) => {
    url = String(url)
    if (url.startsWith('https://api.adoptium.net/')) {
      return new Response(JSON.stringify([{ binary: { package: { name: 'OpenJDK21U-jdk_x64_linux_hotspot_21.tar.gz', link: 'https://github.com/dl/jdk.tar.gz', checksum: sha256(tgzBytes) } } }]))
    }
    return new Response(tgzBytes)
  }
  const java = await installEngineByDownload('java', {
    root: enginesRoot(),
    fetch: tarFetch,
    platform: 'linux',
    arch: 'x64',
    run: async (command, args) => {
      try { execFileSync(command, args); return { ok: true, out: '', err: '' } } catch (error) { return { ok: false, out: '', err: String(error.message) } }
    },
  })
  assert.ok(existsSync(join(java.discovered.JAVA_HOME, 'bin', 'java')))
}

// --- refusals ------------------------------------------------------------------
corrupt = 'apktool'
await assert.rejects(installEngineByDownload('apktool', base({ platform: 'linux', arch: 'x64', hasJava: () => true, root: join(root, 'fresh') })), /Checksum mismatch/)
assert.equal(existsSync(join(root, 'fresh', 'apktool')), false, 'a rejected download installs nothing')
// GitHub's API unreadable (rate limit, no digest): the pinned release is used, still checksum-verified.
for (const broken of [async () => new Response('rate limited', { status: 403 }), async () => { throw new Error('offline') }]) {
  const pinned = await resolveAsset('apktool', { platform: 'linux', arch: 'x64', fetch: broken })
  assert.equal(pinned.url, 'https://github.com/iBotPeaches/Apktool/releases/download/v3.0.3/apktool_3.0.3.jar')
  assert.match(pinned.checksum, /^[0-9a-f]{64}$/)
}
corrupt = 'nodigest'
const noDigest = await resolveAsset('apktool', { platform: 'linux', arch: 'x64', fetch: fetchStub })
assert.match(noDigest.checksum, /^dbf930b0/, 'a release without a digest falls back to the pinned hash')
await assert.rejects(
  installEngineByDownload('ghidra', base({ platform: 'linux', arch: 'x64', hasJava: () => true, root: join(root, 'fresh3'), fetch: async (url) => String(url).includes('api.github.com') ? new Response('limited', { status: 403 }) : new Response(Buffer.from('not ghidra')) })),
  /Checksum mismatch/,
  'bytes that do not match the pinned hash are refused',
)
corrupt = null
await assert.rejects(installEngineByDownload('ghidra', base({ platform: 'linux', arch: 'arm64' })), /cannot be downloaded/)
await assert.rejects(
  installEngineByDownload('apktool', base({
    platform: 'linux',
    arch: 'x64',
    hasJava: () => true,
    root: join(root, 'fresh2'),
    fetch: async (url) => String(url).includes('api.github.com')
      ? new Response(JSON.stringify({ assets: [{ name: 'apktool_3.0.3.jar', browser_download_url: 'https://evil.example/a.jar', digest: `sha256:${sha256(jar)}` }] }))
      : vendor(String(url)),
  })),
  /Refusing to download from https:\/\/evil\.example/,
)
