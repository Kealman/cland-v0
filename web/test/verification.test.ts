// Web: sealed scratch hub, hand-run reservations, isolated Headless Shell.
import test from 'node:test';
import assert from 'node:assert/strict';
import { connectUi } from '../../hub/test/harness.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import { until } from '../../hub/test/until.ts';
import { pageUntil, webFixture, pausePageClock } from './harness.ts';
import type { Page } from 'playwright-core';
import type { HubFrame } from '../../shared/wire/index.ts';

async function initialQueueReceipt(frames: HubFrame[]) {
  const received = () => frames.some(frame => frame.type === 'snapshot' && frame.domain === 'sessions' &&
    frame.value.verification?.holder?.kind === 'hand run' && frame.value.verification.waiters.length === 1);
  await until(received, { what: 'initial hand-holder and waiter queue snapshot received', timeoutMs: 3000 });
  assert.equal(received(), true);
}
async function initialQueueRows(page: Page) {
  await pageUntil(page, () => {
    const rows = document.querySelectorAll('[data-verification-row]');
    return rows.length === 2 && rows[0]?.children[0]?.textContent === 'local 1/1' &&
      rows[0]?.children[1]?.textContent === 'human' && rows[0]?.children[4]?.textContent === '5s' &&
      rows[1]?.children[0]?.textContent === 'waiting 1' && rows[1]?.children[1]?.textContent === 'human' &&
      rows[1]?.children[3]?.textContent?.includes('executor local') === true && rows[1]?.children[4]?.textContent === '0s';
  }, 'initial holder and waiter identities, executors and times rendered');
}

