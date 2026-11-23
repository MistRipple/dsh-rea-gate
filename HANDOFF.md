# dsh-rea-gate

A DeepSeek Harness bundle that keeps REA (reverse-engineering MCP server) installed
once for the whole Host, and decides **per session and per workspace** whether its
tools are visible.

Status: **both halves verified live.** The running Desktop displayed the REA
management console in the sidebar and the bundle detail slot, and the session
header still shows its REA chip.

## Why

REA registers ~263 `mcp__rea__*` tools globally. Most sessions do not need them, and
the schemas cost prompt tokens. The gate hides them per agent instead of uninstalling
anything, so one project can use REA while another never sees it.

## Architecture

```
Host (index.js)
  agent/created  ──► read ~/.dsh/rea-gate.json
                      ├─ workspace open  → nothing
                      └─ workspace closed → agent.ctx.tools.restrict({ deny: [names] })
  rea_gate tool  ──► status | on | off | install | uninstall
  child plugin   ──► ctx.inject(['connection']) ──► exact /api routes
                     GET  /api/dsh-rea-gate/state?session=<id>
                     POST /api/dsh-rea-gate/toggle  { open, session? } | { open, workspace } | { action }
                     GET  /api/dsh-rea-gate/diagnose

Browser (client.js)
  sidebar.panellist ──► REA icon in the left rail
  main (key=rea-gate) ──► lifecycle controls, session defaults, engine checks and usage
  plugins.bundle.config ──► same management controls on the plugin detail page
  conversation.session.header.actions ──► REA 开/关 chip
```

State file `$DSH_HOME/rea-gate.json`:

```json
{ "default": false, "workspaces": { "/path/to/project": true } }
```

## Verified

| What | Evidence |
|---|---|
| Default off | fresh subagent: 0 `mcp__rea__*`, `rea_gate` present (host/Tool/listTools) |
| Toggle on mid-session | same agent goes 0 → 263 tools without restart |
| Workspace memory | later agent in the same directory inherits the choice |
| `install` action | ran `rea setup --client dsh --yes`, returned "REA is registered with DSH." |
| Browser half mounted | Client `Slots.listSubTree` root `sidebar.panellist` lists `rea-gate`; panel renders real data |
| Header chip | same inspection on `conversation.session.header.actions`; chip fetches with its session id |
| Workspace memory | the session chip saves the workspace choice. The panel shows the global default. Host routes expose explicit rules. |
| Engine rows | panel presents a screenshot-style checklist with status marks, concise descriptions, environment details and direct upstream download/configuration links |
| Plugin card | `plugins.bundle.config` renders the same controls on the `dsh-rea-gate` detail page |
| Lifecycle controls | Desktop read REA 6.10.1, aligned DSH registration and 263 loaded tools. **Check update** returned npm stable 6.10.1. The install, update and uninstall UI actions are covered by simulated requests. |
| Module graph | the Desktop panel's **Check module graph** reported `selfPresent` |
| Routes reachable | the Desktop panel loads registration, workspace and engine data; the header chip toggles the live session |

The latest Desktop verification used the new DSH child agent's own schema and
`rea_gate status`: zero visible REA tools and the status tool still callable.
That session did not expose `cordis_inspect_query`. The running page displayed
the REA sidebar entry and loaded real panel data. The old request log probe has
been removed.

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
3. `docs/DETAIL.md` and `locale/` now describe the workspace and engine controls.

## API facts worth keeping

Harness internals that took experiments to pin down:

- `agent/created` listener payload is `{ agent, source, signal }` — the agent is
  `payload.agent`, not the first argument.
- Workspace: `agent.session.header.cwd`. Session id: `agent.session.header.id`.
- `agent.ctx.tools.restrict({ allow?, deny? })` takes **exact tool names** (no
  patterns), throws on unknown names, requires a scoped context, returns a disposer,
  and removes the hidden tools' schema cost. Names are discovered from
  `ctx.tools.schemas(scope)` and filtered by the `mcp__rea__` prefix.
- A linked bundle directory cannot resolve `@deepseek-ai/dsh-tools`, so `defineTool`
  is imported optionally; `ctx.tools.register(plainDefinition)` works.
