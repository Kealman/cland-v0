// Web: Inbox sections and actions through sealed public frames and fake senders.
import test from 'node:test';
import assert from 'node:assert/strict';
import { connectUi, inProcessSpoke } from '../../hub/test/harness.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import { webFixture, pageUntil } from './harness.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { seedItem } from './items-fixture.ts';
import { until } from '../../hub/test/until.ts';
import type { Inbox } from '../../shared/wire/index.ts';

async function inboxFixture(t: Parameters<typeof webFixture>[0], prepare?: (root: string) => Promise<void>) {
  const clock = new FakeClock(new Date('2026-10-23T12:00:00Z'));
  const fixture = await webFixture(t, { clock, ...(prepare ? { prepare } : {}) });
  const ui = await connectUi(t, fixture.hub.discovery);
  const sender = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', role: 'coordinator', sessionId: 'inbox-coord' });
  await sender.waitForPresence(['coord']);
  const send = async (text: string) => {
    const result = await sender.call<{ ok: boolean; message: { id: string }; error?: string }>('send', { topic: 'general', kind: 'decision', text });
    assert.equal(result.ok, true, result.error);
    await clock.advance(60_000);
    const listed = await ui.request({ type: 'inbox.list' });
    return (listed.value as Inbox).messages.find(row => row.text === text)!.id;
  };
  return { ...fixture, clock, ui, sender, send };
}

test('Inbox keeps four ordered sections, newest five rows, oldest wait, live ages and saved folds', async t => {
  const fixture = await inboxFixture(t);
  const ids: string[] = [];
  for (let n = 0; n < 7; n++) ids.push(await fixture.send(`Report ${n}`));
  const receipt = await fixture.ui.request({ type: 'inbox.list' });
  assert.equal(receipt.ok, true, receipt.error);
  assert.equal((receipt.value as Inbox).messages.length, 7);
  await fixture.pageCase(t, async page => {
    const inbox = page.getByRole('list', { name: 'Inbox objects', exact: true });
    await inbox.waitFor();
    assert.deepEqual(await inbox.getByRole('heading').allTextContents(), ['Asks and approvals', 'Plan approvals', 'Requests', 'Messages to you']);
    const section = inbox.locator('[data-inbox-section="messages"]');
    assert.deepEqual(await section.locator('[data-object-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-object-id'))), ids.slice(2).reverse());
    const more = section.getByRole('button', { name: /2 more.*oldest/ });
    await more.waitFor();
    assert.match(await more.innerText(), /oldest 7 m/);
    const newest = section.locator(`[data-object-id="${ids[6]}"]`);
    assert.equal(await newest.locator('time').textContent(), '1 m');
    await page.clock.runFor(60_000);
    assert.equal(await newest.locator('time').textContent(), '2 m');
    await more.click();
    assert.deepEqual(await section.locator('[data-object-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-object-id'))), ids.toReversed());
    await section.getByRole('button', { name: 'Fold Messages to you', exact: true }).click();
    await page.reload();
    const fold = page.getByRole('button', { name: 'Fold Messages to you', exact: true });
    await fold.waitFor();
    assert.equal(await fold.getAttribute('aria-expanded'), 'false');
    assert.equal(await inbox.locator('[data-inbox-empty]').count(), 3);
  }, async page => {
    await page.clock.install({ time: fixture.clock.now() });
    await page.clock.pauseAt(fixture.clock.now());
  });
});

