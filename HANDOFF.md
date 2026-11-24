# dsh-rea-gate

A DeepSeek Harness bundle that keeps REA (reverse-engineering MCP server) installed
once for the whole Host, and decides **per session** whether its
tools are visible.

Status: **both halves verified live.** The running Desktop displayed the REA
management console in the sidebar and the bundle detail slot, and the session
the session control has since moved from the header to the composer (see below).

## Why

REA registers ~263 `mcp__rea__*` tools globally. Most sessions do not need them, and
the schemas cost prompt tokens. The gate hides them per agent instead of uninstalling
anything, so one project can use REA while another never sees it.

## Architecture

```
Host (index.js)
  agent/created  ──► read ~/.dsh/rea-gate.json
                      ├─ default open   → nothing
                      └─ default closed → agent.ctx.tools.restrict({ deny: [names] })
  agent/disposed ──► forget the session's bookkeeping (the scope already lifted the mask)
  ctx.inject(['agents']) ──► re-apply each agent's own choice (saved policy only for agents never seen)
  rea_gate tool  ──► status | on | off (session-only; no lifecycle actions, no persistence)
  sweep (5 s + every /state read) ──► top up masks when REA connects late, grows, or a restrict failed
  child plugin   ──► ctx.inject(['connection']) ──► exact /api routes
                     GET  /api/dsh-rea-gate/state?session=<id>&checks=0|1&refresh=0|1
                     POST /api/dsh-rea-gate/toggle  { open, session? } | { action }
                     GET  /api/dsh-rea-gate/diagnose

Browser (client.js)
  sidebar.panellist ──► REA icon in the left rail
  main (key=rea-gate) ──► lifecycle controls, session defaults, engine checks and usage
  plugins.bundle.config ──► same management controls on the plugin detail page
  conversation.input.left ──► REA dropdown (开启/关闭), composer tool row right of the permission control, polling every 5s
```

`GET /state` waits at most `REA_GATE_DOCTOR_WAIT_MS` (default 2500 ms) for
`rea doctor`. A slower run answers `checks: "pending"` with the cached view and
finishes in the background; the panel re-reads once it settles.

State file `$DSH_HOME/rea-gate.json`:

```json
{ "default": false }
```

## Verified

