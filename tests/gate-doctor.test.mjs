import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// A slow `rea doctor` must not hold the first paint. The route answers with the
// cached view and `checks: 'pending'`; the browser asks again once the run ends.
const directory = mkdtempSync(join(tmpdir(), 'dsh-rea-gate-doctor-test-'))
const reaScript = join(directory, 'rea')
writeFileSync(reaScript, [
  '#!/bin/sh',
  'sleep 1.2',
  `printf '%s' '{"identity":{"cli_package_version":"9.9.9","registrations":[{"client":"dsh","state":"aligned"}]}}'`,
].join('\n'))
chmodSync(reaScript, 0o755)

process.env.DSH_HOME = join(directory, 'home')
process.env.REA_BIN = reaScript
process.env.REA_GATE_DOCTOR_WAIT_MS = '50'
delete process.env.REA_GATE_SKIP_DOCTOR
process.on('exit', () => rmSync(directory, { recursive: true, force: true }))

const { apply } = await import('../index.js')

const routes = new Map()
const ctx = {
  tools: { schemas: () => ['mcp__rea__fixture'], register: () => {} },
  on: () => {},
  effect: (effect) => effect(),
  inject: (services, callback) => {
    if (services.includes('agents')) {
      callback({ effect: (effect) => effect(), agents: { list: () => [], get: () => undefined } })
      return
    }
    assert.deepEqual(services, ['connection'])
    callback({
      effect: (effect) => effect(),
      connection: { fetch: { register: (route) => routes.set(route.path, route) } },
      get: () => undefined,
    })
  },
}
apply(ctx)

const readState = async () => {
  const started = Date.now()
  const response = await routes.get('/api/dsh-rea-gate/state').fetch(
    new Request('http://harness.test/api/dsh-rea-gate/state'),
  )
  return { body: await response.json(), elapsed: Date.now() - started }
}

const first = await readState()
assert.equal(first.body.checks, 'pending')
assert.equal(first.body.version, null)
assert.ok(first.elapsed < 900, `first paint waited ${first.elapsed}ms`)

let settled = first
for (let attempt = 0; attempt < 40; attempt += 1) {
  settled = await readState()
  if (settled.body.checks === 'done') break
  await new Promise((resolve) => setTimeout(resolve, 100))
}
assert.equal(settled.body.checks, 'done')
assert.equal(settled.body.version, '9.9.9')
assert.equal(settled.body.installed, true)

// A reader that opts out of checks is never held either.
const withoutChecks = await routes.get('/api/dsh-rea-gate/state').fetch(
  new Request('http://harness.test/api/dsh-rea-gate/state?checks=0'),
)
assert.equal((await withoutChecks.json()).checks, 'done')
