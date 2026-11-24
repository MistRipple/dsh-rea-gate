/**
 * One-click engine installs that work the same on macOS, Linux and Windows:
 * download the engine's official release, verify its checksum, unpack it under
 * `$DSH_HOME/rea-engines/` and report the environment variables that point REA
 * at it. No administrator rights, package manager or archive tool is needed
 * (zip files are unpacked here; `tar` handles Temurin's `.tar.gz`, which every
 * supported OS ships).
 *
 * Every download is refused unless the vendor's own metadata supplies a
 * checksum and the file matches it.
 */
import { createHash, randomUUID } from 'node:crypto'
import {
  chmodSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { open } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createInflateRaw } from 'node:zlib'

const GITHUB_RELEASES = {
  ghidra: {
    api: 'https://api.github.com/repos/NationalSecurityAgency/ghidra/releases/latest',
    asset: /^ghidra_[\w.-]+_PUBLIC_\d+\.zip$/,
  },
  apktool: {
    api: 'https://api.github.com/repos/iBotPeaches/Apktool/releases/latest',
    asset: /^apktool_[\d.]+\.jar$/,
  },
}
/**
 * Known-good releases, used only when GitHub's API cannot be read (the
 * unauthenticated limit is 60 requests an hour per address, which shared
 * networks exhaust). The hashes are the ones GitHub published for these files.
 */
const GITHUB_FALLBACK = {
  ghidra: {
    url: 'https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_12.2_build/ghidra_12.2_PUBLIC_20261016.zip',
    name: 'ghidra_12.2_PUBLIC_20261016.zip',
    checksum: '2c2cd776db3c1f6a097ba418922378ac3649cadd5e844a6f5f088ae628a7be67',
  },
  apktool: {
    url: 'https://github.com/iBotPeaches/Apktool/releases/download/v3.0.3/apktool_3.0.3.jar',
    name: 'apktool_3.0.3.jar',
    checksum: 'dbf930b076c6b9be08d57c449cacefc3bdd6b71ebd59b3066fc0e1f5b14f9423',
  },
}
const ADOPTIUM_API = 'https://api.adoptium.net/v3/assets/latest/21/hotspot'
const ANDROID_REPOSITORY = 'https://dl.google.com/android/repository/'

/** Where each engine comes from; shown as the button's tooltip. */
export const DOWNLOAD_SOURCES = {
  ghidra: 'download from github.com/NationalSecurityAgency/ghidra',
  java: 'download Temurin 21 from adoptium.net',
  apktool: 'download from github.com/iBotPeaches/Apktool',
  adb: 'download platform-tools from dl.google.com',
}

/** Where downloaded engines live: `$DSH_HOME/rea-engines`. */
export function enginesRoot() {
  return join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'rea-engines')
}

const ALLOWED_HOSTS = new Set(['api.github.com', 'github.com', 'api.adoptium.net', 'dl.google.com'])
const MAX_DOWNLOAD_BYTES = 2 * 1024 ** 3

/**
 * Which engines can be fetched on this machine. Linux on ARM has no Ghidra
 * native decompiler and no Google platform-tools; Temurin 21 has no Windows
 * on ARM build.
 */
export function canDownload(engineId, platform = process.platform, arch = process.arch) {
  const known = ['darwin', 'linux', 'win32'].includes(platform) && ['x64', 'arm64'].includes(arch)
  if (!known || !Object.hasOwn(DOWNLOAD_SOURCES, engineId)) return false
  if (engineId === 'apktool') return true
  if (platform === 'linux' && arch !== 'x64' && engineId !== 'java') return false
  if (platform === 'win32' && arch !== 'x64' && engineId === 'java') return false
  return true
}

function assertAllowed(url) {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(`Refusing to download from ${parsed.origin}`)
  }
  return parsed.href
}

