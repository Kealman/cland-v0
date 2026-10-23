// Web: phone approvals through the sealed touch browser and fake native/frame receipts.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright-core';
import type { Inbox } from '../../shared/wire/index.ts';
import { connectUi } from '../../hub/test/harness.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import { until } from '../../hub/test/until.ts';
import { webFixture, pageUntil } from './harness.ts';

async function approvalFixture(t: Parameters<typeof webFixture>[0]) {
  const clock = new FakeClock(new Date('2026-10-23T12:00:00Z'));
  const fixture = await webFixture(t, { clock, timezoneId: 'UTC' });
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'session.launch', name: 'phone-worker', harness: 'codex' })).ok, true);
  fixture.fakes.codex!.raiseApproval('phone-worker', { id: 'phone-native', kind: 'command', subject: { command: 'echo phone' }, choices: ['once', 'always', 'deny'], answerIn: 'hub' });
  const inbox = (await ui.request({ type: 'inbox.list' })).value as Inbox;
  return { ...fixture, clock, ui, approval: inbox.approvals.find(record => record.session === 'phone-worker')! };
}
const sheet = (page: Page) => page.getByRole('dialog', { name: 'Command approval', exact: true });
const row = (page: Page, id: string) => page.getByRole('list', { name: 'Inbox objects', exact: true }).locator(`[data-object-id="${id}"]`);

test('phone approval opens the complete subject in a touch sheet and folds to the frame outcome', async t => {
  const fixture = await approvalFixture(t);
  const command = 'printf "' + 'complete phone command '.repeat(100) + '\\n"';
  fixture.fakes.codex!.raiseApproval('phone-worker', { id: 'phone-native', kind: 'command', subject: { command, cwd: '/scratch/work', reason: 'Check the phone change' }, choices: ['once', 'always', 'deny'], answerIn: 'hub' });
  await fixture.pageCase(t, async page => {
    const target = row(page, fixture.approval.id);
    await target.tap();
    const dialog = sheet(page);
    await dialog.waitFor();
    assert.equal(await dialog.locator('pre').textContent(), command);
    assert.match(await dialog.innerText(), /phone-worker.*codex/s);
    assert.match(await dialog.innerText(), /\/scratch\/work.*Check the phone change/s);
    assert.equal(await dialog.locator('time').getAttribute('datetime'), fixture.approval.since);
    for (const choice of ['once', 'always']) {
      const bounds = (await dialog.locator(`[data-approval-choice="${choice}"]`).boundingBox())!;
      assert.ok(bounds.height >= 44, `${choice}: ${bounds.height} px`);
      assert.ok(bounds.width >= 350, `${choice}: ${bounds.width} px full width`);
    }
    assert.ok((await dialog.getByRole('button', { name: 'Deny', exact: true }).boundingBox())!.height >= 44);
    await dialog.locator('[data-approval-choice="once"]').tap();
    await dialog.waitFor({ state: 'hidden' });
    const outcome = target.locator('..').locator('[data-approval-outcome]');
    await outcome.waitFor();
    assert.match(await outcome.innerText(), /Approved once by the human.*web/s);
    const archive = (await fixture.ui.request({ type: 'inbox.list', archive: true })).value as Inbox;
    assert.deepEqual(archive.archive?.find(record => record.id === fixture.approval.id)?.outcome, {
      choice: 'once', by: 'human', via: 'web', at: fixture.clock.now().toISOString(),
    });
    assert.equal(fixture.fakes.codex!.approvalAnswers.at(-1)?.choice, 'once');
    assert.equal(await target.isVisible(), false, 'the row folds after the receipt');
    fixture.fakes.codex!.raiseApproval('phone-worker', { id: 'phone-always', kind: 'command', subject: { command: 'echo always' }, choices: ['once', 'always', 'deny'], answerIn: 'hub' });
    await fixture.clock.advance(250);
    const next = row(page, `${fixture.approval.sessionId}:phone-always`);
    await next.tap();
    await sheet(page).getByRole('button', { name: 'Always for this command', exact: true }).tap();
    await sheet(page).waitFor({ state: 'hidden' });
    await next.locator('..').locator('[data-approval-outcome]').waitFor();
    assert.match(await next.locator('..').innerText(), /Approved always by the human.*web/s);
    assert.equal(fixture.fakes.codex!.approvalAnswers.at(-1)?.choice, 'always');
  }, undefined, { phone: true });
});