test('selected request and message unfold, physical d declines to the sender or reads exactly that row', async t => {
  const fixture = await inboxFixture(t);
  const older = await fixture.send('Keep this message');
  const message = await fixture.send('Read this message\nFull message body');
  assert.equal((await fixture.sender.call<{ ok: boolean }>('send', { topic: 'general', kind: 'request', request: 'handover', subject: 'coord', text: 'Review this request\nFull request body' })).ok, true);
  const before = await fixture.ui.request({ type: 'inbox.list' });
  const request = (before.value as Inbox).requests[0]!.id;
  await fixture.pageCase(t, async page => {
    const inbox = page.getByRole('list', { name: 'Inbox objects', exact: true });
    const row = inbox.locator(`[data-object-id="${request}"]`);
    await row.click();
    const detail = row.locator('..');
    assert.match(await detail.innerText(), /Full request body/);
    await detail.getByRole('button', { name: 'd · Decline', exact: true }).waitFor();
    const delivered = fixture.sender.waitForEvent(event => event.params.content.includes(`declined request ${request}`));
    await row.evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', key: 'я', bubbles: true, cancelable: true })));
    assert.match((await delivered).params.content, /human declined/);
    await row.waitFor({ state: 'detached' });
    assert.equal(await inbox.locator(`[data-object-id="${older}"]`).count(), 1);
    const read = inbox.locator(`[data-object-id="${message}"]`);
    await read.click();
    assert.match(await read.locator('..').innerText(), /Full message body/);
    await read.evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', key: 'я', bubbles: true, cancelable: true })));
    await read.waitFor({ state: 'detached' });
    const after = (await fixture.ui.request({ type: 'inbox.list' })).value as Inbox;
    assert.deepEqual(after.messages.map(row => row.id), [older]);
    assert.equal(after.requests.length, 0);
    assert.equal(await page.getByRole('complementary', { name: 'Drawer', exact: true }).count(), 0);
  });
});

test('Enter opens an Inbox message at its anchored thread row and a waiting plan in Plan', async t => {
  const fixture = await inboxFixture(t, async root => {
    await seedItem(root, 'R-900000', 'release', 'Inbox release', { version: '99.0.0' });
    await seedItem(root, 'E-900010', 'epic', 'Inbox epic', { parent: 'R-900000' });
    await seedItem(root, 'T-900100', 'task', 'Inbox task', { parent: 'E-900010' });
    await writeFile(join(root, '.cland/config.toml'), '[plan]\napproval = "human"\n');
  });
  assert.equal((await fixture.ui.request({ type: 'task.plan', item: 'E-900010', op: 'set', yaml: 'stages:\n  - name: Build\n    qa: { scope: none, when: after-stage }\n    lanes:\n      - [T-900100]\n' })).ok, true);
  const current = await fixture.send('A message to open');
  // Later agent traffic keeps this Now row pending beyond the latest history page.
  const peer = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'worker', sessionId: 'inbox-worker', role: 'implementer' });
  await peer.waitForPresence(['coord', 'worker']);
  // History needs 105 later rows, not an ordering between those setup messages.
  // Batch independent socket round trips within the 30-per-window send limit.
  for (let offset = 0; offset < 105; offset += 20) {
    await fixture.clock.advance(600_000);
    const receipts = await Promise.all(Array.from({ length: Math.min(20, 105 - offset) }, (_, index) =>
      fixture.sender.call<{ ok: boolean; error?: string }>('send', { topic: 'general', to: ['worker'], text: `Later agent row ${offset + index}` })));
    for (const sent of receipts) assert.equal(sent.ok, true, sent.error);
  }
  await fixture.pageCase(t, async page => {
    const inbox = page.getByRole('list', { name: 'Inbox objects', exact: true });
    const row = inbox.locator(`[data-object-id="${current}"]`);
    await row.click();
    await row.evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'я', bubbles: true, cancelable: true })));
    const target = page.locator(`[role="log"] [data-message-id="${current}"]`);
    await target.waitFor();
    await pageUntil(page, () => document.activeElement?.getAttribute('data-message-id') !== null && !!document.activeElement?.closest('[role="log"]'), 'Inbox navigation focuses message');
    assert.equal(await target.evaluate(node => node === document.activeElement && node.getBoundingClientRect().top >= node.closest('[role="log"]')!.getBoundingClientRect().top), true);
    await page.getByRole('button', { name: 'Inbox', exact: true }).click();
    const plan = inbox.locator('[data-object-id="E-900010"]');
    await plan.click();
    assert.match(await plan.locator('..').innerText(), /1 stages · 1 lanes · 1 items/);
    await plan.press('Enter');
    const view = page.getByRole('region', { name: 'Epic plan', exact: true });
    await view.getByRole('heading', { name: 'S1 · Build', exact: true }).waitFor();
    assert.match(await view.innerText(), /Inbox epic.*Build/s);
  });
});

