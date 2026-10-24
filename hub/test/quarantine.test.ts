import assert from 'node:assert/strict';
import test from 'node:test';
import { lintQuarantineManifest, recordQuarantineResults, type QuarantineHistory, type QuarantineResult } from '../src/suite-quarantine.ts';
import { Readable } from 'node:stream';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Reporter from './quarantine-reporter.ts';

test('receipt publication preserves the previous file when staging fails and publishes complete JSON on flush', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-receipt-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'receipt.json');
  await writeFile(path, 'previous receipt');
  await mkdir(`${path}.tmp`);
  const publish = async () => {
    const reporter = Readable.from([{ type: 'test:summary', data: { counts: { cancelled: 0 } } }]).pipe(new Reporter(path));
    let output = '';
    for await (const chunk of reporter) output += chunk;
    return output;
  };
  await assert.rejects(publish(), { code: 'EISDIR' });
  assert.equal(await readFile(path, 'utf8'), 'previous receipt');
  // No reporter writer remains after the rejected stream.
  await rm(`${path}.tmp`, { recursive: true });
  assert.equal(await publish(), '', 'the atomic file replaces streamed JSON');
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), { complete: true, cancelled: 0, failures: [], results: [], excused: 0 });
  await assert.rejects(readFile(`${path}.tmp`), { code: 'ENOENT' });
});

test('quarantine requires an owner, a reason and at most seven days, and expiry names the test', () => {
  const identity = 'hub/test/example.test.ts::known flake';
  const entry = { owner: 'T-657', reason: 'Two independent flaky runs; isolated 5/5 green.', added: '2026-10-16', expires: '2026-10-23' };
  const manifest = { version: 1, tests: { [identity]: entry } };
  const now = Date.parse('2026-10-16T12:00:00Z');
  assert.doesNotThrow(() => lintQuarantineManifest(manifest, now));
  for (const invalid of [{ owner: '' }, { reason: 'TODO' }, { expires: '2026-10-24' }, { added: '2026-02-30' }]) {
    assert.throws(() => lintQuarantineManifest({ ...manifest, tests: { [identity]: { ...entry, ...invalid } } }, now), /hub\/test\/example.test.ts::known flake/);
  }
  assert.throws(() => lintQuarantineManifest(manifest, Date.parse('2026-10-23T00:00:00Z')), /expired quarantine: hub\/test\/example.test.ts::known flake/);
});

test('twenty distinct recorded green results clear quarantine; failures and skips reset it and cache hits do not count', () => {
  const result: QuarantineResult = { file: 'hub/test/example.test.ts', name: 'known flake', outcome: 'pass', entry: { owner: 'T-657', reason: 'Known flake.', added: '2026-10-16', expires: '2026-10-23' } };
  let history: QuarantineHistory = {};
  const record = (id: string, results = [result], cached = false) => {
    const next = recordQuarantineResults(history, id, results, cached);
    history = next.history;
    return next.lines.join('\n');
  };
  for (let i = 0; i < 19; i++) assert.doesNotMatch(record(`green-${i}`), /cleared/);
  assert.doesNotMatch(record('green-18'), /cleared/, 'report retries count once');
  assert.doesNotMatch(record('cached', [result], true), /cleared/, 'cache reuse supplies no fresh observation');
  assert.match(record('green-19'), /cleared.*20 consecutive green/);
  assert.doesNotMatch(record('failed', [{ ...result, outcome: 'fail' }]), /cleared/);
  for (let i = 0; i < 19; i++) assert.doesNotMatch(record(`again-${i}`), /cleared/);
  assert.doesNotMatch(record('skipped', [{ ...result, outcome: 'skip' }]), /cleared/);
  assert.doesNotMatch(record('after-skip'), /cleared/);
  for (let i = 0; i < 19; i++) record(`last-${i}`);
  assert.match(record('last-19'), /cleared/);
  assert.doesNotMatch(record('new-entry', [{ ...result, entry: { ...result.entry, added: '2026-10-17' } }]), /cleared/, 'a renewed entry starts a new streak');
});
