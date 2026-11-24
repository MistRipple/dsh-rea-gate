/**
 * The saved gate policy (`$DSH_HOME/rea-gate.json`): one global default for new
 * sessions, plus the engine environment.
 */
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { ALLOWED_ENGINE_ENV } from './engines.js'

const STATE_FILE = 'rea-gate.json'

export function statePath() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  return join(home, STATE_FILE)
}

export function readState() {
  try {
    const parsed = JSON.parse(readFileSync(statePath(), 'utf8'))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const env = Object.create(null)
      if (parsed.env && typeof parsed.env === 'object' && !Array.isArray(parsed.env)) {
        for (const [key, value] of Object.entries(parsed.env)) {
          if (ALLOWED_ENGINE_ENV.has(key) && typeof value === 'string' && value.trim()) {
            env[key] = value.trim()
          }
        }
      }
      return { default: parsed.default === true, env }
    }
  } catch {}
  return { default: false, env: Object.create(null) }
}

export function writeState(state) {
  const file = statePath()
  const temporary = `${file}.${randomUUID()}.tmp`
  const payload = { default: state.default === true }
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

/** Whether a session created now starts with the REA tools visible. */
export function isOpen(state) {
  return state.default === true
}
