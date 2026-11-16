// T2: suite reports consume injected candidate selections and worker receipts over real sockets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, appendFile } from 'node:fs/promises';
import { LocalExecutor } from '../src/executor/local.ts';
import { eventually } from './harness.ts';
import { fixture } from './suite-component-fixture.ts';
import type { VerificationQueue, HubStatus } from '../src/protocol.ts';

for (const commandOnly of [false, true]) test(`capped stall publication keeps a log pointer and ${commandOnly ? 'command state without census' : 'complete process census'}`, async t => {
  const f = await fixture(t, 1, '[hygiene]\nmax_text_bytes = 768\n');
  const census = `suite stall processes ${JSON.stringify({ commandPid: 40001, total: 32, processes: Array.from({ length: 32 }, (_, i) => ({ pid: 40001 + i, name: `worker-${i}` })) })}`;
  const state = 'suite stall command {"commandPid":40001,"exit":{"code":0,"signal":null},"stdout":"open","stderr":"open"}';
  const start = LocalExecutor.prototype.start;
  t.mock.method(LocalExecutor.prototype, 'start', async function (this: LocalExecutor, ...args: Parameters<typeof start>) {
    await start.apply(this, args);
    await appendFile(args[1].log, state + '\n' + (commandOnly ? '' : census + '\n') + 'later output '.repeat(1000) + '\n');
  });
  await f.launch('auto');
  const result = await eventually('capped stall result publication', async () => (await f.results())[0]);
  assert.ok(Buffer.byteLength(result.text, 'utf8') <= 768);
  assert.match(result.text, /stall process detail: log A-\d+/);
  const log = (await readFile(result.artifacts[0]!.path, 'utf8')).split('\n');
  assert.ok(log.includes(state));
  assert.equal(log.includes(census), !commandOnly);
  await eventually('capped stall publication settled', async () => {
    const status = await f.ui.request({ type: 'hub.status', history: true });
    return (status.value as { suites: Array<{ reported: boolean }> }).suites.every(job => job.reported) ? true : undefined;
  });
});

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
  assert.equal(((await f.ui.request({ type: 'hub.status', history: true })).value as HubStatus).suites!.length, 1, 'MCP refusal creates no suite');
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
    const status = await f.ui.request({ type: 'hub.status', history: true });
    return (status.value as { suites: Array<{ reported: boolean }> }).suites.every(job => job.reported) ? true : undefined;
  });
  assert.equal((await f.results()).length, 1);
});
