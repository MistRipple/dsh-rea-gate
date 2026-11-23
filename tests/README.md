# Component checks

The suites use a small React stand-in plus stubs for the DSH primitives to run
the browser bundle in Node.
The panel suite connects its `fetch` stub to the real host handlers and uses a
temporary state file. It disables the external `rea doctor` subprocess so the
component suite stays deterministic. The live Desktop panel uses the real
structured doctor response.

```bash
node --test tests/*.test.mjs            # all three suites
node tests/panel.test.mjs              # plugin card, workspace persistence, engine status, refresh, and host routes
node tests/panel-uninstalled.test.mjs  # not installed: 安装 → POST {"action":"install"}
node tests/chip.test.mjs               # header chip → POST {"session":…,"open":true}
```

To verify the running Desktop page, check that the client inspector lists the
`rea-gate` occupant under `sidebar.panellist` after the next page boot.
