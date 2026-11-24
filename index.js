/**
 * dsh-rea-gate — per-session gate for the REA toolset.
 *
 * The REA MCP server stays installed and runs once for the whole Host. This
 * plugin only decides which agents may see its tools: an agent created while the
 * gate is closed gets a `tools.restrict({ deny })` mask on its own scope, so the
 * mcp__rea__* definitions never reach that session's prompt. Opening the gate
 * disposes that mask, which takes effect immediately in the same session.
 *
 * A gate that cannot hide anything yet (REA still connecting, a failed restrict
 * call, tools added by an update) is retried by a sweep and reported through
 * `exposed`, instead of silently leaving the session unmasked.
 *
 * Layout: lib/state.js is the saved default and engine settings, lib/rea-cli.js
 * the REA/npm/brew calls, lib/engines.js engine settings; this file is the gate,
 * the owner routes and the agent tool.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import {
  COMMANDS,
  HEALTHY_REGISTRATION,
  detectHomebrewPrefix,
  effectiveEnv,
  installReaPackage,
  parseJsonOutput,
  resolveNpmGlobalBin,
  runCommand,
} from './lib/rea-cli.js'
import { canDownload, enginesRoot, installEngineByDownload } from './lib/engine-download.js'
import { pickPath } from './lib/pick-path.js'
import {
  ALLOWED_ENGINE_ENV,
  ENGINE_INSTALLERS,
  doctorEngineState,
  normalizeEnvValue,
  probeJavaHome,
} from './lib/engines.js'
import { isOpen, readState, updateState } from './lib/state.js'

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
const DOCTOR_TTL = 30_000
// How often closed sessions are checked for REA tools that appeared after them.
const SWEEP_MS = 5_000
// The panel's first paint must not wait for a slow `rea doctor`. A bounded wait
// returns the cached view with `checks: 'pending'`, and the browser re-reads
// once the run settles.
const DOCTOR_WAIT_MS = Number(process.env.REA_GATE_DOCTOR_WAIT_MS ?? 2_500) || 2_500
/** Survives a plugin reload because it lives on the agent, not in this closure. */
const CHOICE = Symbol.for('dsh-rea-gate.choice')

export const name = 'dsh-rea-gate'
export const inject = ['tools']

/** Messages shown in the panel follow the browser's language; the rest is English. */
function translator(request) {
  const header = request?.headers?.get?.('accept-language') ?? ''
  const zh = /^\s*zh/i.test(header)
  return (chinese, english) => (zh ? chinese : english)
}
const english = (_chinese, text) => text

/** The directory the session works in, for display only. */
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

/** Join two command results into one, as if they had been a single step. */
function chain(first, second) {
  return {
    ok: second.ok,
    code: second.code,
    out: [first.out, second.out].filter(Boolean).join('\n'),
    err: [first.err, second.err].filter(Boolean).join('\n'),
  }
}