async function getJson(url, fetchImpl) {
  const response = await fetchImpl(assertAllowed(url), {
    headers: { accept: 'application/vnd.github+json, application/json', 'user-agent': 'dsh-rea-gate' },
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`${new URL(url).hostname} answered ${response.status}`)
  return response.json()
}

async function getText(url, fetchImpl) {
  const response = await fetchImpl(assertAllowed(url), {
    headers: { 'user-agent': 'dsh-rea-gate' },
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) throw new Error(`${new URL(url).hostname} answered ${response.status}`)
  return response.text()
}

/** Resolve the official archive for an engine: `{ url, name, algorithm, checksum, label }`. */
export async function resolveAsset(engineId, { platform, arch, fetch: fetchImpl }) {
  if (!canDownload(engineId, platform, arch)) {
    throw new Error(`${engineId} cannot be downloaded for ${platform}/${arch}`)
  }
  if (engineId === 'ghidra' || engineId === 'apktool') {
    const source = GITHUB_RELEASES[engineId]
    const fallback = GITHUB_FALLBACK[engineId]
    let found = null
    try {
      const release = await getJson(source.api, fetchImpl)
      const asset = (release.assets ?? []).find((item) => source.asset.test(item.name))
      const digest = /^sha256:([0-9a-f]{64})$/i.exec(asset?.digest ?? '')
      if (asset && digest) found = { url: asset.browser_download_url, name: asset.name, checksum: digest[1].toLowerCase() }
    } catch {
      // Rate limited or unreachable: fall back to the pinned release below.
    }
    found ??= fallback
    return {
      url: found.url,
      name: found.name,
      algorithm: 'sha256',
      checksum: found.checksum,
      label: found.name.replace(/\.(zip|jar)$/, ''),
    }
  }
  if (engineId === 'java') {
    const os = { darwin: 'mac', linux: 'linux', win32: 'windows' }[platform]
    const architecture = arch === 'arm64' ? 'aarch64' : 'x64'
    const query = new URLSearchParams({ architecture, image_type: 'jdk', os, vendor: 'eclipse' })
    const releases = await getJson(`${ADOPTIUM_API}?${query}`, fetchImpl)
    const pkg = releases?.[0]?.binary?.package
    if (!pkg?.link || !/^[0-9a-f]{64}$/i.test(pkg.checksum ?? '')) {
      throw new Error('Adoptium returned no Temurin 21 archive with a SHA-256 for this machine')
    }
    return {
      url: pkg.link,
      name: pkg.name,
      algorithm: 'sha256',
      checksum: pkg.checksum.toLowerCase(),
      label: pkg.name.replace(/\.(zip|tar\.gz)$/, ''),
    }
  }
  // adb: Google's SDK repository manifest lists the archive and its checksum.
  const xml = await getText(`${ANDROID_REPOSITORY}repository2-3.xml`, fetchImpl)
  const block = /<remotePackage path="platform-tools">([\s\S]*?)<\/remotePackage>/.exec(xml)?.[1]
  const hostOs = { darwin: 'macosx', linux: 'linux', win32: 'windows' }[platform]
  const archive = block && [...block.matchAll(/<archive>([\s\S]*?)<\/archive>/g)]
    .map((match) => match[1])
    .find((text) => new RegExp(`<host-os>${hostOs}</host-os>`).test(text))
  const checksum = archive && /<checksum type="(sha1|sha256)">([0-9a-f]+)<\/checksum>/i.exec(archive)
  const file = archive && /<url>([^<]+)<\/url>/.exec(archive)?.[1]
  if (!checksum || !file) throw new Error('Google published no platform-tools archive for this machine')
  return {
    url: `${ANDROID_REPOSITORY}${file}`,
    name: file,
    algorithm: checksum[1].toLowerCase(),
    checksum: checksum[2].toLowerCase(),
    label: `platform-tools-${/_r([\d.]+)-/.exec(file)?.[1] ?? 'latest'}`,
  }
}

/** Download `url` to `dest` and keep it only when it matches the vendor's checksum. */
export async function downloadVerified({ url, dest, algorithm, checksum, fetch: fetchImpl }) {
  const response = await fetchImpl(assertAllowed(url), {
    headers: { 'user-agent': 'dsh-rea-gate' },
    redirect: 'follow',
    signal: AbortSignal.timeout(30 * 60_000),
  })
  if (!response.ok || !response.body) throw new Error(`${new URL(url).hostname} answered ${response.status}`)
  if (response.url && new URL(response.url).protocol !== 'https:') throw new Error('The download was redirected away from HTTPS')
  const hash = createHash(algorithm)
  let received = 0
  try {
    await pipeline(
      Readable.fromWeb(response.body),
      async function* verify(source) {
        for await (const chunk of source) {
          received += chunk.length
          if (received > MAX_DOWNLOAD_BYTES) throw new Error('The download is larger than expected')
          hash.update(chunk)
          yield chunk
        }
      },
      createWriteStream(dest),
    )
  } catch (error) {
    rmSync(dest, { force: true })
    throw error
  }
  const actual = hash.digest('hex')
  if (actual !== checksum) {
    rmSync(dest, { force: true })
    throw new Error(`Checksum mismatch for ${basename(dest)}: expected ${checksum}, got ${actual}`)
  }
}

/** Unpack a zip (stored or deflated, no zip64, no encryption) into `dest`. */
export async function extractZip(file, dest) {
  const root = resolve(dest)
  mkdirSync(root, { recursive: true })
  const handle = await open(file, 'r')
  try {
    const { size } = await handle.stat()
    const tailLength = Math.min(size, 65_557)
    const tail = Buffer.alloc(tailLength)
    await handle.read(tail, 0, tailLength, size - tailLength)
    let end = -1
    for (let i = tailLength - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === 0x06054b50) { end = i; break }
    }
    if (end < 0) throw new Error('Not a zip archive')
    const count = tail.readUInt16LE(end + 10)
    const directorySize = tail.readUInt32LE(end + 12)
    const directoryOffset = tail.readUInt32LE(end + 16)
    if (count === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
      throw new Error('Zip64 archives are not supported')
    }
    const directory = Buffer.alloc(directorySize)
    await handle.read(directory, 0, directorySize, directoryOffset)

    let position = 0
    for (let index = 0; index < count; index++) {
      if (directory.readUInt32LE(position) !== 0x02014b50) throw new Error('Corrupt zip directory')
      const madeBy = directory.readUInt16LE(position + 4)
      const flags = directory.readUInt16LE(position + 8)
      const method = directory.readUInt16LE(position + 10)
      const compressedSize = directory.readUInt32LE(position + 20)
      const nameLength = directory.readUInt16LE(position + 28)
      const extraLength = directory.readUInt16LE(position + 30)
      const commentLength = directory.readUInt16LE(position + 32)
      const attributes = directory.readUInt32LE(position + 38)
      const headerOffset = directory.readUInt32LE(position + 42)
      const name = directory.toString('utf8', position + 46, position + 46 + nameLength).replaceAll('\\', '/')
      position += 46 + nameLength + extraLength + commentLength

      const target = resolve(root, name)
      if (target !== root && !target.startsWith(root + sep)) throw new Error(`Unsafe path in archive: ${name}`)
      if (name.endsWith('/')) {
        mkdirSync(target, { recursive: true })
        continue
      }
      if (flags & 1) throw new Error('Encrypted zip entries are not supported')
      const mode = madeBy >> 8 === 3 ? attributes >>> 16 : 0
      if ((mode & 0o170000) === 0o120000) continue // symbolic links are not needed by any engine
      mkdirSync(join(target, '..'), { recursive: true })

      if (compressedSize === 0) {
        writeFileSync(target, '')
      } else {
        const local = Buffer.alloc(30)
        await handle.read(local, 0, 30, headerOffset)
        if (local.readUInt32LE(0) !== 0x04034b50) throw new Error('Corrupt zip entry header')
        const start = headerOffset + 30 + local.readUInt16LE(26) + local.readUInt16LE(28)
        const raw = createReadStream(file, { start, end: start + compressedSize - 1 })
        if (method === 0) await pipeline(raw, createWriteStream(target))
        else if (method === 8) await pipeline(raw, createInflateRaw(), createWriteStream(target))
        else throw new Error(`Unsupported zip compression method ${method}`)
      }
      if (mode & 0o111) chmodSync(target, mode & 0o777)
    }
  } finally {
    await handle.close()
  }
}

/** The single top-level folder an archive unpacks into, or the folder itself. */
function archiveRoot(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
  return entries.length === 1 && entries[0].isDirectory() ? join(dir, entries[0].name) : dir
}

function javaHomeIn(dir) {
  for (const home of [dir, join(dir, 'Contents', 'Home')]) {
    if (existsSync(join(home, 'bin', 'java')) || existsSync(join(home, 'bin', 'java.exe'))) return home
  }
  return null
}

function writeApktoolWrapper(dir, platform) {
  if (platform === 'win32') {
    const wrapper = join(dir, 'apktool.bat')
    writeFileSync(wrapper, [
      '@echo off',
      'setlocal',
      'set "JAVACMD=java"',
      'if defined JAVA_HOME if exist "%JAVA_HOME%\\bin\\java.exe" set "JAVACMD=%JAVA_HOME%\\bin\\java.exe"',
      '"%JAVACMD%" -jar "%~dp0apktool.jar" %*',
      '',
    ].join('\r\n'))
    return wrapper
  }
  const wrapper = join(dir, 'apktool')
  writeFileSync(wrapper, [
    '#!/bin/sh',
    'dir=$(cd "$(dirname "$0")" && pwd)',
    'if [ -n "$JAVA_HOME" ] && [ -x "$JAVA_HOME/bin/java" ]; then java="$JAVA_HOME/bin/java"; else java=java; fi',
    'exec "$java" -jar "$dir/apktool.jar" "$@"',
    '',
  ].join('\n'))
  chmodSync(wrapper, 0o755)
  return wrapper
}

/** What a finished install exposes to REA, or null when the folder is incomplete. */
function discover(engineId, dir, platform) {
  if (engineId === 'ghidra') {
    return existsSync(join(dir, 'ghidraRun')) ? { GHIDRA_INSTALL_DIR: dir } : null
  }
  if (engineId === 'java') {
    const home = javaHomeIn(dir)
    return home ? { JAVA_HOME: home } : null
  }
  if (engineId === 'apktool') {
    const wrapper = join(dir, platform === 'win32' ? 'apktool.bat' : 'apktool')
    return existsSync(wrapper) && existsSync(join(dir, 'apktool.jar')) ? { REA_APKTOOL_COMMAND: wrapper } : null
  }
  const adb = join(dir, platform === 'win32' ? 'adb.exe' : 'adb')
  return existsSync(adb) ? { REA_ADB_PATH: adb } : null
}

/**
 * Download, verify and unpack one engine.
 *
 * `options`: `root` (install folder), `run(command, args, timeout)` for `tar`,
 * `hasJava()` (engines that run on a JDK install Temurin first when there is
 * none), and `platform`/`arch`/`fetch` for tests.
 * Resolves `{ discovered, logs }` and throws a readable Error on failure.
 */
export async function installEngineByDownload(engineId, options) {
  const platform = options.platform ?? process.platform
  const arch = options.arch ?? process.arch
  const fetchImpl = options.fetch ?? globalThis.fetch
  const logs = []
  const discovered = {}

  if ((engineId === 'ghidra' || engineId === 'apktool') && options.hasJava && !options.hasJava()) {
    const java = await installEngineByDownload('java', options)
    Object.assign(discovered, java.discovered)
    logs.push(...java.logs)
  }

  const asset = await resolveAsset(engineId, { platform, arch, fetch: fetchImpl })
  const engineDir = join(options.root, engineId)
  const finalDir = join(engineDir, asset.label)
  const existing = existsSync(finalDir) ? discover(engineId, finalDir, platform) : null
  if (existing) {
    logs.push(`${asset.label} is already installed in ${finalDir}`)
    return { discovered: { ...discovered, ...existing }, logs }
  }

  const work = join(options.root, '.tmp', randomUUID())
  mkdirSync(work, { recursive: true })
  try {
    const archive = join(work, asset.name)
    await downloadVerified({ url: asset.url, dest: archive, algorithm: asset.algorithm, checksum: asset.checksum, fetch: fetchImpl })
    logs.push(`Downloaded ${asset.name} (${asset.algorithm} verified)`)

    const unpacked = join(work, 'unpacked')
    mkdirSync(unpacked)
    if (asset.name.endsWith('.jar')) {
      renameSync(archive, join(unpacked, 'apktool.jar'))
      writeApktoolWrapper(unpacked, platform)
    } else if (asset.name.endsWith('.tar.gz')) {
      const result = await options.run('tar', ['-xzf', archive, '-C', unpacked], 600_000)
      if (!result.ok) throw new Error(result.err || 'tar could not unpack the archive')
    } else {
      await extractZip(archive, unpacked)
    }

    const source = asset.name.endsWith('.jar') ? unpacked : archiveRoot(unpacked)
    mkdirSync(engineDir, { recursive: true })
    rmSync(finalDir, { recursive: true, force: true })
    renameSync(source, finalDir)
    const found = discover(engineId, finalDir, platform)
    if (!found) throw new Error(`${asset.label} unpacked without the files REA needs`)
    Object.assign(discovered, found)
    logs.push(`Installed ${asset.label} in ${finalDir}`)

    // Keep only the version just installed.
    for (const entry of readdirSync(engineDir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== asset.label) {
        rmSync(join(engineDir, entry.name), { recursive: true, force: true })
      }
    }
    return { discovered, logs }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

/** True when `dir` holds an installed engine, for tests and diagnostics. */
export function installedEngineDir(root, engineId) {
  const engineDir = join(root, engineId)
  try {
    return readdirSync(engineDir).map((name) => join(engineDir, name)).find((dir) => statSync(dir).isDirectory()) ?? null
  } catch {
    return null
  }
}