test('Sessions verification queue shows hand runs, ages receipts and remembers its fold', async t => {
  const clock = new FakeClock();
  const fixture = await webFixture(t, { clock });
  const holder = await connectUi(t, fixture.hub.discovery, 'cli');
  const waiter = await connectUi(t, fixture.hub.discovery, 'cli');
  const slot = { type: 'suite.slot' as const, mode: 'hub-only' as const, cwd: fixture.root, head: 'recorded-head', pid: process.pid, token: 'web-holder' };
  assert.equal((await holder.request(slot)).ok, true);
  await until(async () => {
    const result = await holder.request({ type: 'suite.queue' });
    return result.ok && (result.value as { holder?: { kind: string } }).holder?.kind === 'hand run';
  }, { what: 'admitted hand holder in public queue', timeoutMs: 3000 });
  await clock.advance(5000);
  assert.equal((await waiter.request({ ...slot, token: 'web-waiter' })).ok, true);
  const frames: HubFrame[] = [];
  const sent: { type: string }[] = [];
  await t.test('C1 hand holder and waiter open in place with Enter and executor status is read once per opening', async t => {
    await fixture.pageCase(t, async page => {
      await page.getByRole('button', { name: 'Sessions', exact: true }).click();
      const group = page.getByRole('button', { name: 'Fold Yours', exact: true });
      await group.focus();
      await group.press('Enter');
      await pageUntil(page, () => document.querySelector('[aria-label="Fold Yours"]')?.getAttribute('aria-expanded') === 'false', 'group folded after physical Enter');
      assert.equal(await group.getAttribute('aria-expanded'), 'false', 'physical Enter folds an existing Sessions group');
      await group.press('Enter');
      await pageUntil(page, () => document.querySelector('[aria-label="Fold Yours"]')?.getAttribute('aria-expanded') === 'true', 'group unfolded after physical Enter');
      assert.equal(await group.getAttribute('aria-expanded'), 'true');
      const archive = page.getByRole('button', { name: 'Show archived sessions', exact: true });
      await archive.press('Enter');
      await pageUntil(page, () => document.querySelector('[aria-label="Show archived sessions"]')?.getAttribute('aria-pressed') === 'true', 'archive toggled on after physical Enter');
      assert.equal(await archive.getAttribute('aria-pressed'), 'true', 'physical Enter activates a native Sessions button');
      await archive.press('Enter');
      await pageUntil(page, () => document.querySelector('[aria-label="Show archived sessions"]')?.getAttribute('aria-pressed') === 'false', 'archive toggled off after physical Enter');
      assert.equal(await archive.getAttribute('aria-pressed'), 'false');
      const line = page.locator('[data-session-slot="verification"] [data-fold-toggle]');
      await line.waitFor();
      await initialQueueReceipt(frames);
      await pageUntil(page, () => document.querySelector('[data-session-slot="verification"] [data-fold-toggle]')?.textContent?.includes('verify: human 5s') === true && document.querySelector('[data-session-slot="verification"] [data-fold-toggle]')?.textContent?.includes('1 waiting') === true, 'initial holder and waiter summary rendered');
      assert.match(await line.textContent() ?? '', /verify: human 5s .*1 waiting · next \?/);
      const opened = page.getByRole('table', { name: 'Verification queue', exact: true }).waitFor();
      await line.press('Enter');
      await opened;
      await initialQueueRows(page);
      const rows = page.locator('[data-verification-row]');
      assert.equal(await rows.count(), 2);
      assert.ok((await rows.nth(0).textContent())?.includes('local 1/1human'));
      assert.ok((await rows.nth(0).textContent())?.includes(fixture.root));
      assert.match(await rows.nth(1).textContent() ?? '', /waiting 1human.*executor local.*0s\?/);
      await pageUntil(page, () => document.querySelector('[data-verification-spend]')?.textContent === 'droplets today $0.00 of the $5.00 cap', 'executor daily spend renders');
      assert.equal(sent.filter(frame => frame.type === 'executor.status').length, 1);
      await line.press('ArrowLeft');
      assert.equal(await line.getAttribute('aria-expanded'), 'false');
      await line.press('ArrowRight');
      await pageUntil(page, () => document.querySelector('[data-session-slot="verification"] [data-fold-toggle]')?.getAttribute('aria-expanded') === 'true', 'shared fold key reopens queue');
      await until(() => sent.filter(frame => frame.type === 'executor.status').length === 2, { what: 'one new executor read on reopening', timeoutMs: 3000 });
      assert.equal(sent.filter(frame => frame.type === 'executor.status').length, 2);
    }, async page => {
      await pausePageClock(page, clock.now());
      page.on('websocket', socket => {
        socket.on('framereceived', event => frames.push(JSON.parse(String(event.payload))));
        socket.on('framesent', event => sent.push(JSON.parse(String(event.payload))));
      });
    });
  });
  await t.test('C3 elapsed running and wait times advance without a frame and a replacement resets their receipt', async t => {
    frames.length = 0;
    await fixture.pageCase(t, async page => {
      await page.getByRole('button', { name: 'Sessions', exact: true }).click();
      const line = page.locator('[data-session-slot="verification"] [data-fold-toggle]');
      await line.click();
      await page.getByRole('table', { name: 'Verification queue', exact: true }).waitFor();
      await initialQueueReceipt(frames);
      await initialQueueRows(page);
      const before = frames.filter(frame => frame.type === 'verification.queue').length;
      await page.clock.runFor(60_000);
      assert.match(await line.textContent() ?? '', /verify: human 1m .*1 waiting/);
      assert.deepEqual(await page.locator('[data-verification-row] td:nth-child(5)').allTextContents(), ['1m', '1m']);
      assert.equal(frames.filter(frame => frame.type === 'verification.queue').length, before, 'client ages without a new queue frame');
      const replaced = pageUntil(page, () => document.querySelectorAll('[data-verification-row]').length === 1 && document.querySelector('[data-verification-row] td:nth-child(5)')?.textContent === '5s', 'replacement queue receipt resets elapsed time');
      await waiter.close();
      await replaced;
      assert.equal(await page.locator('[data-verification-row]').count(), 1);
      assert.equal(await page.locator('[data-verification-row] td:nth-child(5)').textContent(), '5s');
      assert.ok(!((await line.textContent())?.includes('waiting')));
    }, async page => {
      await pausePageClock(page, clock.now());
      page.on('websocket', socket => socket.on('framereceived', event => frames.push(JSON.parse(String(event.payload)))));
    });
  });
  await t.test('C4 queue open and closed preferences survive reload', async t => {
    await fixture.pageCase(t, async page => {
      await page.getByRole('button', { name: 'Sessions', exact: true }).click();
      const line = page.locator('[data-session-slot="verification"] [data-fold-toggle]');
      assert.equal(await line.getAttribute('aria-expanded'), 'false');
      await line.click();
      await page.getByRole('table', { name: 'Verification queue', exact: true }).waitFor();
      await page.reload();
      await page.getByRole('table', { name: 'Verification queue', exact: true }).waitFor();
      assert.equal(await line.getAttribute('aria-expanded'), 'true');
      await line.press('Enter');
      assert.equal(await line.getAttribute('aria-expanded'), 'false');
      await page.reload();
      await line.waitFor();
      assert.equal(await line.getAttribute('aria-expanded'), 'false');
      assert.equal(await page.getByRole('table', { name: 'Verification queue', exact: true }).count(), 0);
    });
  });
});
