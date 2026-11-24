# Component checks

The suites use a small React stand-in plus stubs for the DSH primitives to run
the browser bundle in Node.
The panel suite connects its `fetch` stub to the real host handlers and uses a
temporary state file. It disables the external `rea doctor` subprocess so the
component suite stays deterministic. The live Desktop panel uses the real
structured doctor response.

```bash
node --test tests/*.test.mjs            # all suites (also: npm test)
node tests/panel.test.mjs              # plugin card, session default, engine status, refresh, and host routes
node tests/panel-uninstalled.test.mjs  # not installed: 安装 → POST {"action":"install"}
node tests/chip.test.mjs               # composer dropdown → POST {"session":…,"open":true}
node tests/gate-route.test.mjs         # toggle route: session switch vs global default, stale workspace/remember requests refused
node tests/gate-reload.test.mjs        # reload: existing agents are re-gated and lazily resolved
node tests/gate-doctor.test.mjs        # slow `rea doctor`: first paint returns `checks: pending`
node tests/gate-sweep.test.mjs         # late REA, failed restrict, tool-set growth; agent tool limited to status/on/off
node tests/gate-session.test.mjs       # per-session switches, new-session default, reload, id clash, host language
node tests/lib.test.mjs                # state helpers, env-value validation, executable lookup, doctor parsing
node tests/panel-english.test.mjs      # English browser: no Chinese text may reach the page
```

To verify the running Desktop page, check that the client inspector lists the
`rea-gate` occupant under `sidebar.panellist` after the next page boot.
