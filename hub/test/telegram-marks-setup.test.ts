import test from 'node:test';
import assert from 'node:assert/strict';
import { telegramMarks } from './telegram-marks-fixture.ts';
import { access } from 'node:fs/promises';
import { FakeClock } from './fake-clock.ts';
import { within } from '../src/executor/droplet/deadline.ts';

for (const failure of ['omitted', 'aborted'] as const) test(`Telegram marks fixture drains ${failure} setup before removing its root`, async t => {
  const f = await telegramMarks(t);
  const { root } = await f.project();
  await f.prepare(root);
  const setupClock = new FakeClock(), abort = new AbortController();
  const poll = f.owner.observe(signal => f.fake.waitForPoll(signal));
  const closed = f.owner.observe(async signal => f.fake.waitForPollClose((await poll).id, signal), { drain: true });
  const starting = f.startHub(root, f.env, {}, { receipt: new Promise<void>(() => {}), clock: setupClock, signal: abort.signal });
  const rejected = assert.rejects(starting, failure === 'omitted' ? /setup receipt deadline/ : /cancelled/);
  const hub = await within(f.owner.serving, 2000);
  await within(poll, 2000);
  if (failure === 'omitted') await setupClock.advance(1000);
  else abort.abort(new Error('setup cancelled'));
  await rejected;
  await within(closed, 2000);
  await f.owner.dispose();
  await hub.stopped;
  await f.native.close();
  assert.equal(f.native.receipts().closed, true);
  assert.equal(f.native.receipts().handlers, 0);
  assert.equal(f.native.receipts().connections, 0);
  assert.equal(f.owner.observations(), 0);
  assert.equal(f.clock.pending, 0);
  assert.equal(setupClock.pending, 0);
  assert.throws(() => f.store.remotes.forMessenger('telegram').get('telegram.offset'), /closed|not open/i);
});


test('Telegram marks incomplete drain retains root and Store until actual settlement', async t => {
  const drainClock = new FakeClock();
  const f = await telegramMarks(t, { drainClock });
  const project = await f.project();
  await f.prepare(project.root);
  const release = Promise.withResolvers<void>(), entered = Promise.withResolvers<void>();
  f.owner.close(async () => { entered.resolve(); await release.promise; });
  try {
    const removing = project.remove();
    const incomplete = assert.rejects(removing, /drainage incomplete; root retained/);
    await within(entered.promise, 2000);
    await drainClock.advance(1000);
    await incomplete;
    await access(project.root);
    assert.equal(f.store.remotes.forMessenger('telegram').get('telegram.offset'), null);
  } finally { release.resolve(); }
  await f.owner.dispose();
  assert.throws(() => f.store.remotes.forMessenger('telegram').get('telegram.offset'), /closed|not open/i);
  await project.remove();
  await assert.rejects(access(project.root), { code: 'ENOENT' });
  assert.equal(drainClock.pending, 0);
});
