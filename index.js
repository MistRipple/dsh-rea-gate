/**
 * dsh-rea-gate — per-session gate for the REA toolset.
 *
 * The REA MCP server stays installed and runs once for the whole Host. This
 * plugin only decides which agents may see its tools: an agent created while the
 * gate is closed gets a `tools.restrict({ deny })` mask on its own scope, so the
 * mcp__rea__* definitions never reach that session's prompt. Opening the gate
 * disposes that mask, which takes effect immediately in the same session.
 *
 * Every step degrades safely: a gate that cannot resolve tool names hides
 * nothing rather than throwing inside agent creation.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { delimiter, dirname, isAbsolute, join } from 'node:path'
import { execFile } from 'node:child_process'

/**
 * A linked bundle directory cannot resolve the dsh installation's own packages,
 * so `defineTool` is optional: without it the registry receives the plain
 * definition object instead of failing the whole plugin.
 */
let defineTool
try {
  ;({ defineTool } = await import('@deepseek-ai/dsh-tools'))
} catch {}

const PREFIX = 'mcp__rea__'
const STATE_FILE = 'rea-gate.json'

// These are the caller-supplied engine settings that REA reads from the
// harness environment or cordis.patch.yml.
const ENGINE_ENV = {
  ghidra: ['GHIDRA_INSTALL_DIR', 'JAVA_HOME'],
  hopper: ['HOPPER_LAUNCHER_PATH'],
  ida: ['REA_IDA_MCP_CONFIG'],
  jadx: ['REA_JADX_MCP_JAR', 'JAVA_HOME'],
  apktool: ['REA_APKTOOL_COMMAND'],
  adb: ['REA_ADB_PATH'],
  kuna: ['REA_KUNA_COMMAND'],
  java: ['JAVA_HOME'],
}
const ALLOWED_ENGINE_ENV = new Set(Object.values(ENGINE_ENV).flat())
const ENGINE_INSTALLERS = {
  ghidra: { args: ['install', 'ghidra'], label: 'brew install ghidra' },
  java: { args: ['install', 'openjdk@21'], label: 'brew install openjdk@21' },
  apktool: { args: ['install', 'apktool'], label: 'brew install apktool' },
  adb: { args: ['install', '--cask', 'android-platform-tools'], label: 'brew install --cask android-platform-tools' },
}
const COMMANDS = {
  install: ['setup', '--client', 'dsh', '--yes'],
  reinstall: ['setup', '--client', 'dsh', '--yes'],
  update: ['update'],
  uninstall: ['uninstall'],
}
const DOCTOR_TTL = 30_000
// The panel's first paint must not wait for a slow `rea doctor`. A bounded wait
// returns the cached view with `checks: 'pending'`, and the browser re-reads
// once the run settles.
const DOCTOR_WAIT_MS = Number(process.env.REA_GATE_DOCTOR_WAIT_MS ?? 2_500) || 2_500

export const name = 'dsh-rea-gate'
export const inject = ['tools']

function statePath() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, STATE_FILE)
}

function readState() {
  try {
    const parsed = JSON.parse(readFileSync(statePath(), 'utf8'))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const workspaces = Object.create(null)
      if (parsed.workspaces && typeof parsed.workspaces === 'object' && !Array.isArray(parsed.workspaces)) {
        for (const [path, open] of Object.entries(parsed.workspaces)) {
          if (path !== '') workspaces[path] = open === true
        }
      }
      const env = Object.create(null)
      if (parsed.env && typeof parsed.env === 'object' && !Array.isArray(parsed.env)) {
        for (const [key, value] of Object.entries(parsed.env)) {
          if (ALLOWED_ENGINE_ENV.has(key) && typeof value === 'string' && value.trim()) {
            env[key] = value.trim()
          }
        }
      }
      return { default: parsed.default === true, workspaces, env }
    }
  } catch {}
  return { default: false, workspaces: Object.create(null), env: Object.create(null) }
}

