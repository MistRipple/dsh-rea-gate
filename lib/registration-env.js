/**
 * Does the DSH registration actually carry the engine paths saved in the panel?
 *
 * `rea doctor` runs with the plugin's own copy of those variables, so it can
 * call an engine usable even when the registration REA's MCP server is started
 * from (the `rea-mcp` entry in DSH's patch file) never received them. Reading
 * the registration back closes that gap.
 *
 * The patch file is a YAML flow mapping. This reads only the `env` mapping of
 * the REA entry, without a YAML library.
 */
import { readFileSync } from 'node:fs'

/** Split a flow mapping body on the commas that are not inside quotes. */
function splitTopLevel(body) {
  const parts = []
  let current = ''
  let quote = null
  for (let i = 0; i < body.length; i++) {
    const char = body[i]
    if (quote) {
      current += char
      if (char === '\\' && quote === '"') current += body[++i] ?? ''
      else if (char === quote) {
        if (quote === "'" && body[i + 1] === "'") current += body[++i]
        else quote = null
      }
    } else if (char === '"' || char === "'") {
      quote = char
      current += char
    } else if (char === ',') {
      parts.push(current)
      current = ''
    } else {
      current += char
    }
  }
  if (current.trim()) parts.push(current)
  return parts
}

function scalar(raw) {
  const text = raw.trim()
  if (text.startsWith('"') && text.endsWith('"') && text.length >= 2) {
    try { return JSON.parse(text) } catch { return text.slice(1, -1) }
  }
  if (text.startsWith("'") && text.endsWith("'") && text.length >= 2) return text.slice(1, -1).replaceAll("''", "'")
  return text
}

/** The text between the braces that open at `start` (the index of `{`), honouring quotes. */
function braceBody(text, start) {
  let depth = 0
  let quote = null
  for (let i = start; i < text.length; i++) {
    const char = text[i]
    if (quote) {
      if (char === '\\' && quote === '"') i++
      else if (char === quote) quote = null
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === '{') {
      depth++
    } else if (char === '}') {
      depth--
      if (depth === 0) return text.slice(start + 1, i)
    }
  }
  return null
}

/**
 * The `env` of the REA MCP entry in a patch file's text, or null when the entry
 * or its mapping is not there. An entry without `env` reads as `{}`.
 */
export function parseRegisteredEnv(text) {
  const entry = /serverName:\s*["']?rea["']?\s*[,}]/.exec(text)
  if (!entry) return null
  const open = text.indexOf('{', text.lastIndexOf('config:', entry.index))
  const config = open < 0 ? null : braceBody(text, open)
  if (config === null) return null
  const envKey = /(?:^|[\s,{])env:\s*\{/.exec(config)
  if (!envKey) return {}
  const body = braceBody(config, config.indexOf('{', envKey.index + envKey[0].length - 1))
  if (body === null) return null
  const env = {}
  for (const part of splitTopLevel(body)) {
    const split = part.indexOf(':')
    if (split < 0) continue
    const key = scalar(part.slice(0, split))
    if (key) env[key] = scalar(part.slice(split + 1))
  }
  return env
}

/** Read and parse `file`; `{ ok: false }` when it is missing, unreadable or has no REA entry. */
export function readRegisteredEnv(file) {
  if (!file) return { ok: false }
  try {
    const env = parseRegisteredEnv(readFileSync(file, 'utf8'))
    return env === null ? { ok: false } : { ok: true, env }
  } catch {
    return { ok: false }
  }
}

/**
 * Compare the saved engine variables with the registered ones. Returns the
 * variables the registration lacks (`missing`) or holds with another value
 * (`different`). Paths are compared as written; Windows paths ignore case.
 */
export function compareEnv(saved, registered, caseInsensitive = process.platform === 'win32') {
  const same = (a, b) => (caseInsensitive ? a.toLowerCase() === b.toLowerCase() : a === b)
  const problems = []
  for (const [name, value] of Object.entries(saved ?? {})) {
    if (!value) continue
    if (!Object.hasOwn(registered, name)) problems.push({ name, state: 'missing' })
    else if (!same(String(registered[name]), String(value))) problems.push({ name, state: 'different' })
  }
  return problems
}
