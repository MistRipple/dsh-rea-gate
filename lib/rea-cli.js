/**
 * Everything that talks to the REA command line or to the package managers
 * around it. Nothing here knows about gating or about the browser panel, so a
 * change in REA's CLI surface stays inside this file.
 */
import { existsSync } from 'node:fs'
import { delimiter, dirname, isAbsolute, join } from 'node:path'
import { execFile } from 'node:child_process'

/** `rea` subcommands the plugin may run on the owner's behalf. */
export const COMMANDS = {
  install: ['setup', '--client', 'dsh', '--yes'],
  reinstall: ['setup', '--client', 'dsh', '--yes'],
  update: ['update'],
  // `rea uninstall` has no per-client option; it clears every client REA configured.
  uninstall: ['uninstall'],
}

/**
 * Registration states `rea doctor` reports for a client that is set up
 * correctly. Anything else (including a state this plugin has never seen) is
 * shown as needing attention. The host reports the verdict as
 * `registration.healthy`, so the browser never has to guess these names.
 */
export const HEALTHY_REGISTRATION = new Set(['aligned', 'healthy'])

const IS_WINDOWS = process.platform === 'win32'

export function effectiveEnv(state, extra = {}) {
  return { ...process.env, ...(state?.env ?? {}), ...extra }
}

export function detectHomebrewPrefix() {
  if (process.env.REA_GATE_SKIP_DOCTOR === '1') return null
  if (process.platform !== 'darwin') return null
  for (const prefix of ['/opt/homebrew', '/usr/local']) {
    if (existsSync(join(prefix, 'bin', 'brew'))) return prefix
  }
  return null
}

/** Executable suffixes to try; Windows launchers are .exe, .cmd or .bat files. */
const SUFFIXES = IS_WINDOWS ? ['.exe', '.cmd', '.bat', ''] : ['']

export function findBinary(command, extraDirs = []) {
  if (command === 'rea' && process.env.REA_BIN) return process.env.REA_BIN
  const searchDirs = [
    ...extraDirs.filter(Boolean),
    ...(IS_WINDOWS ? [] : ['/opt/homebrew/bin', '/usr/local/bin']),
    dirname(process.execPath),
    ...(process.env.PATH ? process.env.PATH.split(delimiter) : []),
  ]
  const seen = new Set()
  for (const dir of searchDirs) {
    if (!dir || seen.has(dir)) continue
    seen.add(dir)
    for (const suffix of SUFFIXES) {
      const candidate = join(dir, command + suffix)
      if (existsSync(candidate)) return candidate
    }
  }
  return command
}

export function runCommand(command, args, timeout = 180_000, options = {}) {
  const extraDirs = options.extraDirs ?? []
  const executable = findBinary(command, extraDirs)
  const baseEnv = options.env ?? process.env
  const pathParts = [
    ...extraDirs,
    isAbsolute(executable) ? dirname(executable) : null,
    ...(IS_WINDOWS ? [] : ['/opt/homebrew/bin', '/usr/local/bin']),
    dirname(process.execPath),
    baseEnv.PATH,
  ].filter(Boolean)
  const env = { ...baseEnv, PATH: [...new Set(pathParts)].join(delimiter) }
  // Node refuses to run .cmd/.bat files without a shell. The arguments are
  // fixed constants from this plugin, never user input.
  const batch = IS_WINDOWS && /\.(cmd|bat)$/i.test(executable)
  return new Promise((resolve) => {
    execFile(
      batch ? `"${executable}"` : executable,
      args,
      { env, timeout, maxBuffer: 8 * 1024 * 1024, shell: batch, windowsHide: true },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          code: error?.code ?? 0,
          out: String(stdout ?? '').trim(),
          err: String(stderr ?? '').trim() || error?.message || '',
        })
      },
    )
  })
}

export async function resolveNpmGlobalBin() {
  const result = await runCommand('npm', ['prefix', '-g'], 15_000)
  if (!result.ok || !result.out) return null
  const prefix = result.out.split(/\r?\n/)[0]?.trim()
  if (!prefix) return null
  return IS_WINDOWS ? prefix : join(prefix, 'bin')
}

export function parseJsonOutput(result) {
  if (!result?.out) return null
  try {
    const parsed = JSON.parse(result.out)
    return parsed?.data ?? parsed
  } catch {
    return null
  }
}