test('the events footer survives four empty sections and follows shared last-look marks and warnings', async t => {
  const fixture = await inboxFixture(t, async root => {
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/journal.jsonl'), [
      { ts: '2026-10-23T11:50:00Z', event: 'notification', kind: 'verdict', item: 'T-1', result: 'not clear', text: 'Old warning' },
      { ts: '2026-10-23T11:58:00Z', event: 'notification', kind: 'verdict', item: 'T-2', result: 'not clear', text: 'New warning' },
      { ts: '2026-10-23T11:59:00Z', event: 'notification', kind: 'verdict', item: 'T-3', result: 'clear', text: 'New clear' },
    ].map(row => JSON.stringify(row) + '\n').join(''));
  });
  assert.equal((await fixture.ui.request({ type: 'marks.set', events: '2026-10-23T11:55:00Z' })).ok, true);
  const history = (await fixture.ui.request({ type: 'events.list', limit: 200 })).value as { rows: Array<{ ts: string; warning?: boolean }> };
  const expected = history.rows.filter(row => row.ts > '2026-10-23T11:55:00Z');
  assert.equal(expected.filter(row => row.warning).length, 1);
  await fixture.pageCase(t, async page => {
    const footer = page.locator('[data-inbox-events]');
    await footer.waitFor();
    assert.equal(await page.locator('[data-inbox-empty]').count(), 4);
    assert.equal(await footer.innerText(), `△ ${expected.length} new events · ⚠ 1`);
    assert.equal((await fixture.ui.request({ type: 'marks.set', events: '2026-10-23T12:01:00Z' })).ok, true);
    await pageUntil(page, () => document.querySelector('[data-inbox-events]')?.textContent === '△ 0 new events · ⚠ 0', 'shared last-look updates footer');
    await footer.click();
    await page.getByRole('heading', { name: 'Events', exact: true }).waitFor();
  });
});

test('asks and approvals share newest-first rows and the selected approval answers with Neovim keys', async t => {
  const fixture = await inboxFixture(t);
  const asked = await fixture.sender.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Choose an option', options: ['Keep', 'Change'], free: true });
  assert.equal(asked.ok, true);
  await fixture.clock.advance(60_000);
  assert.equal((await fixture.ui.request({ type: 'session.launch', name: 'approval-worker', harness: 'codex' })).ok, true);
  fixture.fakes.codex!.raiseApproval('approval-worker', { id: 'native-1', kind: 'command', subject: { command: 'echo fixture', cwd: '/scratch', reason: 'Test approval' }, choices: ['once', 'always', 'deny'], answerIn: 'hub' });
  await fixture.clock.advance(60_000);
  assert.equal((await fixture.ui.request({ type: 'session.launch', name: 'tui-worker', harness: 'claude-code' })).ok, true);
  fixture.fakes['claude-code']!.raiseApproval('tui-worker', { id: 'tui-1', kind: 'command', subject: { command: 'echo TUI' }, choices: ['once', 'deny'], answerIn: 'tui' });
  const before = (await fixture.ui.request({ type: 'inbox.list' })).value as Inbox;
  const approval = before.approvals.find(row => row.session === 'approval-worker')!;
  const tui = before.approvals.find(row => row.session === 'tui-worker')!;
  await fixture.pageCase(t, async page => {
    const section = page.locator('[data-inbox-section="asks"]');
    assert.deepEqual(await section.locator('[data-object-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-object-id'))), [tui.id, approval.id, asked.ask]);
    const tuiRow = section.locator(`[data-object-id="${tui.id}"]`);
    await tuiRow.click();
    assert.match(await tuiRow.locator('..').innerText(), /Answer in Neovim/);
    assert.equal(await tuiRow.locator('..').locator('[data-approval-choice]').count(), 0);
    const row = section.locator(`[data-object-id="${approval.id}"]`);
    await row.click();
    const detail = row.locator('..');
    await detail.getByRole('button', { name: '1 · Approve once', exact: true }).waitFor();
    await row.evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', key: 'я', bubbles: true, cancelable: true })));
    await detail.getByRole('textbox', { name: 'Denial note', exact: true }).fill('Wait for review');
    await detail.getByRole('button', { name: 'Deny', exact: true }).click();
    await detail.locator('[data-approval-outcome]').waitFor();
    assert.match(await detail.innerText(), /Denied.*human.*web/s);
    assert.deepEqual(fixture.fakes.codex!.approvalAnswers.map(({ requestId, choice, note }) => ({ requestId, choice, note })), [{ requestId: 'native-1', choice: 'deny', note: 'Wait for review' }]);
    for (const [native, code, choice] of [['native-once', 'Digit1', 'once'], ['native-always', 'Digit2', 'always']] as const) {
      fixture.fakes.codex!.raiseApproval('approval-worker', { id: native, kind: 'command', subject: { command: `echo ${choice}` }, choices: ['once', 'always', 'deny'], answerIn: 'hub' });
      await fixture.clock.advance(250);
      const fresh = section.locator(`[data-object-id="${approval.sessionId}:${native}"]`);
      await fresh.click();
      await fresh.evaluate((node, code) => node.dispatchEvent(new KeyboardEvent('keydown', { code, key: 'я', bubbles: true, cancelable: true })), code);
      await fresh.locator('..').locator('[data-approval-outcome]').waitFor();
      assert.equal(fixture.fakes.codex!.approvalAnswers.at(-1)?.choice, choice);
    }
    await section.locator(`[data-object-id="${asked.ask}"]`).click();
    const delivered = fixture.sender.waitForEvent(event => event.params.meta?.answer_to === asked.ask);
    await section.locator(`[data-object-id="${asked.ask}"]`).evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2', key: 'я', bubbles: true, cancelable: true })));
    assert.equal((await delivered).params.content, 'Change');
    await section.locator('[data-ask-outcome]').waitFor();
  });
});