| What | Evidence |
|---|---|
| Default off | fresh subagent: 0 `mcp__rea__*`, `rea_gate` present (host/Tool/listTools) |
| Toggle on mid-session | same agent goes 0 → 263 tools without restart |
| New-session default | the saved `default` decides how a new session starts; running sessions keep their own switch |
| `install` action | ran `rea setup --client dsh --yes`, returned "REA is registered with DSH." |
| Browser half mounted | Client `Slots.listSubTree` root `sidebar.panellist` lists `rea-gate`; panel renders real data |
| Composer dropdown | `conversation.input.left` (session-scoped list slot; props are `{}`, so the session id arrives through the registration's `inject`); uses the host `Menu` with `portal`; fetches with its session id. Verified in a live Desktop on 2026-11-24 (see Next steps 6) |
| Switch scope | every session has its own switch: the dropdown and `rea_gate on/off` change that session only and save nothing. Only the panel's global default is persisted. Per-workspace rules were removed; `workspace`/`remember` requests get a 400 so a stale client cannot flip the default. |
| One-click engine installs | `lib/engine-download.js`: macOS with Homebrew keeps `brew install`; Linux, Windows and macOS without brew download the official archive (GitHub releases for Ghidra/apktool, Temurin from adoptium.net, platform-tools from dl.google.com), verify its SHA-256/SHA-1, unpack under `$DSH_HOME/rea-engines/` and write the env paths. Covered by `tests/engine-download.test.mjs` (fake vendor, own zip writer). Run against the real vendors on macOS only; Windows and Linux hosts are still to be tried. |
| Path chooser | The folder icon beside each engine path field: `lib/pick-path.js` (osascript / PowerShell / zenity→kdialog) behind `{ action: 'pick-path', kind }` on the toggle route; folder variables try DSH's `__DSH_DIRECTORY_PICKER__` first. Unit-tested with a fake runner (`tests/pick-path.test.mjs`); the AppleScript compiles, the PowerShell and zenity/kdialog calls are untested on real Windows/Linux machines. |
| Engine rows | panel presents a screenshot-style checklist with status marks, concise descriptions, environment details and direct upstream download/configuration links |
| Plugin card | `plugins.bundle.config` renders the same controls on the `dsh-rea-gate` detail page |
| Lifecycle controls | Desktop read REA 6.10.1, aligned DSH registration and 263 loaded tools. **Check update** returned npm stable 6.10.1. The install, update and uninstall UI actions are covered by simulated requests. |
| Module graph | the Desktop panel's **Check module graph** reported `selfPresent` |
| Routes reachable | the Desktop panel loads registration and engine data; the composer dropdown switches the live session |
| Reload keeps each session's choice | reload the plugin → a closed session stays at 0 tools, a session switched on stays on |
| Disposed session forgotten | `agent/disposed` drops the entry; `/state?session=` reports `sessionKnown: false` and toggle answers 404 |
| Agent tool is read/flip only | `rea_gate` accepts `status`, `on`, `off`; install/update/uninstall are panel-only; `on`/`off` never write the state file (`gate-sweep` test) |
| Late REA / failed restrict | closed sessions are re-masked by the sweep; `exposed` in `/state` and the dropdown's `REA 关（未生效）` report a leak (`gate-sweep` test) |
| Uninstall scope | `rea uninstall` has no `--client` option (checked on 6.10.1), so it clears every client; the dialog and README say so |
| First paint not blocked | a 1.2 s `rea doctor` still answers in <900 ms with `checks: "pending"`, then settles to `done` |
| Dropdown follows other surfaces | polling picks up a change made through the panel or the `rea_gate` tool within 5 s |

The latest Desktop verification reloaded the plugin twice with
`plugin_manager set_plugin target="include:rea-gate"` and then drove the real
page: the REA panel rendered live engine rows from `rea doctor`, the sidebar and
session-header slots stayed active, and the (old) header chip toggled the session
(263 → 0 → 263) with the host agreeing at each step. A closed workspace stayed
closed across a reload without a manual toggle.

## Host / client reload, which cost hours to pin down

**Host code (`index.js`) reloads without an app restart.** Host HMR replaces plugins
whose *linked package files* changed at the next profile recomposition, and a Plugin
Manager operation forces one:

```
plugin_manager set_plugin target="include:rea-gate" enabled=false   # then true
```

The entry id is `include:rea-gate`; the bare patch id `rea-gate` is refused with
`unknown-plugin`. Expect `application: "applied"` on both calls.

**Client reload was inconsistent on this Desktop build.** Observed twice: after a
client edit the graph row's rev changed and `/plugins/events` served the new bundle,
yet the page never applied it — no new module, no re-run of `apply()`. Per
`dsh-client-modules`, `ClientEntries.reload()` returns early when the id is absent
from `this.desired`, and `this.desired` only changes through `sync()` from a `graph`
frame. During the lifecycle panel redesign, the running Desktop displayed the new
bundle after profile recomposition with the host PID unchanged. Verify the visible
version after recomposition and use a fresh app launch if the old client remains.

**There is no way to reload the page from inside this Desktop build** (all checked):

| Attempt | Result |
|---|---|
| ⌘R | inert — no View/Reload menu item, no accelerator |
| `open -a "DeepSeek Harness"` | activates the existing window, creates none |
| 开发者工具 menu item / ⌘⌥I | no DevTools renderer appears (DevTools disabled) |
| Client `Service` catalog | no reload/restart service |
| `location.reload` in shipped client code | only the host-release-change prompt, which needs a different host release |

A quit and reopen provides a fresh page boot. The session persists on disk.

## Next steps

1. Keep the session default and engine rows covered by the component and host-route
   tests when the response shape changes. The panel uses doctor results when present
   and reports environment variable presence for uncovered engines.
2. The `/diagnose` route reports whether the host composed the browser module.
   Both the sidebar and `plugins.bundle.config` keyed by package name provide the console.
3. `docs/DETAIL.md` and `locale/` describe the default and engine controls.
4. `sessions` is pruned on `agent/disposed` and on load. A session that ends without
   that event keeps its entry until the next reload, and `/state?session=` still
   reports `sessionKnown: true` for it (when the host's agent table is injected, the
   lookup re-checks it first, so a replaced agent is picked up). The chip polls only
   while its page is visible, so it never shows a decision another surface reversed
   for longer than one poll after the page is visible again.
5. Unverified against a live DSH: whether a sub-agent reports the same
   `session.header.id` as its parent, and whether it should inherit a parent's
   session-only choice. The gate defends against the id clash (the first agent keeps
   the chip's entry, a later one is still gated) but sub-agents do not inherit a
   parent's `on`; a new agent starts from the saved policy.
6. The composer dropdown (`conversation.input.left`) was checked in a live Desktop on
   2026-11-24: it renders right of the permission control in the new-session composer,
   in an existing session's composer and in the side sub-agent composer; the portaled
   Menu opens upward with 开启/关闭 and a check on the current state; choosing 关闭
   switched the label to `REA 关` and left `rea-gate.json` untouched. The trigger is text only (`REA 开 ▾`, no icon, no narrow-width label hiding). Not checked: the English UI, and that a closed session really
   reports 0 REA tools through the live `/state` route. A plugin's host code only
   reloads when the plugin is disabled and enabled again in Plugins → Installed; the
   client bundle hot-reloads on its own.
