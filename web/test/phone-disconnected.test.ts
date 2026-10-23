// Web: phone disconnection through the sealed scratch hub and real socket edge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { connectUi, inProcessSpoke } from '../../hub/test/harness.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import type { Inbox } from '../../shared/wire/index.ts';
import { until } from '../../hub/test/until.ts';
import { webFixture, pageUntil, reconnectUntilLive, pausePageClock } from './harness.ts';

test('phone disconnect shows a counting backoff and immediate Retry resets it without reloading', async t => {
  const fixture = await webFixture(t, { timezoneId: 'UTC' });
  await fixture.pageCase(t, async page => {
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Live', 'initial live connection');
    await pausePageClock(page, new Date('2026-10-23T14:10:00Z'));
    let documents = 0;
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) documents++; });
    const attempts: boolean[] = [];
    page.on('websocket', socket => { const index = attempts.length; attempts.push(false); socket.once('close', () => { attempts[index] = true; }); });
    await fixture.hub.stop();
    await fixture.hub.stopped;
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Offline', 'closed scratch hub socket');
    const strip = page.locator('[data-disconnected]');
    assert.equal(await strip.count(), 1);
    assert.match(await strip.innerText(), /Disconnected since 14:10 · retry in 1 s/);
    const retry = strip.getByRole('button', { name: 'Retry', exact: true });
    assert.ok((await retry.boundingBox())!.height >= 44);
    const header = (await page.locator('header').first().boundingBox())!;
    assert.equal((await strip.boundingBox())!.y, header.y + header.height, 'strip sits under header');
    for (const delay of [250, 500, 1000, 2000, 4000]) {
      const count = attempts.length;
      await page.clock.runFor(delay);
      await until(() => attempts[count] === true, { what: 'failed real retry closed', timeoutMs: 3000 });
    }
    assert.match(await strip.innerText(), /Disconnected since 14:10 · retry in 8 s/);
    await page.clock.runFor(1000);
    assert.match(await strip.innerText(), /retry in 7 s/);
    const immediate = page.waitForEvent('websocket');
    await retry.tap();
    await immediate;
    await until(() => attempts[5] === true, { what: 'immediate retry closed', timeoutMs: 3000 });
    assert.match(await strip.innerText(), /retry in 1 s/);
    await page.clock.runFor(249);
    assert.equal(attempts.length, 6, 'Retry resets to 250 ms');
    await page.setViewportSize({ width: 640, height: 844 });
    await pageUntil(page, () => document.querySelector('[data-phone]')?.getAttribute('data-phone') === 'false', 'desktop width committed');
    assert.equal(await strip.count(), 0, 'desktop retains its dot');
    await page.setViewportSize({ width: 390, height: 844 });
    await pageUntil(page, () => document.querySelector('[data-phone]')?.getAttribute('data-phone') === 'true', 'phone width committed');
    assert.equal(await strip.count(), 1);
    await fixture.restartHub();
    await reconnectUntilLive(page);
    assert.equal(await strip.count(), 0);
    assert.equal(documents, 0, 'reconnect needs no document navigation');
  }, undefined, { phone: true });
});

test('phone keeps the last Inbox time and disables every answer and reply while disconnected', async t => {
  const clock = new FakeClock(new Date('2026-10-23T12:00:00Z'));
  const fixture = await webFixture(t, { clock, timezoneId: 'UTC' });
  const ui = await connectUi(t, fixture.hub.discovery);
  const sender = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', role: 'coordinator', sessionId: 'offline-controls' });
  await sender.waitForPresence(['coord']);
  const asked = await sender.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Keep this decision?', options: ['Keep', 'Wait'], free: true });
  assert.equal(asked.ok, true);
  assert.equal((await sender.call<{ ok: boolean }>('send', { topic: 'general', text: 'Offline reply report', kind: 'decision' })).ok, true);
  assert.equal((await ui.request({ type: 'session.launch', name: 'worker', harness: 'codex' })).ok, true);
  fixture.fakes.codex!.raiseApproval('worker', { id: 'offline-native', kind: 'command', subject: { command: 'echo offline' }, choices: ['once', 'always', 'deny'], answerIn: 'hub' });
  const inbox = (await ui.request({ type: 'inbox.list' })).value as Inbox;
  const approval = inbox.approvals[0]!;
  const message = inbox.messages.find(row => row.text === 'Offline reply report')!;
  await clock.advance(250);
  const mutations: string[] = [];
  await fixture.pageCase(t, async page => {
    const rows = page.getByRole('list', { name: 'Inbox objects', exact: true });
    await rows.locator(`[data-object-id="${asked.ask}"]`).waitFor();
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Live', 'initial live snapshot');
    await rows.locator(`[data-object-id="${message.id}"]`).tap();
    const reply = page.locator('[data-inbox-reply]');
    await reply.getByRole('textbox').fill('Keep this draft');
    await fixture.hub.stop(); await fixture.hub.stopped;
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Offline', 'offline before controls');
    await page.clock.runFor(1000);
    const title = page.locator('[data-pane="primary"] > [data-fold-block] > header');
    assert.match(await title.innerText(), /Inbox.*as of 14:09/s);
    assert.equal(await rows.locator('[data-object-id]').count(), 3, 'snapshot rows stay visible');
    assert.match(await reply.innerText(), /unsent/);
    assert.equal(await reply.locator('[data-composer-send]').isDisabled(), true);
    assert.equal(await reply.getByRole('textbox').inputValue(), 'Keep this draft');
    await rows.locator(`[data-object-id="${asked.ask}"]`).tap();
    const ask = page.getByRole('dialog', { name: 'Answer ask', exact: true });
    assert.equal(await ask.locator('[data-ask-option], input, [data-ask-decline], [data-ask-send]').count(), 5);
    for (const control of await ask.locator('[data-ask-option], input, [data-ask-decline], [data-ask-send]').all()) assert.equal(await control.isDisabled(), true);
    await ask.getByRole('button', { name: 'Close sheet', exact: true }).tap();
    await rows.locator(`[data-object-id="${approval.id}"]`).tap();
    const sheet = page.getByRole('dialog', { name: 'Command approval', exact: true });
    assert.equal(await sheet.locator('[data-approval-choice], [data-approval-deny], input').count(), 4);
    for (const control of await sheet.locator('[data-approval-choice], [data-approval-deny], input').all()) assert.equal(await control.isDisabled(), true);
    await sheet.getByRole('button', { name: 'Close sheet', exact: true }).tap();
    await page.clock.runFor(1000);
    assert.match(await title.innerText(), /as of 14:09/);
    assert.deepEqual(mutations, [], 'offline controls send no mutation');
  }, async page => {
    await pausePageClock(page, new Date('2026-10-23T14:09:00Z'));
    page.on('websocket', socket => socket.on('framesent', event => { const frame = JSON.parse(String(event.payload)); if (['topic.send', 'topic.answer', 'approval.answer'].includes(frame.type)) mutations.push(frame.type); }));
  }, { phone: true });
});

