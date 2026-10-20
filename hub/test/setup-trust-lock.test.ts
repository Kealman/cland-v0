// T2: setup's trust step against a fake config-lock holder in a scratch HOME, as required by T-936 C2.
// The holder and retry use one complete FakeClock; no harness process or wall-clock wait.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTrustStep } from '../src/setup/steps/trust.ts';
import type { SetupOptions } from '../src/setup/types.ts';
import { FakeClock } from './fake-clock.ts';
import { scriptedPrompter } from './setup-prompter.ts';

function fixture(t: test.TestContext) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'cland-trust-lock-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const file = join(root, '.claude.json'), lock = `${file}.lock`;
  const clock = new FakeClock();
  writeFileSync(file, '{}');
  mkdirSync(lock);
  const refresh = () => utimesSync(lock, clock.now(), clock.now());
  refresh();
  const options: SetupOptions = { root, env: { HOME: root }, interactive: false, yes: true, prompter: scriptedPrompter([]), machine: {
    requiredHarnesses: async () => ['claude-code'], projectExists: async () => true, onPath: async () => true,
    read: async () => null, write: async () => { assert.fail('unexpected project write'); },
    run: async () => { assert.fail('unexpected installer'); },
    harness: async id => ({ id, bin: id === 'claude-code' ? '/tools/claude' : null, version: null, checks: [] }),
  } };
  return { root, file, lock, clock, refresh, run: () => createTrustStep({ clock })(options) };
}

test('setup trusts Claude after its config writer releases the lock beyond five seconds', async t => {
  const { root, file, lock, clock, run } = fixture(t);
  const result = run();
  await clock.advance(6000);
  assert.equal(readFileSync(file, 'utf8'), '{}', 'trust must wait for the writer');
  writeFileSync(file, '{"writtenByHolder":true}');
  rmSync(lock, { recursive: true });
  await clock.advance(1000);
  const lines = await result;
  assert.equal(lines[0]?.verdict, 'done', JSON.stringify(lines));
  assert.deepEqual(JSON.parse(readFileSync(file, 'utf8')), { writtenByHolder: true, projects: { [root]: { hasTrustDialogAccepted: true } } });
  assert.equal(existsSync(lock), false);
  assert.equal(clock.pending, 0);
});

test('setup reclaims the orphan left by the Claude auth probe within its retry window', async t => {
  const { root, file, lock, clock, run } = fixture(t);
  let finished = false;
  const result = run().then(lines => { finished = true; return lines; });
  await clock.advance(10_000);
  assert.equal(finished, false, 'the existing ten-second stale threshold still applies');
  assert.equal(existsSync(lock), true);
  await clock.advance(1000);
  assert.equal((await result)[0]?.verdict, 'done');
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).projects[root].hasTrustDialogAccepted, true);
  assert.equal(existsSync(lock), false);
  assert.equal(clock.pending, 0);
});

test('setup bounds a refreshed Claude lock wait and reports the path and unknown holder', async t => {
  const { file, lock, clock, refresh, run } = fixture(t);
  const holder = clock.setInterval(refresh, 500);
  try {
    let finished = false;
    const result = run().then(lines => { finished = true; return lines; });
    await clock.advance(14_999);
    assert.equal(finished, false);
    assert.equal(readFileSync(file, 'utf8'), '{}');
    await clock.advance(1);
    const lines = await result;
    assert.equal(lines[0]?.verdict, 'fail');
    assert.ok(lines[0]!.detail.includes(lock), lines[0]!.detail);
    assert.match(lines[0]!.detail, /after 15000 ms \(retry window 15000 ms\)/);
    assert.match(lines[0]!.detail, /holder unknown \(Claude Code directory lock has no PID metadata\)/);
    assert.equal(readFileSync(file, 'utf8'), '{}');
    assert.equal(existsSync(lock), true, 'a refreshed lock belongs to the writer');
  } finally {
    clock.clearInterval(holder);
  }
  assert.equal(clock.pending, 0);
});
