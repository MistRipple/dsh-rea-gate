/**
 * Analysis-engine knowledge: which environment variables each engine reads,
 * how to probe the local machine when `rea doctor` has nothing to say, and how
 * to validate a value before it is saved.
 */
import { existsSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { effectiveEnv, findBinary } from './rea-cli.js'

// The caller-supplied engine settings REA reads from the harness environment
// or from the DSH registration.
export const ENGINE_ENV = {
  ghidra: ['GHIDRA_INSTALL_DIR', 'JAVA_HOME'],
  hopper: ['HOPPER_LAUNCHER_PATH'],
  ida: ['REA_IDA_MCP_CONFIG'],
  jadx: ['REA_JADX_MCP_JAR', 'JAVA_HOME'],
  apktool: ['REA_APKTOOL_COMMAND'],
  adb: ['REA_ADB_PATH'],
  kuna: ['REA_KUNA_COMMAND'],
  java: ['JAVA_HOME'],
}
export const ALLOWED_ENGINE_ENV = new Set(Object.values(ENGINE_ENV).flat())

/**
 * What each variable must point at. REA itself rejects relative paths for
 * these, so the plugin refuses them up front instead of saving a value that
 * `rea doctor` will only complain about later.
 */
const ENV_KIND = {
  GHIDRA_INSTALL_DIR: 'dir',
  JAVA_HOME: 'dir',
  HOPPER_LAUNCHER_PATH: 'any',
  REA_IDA_MCP_CONFIG: 'file',
  REA_JADX_MCP_JAR: 'file',
  REA_APKTOOL_COMMAND: 'file',
  REA_ADB_PATH: 'file',
  REA_KUNA_COMMAND: 'file',
}

export const ENGINE_INSTALLERS = {
  ghidra: { args: ['install', 'ghidra'], label: 'brew install ghidra' },
  java: { args: ['install', 'openjdk@21'], label: 'brew install openjdk@21' },
  apktool: { args: ['install', 'apktool'], label: 'brew install apktool' },
  adb: { args: ['install', '--cask', 'android-platform-tools'], label: 'brew install --cask android-platform-tools' },
}

/**
 * Clean and validate one value for `key`. An empty value clears the setting.
 * `tr(zh, en)` picks the message language.
 */
export function normalizeEnvValue(key, raw, tr) {
  let value = String(raw).trim().replace(/^(['"])(.*)\1$/, '$2').trim()
  if (value === '') return { ok: true, value: '' }
  if (value === '~' || value.startsWith('~/')) value = join(homedir(), value.slice(1))
  if (/[\0\r\n]/.test(value)) {
    return { ok: false, message: tr(`${key} 含有非法字符。`, `${key} contains invalid characters.`) }
  }
  if (!isAbsolute(value)) {
    return { ok: false, message: tr(`${key} 必须是绝对路径：${value}`, `${key} must be an absolute path: ${value}`) }
  }
  let stat
  try {
    stat = statSync(value)
  } catch {
    return { ok: false, message: tr(`路径不存在：${value}`, `Path does not exist: ${value}`) }
  }
  const kind = ENV_KIND[key]
  if (kind === 'dir' && !stat.isDirectory()) {
    return { ok: false, message: tr(`${key} 需要指向目录：${value}`, `${key} must point to a directory: ${value}`) }
  }
  if (kind === 'file' && !stat.isFile()) {
    return { ok: false, message: tr(`${key} 需要指向文件：${value}`, `${key} must point to a file: ${value}`) }
  }
  return { ok: true, value }
}

export function probeJavaHome(env, brewPrefix) {
  const configured = env.JAVA_HOME?.trim()
  if (configured && existsSync(join(configured, 'bin', 'java'))) {
    return { available: true, home: configured, configured: true }
  }
  const candidates = []
  if (brewPrefix) {
    const optDir = join(brewPrefix, 'opt')
    try {
      const jdkDirs = readdirSync(optDir)
        .filter((name) => name === 'openjdk' || /^openjdk@\d+$/.test(name))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      for (const dir of jdkDirs) {
        candidates.push(join(optDir, dir, 'libexec/openjdk.jdk/Contents/Home'))
      }
    } catch {}
  }
  try {
    for (const dir of readdirSync('/Library/Java/JavaVirtualMachines')) {
      candidates.push(join('/Library/Java/JavaVirtualMachines', dir, 'Contents/Home'))
    }
  } catch {}
  for (const home of candidates) {
    if (existsSync(join(home, 'bin', 'java'))) {
      return { available: true, home, configured: Boolean(configured) }
    }
  }
  return { available: false, home: null, configured: Boolean(configured) }
}

function engineState(state, brewPrefix) {
  const savedEnv = state?.env ?? {}
  return Object.entries(ENGINE_ENV).map(([id, names]) => {
    const variables = names.map((varName) => {
      const savedValue = savedEnv[varName] ?? null
      const hostSet = Boolean(process.env[varName]?.trim())
      return {
        name: varName,
        set: Boolean(savedValue || hostSet),
        value: savedValue,
        fromHostEnv: Boolean(!savedValue && hostSet),
      }
    })
    const installer = ENGINE_INSTALLERS[id]
    return {
      id,
      configured: variables[0].set,
      variables,
      canInstall: Boolean(installer && brewPrefix),
      installCommand: installer?.label ?? null,
    }
  })
}

/**
 * Merge `rea doctor`'s provider inspections into the engine list. Doctor owns
 * the verdict when it has one; the local probes below only fill in for engines
 * it did not cover (and never run when doctor is disabled).
 */
export function doctorEngineState(doctor, state, brewPrefix, tr) {
  const skipLocalProbe = process.env.REA_GATE_SKIP_DOCTOR === '1'
  const merged = effectiveEnv(state)
  const inspections = new Map((doctor?.providerInspections ?? []).map((item) => [item.id, item]))
  return engineState(state, brewPrefix).map((engine) => {
    const inspection = inspections.get(engine.id)
    const checks = inspection?.checks ?? doctor?.checks?.filter((item) => item.name === engine.id) ?? []
    if (inspection || checks.length > 0) {
      return {
        ...engine,
        checked: true,
        configured: inspection?.configured ?? engine.configured,
        available: inspection?.available ?? checks.every((item) => item.ok === true),
        version: inspection?.providerVersion ?? null,
        checks: checks.map(({ name, ok, detail, remediation }) => ({ name, ok: ok === true, detail, remediation })),
      }
    }
    if (skipLocalProbe) return engine
    if (engine.id === 'java') {
      const probed = probeJavaHome(merged, brewPrefix)
      return {
        ...engine,
        checked: true,
        configured: probed.configured || probed.available,
        available: probed.available,
        checks: probed.available
          ? [{ name: 'java', ok: true, detail: probed.home, remediation: null }]
          : [{
            name: 'java',
            ok: false,
            detail: tr(
              '未检测到可用的 JDK（JAVA_HOME 与系统/Homebrew 均未找到）。',
              'No usable JDK found (neither JAVA_HOME nor the system or Homebrew locations).',
            ),
            remediation: null,
          }],
      }
    }
    if (engine.id === 'apktool' || engine.id === 'adb') {
      const envKey = ENGINE_ENV[engine.id][0]
      const configuredCmd = merged[envKey]?.trim()
      const candidate = configuredCmd || findBinary(engine.id)
      const found = isAbsolute(candidate) && existsSync(candidate)
      return {
        ...engine,
        checked: true,
        configured: Boolean(configuredCmd) || found,
        available: found,
        checks: found
          ? [{ name: engine.id, ok: true, detail: candidate, remediation: null }]
          : configuredCmd
            ? [{
              name: engine.id,
              ok: false,
              detail: tr(`未找到指定路径：${configuredCmd}`, `The configured path was not found: ${configuredCmd}`),
              remediation: null,
            }]
            : [],
      }
    }
    return engine
  })
}