test('Inbox answer keys remain visible through a complete native keyboard scroll in a small viewport', async t => {
  const fixture = await inboxFixture(t);
  assert.equal((await fixture.sender.call<{ ok: boolean }>('ask', { topic: 'general', question: 'Small viewport ask', options: ['Keep', 'Change'], free: true })).ok, true);
  await fixture.pageCase(t, async page => {
    await page.setViewportSize({ width: 1024, height: 600 });
    await page.locator('[data-inbox-kind="ask"] [data-object-id]').click();
    await page.keyboard.press('Shift+/');
    const help = page.getByRole('dialog', { name: 'Inbox keys', exact: true });
    await help.waitFor();
    const rows = help.locator('[data-key-action]');
    const expected = await rows.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-key-action')!));
    const observed = await help.evaluateHandle(node => {
      const state = { seen: new Set<string>(), ended: 0 };
      const collect = () => {
        const dialog = node.getBoundingClientRect();
        for (const row of node.querySelectorAll('[data-key-action]')) {
          const rect = row.getBoundingClientRect();
          if (rect.top >= Math.max(0, dialog.top) && rect.bottom <= Math.min(innerHeight, dialog.bottom)) state.seen.add(row.getAttribute('data-key-action')!);
        }
      };
      node.addEventListener('scroll', collect);
      node.addEventListener('scrollend', () => { collect(); state.ended++; });
      collect(); return state;
    });
    for (let step = 0; step <= expected.length; step++) {
      const canMove = await help.evaluate(node => node.scrollTop + node.clientHeight < node.scrollHeight - 1);
      if (!canMove) break;
      const before = await observed.evaluate(state => state.ended);
      await page.keyboard.press('PageDown');
      await pageUntil(page, () => !!document.querySelector('dialog'), 'help remains open');
      await until(async () => await observed.evaluate(state => state.ended) > before, { what: 'native help scroll completed', timeoutMs: 3000 });
      assert.ok(step < expected.length, 'bounded scroll traversal');
    }
    assert.deepEqual((await observed.evaluate(state => [...state.seen])).sort(), expected.sort());
    assert.equal(await rows.last().evaluate(node => { const box = node.getBoundingClientRect(), parent = node.closest('dialog')!.getBoundingClientRect(); return box.top >= parent.top && box.bottom <= Math.min(innerHeight, parent.bottom); }), true);
    assert.equal(await rows.last().locator('dt').textContent(), 'Decline request or read message');
  });
});