export function apply(ctx) {
  /** agent -> disposers that lift its deny masks (one per closeGate top-up) */
  const gates = new Map()
  /** agents whose choice is "closed"; the sweep keeps their masks complete */
  const closedAgents = new Set()
  /** closed agents that could not be fully masked yet */
  const pendingGates = new Set()
  /** agent -> { open }; mirrored on the agent so a reload keeps it */
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

  function getChoice(agent) {
    return agentChoices.get(agent) ?? agent?.[CHOICE]
  }

  function setChoice(agent, choice) {
    agentChoices.set(agent, choice)
    try {
      Object.defineProperty(agent, CHOICE, { value: choice, configurable: true, writable: true, enumerable: false })
    } catch {}
  }

  /**
   * Resolve a session's agent. The host table is the truth when it is
   * available: a cached entry for the same id may point at a different agent
   * (a sub-agent created later, or a session whose agent was replaced).
   */
  function sessionEntry(sessionId) {
    if (typeof sessionId !== 'string' || sessionId.length === 0) return undefined
    const cached = sessions.get(sessionId)
    const live = liveAgents?.get?.(sessionId)
    if (cached && (!live || live === cached.agent)) return cached
    const agent = live ?? cached?.agent
    if (!agent) return undefined
    const entry = { agent, workspace: workspaceOf(agent) }
    sessions.set(sessionId, entry)
    // A lazily resolved session must match the policy before its state is read.
    if (!getChoice(agent)) applyChoice(agent, isOpen(readState()))
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
    const doctor = ['doctor', '--client', 'dsh', '--format', 'json']
    diagnosing = runCommand('rea', doctor, 30_000, { env, extraDirs })
      .then(async (result) => {
        if (result.code === 'ENOENT' && extraDirs.length === 0) {
          const npmBin = await resolveNpmGlobalBin()
          if (npmBin) result = await runCommand('rea', doctor, 30_000, { env, extraDirs: [npmBin] })
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
    return runCommand('rea', COMMANDS.install, 180_000, { env: effectiveEnv(state), extraDirs })
  }

  /**
   * Run one maintenance task at a time. Installs, updates and brew runs change
   * global state, so a second request while one is running is refused rather
   * than queued.
   */
  async function exclusive(task, tr) {
    if (maintenance) {
      return { ok: false, busy: true, message: tr('已有另一项 REA 维护操作正在运行。', 'Another REA maintenance action is already running.') }
    }
    maintenance = task()
    try {
      return await maintenance
    } finally {
      maintenance = undefined
    }
  }

  function maintain(action, options = {}, tr = english) {
    return exclusive(async () => {
      const env = effectiveEnv(readState())
      let extraDirs = []
      let result

      if (action === 'reinstall') {
        result = await installReaPackage(env)
        if (result.ok) {
          const npmBin = await resolveNpmGlobalBin()
          if (npmBin) extraDirs = [npmBin]
          result = chain(result, await runCommand('rea', COMMANDS.install, 180_000, { env, extraDirs }))
        }
      } else if (action === 'uninstall') {
        result = await runCommand('rea', COMMANDS.uninstall, 180_000, { env })
        if (result.code === 'ENOENT' && options.removePackage) {
          result = { ok: true, code: 0, out: '', err: '' }
        }
        if (result.ok && options.removePackage) {
          result = chain(result, await runCommand('npm', ['uninstall', '--global', 'rea-agents'], 180_000, { env }))
        }
      } else {
        result = await runCommand('rea', COMMANDS[action], 180_000, { env })
        if (action === 'install' && result.code === 'ENOENT' && !process.env.REA_BIN) {
          const npmResult = await installReaPackage(env)
          if (npmResult.ok) {
            const npmBin = await resolveNpmGlobalBin()
            if (npmBin) extraDirs = [npmBin]
            result = chain(npmResult, await runCommand('rea', COMMANDS.install, 180_000, { env, extraDirs }))
          } else {
            result = npmResult
          }
        }
      }

      await diagnosing
      await inspectRea(true, extraDirs)
      const output = (result.ok ? result.out || result.err : result.err || result.out).slice(0, 12_000)
      return { ok: result.ok, message: output }
    }, tr)
  }

  async function installEngine(engineId, tr = english) {
    const installer = Object.hasOwn(ENGINE_INSTALLERS, engineId) ? ENGINE_INSTALLERS[engineId] : null
    if (!installer) return { ok: false, status: 400, message: `Unsupported engine installer: ${engineId}` }
    const brewPrefix = detectHomebrewPrefix()
    if (!brewPrefix && !canDownload(engineId)) {
      return { ok: false, status: 409, message: tr('这台机器暂不支持一键安装该引擎，请点击官方链接手动安装并配置路径。', 'One-click install is not available for this engine on this machine. Use the official link to install it and set its path by hand.') }
    }
    if (!brewPrefix) return downloadEngine(engineId, tr)
    return exclusive(async () => {
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
        updateState((current) => { current.env = { ...current.env, ...discovered } })
        const sync = await syncRegistrationWithEnv(readState())
        if (!sync.ok && sync.code !== 'ENOENT') {
          logs.push(sync.err || sync.out)
        }
      }
      await diagnosing
      await inspectRea(true)
      return { ok: true, message: logs.join('\n').slice(0, 12_000) }
    }, tr)
  }

  /**
   * The same one-click install for machines without Homebrew (Linux, Windows,
   * and macOS without brew): fetch the official archive, verify it, unpack it
   * and point REA at it.
   */
  function downloadEngine(engineId, tr) {
    return exclusive(async () => {
      let installed
      try {
        installed = await installEngineByDownload(engineId, {
          root: enginesRoot(),
          run: (command, args, timeout) => runCommand(command, args, timeout),
          hasJava: () => {
            const state = readState()
            return probeJavaHome(effectiveEnv(state), null).available
          },
        })
      } catch (error) {
        return { ok: false, message: String(error?.message ?? error).slice(0, 12_000) }
      }
      const discovered = { ...installed.discovered }
      const logs = [...installed.logs]
      if (Object.keys(discovered).length > 0) {
        updateState((current) => { current.env = { ...current.env, ...discovered } })
        const sync = await syncRegistrationWithEnv(readState())
        if (!sync.ok && sync.code !== 'ENOENT') logs.push(sync.err || sync.out)
      }
      await diagnosing
      await inspectRea(true)
      return { ok: true, message: logs.join('\n').slice(0, 12_000) }
    }, tr)
  }

  async function setEngineEnv(values, tr = english) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      return { ok: false, status: 400, message: 'Expected an environment mapping.' }
    }
    const entries = Object.entries(values)
    if (entries.length === 0) return { ok: false, status: 400, message: 'No environment variables provided.' }
    // Validate everything before saving anything: a bad value must not leave a
    // half-applied change behind.
    const cleaned = {}
    for (const [key, raw] of entries) {
      if (!ALLOWED_ENGINE_ENV.has(key) || typeof raw !== 'string') {
        return { ok: false, status: 400, message: `Unsupported environment variable: ${key}` }
      }
      const checked = normalizeEnvValue(key, raw, tr)
      if (!checked.ok) return { ok: false, status: 400, message: checked.message }
      cleaned[key] = checked.value
    }
    return exclusive(async () => {
      let changed = false
      const saved = updateState((state) => {
        for (const [key, value] of Object.entries(cleaned)) {
          if ((state.env[key] ?? '') === value) continue
          changed = true
          if (value) state.env[key] = value
          else delete state.env[key]
        }
      })
      if (!saved) {
        return { ok: false, message: tr('无法保存引擎环境变量配置。', 'Could not save the engine environment settings.') }
      }
      let syncNote = ''
      // Clearing a value changes the registration just as much as setting one.
      if (changed) {
        const sync = await syncRegistrationWithEnv(readState())
        if (!sync.ok && sync.code !== 'ENOENT') {
          syncNote = (sync.err || sync.out).slice(0, 4_000)
        }
      }
      await diagnosing
      await inspectRea(true)
      return { ok: true, message: syncNote }
    }, tr)
  }

  /**
   * Make sure a closed agent cannot see any REA tool. The first call masks every
   * registered REA name (so the local mask holds even if an ancestor already
   * hides them); later calls only add the names that have appeared or leaked
   * since. Returns true when nothing is left to hide, false when the agent
   * still needs another attempt.
   */
  function closeGate(agent) {
    const masks = gates.get(agent) ?? []
    const names = masks.length === 0 ? reaNames(ctx) : reaNames(ctx, agent)
    if (names.length === 0) {
      // Either the agent is already fully hidden, or REA is not registered yet
      // (the MCP server connects after startup or after an update). In the
      // second case the sweep retries once the tools show up.
      if (masks.length === 0) {
        log?.warn?.('REA tools are not registered yet; the gate will close once they appear')
        pendingGates.add(agent)
        return false
      }
      pendingGates.delete(agent)
      return true
    }
    try {
      masks.push(agent.ctx.tools.restrict({ deny: names }))
      gates.set(agent, masks)
      pendingGates.delete(agent)
      return true
    } catch (error) {
      log?.warn?.(`could not hide REA tools: ${error?.message ?? error}`)
      pendingGates.add(agent)
      return false
    }
  }

  function openGate(agent) {
    pendingGates.delete(agent)
    closedAgents.delete(agent)
    const masks = gates.get(agent)
    if (!masks) return
    for (const dispose of masks) {
      try {
        dispose()
      } catch {}
    }
    gates.delete(agent)
  }

  /**
   * Set one session's own switch. Saved rules decide a session's first state
   * only; after that the session keeps its choice, also across a plugin reload.
   */
  function applyChoice(agent, open) {
    setChoice(agent, { open })
    if (open) {
      openGate(agent)
    } else {
      closedAgents.add(agent)
      closeGate(agent)
    }
  }

  /**
   * Re-close agents whose mask is missing tools: REA connected after the agent
   * was created, a restrict call failed, or an update added new tools. Runs only
   * when the registered REA tool set changed or an earlier attempt failed.
   */
  let sweptSignature = null
  function sweepGates(registered = reaNames(ctx)) {
    const signature = registered.join('\n')
    if (signature === sweptSignature && pendingGates.size === 0) return
    sweptSignature = signature
    for (const agent of [...closedAgents]) closeGate(agent)
  }

  /** Every agent this instance knows about: created ones and the host's live table. */
  function knownAgents() {
    const agents = new Set()
    for (const { agent } of sessions.values()) agents.add(agent)
    try {
      for (const agent of liveAgents?.list?.() ?? []) agents.add(agent)
    } catch {}
    return agents
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
        // A choice made before the reload is still that session's choice; only
        // a session this plugin never saw takes the saved policy.
        const previous = getChoice(agent)
        applyChoice(agent, previous ? previous.open : isOpen(readState()))
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
    closedAgents.delete(agent)
    pendingGates.delete(agent)
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
      // The first agent of a session owns the entry; a later agent that reports
      // the same id (a sub-agent) is still gated but must not displace it.
      if (typeof sessionId === 'string' && !sessions.has(sessionId)) sessions.set(sessionId, { agent, workspace })
      applyChoice(agent, isOpen(readState()))
    } catch (error) {
      log?.warn?.(`could not apply the REA gate to a new session: ${error?.message ?? error}`)
    }
  })

  // The disposal payload is `{ agent }`, like creation.
  ctx.on('agent/disposed', (...args) => {
    const agent = args[0]?.agent
    if (!agent || typeof agent !== 'object') return
    try {
      forgetAgent(agent)
    } catch {}
  })

  /** Persist the default that new sessions start from. Running sessions keep their own switch. */
  function setDefault(open) {
    return updateState((state) => { state.default = open })
  }

  function stateFor(sessionId, tr = english) {
    const entry = sessionId ? sessionEntry(sessionId) : undefined
    const workspace = entry?.workspace ?? null
    const state = readState()
    const registeredNames = reaNames(ctx)
    sweepGates(registeredNames)
    const registered = registeredNames.length
    const tools = entry?.agent ? reaNames(ctx, entry.agent).length : 0
    const open = (entry?.agent && getChoice(entry.agent)?.open) ?? isOpen(state)
    const { report, cli, checkedAt } = diagnosis
    const identity = report?.identity
    const registration = (identity?.registrations ?? report?.registrations)?.find((item) => item.client === 'dsh')
    const liveServer = identity?.live_server ?? report?.live_server
    const installed = registration?.state === 'missing'
      ? false
      : Boolean(registration || registered > 0 || tools > 0)
    const brewPrefix = detectHomebrewPrefix()
    return {
      open,
      // The gate is closed but the session can still see REA tools.
      exposed: open === false && tools > 0,
      workspace,
      installed,
      registeredTools: registered,
      tools,
      cli,
      checkedAt: checkedAt || null,
      version: identity?.cli_package_version ?? null,
      registration: registration
        ? {
          state: registration.state,
          path: registration.config_path ?? null,
          healthy: HEALTHY_REGISTRATION.has(registration.state),
        }
        : null,
      doctor: report
        ? { liveServer: liveServer?.state ?? 'unknown' }
        : null,
      default: state.default,
      sessionKnown: entry !== undefined,
      capabilities: { homebrew: Boolean(brewPrefix) },
      engines: doctorEngineState(report, state, brewPrefix, tr),
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
    /** A failed command is a server-side failure; an overlapping request is a conflict. */
    const outcomeStatus = (result) => (result.ok ? 200 : result.busy ? 409 : result.status ?? 500)

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
            return json({ ...stateFor(session, translator(request)), checks: settled ? 'done' : 'pending' })
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
            const tr = translator(request)
            const body = await request.json().catch(() => null)
            if (typeof body?.action === 'string' && Object.hasOwn(COMMANDS, body.action)) {
              const result = await maintain(body.action, { removePackage: body.removePackage === true }, tr)
              const sessionId = typeof body?.session === 'string' ? body.session : undefined
              return json({ ...stateFor(sessionId, tr), ...result }, outcomeStatus(result))
            }
            if (body?.action === 'install-engine' && typeof body.engine === 'string') {
              const result = await installEngine(body.engine, tr)
              return json({ ...stateFor(undefined, tr), ...result }, outcomeStatus(result))
            }
            if (body?.action === 'set-env' && body.values && typeof body.values === 'object') {
              const result = await setEngineEnv(body.values, tr)
              return json({ ...stateFor(undefined, tr), ...result }, outcomeStatus(result))
            }
            if (body?.action === 'pick-path' && (body.kind === 'dir' || body.kind === 'file')) {
              // The panel knows which language it shows; the header may disagree with it.
              const say = body.lang === 'zh' ? (chinese) => chinese : body.lang === 'en' ? (_chinese, text) => text : tr
              const picked = await pickPath(
                body.kind,
                body.kind === 'dir' ? say('选择文件夹', 'Choose a folder') : say('选择文件', 'Choose a file'),
              )
              if (picked.ok) return json({ ok: true, path: picked.path })
              const message = picked.unsupported
                ? tr('这台机器没有可用的文件选择对话框（Linux 需要 zenity 或 kdialog），请直接填写路径。', 'No file dialog is available on this machine (Linux needs zenity or kdialog). Type the path instead.')
                : picked.message
              return json({ ok: false, unsupported: picked.unsupported === true, message }, picked.unsupported ? 501 : 500)
            }
            if (body?.action === 'check-update') {
              const result = await runCommand('npm', ['view', 'rea-agents', 'dist-tags.latest', '--json'], 15_000)
              const latest = parseJsonOutput(result)
              return typeof latest === 'string'
                ? json({ latest })
                : json({ ok: false, message: tr('无法从 npm 读取 REA 最新稳定版本。', 'Could not read the latest stable REA version from npm.') }, 502)
            }
            if (typeof body?.open !== 'boolean' || body.action !== undefined) {
              return json({ ok: false, message: 'Expected an open/closed choice.' }, 400)
            }
            // Per-workspace rules are gone. A stale client must not have its
            // workspace request read as a change to the global default.
            if (body.workspace !== undefined || body.remember !== undefined) {
              return json({ ok: false, message: 'Per-workspace rules are no longer supported.' }, 400)
            }
            // `{ session, open }` switches that one session and saves nothing;
            // `{ open }` alone sets the default that new sessions start from.
            const entry = body.session !== undefined ? sessionEntry(body.session) : undefined
            if (body.session !== undefined && !entry) {
              return json({ ok: false, message: 'This session is not active in the host.' }, 404)
            }
            if (entry) {
              applyChoice(entry.agent, body.open)
              return json({ ...stateFor(body.session, tr), ok: true })
            }
            const saved = setDefault(body.open)
            return json({
              ...stateFor(undefined, tr),
              ok: saved,
              message: saved ? '' : tr('无法保存 REA 门控偏好。', 'Could not save the REA gate preference.'),
            })
          },
        }),
      'dsh-rea-gate: toggle route',
    )
  })

  ctx.effect(() => {
    const timer = setInterval(() => {
      try {
        sweepGates()
      } catch (error) {
        log?.warn?.(`REA gate sweep failed: ${error?.message ?? error}`)
      }
    }, SWEEP_MS)
    timer.unref?.()
    return () => {
      clearInterval(timer)
      for (const masks of gates.values()) {
        for (const dispose of masks) {
          try {
            dispose()
          } catch {}
        }
      }
      gates.clear()
      closedAgents.clear()
      pendingGates.clear()
    }
  })

  // The model may only read or flip the gate. Installing, updating and removing
  // REA run global package-manager commands, so they stay behind the owner's
  // panel: an agent that is analysing an untrusted sample must not be able to
  // reach them, whatever the sample tells it to do. A model-initiated change is
  // session-only and never touches the saved default.
  const definition = {
    name: 'rea_gate',
    description:
      'Read or change whether this session can use the REA reverse-engineering tools. '
      + 'A change applies to this session only.',
    parameters: {
      action: {
        type: 'string',
        required: true,
        enum: ['status', 'on', 'off'],
        description: 'status reports the current state; on exposes REA tools to this session; off hides them.',
      },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args, exec) {
      const agent = exec?.agent
      const action = args?.action

      if (action !== 'status' && action !== 'on' && action !== 'off') {
        return 'REA gate: only status, on and off are available to the agent. '
          + 'Install, update and uninstall are managed from the REA panel in DSH.'
      }

      if (action === 'on' || action === 'off') {
        if (!agent) return 'REA gate: no active session to change.'
        applyChoice(agent, action === 'on')
      }

      const state = readState()
      const open = (agent && getChoice(agent)?.open) ?? isOpen(state)
      const count = agent ? reaNames(ctx, agent).length : 0
      const lines = [
        `REA is ${open ? 'available' : 'hidden'} in this session.`,
        `New sessions start ${state.default ? 'open' : 'closed'} (set in the REA panel).`,
        `REA tools visible in this session: ${count}.`,
        open ? 'Turn it off with action "off".' : 'Turn it on with action "on".',
      ]
      if (!open && count > 0) lines.push('Warning: the gate is closed but some REA tools are still visible.')
      return lines.join('\n')
    },
  }

  try {
    ctx.tools.register(defineTool ? defineTool(definition) : definition)
  } catch (error) {
    log?.warn?.(`could not register rea_gate: ${error?.message ?? error}`)
  }
}