test('phone TUI approvals mark the command and never open answer controls', async t => {
  const fixture = await approvalFixture(t);
  assert.equal((await fixture.ui.request({ type: 'session.launch', name: 'claude-phone', harness: 'claude-code' })).ok, true);
  fixture.fakes['claude-code']!.raiseApproval('claude-phone', { id: 'claude', kind: 'command', subject: { command: 'echo Claude TUI' }, choices: [], answerIn: 'tui' });
  fixture.fakes.codex!.raiseApproval('phone-worker', { id: 'phone-native', kind: 'command', subject: { command: 'echo payload fallback' }, choices: [], answerIn: 'tui' });
  const inbox = (await fixture.ui.request({ type: 'inbox.list' })).value as Inbox;
  await fixture.pageCase(t, async page => {
    for (const approval of inbox.approvals) {
      const target = row(page, approval.id);
      await target.waitFor();
      assert.match(await target.innerText(), /answer in Neovim/);
      assert.match(await target.innerText(), /echo (Claude TUI|payload fallback)/);
      await target.tap();
      assert.equal(await sheet(page).count(), 0);
      assert.equal(await target.locator('..').locator('[data-approval-choice], [data-approval-deny], input').count(), 0);
    }
    assert.deepEqual(fixture.fakes.codex!.approvalAnswers, []);
    assert.deepEqual(fixture.fakes['claude-code']!.approvalAnswers, []);
  }, undefined, { phone: true });
});

test('phone Deny shares the note label row and sends with or without a note', async t => {
  const fixture = await approvalFixture(t);
  await fixture.pageCase(t, async page => {
    for (const note of ['', 'Wait for review']) {
      const native = note ? 'with-note' : 'phone-native';
      const id = `${fixture.approval.sessionId}:${native}`;
      if (note) {
        fixture.fakes.codex!.raiseApproval('phone-worker', { id: native, kind: 'command', subject: { command: 'echo with note' }, choices: ['once', 'always', 'deny'], answerIn: 'hub' });
        await fixture.clock.advance(250);
      }
      const target = row(page, id);
      await target.tap();
      const dialog = sheet(page);
      const field = dialog.getByRole('textbox', { name: 'Denial note', exact: true });
      const deny = dialog.getByRole('button', { name: 'Deny', exact: true });
      const labelBox = (await dialog.locator('label').boundingBox())!;
      const fieldBox = (await field.boundingBox())!;
      const denyBox = (await deny.boundingBox())!;
      assert.ok(denyBox.height >= 44 && denyBox.y <= labelBox.y && denyBox.y + denyBox.height >= labelBox.y + labelBox.height && denyBox.y + denyBox.height <= fieldBox.y, 'Deny sits alongside the label above the note');
      assert.equal(await deny.isDisabled(), false, 'a note is optional');
      await field.fill(note);
      if (note) {
        await page.setViewportSize({ width: 390, height: 500 });
        await pageUntil(page, () => document.querySelector('[data-phone]') !== null && visualViewport!.height === 500 && Math.abs(document.querySelector('[data-bottom-sheet]')!.getBoundingClientRect().bottom - (visualViewport!.offsetTop + visualViewport!.height)) < 1, 'approval sheet follows the phone visual viewport');
      }
      await deny.tap();
      await dialog.waitFor({ state: 'hidden' });
      const outcome = target.locator('..').locator('[data-approval-outcome]');
      await outcome.waitFor();
      assert.match(await outcome.innerText(), /Denied by the human.*web/s);
      const archive = (await fixture.ui.request({ type: 'inbox.list', archive: true })).value as Inbox;
      const closed = archive.archive?.find(record => record.id === id)?.outcome;
      assert.ok(closed && 'choice' in closed);
      assert.equal(closed?.choice, 'deny');
      assert.equal(closed?.note, note || undefined);
      assert.equal(fixture.fakes.codex!.approvalAnswers.at(-1)?.note, note || undefined);
    }
    assert.deepEqual(fixture.fakes.codex!.approvalAnswers.map(answer => answer.choice), ['deny', 'deny']);
  }, undefined, { phone: true });
});