test('In Inbox reveals an older-than-five ask through a saved fold and focuses its secondary-pane card', async t => {
  const fixture = await inboxFixture(t);
  const ask = async (question: string) => {
    const result = await fixture.sender.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question, options: ['Keep', 'Change'], free: true });
    assert.equal(result.ok, true);
    await fixture.clock.advance(250);
    return result.ask;
  };
  const id = await ask('Older ask target');
  for (let n = 0; n < 6; n++) await ask(`Newer ask ${n}`);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Topics', exact: true }).click();
    await page.locator('[data-object-id="general"]').click();
    await page.locator('[data-object-id="general"]').press('Meta+Enter');
    const primary = page.locator('[data-pane="primary"]');
    const secondary = page.locator('[data-pane="secondary"]');
    const copy = secondary.locator(`[data-ask-id="${id}"]`);
    await copy.waitFor();
    await page.evaluate(() => localStorage.setItem('cland.ui.inbox.v1', JSON.stringify({ folds: { asks: true } })));
    await copy.getByRole('link', { name: 'In Inbox', exact: true }).click();
    const destination = secondary.getByRole('list', { name: 'Inbox objects', exact: true }).locator(`[data-ask-id="${id}"]`);
    await destination.waitFor();
    await pageUntil(page, () => document.activeElement?.getAttribute('data-ask-id') !== null && document.activeElement?.closest('[data-pane]')?.getAttribute('data-pane') === 'secondary', 'older Inbox destination focus');
    assert.equal(await destination.evaluate(node => node === document.activeElement), true);
    assert.equal(await primary.locator(`[data-ask-id="${id}"]`).count(), 1);
    const delivered = fixture.sender.waitForEvent(event => event.params.meta?.answer_to === id);
    await destination.evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2', key: 'я', bubbles: true, cancelable: true })));
    assert.equal((await delivered).params.content, 'Change');
    await destination.locator('[data-ask-outcome]').waitFor();
  });
});

async function approvalFixture(t: Parameters<typeof webFixture>[0]) {
  const fixture = await inboxFixture(t);
  assert.equal((await fixture.ui.request({ type: 'session.launch', name: 'race-worker', harness: 'codex' })).ok, true);
  fixture.fakes.codex!.raiseApproval('race-worker', { id: 'race-native', kind: 'command', subject: { command: 'echo race' }, choices: ['once', 'always', 'deny'], answerIn: 'hub' });
  const inbox = (await fixture.ui.request({ type: 'inbox.list' })).value as Inbox;
  return { ...fixture, approval: inbox.approvals.find(row => row.session === 'race-worker')! };
}

test('a refused approval race recovers only its exact archived winner and preserves a newer Inbox row', async t => {
  const fixture = await approvalFixture(t);
  let release: (() => void) | undefined;
  let refused = false;
  let answerId = '';
  let recoveryId = '';
  let releaseRecovery: (() => void) | undefined;
  await fixture.pageCase(t, async page => {
    const row = page.locator(`[data-object-id="${fixture.approval.id}"]`);
    await row.click();
    await row.locator('..').getByRole('button', { name: '1 · Approve once', exact: true }).click();
    await until(() => !!release, { what: 'approval answer held before hub', timeoutMs: 3000 });
    assert.equal((await fixture.ui.request({ type: 'approval.answer', approval: fixture.approval.id, choice: 'always' })).ok, true);
    const newer = await fixture.sender.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Newer Inbox ask', options: ['Keep'], free: true });
    assert.equal(newer.ok, true);
    await fixture.clock.advance(250);
    await page.locator(`[data-object-id="${newer.ask}"]`).waitFor();
    release!();
    await until(() => refused, { what: 'losing approval actually refused by hub', timeoutMs: 3000 });
    await until(() => !!releaseRecovery, { what: 'archive winner reply held', timeoutMs: 3000 });
    const latest = await fixture.sender.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Arrived during recovery', options: ['Keep'], free: true });
    assert.equal(latest.ok, true);
    await fixture.clock.advance(250);
    await page.locator(`[data-object-id="${latest.ask}"]`).waitFor();
    const count = await page.getByRole('button', { name: 'Inbox', exact: true }).textContent();
    releaseRecovery!();
    const outcome = row.locator('..').locator('[data-approval-outcome]');
    await outcome.waitFor();
    assert.match(await outcome.innerText(), /Approved always.*human.*neovim/s);
    assert.equal(await page.locator(`[data-object-id="${newer.ask}"]`).count(), 1);
    assert.equal(await page.locator(`[data-object-id="${latest.ask}"]`).count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Inbox', exact: true }).textContent(), count);
    assert.equal(await row.locator('..').getByRole('alert').count(), 0);
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      route.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'approval.answer') { answerId = frame.id; release = () => server.send(message); }
        else { if (frame.type === 'inbox.list' && frame.archive) recoveryId = frame.id; server.send(message); }
      });
      server.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'approval' && frame.approval.id === fixture.approval.id) return;
        if (frame.type === 'result' && frame.id === answerId && !frame.ok) refused = true;
        if (frame.type === 'result' && frame.id === recoveryId) releaseRecovery = () => route.send(message);
        else route.send(message);
      });
    });
  });
});