test('phone reconnect keeps offline drafts unsent and refreshes a refused resume from the last sequence', async t => {
  const fixture = await webFixture(t, { timezoneId: 'UTC' });
  const frames: Array<{ type: string; resume?: { epoch: string; seq: number }; epoch?: string; seq?: number }> = [];
  const sent: string[] = [];
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Topics', exact: true }).tap();
    await page.getByRole('list', { name: 'Topics objects', exact: true }).locator('[data-object-id="general"]').tap();
    const composer = page.locator('[data-phone-composer]');
    await composer.waitFor();
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Live', 'initial live connection');
    await pausePageClock(page, new Date('2026-10-23T14:10:00Z'));
    const documentTime = await page.evaluate(() => performance.timeOrigin);
    await fixture.hub.stop(); await fixture.hub.stopped;
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Offline', 'offline before drafting');
    const cursor = frames.filter(frame => frame.epoch !== undefined && frame.seq !== undefined && frame.type !== 'snapshot').at(-1)!;
    await composer.getByRole('textbox').fill('Offline draft stays here');
    assert.equal(await composer.locator('[data-composer-send]').isDisabled(), true);
    await composer.evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    assert.deepEqual(sent, []);
    await fixture.restartHub();
    const sender = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', role: 'coordinator', sessionId: 'offline-new-ask' });
    await sender.waitForPresence(['coord']);
    const asked = await sender.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Raised during disconnection', options: ['Now', 'Later'] });
    assert.equal(asked.ok, true);
    await reconnectUntilLive(page);
    assert.equal(await page.locator('[data-disconnected]').count(), 0);
    assert.equal(await composer.getByRole('textbox').inputValue(), 'Offline draft stays here');
    assert.equal(await composer.locator('[data-composer-send]').isDisabled(), false);
    assert.deepEqual(sent, [], 'reconnection never replays the draft');
    const hello = frames.filter(frame => frame.type === 'hello').at(-1)!;
    assert.deepEqual(hello.resume, { epoch: cursor.epoch, seq: cursor.seq }, 'hello retains the last applied sequence');
    assert.notEqual(frames.filter(frame => frame.type === 'snapshot.end').at(-1)!.epoch, cursor.epoch, 'new epoch supplies the replacement snapshot');
    const ui = await connectUi(t, fixture.hub.discovery);
    const history = await ui.request({ type: 'topic.history', topic: 'general' });
    assert.equal(history.ok, true);
    assert.equal((history.value as { messages: Array<{ text: string }> }).messages.some(row => row.text === 'Offline draft stays here'), false, 'durable history has no offline send');
    await page.getByRole('button', { name: 'Inbox', exact: true }).tap();
    const inbox = page.getByRole('list', { name: 'Inbox objects', exact: true });
    await inbox.locator(`[data-object-id="${asked.ask}"]`).waitFor();
    assert.match(await inbox.innerText(), /Raised during disconnection/);
    assert.doesNotMatch(await page.locator('[data-pane="primary"] > [data-fold-block] > header').innerText(), /as of/);
    assert.equal(await page.evaluate(() => performance.timeOrigin), documentTime, 'same document after reconnection and navigation');
  }, page => {
    page.on('websocket', socket => {
      socket.on('framesent', event => { const frame = JSON.parse(String(event.payload)); frames.push(frame); if (frame.type === 'topic.send') sent.push(frame.text); });
      socket.on('framereceived', event => frames.push(JSON.parse(String(event.payload))));
    });
  }, { phone: true });
});
