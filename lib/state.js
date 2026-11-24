/**
 * The saved gate policy (`$DSH_HOME/rea-gate.json`) and the notion of a
 * "workspace" it is keyed by.
 */
import { mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { ALLOWED_ENGINE_ENV } from './engines.js'

const STATE_FILE = 'rea-gate.json'

export function statePath() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, STATE_FILE)
}

/**
 * A git worktree's `.git` is a file pointing at `<main>/.git/worktrees/<name>`.
 * All worktrees of one repository share one workspace rule, keyed by the main
 * checkout.
 */
function worktreeMainRoot(dir) {
  try {
    const dotGit = join(dir, '.git')
    if (!statSync(dotGit).isFile()) return null
    const match = /^gitdir:\s*(.+)$/m.exec(readFileSync(dotGit, 'utf8'))
    if (!match) return null
    const parts = resolve(dir, match[1].trim()).split(sep)
    const at = parts.lastIndexOf('worktrees')
    if (at > 1 && parts[at - 1] === '.git') return parts.slice(0, at - 1).join(sep) || sep
  } catch {}
  return null
}

/**
 * The key a directory is remembered under: symlinks and case resolved, trailing
 * separators dropped, and a git worktree mapped to its main checkout. Paths that
 * do not exist any more are only normalised lexically.
 */
export function canonicalWorkspace(path) {
  if (typeof path !== 'string') return null
  const trimmed = path.trim()
  if (trimmed === '' || !isAbsolute(trimmed)) return trimmed === '' ? null : trimmed
  let resolved = resolve(trimmed)
  try {
    resolved = realpathSync.native(resolved)
  } catch {}
  return worktreeMainRoot(resolved) ?? resolved
}

/** True when `child` is `parent` or lies below it. */
export function isInside(child, parent) {
  if (child === parent) return true
  return child.startsWith(parent.endsWith(sep) ? parent : parent + sep)
}

export function readState() {
  try {
    const parsed = JSON.parse(readFileSync(statePath(), 'utf8'))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const workspaces = Object.create(null)
      if (parsed.workspaces && typeof parsed.workspaces === 'object' && !Array.isArray(parsed.workspaces)) {
        for (const [path, open] of Object.entries(parsed.workspaces)) {
          if (path === '') continue
          // Rules saved before paths were normalised migrate on the next write.
          workspaces[canonicalWorkspace(path) ?? path] = open === true
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

export function writeState(state) {
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

/**
 * Read the freshest state, change it and write it back in one synchronous
 * step. Nothing awaits in between, so two edits inside this process cannot
 * overwrite each other; another process editing the file at the same moment
 * can still win, which the single-owner file format accepts.
 */
export function updateState(change) {
  const state = readState()
  change(state)
  return writeState(state)
}

/**
 * The saved rule that governs a workspace: its own, else the nearest parent
 * directory that has one. `undefined` means the global default applies.
 */
export function ruleFor(state, workspace) {
  if (!workspace) return undefined
  let dir = workspace
  for (;;) {
    if (Object.hasOwn(state.workspaces, dir)) return { path: dir, open: state.workspaces[dir] === true }
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

export function isOpen(state, workspace) {
  return ruleFor(state, workspace)?.open ?? state.default === true
}