test('a fresh epoch recovers an approval answered by a peer while this browser was offline', async t => {
  const fixture = await approvalFixture(t);
  let disconnect: (() => void) | undefined;
  await fixture.pageCase(t, async page => {
    const row = page.locator(`[data-object-id="${fixture.approval.id}"]`);
    await row.click();
    await row.locator('..').getByRole('button', { name: '1 · Approve once', exact: true }).waitFor();
    disconnect!();
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent === 'Offline', 'approval browser offline');
    assert.equal((await fixture.ui.request({ type: 'approval.answer', approval: fixture.approval.id, choice: 'once' })).ok, true);
    await fixture.restartHub();
    await page.clock.runFor(250);
    const outcome = row.locator('..').locator('[data-approval-outcome]');
    await outcome.waitFor();
    assert.match(await outcome.innerText(), /Approved once.*human.*neovim/s);
    assert.equal(await row.locator('..').locator('[data-approval-choice]').count(), 0);
  }, async page => {
    await page.clock.install({ time: fixture.clock.now() });
    await page.clock.pauseAt(fixture.clock.now());
    await page.routeWebSocket('**/ws', route => { const server = route.connectToServer(); disconnect = () => { route.close(); server.close(); }; });
  });
});

test('the events footer counts all unread pages including a warning older than the newest 200', async t => {
  const fixture = await inboxFixture(t, async root => {
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/journal.jsonl'), Array.from({ length: 205 }, (_, n) => JSON.stringify({ ts: new Date(Date.parse('2026-10-23T11:00:00Z') + n * 1000).toISOString(), event: 'notification', kind: 'verdict', item: `T-${1000 + n}`, result: n === 0 ? 'not clear' : 'clear', text: `Unread verdict ${n}` }) + '\n').join(''));
  });
  assert.equal((await fixture.ui.request({ type: 'marks.set', events: '2026-10-23T10:00:00Z' })).ok, true);
  let before: string | undefined;
  let total = 0, warnings = 0;
  do {
    const page = (await fixture.ui.request({ type: 'events.list', limit: 200, ...(before ? { before } : {}) })).value as { rows: Array<{ ts: string; warning?: boolean }>; more: boolean; before: string | null };
    const newer = page.rows.filter(row => row.ts > '2026-10-23T10:00:00Z');
    total += newer.length; warnings += newer.filter(row => row.warning).length;
    before = page.more ? page.before ?? undefined : undefined;
  } while (before);
  assert.ok(total > 200);
  assert.equal(warnings, 1);
  await fixture.pageCase(t, async page => {
    await until(async () => await page.locator('[data-inbox-events]').innerText() === `△ ${total} new events · ⚠ 1`, { what: 'all-page event and warning counts rendered', timeoutMs: 3000 });
    assert.equal(await page.locator('[data-inbox-events]').innerText(), `△ ${total} new events · ⚠ 1`);
  });
});