function writeState(state) {
  const file = statePath()
  const temporary = `${file}.${randomUUID()}.tmp`
  const payload = {
    default: state.default === true,
    workspaces: state.workspaces ?? {},
  }
  const envEntries = Object.entries(state.env ?? {}).filter(([k, v]) => ALLOWED_ENGINE_ENV.has(k) && typeof v === 'string' && v.trim())
  if (envEntries.length > 0) payload.env = Object.fromEntries(envEntries)
  try {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
    renameSync(temporary, file)
    return true
  } catch {
    try { rmSync(temporary, { force: true }) } catch {}
    return false
  }
}

/** The directory the session works in; the key its choice is remembered under. */
function workspaceOf(agent) {
  const candidates = [
    agent?.session?.header?.cwd,
    agent?.session?.header?.workspace,
    agent?.options?.cwd,
    agent?.session?.cwd,
    agent?.cwd,
  ]
  for (const value of candidates) {
    if (typeof value === 'string' && value.length > 0) return value
  }
  return null
}

function isOpen(state, workspace) {
  if (workspace && Object.hasOwn(state.workspaces, workspace)) {
    return state.workspaces[workspace] === true
  }
  return state.default === true
}

function effectiveEnv(state, extra = {}) {
  return { ...process.env, ...(state?.env ?? {}), ...extra }
}

function detectHomebrewPrefix() {
  if (process.env.REA_GATE_SKIP_DOCTOR === '1') return null
  if (process.platform !== 'darwin') return null
  for (const prefix of ['/opt/homebrew', '/usr/local']) {
    if (existsSync(join(prefix, 'bin', 'brew'))) return prefix
  }
  return null
}

function findBinary(command, extraDirs = []) {
  if (command === 'rea' && process.env.REA_BIN) return process.env.REA_BIN
  const searchDirs = [
    ...extraDirs.filter(Boolean),
    '/opt/homebrew/bin',
    '/usr/local/bin',
    dirname(process.execPath),
    ...(process.env.PATH ? process.env.PATH.split(delimiter) : []),
  ]
  const seen = new Set()
  for (const dir of searchDirs) {
    if (!dir || seen.has(dir)) continue
    seen.add(dir)
    const candidate = join(dir, command)
    if (existsSync(candidate)) return candidate
  }
  return command
}

function probeJavaHome(env, brewPrefix) {
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
  const merged = effectiveEnv(state)
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

function parseJsonOutput(result) {
  if (!result?.out) return null
  try {
    const parsed = JSON.parse(result.out)
    return parsed?.data ?? parsed
  } catch {
    return null
  }
}

function doctorEngineState(doctor, state, brewPrefix) {
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
          : [{ name: 'java', ok: false, detail: '未检测到可用的 JDK（JAVA_HOME 与系统/Homebrew 均未找到）。', remediation: null }],
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
            ? [{ name: engine.id, ok: false, detail: `未找到指定路径：${configuredCmd}`, remediation: null }]
            : [],
      }
    }
    return engine
  })
}

/** REA tool names visible in one scope, discovered instead of hardcoded. */
function reaNames(ctx, scope) {
  try {
    const schemas = ctx.tools.schemas(scope)
    if (Array.isArray(schemas)) {
      const names = []
      for (const entry of schemas) {
        const name = typeof entry === 'string' ? entry : entry?.name
        if (typeof name === 'string' && name.startsWith(PREFIX)) names.push(name)
      }
      if (names.length > 0) return names
    }
  } catch {}
  return []
}

function runCommand(command, args, timeout = 180_000, options = {}) {
  const extraDirs = options.extraDirs ?? []
  const executable = findBinary(command, extraDirs)
  const baseEnv = options.env ?? process.env
  const pathParts = [
    ...extraDirs,
    isAbsolute(executable) ? dirname(executable) : null,
    '/opt/homebrew/bin',
    '/usr/local/bin',
    dirname(process.execPath),
    baseEnv.PATH,
  ].filter(Boolean)
  const env = { ...baseEnv, PATH: [...new Set(pathParts)].join(delimiter) }
  return new Promise((resolve) => {
    execFile(executable, args, { env, timeout, maxBuffer: 8 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        code: error?.code ?? 0,
        out: String(stdout ?? '').trim(),
        err: String(stderr ?? '').trim() || error?.message || '',
      })
    })
  })
}

