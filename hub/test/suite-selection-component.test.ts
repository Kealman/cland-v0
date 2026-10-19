// T2: suite reports consume injected candidate selections and worker receipts over real sockets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { eventually } from './harness.ts';
import { fixture } from './suite-component-fixture.ts';
import type { VerificationQueue, HubStatus } from '../src/protocol.ts';

test('candidate selection reaches execution and explains the reserved all-mode refusal', async t => {
  const f = await fixture(t);
  f.facts.selection = { mode: 'hub-only', files: ['hub/src/tracker/tracker.ts'], reason: 'all paths outside nvim/; coverage map missing' };
  await f.launch('auto');
  const reduced = await eventually('auto result', async () => (await f.results())[0]);
  assert.match(reduced.text, /mode hub-only; all paths outside nvim\/; coverage map missing; deciding files \["hub\/src\/tracker\/tracker.ts"\]/);
  assert.deepEqual(f.executions[0]!.selection, f.facts.selection);
  const log = await readFile(reduced.artifacts[0]!.path, 'utf8');
  assert.match(log, /"mode":"hub-only","files":\["hub\/src\/tracker\/tracker.ts"\]/);
  const reserved = await f.spoke.call<{ ok: boolean; code: string; error: string }>('verify', { mode: 'all', cwd: f.root, report: f.topic, to: ['rev'] });
  assert.equal(reserved.ok, false);
  assert.equal(reserved.code, 'verify-all-reserved');
  assert.match(reserved.error, /mode hub-only/);
  assert.deepEqual(((await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue).waiters, []);
  assert.equal(((await f.ui.request({ type: 'hub.status' })).value as HubStatus).suites!.length, 1, 'MCP refusal creates no suite');
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  await f.launch('--all');
  const full = await eventually('forced full result', async () => (await f.results())[1]);
  assert.match(full.text, /mode full; --all \/ all forces full/);
  assert.match(full.text, /deciding files \["hub\/src\/tracker\/tracker.ts"\]/);
});

for (const cap of [768, 384]) test(`selection report respects the ${cap}-byte cap with a complete durable path list`, async t => {
  const f = await fixture(t, 0, `[hygiene]\nmax_text_bytes = ${cap}\n`);
  const names = Array.from({ length: 150 }, (_, n) => `nvim/test/${String(n).padStart(3, '0')}-${'界'.repeat(40)}.test.ts`);
  f.facts.selection = { mode: 'nvim-only', files: names, reason: 'all paths under nvim/' };
  await f.launch('auto');
  const result = await eventually('bounded report publication', async () => (await f.results())[0]);
  assert.ok(Buffer.byteLength(result.text, 'utf8') <= cap);
  assert.match(result.text, /mode nvim-only/);
  assert.match(result.text, /all paths under nvim\//);
  assert.match(result.text, /full list in log/);
  assert.ok(!result.text.includes('�'));
  assert.match(result.text, /Executor local · \S+ \S+ · Node v[\d.]+ · Neovim none/);
  const log = await readFile(result.artifacts[0]!.path, 'utf8');
  assert.ok(names.every(name => log.includes(name)), 'every deciding path remains in the log');
  await eventually('bounded report settled', async () => {
    const status = await f.ui.request({ type: 'hub.status' });
    return (status.value as { suites: Array<{ reported: boolean }> }).suites.every(job => job.reported) ? true : undefined;
  });
  assert.equal((await f.results()).length, 1);
});