test('held successful read and decline replies preserve newer pushed Inbox rows and counts', async t => {
  const fixture = await inboxFixture(t);
  let holdType = '';
  let heldId = '';
  let release: (() => void) | undefined;
  let applied = false;
  await fixture.pageCase(t, async page => {
    for (const action of ['inbox.read', 'inbox.decline'] as const) {
      const message = await fixture.send(`Action target ${action}`);
      let target = message;
      if (action === 'inbox.decline') {
        assert.equal((await fixture.sender.call<{ ok: boolean }>('send', { topic: 'general', kind: 'request', request: 'handover', subject: 'coord', text: 'Request target' })).ok, true);
        target = ((await fixture.ui.request({ type: 'inbox.list' })).value as Inbox).requests[0]!.id;
        await fixture.clock.advance(250);
      }
      const row = page.locator(`[data-object-id="${target}"]`);
      await row.click();
      holdType = action; release = undefined; applied = false;
      await row.evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', key: 'я', bubbles: true, cancelable: true })));
      await until(() => !!release, { what: 'successful Inbox action reply held', timeoutMs: 3000 });
      await page.locator('[data-inbox-pending]').waitFor();
      const newer = await fixture.send(`Newer row after ${action}`);
      await page.locator(`[data-object-id="${newer}"]`).waitFor();
      const count = await page.getByRole('button', { name: 'Inbox', exact: true }).textContent();
      release!();
      await until(() => applied, { what: 'held successful reply delivered to browser', timeoutMs: 3000 });
      // The fulfilled action's finally removes its pending disabled state.
      await page.locator('[data-inbox-pending]').waitFor({ state: 'detached' });
      assert.equal(await page.locator(`[data-object-id="${target}"]`).count(), 0);
      assert.equal(await page.locator(`[data-object-id="${newer}"]`).count(), 1);
      assert.equal(await page.getByRole('button', { name: 'Inbox', exact: true }).textContent(), count);
    }
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      route.onMessage(message => { const frame = JSON.parse(String(message)); if (frame.type === holdType) heldId = frame.id; server.send(message); });
      server.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'result' && frame.id === heldId && frame.ok) release = () => { route.send(message); applied = true; };
        else route.send(message);
      });
    });
  });
});

test('a held approval recovery cannot overwrite a newer same-id TUI authorization delta', async t => {
  const fixture = await approvalFixture(t);
  fixture.fakes.codex!.scriptApproval('fail');
  let recoveryId = '';
  let releaseRecovery: (() => void) | undefined;
  let publishAuthorization: (() => void) | undefined;
  await fixture.pageCase(t, async page => {
    const row = page.locator(`[data-object-id="${fixture.approval.id}"]`);
    await row.click();
    await row.locator('..').getByRole('button', { name: '1 · Approve once', exact: true }).click();
    await until(() => !!releaseRecovery, { what: 'real failure recovery reply held', timeoutMs: 3000 });
    publishAuthorization!();
    const detail = row.locator('..');
    await detail.getByText('Answer in Neovim', { exact: true }).waitFor();
    assert.match(await detail.innerText(), /echo revalidated/);
    releaseRecovery!();
    // finally removes the local pending status only after recovery has applied.
    await detail.getByRole('status').waitFor({ state: 'detached' });
    assert.match(await detail.innerText(), /Answer in Neovim/);
    assert.match(await detail.innerText(), /echo revalidated/);
    assert.equal(await detail.locator('[data-approval-choice], [data-approval-deny]').count(), 0);
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      // Recorded public delta at the WebSocket seam, after a real adapter failure.
      publishAuthorization = () => route.send(JSON.stringify({ type: 'approval', approval: { ...fixture.approval, subject: { command: 'echo revalidated' }, command: 'echo revalidated', choices: [], answerIn: 'tui', state: 'pending' } }));
      route.onMessage(message => { const frame = JSON.parse(String(message)); if (frame.type === 'inbox.list' && frame.archive) recoveryId = frame.id; server.send(message); });
      server.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'result' && frame.id === recoveryId) releaseRecovery = () => route.send(message);
        else route.send(message);
      });
    });
  });
});