async function resolveNpmGlobalBin() {
  const result = await runCommand('npm', ['prefix', '-g'], 15_000)
  if (!result.ok || !result.out) return null
  const prefix = result.out.split(/\r?\n/)[0]?.trim()
  if (!prefix) return null
  return process.platform === 'win32' ? prefix : join(prefix, 'bin')
}

export function apply(ctx) {
  /** agent -> disposer that lifts the deny mask */
  const gates = new Map()
  /** The policy applied to each agent, independently of later workspace edits. */
  const agentChoices = new WeakMap()
  /** session id -> { agent, workspace }, for the browser control */
  const sessions = new Map()
  const log = ctx.logger?.('dsh-rea-gate')
  /** The host's live-agent table; used when a session predates a plugin reload. */
  let liveAgents
  ctx.inject(['agents'], (agentCtx) => {
    liveAgents = agentCtx.agents
    agentCtx.effect(() => () => {
      if (liveAgents === agentCtx.agents) liveAgents = undefined
    })
    reconcileExistingAgents()
  })

  /** Resolve a session's agent from the creation cache or the host table. */
  function sessionEntry(sessionId) {
    if (typeof sessionId !== 'string' || sessionId.length === 0) return undefined
    const cached = sessions.get(sessionId)
    if (cached) return cached
    const agent = liveAgents?.get?.(sessionId)
    if (!agent) return undefined
    const entry = { agent, workspace: workspaceOf(agent) }
    sessions.set(sessionId, entry)
    // A lazily resolved session must match the policy before its state is read.
    applyChoice(agent, isOpen(readState(), entry.workspace))
    return entry
  }

  let diagnosis = { report: null, cli: null, checkedAt: 0 }
  let diagnosing
  let maintenance

  function inspectRea(force = false, extraDirs = []) {
    if (process.env.REA_GATE_SKIP_DOCTOR === '1') return Promise.resolve(diagnosis)
    if (diagnosing) return diagnosing
    if (!force && Date.now() - diagnosis.checkedAt < DOCTOR_TTL) return Promise.resolve(diagnosis)
    const env = effectiveEnv(readState())
    diagnosing = runCommand('rea', ['doctor', '--client', 'dsh', '--format', 'json'], 30_000, { env, extraDirs })
      .then(async (result) => {
        if (result.code === 'ENOENT' && extraDirs.length === 0) {
          const npmBin = await resolveNpmGlobalBin()
          if (npmBin) {
            result = await runCommand('rea', ['doctor', '--client', 'dsh', '--format', 'json'], 30_000, { env, extraDirs: [npmBin] })
          }
        }
        const report = parseJsonOutput(result)
        const cli = report ? 'available' : result.code === 'ENOENT' ? 'missing' : 'unavailable'
        diagnosis = { report, cli, checkedAt: Date.now() }
        return diagnosis
      })
      // A background run must never reject: a timed-out reader already moved on.
      .catch(() => diagnosis)
      .finally(() => { diagnosing = undefined })
    return diagnosing
  }

  /** Wait for the diagnosis at most `waitMs`; false means it is still running. */
  function inspectReaWithin(force, waitMs) {
    const running = inspectRea(force)
    if (!running) return Promise.resolve(true)
    let timer
    const expiry = new Promise((resolve) => {
      timer = setTimeout(() => resolve(false), waitMs)
      timer?.unref?.()
    })
    return Promise.race([running.then(() => true, () => true), expiry])
      .finally(() => clearTimeout(timer))
  }

  async function syncRegistrationWithEnv(state, extraDirs = []) {
    if (process.env.REA_GATE_SKIP_DOCTOR === '1') return { ok: true, out: '', err: '' }
    const env = effectiveEnv(state)
    return runCommand('rea', COMMANDS.install, 180_000, { env, extraDirs })
  }

  async function maintain(action, options = {}) {
    if (maintenance) {
      return { ok: false, message: 'Another REA maintenance action is already running.' }
    }
    maintenance = (async () => {
      const state = readState()
      const env = effectiveEnv(state)
      let extraDirs = []
      let result

      if (action === 'reinstall') {
        result = await runCommand('npm', ['install', '--global', 'rea-agents@latest'], 300_000, { env })
        if (result.ok) {
          const npmBin = await resolveNpmGlobalBin()
          if (npmBin) extraDirs = [npmBin]
          const setupResult = await runCommand('rea', COMMANDS.install, 180_000, { env, extraDirs })
          result = {
            ok: setupResult.ok,
            code: setupResult.code,
            out: [result.out, setupResult.out].filter(Boolean).join('\n'),
            err: [result.err, setupResult.err].filter(Boolean).join('\n'),
          }
        }
      } else if (action === 'uninstall') {
        result = await runCommand('rea', COMMANDS.uninstall, 180_000, { env })
        if (result.code === 'ENOENT' && options.removePackage) {
          result = { ok: true, code: 0, out: '', err: '' }
        }
        if (result.ok && options.removePackage) {
          const removeResult = await runCommand('npm', ['uninstall', '--global', 'rea-agents'], 180_000, { env })
          result = {
            ok: removeResult.ok,
            code: removeResult.code,
            out: [result.out, removeResult.out].filter(Boolean).join('\n'),
            err: [result.err, removeResult.err].filter(Boolean).join('\n'),
          }
        }
      } else {
        result = await runCommand('rea', COMMANDS[action], 180_000, { env })
        if (action === 'install' && result.code === 'ENOENT' && !process.env.REA_BIN) {
          const npmResult = await runCommand('npm', ['install', '--global', 'rea-agents@latest'], 300_000, { env })
          if (npmResult.ok) {
            const npmBin = await resolveNpmGlobalBin()
            if (npmBin) extraDirs = [npmBin]
            const setupResult = await runCommand('rea', COMMANDS.install, 180_000, { env, extraDirs })
            result = {
              ok: setupResult.ok,
              code: setupResult.code,
              out: [npmResult.out, setupResult.out].filter(Boolean).join('\n'),
              err: [npmResult.err, setupResult.err].filter(Boolean).join('\n'),
            }
          } else {
            result = npmResult
          }
        }
      }

      await diagnosing
      await inspectRea(true, extraDirs)
      const output = (result.ok ? result.out || result.err : result.err || result.out).slice(0, 12_000)
      return { ok: result.ok, message: output }
    })()
    try {
      return await maintenance
    } finally {
      maintenance = undefined
    }
  }

  async function installEngine(engineId) {
    const installer = Object.hasOwn(ENGINE_INSTALLERS, engineId) ? ENGINE_INSTALLERS[engineId] : null
    if (!installer) return { ok: false, message: `Unsupported engine installer: ${engineId}` }
    const brewPrefix = detectHomebrewPrefix()
    if (!brewPrefix) {
      return { ok: false, message: '未检测到 Homebrew，请点击官方链接手动安装并配置路径。' }
    }
    if (maintenance) {
      return { ok: false, message: 'Another REA maintenance action is already running.' }
    }
    maintenance = (async () => {
      const brewResult = await runCommand('brew', installer.args, 600_000)
      if (!brewResult.ok) {
        const output = (brewResult.err || brewResult.out).slice(0, 12_000)
        return { ok: false, message: output || `Homebrew failed while running: ${installer.label}` }
      }
      const state = readState()
      const discovered = {}
      if (engineId === 'ghidra') {
        const ghidraDir = join(brewPrefix, 'opt', 'ghidra', 'libexec')
        if (existsSync(ghidraDir)) discovered.GHIDRA_INSTALL_DIR = ghidraDir
        const javaInfo = probeJavaHome(effectiveEnv(state), brewPrefix)
        if (javaInfo.available && javaInfo.home && !state.env.JAVA_HOME && !process.env.JAVA_HOME?.trim()) {
          discovered.JAVA_HOME = javaInfo.home
        }
      } else if (engineId === 'java') {
        const preferred = join(brewPrefix, 'opt', 'openjdk@21', 'libexec/openjdk.jdk/Contents/Home')
        const javaHome = existsSync(join(preferred, 'bin', 'java'))
          ? preferred
          : probeJavaHome(effectiveEnv(state), brewPrefix).home
        if (javaHome) discovered.JAVA_HOME = javaHome
      } else if (engineId === 'apktool') {
        const bin = join(brewPrefix, 'bin', 'apktool')
        if (existsSync(bin)) discovered.REA_APKTOOL_COMMAND = bin
      } else if (engineId === 'adb') {
        const bin = join(brewPrefix, 'bin', 'adb')
        if (existsSync(bin)) discovered.REA_ADB_PATH = bin
      }

      const logs = [brewResult.out].filter(Boolean)
      if (Object.keys(discovered).length > 0) {
        state.env = { ...state.env, ...discovered }
        writeState(state)
        const sync = await syncRegistrationWithEnv(state)
        if (!sync.ok && sync.code !== 'ENOENT') {
          logs.push(sync.err || sync.out)
        }
      }
      await diagnosing
      await inspectRea(true)
      return { ok: true, message: logs.join('\n').slice(0, 12_000) }
    })()
    try {
      return await maintenance
    } finally {
      maintenance = undefined
    }
  }

  async function setEngineEnv(values) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      return { ok: false, message: 'Expected an environment mapping.' }
    }
    const entries = Object.entries(values)
    if (entries.length === 0) return { ok: false, message: 'No environment variables provided.' }
    for (const [key, value] of entries) {
      if (!ALLOWED_ENGINE_ENV.has(key) || typeof value !== 'string') {
        return { ok: false, message: `Unsupported environment variable: ${key}` }
      }
    }
    if (maintenance) {
      return { ok: false, message: 'Another REA maintenance action is already running.' }
    }
    maintenance = (async () => {
      const state = readState()
      let hasNonEmpty = false
      for (const [key, raw] of entries) {
        const cleaned = raw.trim().replace(/^(['"])(.*)\1$/, '$2').trim()
        if (cleaned) {
          state.env[key] = cleaned
          hasNonEmpty = true
        } else {
          delete state.env[key]
        }
      }
      if (!writeState(state)) {
        return { ok: false, message: 'Could not save the engine environment settings.' }
      }
      let syncNote = ''
      if (hasNonEmpty) {
        const sync = await syncRegistrationWithEnv(state)
        if (!sync.ok && sync.code !== 'ENOENT') {
          syncNote = (sync.err || sync.out).slice(0, 4_000)
        }
      }
      await diagnosing
      await inspectRea(true)
      return { ok: true, message: syncNote }
    })()
    try {
      return await maintenance
    } finally {
      maintenance = undefined
    }
  }

  function closeGate(agent) {
    if (gates.has(agent)) return gates.get(agent)
    // Keep a local mask even if an ancestor already hides these global tools.
    const names = reaNames(ctx)
    if (names.length === 0) return null
    try {
      const dispose = agent.ctx.tools.restrict({ deny: names })
      gates.set(agent, dispose)
      return dispose
    } catch (error) {
      log?.warn?.(`could not hide REA tools: ${error?.message ?? error}`)
      return null
    }
  }

  function openGate(agent) {
    const dispose = gates.get(agent)
    if (!dispose) return
    try {
      dispose()
    } catch {}
    gates.delete(agent)
  }

  function applyChoice(agent, open) {
    agentChoices.set(agent, open)
    if (open) openGate(agent)
    else closeGate(agent)
  }

  /** Apply the saved policy to agents that existed before this plugin instance loaded. */
  function reconcileExistingAgents() {
    if (!liveAgents?.list) return
    const live = liveAgents.list()
    // Drop bookkeeping for sessions that left the registry while this instance
    // was not loaded; their scopes already unwound the deny masks.
    const liveIds = new Set()
    const liveSet = new Set(live)
    for (const agent of live) {
      const sessionId = agent?.session?.header?.id
      if (typeof sessionId === 'string') liveIds.add(sessionId)
    }
    for (const [sessionId, entry] of sessions) {
      if (!liveIds.has(sessionId) && !liveSet.has(entry.agent)) sessions.delete(sessionId)
    }
    for (const agent of live) {
      try {
        const sessionId = agent?.session?.header?.id
        const workspace = workspaceOf(agent)
        if (typeof sessionId === 'string' && !sessions.has(sessionId)) {
          sessions.set(sessionId, { agent, workspace })
        }
        applyChoice(agent, isOpen(readState(), workspace))
      } catch (error) {
        log?.warn?.(`could not apply the REA gate to an existing session: ${error?.message ?? error}`)
      }
    }
  }

  /**
   * An agent that left the registry needs no bookkeeping: its scope already
   * unwound the deny mask, and holding the reference would keep the session
   * (and its transcript) alive for the lifetime of the host process.
   */
  function forgetAgent(agent) {
    gates.delete(agent)
    const sessionId = agent?.session?.header?.id
    if (typeof sessionId !== 'string') return
    const entry = sessions.get(sessionId)
    if (entry && entry.agent === agent) sessions.delete(sessionId)
  }

  // The creation payload is { agent, source, signal }; only its `agent` has a ctx.
  ctx.on('agent/created', (...args) => {
    const agent = args[0]?.agent
    if (!agent || typeof agent !== 'object') return
    try {
      const workspace = workspaceOf(agent)
      const sessionId = agent?.session?.header?.id
      if (typeof sessionId === 'string') sessions.set(sessionId, { agent, workspace })
      applyChoice(agent, isOpen(readState(), workspace))
    } catch {}
  })

  // The disposal payload is `{ agent }`, like creation.
  ctx.on('agent/disposed', (...args) => {
    const agent = args[0]?.agent
    if (!agent || typeof agent !== 'object') return
    try {
      forgetAgent(agent)
    } catch {}
  })

  /** Persist a default or workspace choice and optionally apply it to one agent. */
  function setOpen(workspace, open, agent) {
    const state = readState()
    if (workspace) state.workspaces[workspace] = open
    else state.default = open
    const saved = writeState(state)
    if (agent) applyChoice(agent, open)
    return saved
  }

  function stateFor(sessionId) {
    const entry = sessionId ? sessionEntry(sessionId) : undefined
    const workspace = entry?.workspace ?? null
    const state = readState()
    const registered = reaNames(ctx).length
    const tools = entry?.agent ? reaNames(ctx, entry.agent).length : 0
    const { report, cli, checkedAt } = diagnosis
    const identity = report?.identity
    const registration = (identity?.registrations ?? report?.registrations)?.find((item) => item.client === 'dsh')
    const liveServer = identity?.live_server ?? report?.live_server
    const installed = registration?.state === 'missing'
      ? false
      : Boolean(registration || registered > 0 || tools > 0)
    const brewPrefix = detectHomebrewPrefix()
    return {
      open: (entry?.agent && agentChoices.get(entry.agent)) ?? isOpen(state, workspace),
      workspace,
      installed,
      registeredTools: registered,
      tools,
      cli,
      checkedAt: checkedAt || null,
      version: identity?.cli_package_version ?? null,
      registration: registration
        ? { state: registration.state, path: registration.config_path ?? null }
        : null,
      doctor: report
        ? { liveServer: liveServer?.state ?? 'unknown' }
        : null,
      default: state.default,
      sessionKnown: entry !== undefined,
      capabilities: { homebrew: Boolean(brewPrefix) },
      workspaces: Object.entries(state.workspaces)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([path, open]) => ({ path, open: open === true })),
      engines: doctorEngineState(report, state, brewPrefix),
    }
  }

  // Browser controls use exact routes on the /api bridge.
  //
  // Registered from a child plugin that injects `connection`, not from `apply`
  // itself: this bundle's own `inject` stays ['tools'] so the gate keeps working
  // in compositions with no web carrier. Reading `ctx.connection` directly here
  // is useless — an undeclared service is undefined, and the previous version
  // skipped both routes silently for exactly that reason.
  ctx.inject(['connection'], (routeCtx) => {
    const json = (body, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
    const url = (request) => new URL(request.url ?? '/', 'http://rea-gate.invalid')

    // An exact route is reached only by owner Peers and only after the carrier's
    // Host/Origin and cookie checks, so it needs no rejection fence of its own.
    routeCtx.effect(
      () =>
        routeCtx.connection.fetch.register({
          path: '/api/dsh-rea-gate/state',
          methods: ['GET'],
          requestBody: 'buffered',
          fetch: async (request) => {
            const params = url(request).searchParams
            const session = params.get('session') ?? undefined
            const checks = params.get('checks') !== '0'
            // A slow `rea doctor` must not hold the first paint. The reader gets
            // the cached view plus `checks: 'pending'` and asks again once the
            // background run settles.
            const settled = checks
              ? await inspectReaWithin(params.get('refresh') === '1', DOCTOR_WAIT_MS)
              : true
            return json({ ...(await stateFor(session)), checks: settled ? 'done' : 'pending' })
          },
        }),
      'dsh-rea-gate: state route',
    )

    routeCtx.effect(
      () =>
        routeCtx.connection.fetch.register({
          path: '/api/dsh-rea-gate/diagnose',
          methods: ['GET'],
          requestBody: 'buffered',
          fetch: async () => {
            try {
              const graph = routeCtx.get?.('clientModules')?.graph()
              return json({
                package: name,
                graph: graph ? {
                  rev: graph.rev,
                  selfPresent: graph.entries.some((entry) => entry.id === name),
                } : null,
              })
            } catch {
              return json({ package: name, graph: null, error: 'Could not read the client module graph.' }, 503)
            }
          },
        }),
      'dsh-rea-gate: diagnose route',
    )

    routeCtx.effect(
      () =>
        routeCtx.connection.fetch.register({
          path: '/api/dsh-rea-gate/toggle',
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: async (request) => {
            const body = await request.json().catch(() => null)
            if (typeof body?.action === 'string' && Object.hasOwn(COMMANDS, body.action)) {
              const result = await maintain(body.action, { removePackage: body.removePackage === true })
              const sessionId = typeof body?.session === 'string' ? body.session : undefined
              return json({ ...stateFor(sessionId), ...result }, result.ok ? 200 : 409)
            }
            if (body?.action === 'install-engine' && typeof body.engine === 'string') {
              const result = await installEngine(body.engine)
              return json({ ...stateFor(), ...result }, result.ok ? 200 : 409)
            }
            if (body?.action === 'set-env' && body.values && typeof body.values === 'object') {
              const result = await setEngineEnv(body.values)
              return json({ ...stateFor(), ...result }, result.ok ? 200 : 400)
            }
            if (body?.action === 'reset-workspace' && typeof body.workspace === 'string' && body.workspace.length > 0) {
              const state = readState()
              delete state.workspaces[body.workspace]
              const saved = writeState(state)
              return json({ ...stateFor(), ok: saved, message: saved ? '' : 'Could not save the REA gate preference.' })
            }
            if (body?.action === 'check-update') {
              const result = await runCommand('npm', ['view', 'rea-agents', 'dist-tags.latest', '--json'], 15_000)
              const latest = parseJsonOutput(result)
              return typeof latest === 'string'
                ? json({ latest })
                : json({ ok: false, message: 'Could not read the latest stable REA version from npm.' }, 502)
            }
            if (typeof body?.open !== 'boolean' || body.action !== undefined) {
              return json({ ok: false, message: 'Expected an open/closed choice.' }, 400)
            }
            if (body.workspace !== undefined &&
                (typeof body.workspace !== 'string' || body.workspace.length === 0 || body.session !== undefined)) {
              return json({ ok: false, message: 'Expected one workspace path.' }, 400)
            }
            if (body.remember !== undefined && typeof body.remember !== 'boolean') {
              return json({ ok: false, message: 'Expected remember to be a boolean.' }, 400)
            }
            const entry = body.session !== undefined ? sessionEntry(body.session) : undefined
            if (body.session !== undefined && !entry) {
              return json({ ok: false, message: 'This session is not active in the host.' }, 404)
            }
            if (body.remember === false && !entry) {
              return json({ ok: false, message: 'A temporary change requires an active session.' }, 400)
            }
            if (body.remember === false) {
              applyChoice(entry.agent, body.open)
              return json({ ...stateFor(body.session), remembered: false, ok: true })
            }
            const workspace = body.workspace ?? entry?.workspace ?? null
            // A session-scoped control with no workspace cannot be remembered.
            // Apply it to that session instead of silently changing the global
            // default; an explicit `remember: true` is rejected.
            if (entry && workspace === null) {
              if (body.remember === true) {
                return json({
                  ok: false,
                  message: 'This session has no workspace directory; pass remember:false for a temporary change.',
                }, 400)
              }
              applyChoice(entry.agent, body.open)
              return json({ ...stateFor(body.session), remembered: false, ok: true })
            }
            const saved = setOpen(workspace, body.open, entry?.agent)
            return json({
              ...stateFor(body.session),
              remembered: saved && workspace !== null,
              ok: saved,
              message: saved ? '' : 'Could not save the REA gate preference.',
            })
          },
        }),
      'dsh-rea-gate: toggle route',
    )
  })

  ctx.effect(() => {
    return () => {
      for (const dispose of gates.values()) {
        try {
          dispose()
        } catch {}
      }
      gates.clear()
    }
  })

  const definition = {
    name: 'rea_gate',
    description:
      'Read or change whether this session can use the REA reverse-engineering tools. '
      + 'The choice is remembered per workspace directory, so it also applies to later sessions there.',
    parameters: {
      action: {
        type: 'string',
        required: true,
        enum: ['status', 'on', 'off', 'install', 'update', 'uninstall'],
        description:
          'status reports the current state; on exposes REA tools to this session; off hides them; '
          + 'install sets up REA for DSH; update updates the REA installation; uninstall removes REA-owned agent registrations and skill files.',
      },
      remember: {
        type: 'boolean',
        description: 'For on or off, set false to change only this session. The default is to save the workspace choice.',
      },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args, exec) {
      const agent = exec?.agent
      const workspace = workspaceOf(agent)
      const state = readState()

      if (Object.hasOwn(COMMANDS, args.action)) {
        const result = await maintain(args.action)
        const lines = [
          args.action === 'install'
            ? (result.ok ? 'REA is registered with DSH.' : 'REA registration failed.')
            : args.action === 'update'
              ? (result.ok ? 'REA was updated.' : 'REA update failed.')
              : (result.ok ? 'REA-owned integrations and skill files were removed.' : 'REA removal failed.'),
        ]
        if (result.message) lines.push(result.message)
        if (!result.ok) lines.push('Run `rea doctor` in a terminal for details.')
        lines.push('Restart DSH if the tool list does not change in the next session.')
        return lines.join('\n')
      }

      if (!workspace && !(agent && args.remember === false)) {
        return 'REA gate: this session has no workspace directory, so the choice cannot be remembered. '
          + `The global default is ${state.default ? 'open' : 'closed'}.`
      }

      if (args.action === 'on' || args.action === 'off') {
        const open = args.action === 'on'
        if (args.remember === false && agent) applyChoice(agent, open)
        else if (!setOpen(workspace, open, agent)) {
          return `REA is now ${open ? 'available' : 'hidden'} in this session, but the choice could not be saved for ${workspace}.`
        }
      }

      const open = (agent && agentChoices.get(agent)) ?? isOpen(readState(), workspace)
      const count = agent ? reaNames(ctx, agent).length : 0
      return [
        `REA is ${open ? 'available' : 'hidden'} in this session.`,
        workspace ? `Workspace: ${workspace}` : 'Workspace: none',
        `REA tools visible in this session: ${count}.`,
        open ? 'Turn it off with action "off".' : 'Turn it on with action "on".',
      ].join('\n')
    },
  }

  try {
    ctx.tools.register(defineTool ? defineTool(definition) : definition)
  } catch (error) {
    log?.warn?.(`could not register rea_gate: ${error?.message ?? error}`)
  }
}