- Client bundle format: `window.__ModuleLoader__.load({ id, factory })`, factory
  returns `{ inject: ['slots'], apply(ctx) }`.
- `$DSH_HOME/cordis.patch.yml` is a home-level layer that outranks the profile layer;
  a row can be turned off with `- id: <row>` + `disabled: true`.

### Services on a plugin context are undefined unless injected

**This was the bug that kept the panel empty.** A plugin's `export const inject` gates
which services its context exposes; reading an undeclared one yields `undefined`
rather than throwing. With `inject = ['tools']`, `ctx.connection` was `undefined`, so
`if (ctx.connection?.fetch?.register)` skipped both routes and every browser fetch
returned null — with no error anywhere.

`ctx.inject(...)` and `ctx.plugin(...)` are mixed into `Context` from the registry
(`this.mixin("registry", ["inject", "plugin"])`), so a plugin can add a dependency
*without* changing its own `inject`:

```js
ctx.inject(['connection'], (routeCtx) => {
  routeCtx.effect(() => routeCtx.connection.fetch.register({ ... }), 'label')
})
```

Keep `inject = ['tools']` on the bundle itself: making `connection` required would
stop the gate from working in compositions with no web carrier.

### Exact Fetch routes

```ts
interface ConnectionFetchRoute {
  path: string                                  // below /api, e.g. '/api/dsh-rea-gate/state'
  methods: readonly ('GET' | 'HEAD' | 'POST')[]
  requestBody: 'buffered' | 'streaming'         // required
  fetch: (request: Request) => Promise<Response>
}
```

- `requestBody` is required by the type but **not validated** by `assertFetchRoute`;
  omit it and `requestBodyMode` returns `undefined`, which silently takes the
  streaming branch. Always pass `'buffered'` when the handler calls `request.json()`.
- No rejection fence belongs in the handler: the carrier applies Host/Origin trust and
  the cookie check *before* dispatch, and the shared handler answers `403` to any
  non-owner Peer.
- `ctx.connection.requestRejection()` takes a node-style `ConnectionTrustRequest`,
  not a WHATWG `Request`.

### Auth, which decides whether the browser half can reach its routes

- The page URL carries `?token=…`; `GET /` exchanges it for an authority-bound signed
  cookie and redirects to `./`. `/api` routes answer `401 unauthorized` without it.
  Relative `fetch('api/…')` from the page therefore works, while `curl` without the
  cookie does not — **do not read a 401 as a broken route**, and an unknown path also
  answers 401, so curl cannot tell registered routes from unregistered ones.
- Routes registered on `ctx.webServer` directly (like `/plugins/events`) bypass that
  fence and are public.
- `immediately` in `dsh.client` is only the stage-one **prefetch** tier; it does not
  gate mounting, so flipping it to `false` cannot fix a missing mount.

### Slot contracts, read from the live page

- `sidebar.panellist` is a **list**: `{ id, order?, label? }`, `label` may be a thunk
  re-read on every projection. The icon receives `{ size, active }`.
- `main` is **keyed**: `{ key }` only; the key equals the panellist id.
- `conversation.header` is a **single** slot with an *empty* registration catalog — it
  takes no `id`/`order`, and writing there **replaces the shipped navigation
  container**. A session-header chip belongs in `conversation.session.header.actions`
  (list, `{ id, order?, label? }`), which also supplies the `sessionId` prop.
- A `main` panel body receives `usePanelInfo`, `useSessions`, `useWorkspaces`, …; a
  panel that only talks to its own host route can ignore them.

## Repo layout

```
index.js              host: gate, state, routes, REA CLI calls
client.js             browser: sidebar panel, header chip, icon
cordis.patch.yml      bundle patch (one row, id: rea-gate)
package.json          dsh.bundle.patch + dsh.client
locale/{en,zh}.json   display metadata
docs/DETAIL.md        plugin detail page
tests/*.test.mjs      component checks (mini React stand-in, no browser)
```

## Install / remove

Installed into the `desktop` profile as a linked directory. The Desktop profile is
owned by the Electron app — `dsh plugin --profile desktop …` is refused — so use
`plugin_manager` `install_bundle` / `remove_bundle`, never hand-edited profile files.

Changing the path means `remove_bundle` then `install_bundle` — the profile records
an absolute `link:` path.
