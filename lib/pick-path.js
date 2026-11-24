/**
 * A native "choose a file / folder" dialog on the machine that runs DSH, so
 * the engine path fields can offer a Browse button on every platform:
 *
 * - macOS: AppleScript `choose file` / `choose folder` through `osascript`
 * - Windows: the .NET OpenFileDialog / FolderBrowserDialog through PowerShell
 * - Linux: `zenity`, or `kdialog` when zenity is missing
 *
 * It only returns the path the user chose; nothing is read or written.
 */
import { runCommand } from './rea-cli.js'

const DIALOG_TIMEOUT_MS = 10 * 60_000

/** Escape a string for a double-quoted AppleScript or PowerShell single-quoted literal. */
const appleQuote = (value) => value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
const powershellQuote = (value) => value.replaceAll("'", "''")

function macCommand(kind, title) {
  const chooser = kind === 'dir' ? 'choose folder' : 'choose file'
  return {
    command: 'osascript',
    args: [
      '-e', 'tell application "System Events" to activate',
      '-e', `POSIX path of (${chooser} with prompt "${appleQuote(title)}")`,
    ],
  }
}

function windowsCommand(kind, title) {
  const dialog = kind === 'dir'
    ? `$d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = '${powershellQuote(title)}'; $d.ShowNewFolderButton = $false`
    : `$d = New-Object System.Windows.Forms.OpenFileDialog; $d.Title = '${powershellQuote(title)}'; $d.CheckFileExists = $true`
  const value = kind === 'dir' ? '$d.SelectedPath' : '$d.FileName'
  // A hidden top-most owner keeps the dialog in front of the DSH window.
  const script = [
    // Node reads the answer as UTF-8; the console would otherwise use the OEM code page.
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    'Add-Type -AssemblyName System.Windows.Forms',
    '[System.Windows.Forms.Application]::EnableVisualStyles()',
    "$owner = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true; ShowInTaskbar = $false; StartPosition = 'CenterScreen'; Opacity = 0 }",
    '$owner.Show()',
    dialog,
    `if ($d.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write(${value}) }`,
    '$owner.Close()',
  ].join('; ')
  return { command: 'powershell', args: ['-NoProfile', '-NonInteractive', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', script] }
}

function linuxCommands(kind, title) {
  return [
    {
      command: 'zenity',
      args: ['--file-selection', ...(kind === 'dir' ? ['--directory'] : []), `--title=${title}`],
    },
    {
      command: 'kdialog',
      args: [kind === 'dir' ? '--getexistingdirectory' : '--getopenfilename', process.env.HOME || '/', '--title', title],
    },
  ]
}

/** Strip the trailing slash AppleScript adds to folders, and surrounding whitespace. */
function cleanPath(raw, platform) {
  let value = String(raw).trim()
  if (platform !== 'win32' && value.length > 1) value = value.replace(/\/+$/, '')
  return value
}

/**
 * Open the dialog and resolve one of:
 * - `{ ok: true, path }` the chosen path
 * - `{ ok: true, path: null }` the user cancelled
 * - `{ ok: false, message }` no dialog could be shown (`unsupported: true` when
 *   the machine has no dialog program at all)
 *
 * `options.platform` and `options.run` exist for tests.
 */
export async function pickPath(kind, title, options = {}) {
  const platform = options.platform ?? process.platform
  const run = options.run ?? ((command, args) => runCommand(command, args, DIALOG_TIMEOUT_MS))
  const candidates = platform === 'darwin'
    ? [macCommand(kind, title)]
    : platform === 'win32'
      ? [windowsCommand(kind, title)]
      : linuxCommands(kind, title)

  let missing = true
  for (const { command, args } of candidates) {
    const result = await run(command, args)
    if (result.ok) {
      const path = cleanPath(result.out, platform)
      return { ok: true, path: path === '' ? null : path }
    }
    if (result.code === 'ENOENT') continue
    missing = false
    // A cancelled dialog: AppleScript error -128, or an empty answer with exit code 1.
    if (/-128|User canceled/i.test(result.err) || (result.code === 1 && !result.out && !/error|cannot|unable/i.test(result.err))) {
      return { ok: true, path: null }
    }
    return { ok: false, message: (result.err || result.out || `${command} failed`).slice(0, 2_000) }
  }
  return missing
    ? { ok: false, unsupported: true, message: platform === 'linux' ? 'No file dialog program was found. Install zenity or kdialog, or type the path.' : 'No file dialog is available.' }
    : { ok: false, message: 'The file dialog could not be shown.' }
}
