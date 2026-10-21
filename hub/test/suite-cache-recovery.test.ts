// T2: cache identity and reporting use projectHub, injected candidate facts and
// local executor receipts. Persistence closes and reopens the SQLite store in-process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { clandWithEnv, eventually } from './harness.ts';
import type { ResultMessage } from './suite-fixture.ts';
import { fixture } from './suite-component-fixture.ts';
import { verificationFixture } from './verification-fixture.ts';
test('cache reopen preserves mode keys and failure invalidation', async t => {
  const f = await fixture(t, 1);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  f.facts.selection = { mode: 'hub-only', files: ['hub/src/tracker/example.ts'], reason: 'hub change' };
  const failed = await f.launch('all');
  assert.match((await eventually('failed run', async () => (await f.results())[0])).text, /exit 1/);
  f.code(0);
  const green = await f.launch('all');
  assert.equal(green.cached, undefined);
  assert.notEqual(green.id, failed.id);
  assert.match((await eventually('green run', async () => (await f.results())[1])).text, /exit 0/);
  f.code(1);
  const freshFailure = await f.launch('all', '--fresh');
  assert.equal(freshFailure.cached, undefined);
  assert.match((await eventually('fresh failure', async () => (await f.results())[2])).text, /exit 1/);
  f.code(0);
  const recoveredGreen = await f.launch('all');
  assert.equal(recoveredGreen.cached, undefined, 'a fresh failure supersedes the old green');
  await eventually('recovered green', async () => (await f.results())[3]);
  const reduced = await f.launch('hub');
  assert.equal(reduced.cached, undefined, 'full and hub-only have separate keys');
  await eventually('reduced run', async () => (await f.results())[4]);
  const reducedAgain = await f.launch('auto');
  assert.equal(reducedAgain.cached?.run, reduced.id, 'auto resolves to the same effective mode');
  await eventually('reduced cache', async () => (await f.results())[5]);
  await f.reopen();
  const recovered = await f.launch('all');
  assert.equal(recovered.cached?.run, recoveredGreen.id);
  const result = await eventually('recovered cache result', async () => {
    const history = await f.ui.request({ type: 'topic.history', topic: f.topic });
    return (history.value as { messages: ResultMessage[] }).messages.find(m => m.id === `suite:${recovered.id}`);
  });
  assert.match(result.text, /cached/);
  assert.equal(f.executions.length, 5, 'only uncached runs execute');
});

test('cached report preserves both heads and its original candidate provenance', async t => {
  const f = await fixture(t, 0, '[hygiene]\nmax_text_bytes = 384\n');
  const original = await f.launch();
  await eventually('bounded original', async () => (await f.results())[0]);
  f.facts.head = 'c'.repeat(40); // A new commit with the identical candidate tree.
  const head = f.facts.head;
  const hit = await f.launch();
  assert.equal(hit.cached?.run, original.id);
  const result = await eventually('bounded cache', async () => (await f.results())[1]);
  assert.ok(Buffer.byteLength(result.text) <= 384);
  assert.ok(result.text.includes('cached') && result.text.includes(head) && result.text.includes(original.id) && result.text.includes(hit.cached!.head) && result.text.includes(hit.cached!.tree));
  assert.equal(result.artifacts.length, 1);
  assert.match(result.text, /Executor local · \S+ \S+ · Node v[\d.]+ · Neovim none/);
  assert.match(result.text, /Original occasion none · executor local/);
  await eventually('bounded cache settled', async () => {
    const status = await f.ui.request({ type: 'hub.status', history: true });
    return (status.value as { suites: Array<{ reported: boolean }> }).suites.every(j => j.reported) ? true : undefined;
  });
  assert.equal((await f.results()).length, 2);
});

test('package candidate trees keep different npm scripts out of the root cache', async t => {
  const f = await fixture(t);
  await mkdir(join(f.root, 'other-package'));
  // This package inherits the root's verification commands and hub discovery.
  await verificationFixture(join(f.root, 'other-package'), { testScript: 'node -e "process.exit(1)"' });
  await f.launch();
  assert.match((await eventually('root green', async () => (await f.results())[0])).text, /exit 0/);
  f.code(1);
  f.trees.set(join(f.root, 'other-package'), 'c'.repeat(40)); // Candidate inspection supplies this package's distinct script tree.
  const response = await clandWithEnv(join(f.root, 'other-package'), f.env, 'verify', 'auto', '--report', f.topic, '--to', 'rev', '--json');
  assert.equal(response.code, 0, response.stderr);
  const subdirectory = JSON.parse(response.stdout) as { id: string; cached?: unknown; pid?: number };
  assert.equal(subdirectory.cached, undefined);
  assert.match((await eventually('package failure', async () => (await f.results())[1])).text, /exit 1/);
});