test('phone file approval preserves the complete change and a peer winner closes its sheet', async t => {
  const fixture = await approvalFixture(t);
  let departed = false;
  const subject = { files: ['src/first.ts', 'src/second.ts'], change: '--- src/first.ts\n+++ src/first.ts\n@@ -1 +1 @@\n-old\n+new' };
  fixture.fakes.codex!.raiseApproval('phone-worker', { id: 'phone-native', kind: 'file change', subject, choices: ['once', 'always', 'deny'], answerIn: 'hub' });
  await fixture.pageCase(t, async page => {
    const target = row(page, fixture.approval.id);
    await target.tap();
    const dialog = sheet(page);
    assert.equal(await dialog.locator('pre').textContent(), subject.change);
    for (const file of subject.files) assert.equal(await dialog.getByText(file, { exact: true }).textContent(), file);
    assert.equal((await fixture.ui.request({ type: 'approval.answer', approval: fixture.approval.id, choice: 'always' })).ok, true);
    await dialog.waitFor({ state: 'hidden' });
    const outcome = target.locator('..').locator('[data-approval-outcome]');
    await outcome.waitFor();
    assert.match(await outcome.innerText(), /Approved always by the human.*neovim/s);
    assert.equal(fixture.fakes.codex!.approvalAnswers.at(-1)?.choice, 'always');
    await fixture.clock.advance(250);
    await until(() => departed, { what: 'exact approval departure delivered to the phone', timeoutMs: 3000 });
    assert.equal(departed, true);
    await page.getByRole('button', { name: 'Fold Asks and approvals', exact: true }).focus();
    assert.equal(await outcome.isVisible(), true, 'winner remains for the Inbox visit');
    await page.getByRole('button', { name: 'Topics', exact: true }).tap();
    await page.getByRole('list', { name: 'Topics objects', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Inbox', exact: true }).tap();
    await page.getByRole('list', { name: 'Inbox objects', exact: true }).waitFor();
    assert.equal(await page.locator('[data-approval-outcome]').count(), 0, 'leaving Inbox retires the outcome');
  }, page => {
    page.on('websocket', socket => socket.on('framereceived', event => {
      const frame = JSON.parse(String(event.payload));
      if (frame.type === 'inbox' && frame.inbox.departures?.some((entry: { id: string }) => entry.id === fixture.approval.id)) departed = true;
    }));
  }, { phone: true });
});

test('a losing phone answer recovers the native winner and closes the approval sheet', async t => {
  const fixture = await approvalFixture(t);
  let release: (() => void) | undefined;
  let refused = false;
  let answerId = '';
  await fixture.pageCase(t, async page => {
    const target = row(page, fixture.approval.id);
    await target.tap();
    const dialog = sheet(page);
    await dialog.locator('[data-approval-choice="once"]').tap();
    await until(() => !!release, { what: 'phone answer held before the hub gate', timeoutMs: 3000 });
    const winner = { choice: 'deny' as const, note: 'Answered at the terminal', by: 'harness', via: 'harness' as const, at: fixture.clock.now().toISOString() };
    fixture.fakes.codex!.closeApproval('phone-worker', 'phone-native', winner);
    release!();
    await until(() => refused, { what: 'phone answer refused by the actual hub', timeoutMs: 3000 });
    await dialog.waitFor({ state: 'hidden' });
    const outcome = target.locator('..').locator('[data-approval-outcome]');
    await outcome.waitFor();
    assert.match(await outcome.innerText(), /Denied by harness.*harness/s);
    const archive = (await fixture.ui.request({ type: 'inbox.list', archive: true })).value as Inbox;
    assert.deepEqual(archive.archive?.find(record => record.id === fixture.approval.id)?.outcome, winner);
    assert.deepEqual(fixture.fakes.codex!.approvalAnswers, [], 'the losing phone answer never reaches the harness');
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      route.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'approval.answer') { answerId = frame.id; release = () => server.send(message); }
        else server.send(message);
      });
      server.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'approval' && frame.approval.id === fixture.approval.id) return;
        if (frame.type === 'result' && frame.id === answerId && !frame.ok) refused = true;
        route.send(message);
      });
    });
  }, { phone: true });
});

test('phone approval Escape, close, scrim and swipe leave the native request pending', async t => {
  const fixture = await approvalFixture(t);
  const sent: string[] = [];
  const assertPending = async () => {
    const inbox = (await fixture.ui.request({ type: 'inbox.list' })).value as Inbox;
    assert.equal(inbox.approvals.find(record => record.id === fixture.approval.id)?.state, 'pending');
    assert.deepEqual(fixture.fakes.codex!.approvalAnswers, []);
  };
  await fixture.pageCase(t, async page => {
    const target = row(page, fixture.approval.id);
    for (const method of ['Escape field', 'Escape option', 'close', 'scrim']) {
      await target.tap();
      const dialog = sheet(page);
      await dialog.waitFor();
      if (method.startsWith('Escape')) {
        if (method === 'Escape field') await dialog.getByRole('textbox', { name: 'Denial note', exact: true }).fill('Do not send');
        else await dialog.locator('[data-approval-choice="once"]').focus();
        await page.evaluate(() => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'я', bubbles: true, cancelable: true })));
      } else if (method === 'close') await dialog.getByRole('button', { name: 'Close sheet', exact: true }).tap();
      else await page.touchscreen.tap(10, 10);
      await dialog.waitFor({ state: 'hidden' });
      await assertPending();
      assert.equal(await target.evaluate(node => node === document.activeElement), true, 'focus returns to the row');
    }
    await target.tap();
    const dialog = sheet(page);
    const command = (await dialog.locator('pre').boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 190, y: command.y + 5 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 190, y: command.y + 70 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally { await cdp.detach(); }
    assert.equal(await dialog.isVisible(), true);
    await assertPending();
    assert.deepEqual(sent, [], 'dismissals and swipe never send approval.answer');
  }, page => { page.on('websocket', socket => socket.on('framesent', event => { const frame = JSON.parse(String(event.payload)); if (frame.type === 'approval.answer') sent.push(frame.type); })); }, { phone: true });
});
