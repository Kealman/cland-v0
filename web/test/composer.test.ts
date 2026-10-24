// Web: composer DOM, authenticated frames and sealed in-process recipients.
import test from 'node:test';
import assert from 'node:assert/strict';
import { connectUi, inProcessSpoke } from '../../hub/test/harness.ts';
import { reconnectUntilLive, pageUntil, webFixture, pausePageClock } from './harness.ts';
import type { Page } from 'playwright-core';
import type { TopicMessage } from '../../shared/wire/index.ts';
import { until } from '../../hub/test/until.ts';

async function composerFixture(t: Parameters<typeof webFixture>[0]) {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const coordinator = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', role: 'coordinator', sessionId: 'composer-coord' });
  await coordinator.waitForPresence(['coord']);
  return { ...fixture, get hub() { return fixture.hub; }, ui, coordinator };
}

async function thread(page: Page, id = 'general') {
  await page.getByRole('button', { name: 'Topics', exact: true }).click();
  await page.locator(`[data-object-id="${id}"]`).click();
  return page.getByRole('form', { name: 'Composer', exact: true });
}

async function physical(page: Page, code: string, modifiers: { metaKey?: boolean; shiftKey?: boolean } = {}) {
  await page.evaluate(({ code, modifiers }) => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { code, key: 'я', bubbles: true, cancelable: true, ...modifiers })), { code, modifiers });
}

test('an item composer addresses the Coordinator by default and @ selects another session from the palette', async t => {
  const fixture = await composerFixture(t);
  const peer = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'peer', sessionId: 'composer-peer' });
  await peer.waitForPresence(['coord', 'peer']);
  const made = await fixture.ui.request({ type: 'task.create', title: 'Composer routing', size: 'XS' });
  assert.equal(made.ok, true, made.error);
  const item = (made.value as { item: { id: string } }).item.id;
  const created = await fixture.ui.request({ type: 'topic.create', title: 'Routing', item });
  assert.equal(created.ok, true, created.error);
  const topic = (created.value as { topic: { id: string } }).topic.id;
  await fixture.pageCase(t, async page => {
    const form = await thread(page, topic);
    assert.match(await form.locator('[data-composer-recipient]').innerText(), /coord.*Coordinator/s);
    const field = form.getByRole('textbox', { name: 'Message text' });
    await field.fill('Coordinator routing receipt');
    const delivered = fixture.coordinator.waitForEvent(event => event.params.content === 'Coordinator routing receipt');
    await form.getByRole('button', { name: 'Send', exact: true }).click();
    assert.equal((await delivered).params.content, 'Coordinator routing receipt');
    await form.locator('[data-pending-message]').waitFor({ state: 'detached' });
    await field.fill('Session routing receipt');
    await physical(page, 'Digit2', { shiftKey: true });
    const search = page.getByRole('combobox', { name: 'Search palette' });
    assert.equal(await search.inputValue(), '@');
    await search.fill('@peer');
    await page.getByRole('option').filter({ hasText: 'peer' }).click();
    assert.equal(await field.inputValue(), 'Session routing receipt');
    assert.match(await form.locator('[data-composer-recipient]').innerText(), /peer/);
    const received = peer.waitForEvent(event => event.params.content === 'Session routing receipt');
    await form.getByRole('button', { name: 'Send', exact: true }).click();
    assert.equal((await received).params.content, 'Session routing receipt');
    assert.equal(fixture.coordinator.events.filter(event => event.params.content === 'Session routing receipt').length, 0);
    await form.getByRole('button', { name: 'Remove peer', exact: true }).click();
    assert.equal(await form.locator('[data-composer-recipient]').count(), 0);
    await field.fill('@coord Hub addressing receipt');
    const implicit = fixture.coordinator.waitForEvent(event => event.params.content === '@coord Hub addressing receipt');
    await form.getByRole('button', { name: 'Send', exact: true }).click();
    assert.equal((await implicit).params.content, '@coord Hub addressing receipt');
  });
});

test('the composer sends Message, Decision and Question with their kinds in the thread and peer history', async t => {
  const fixture = await composerFixture(t);
  await fixture.pageCase(t, async page => {
    const form = await thread(page);
    for (const [label, kind] of [['Message', 'message'], ['Decision', 'decision'], ['Question', 'question']] as const) {
      await form.getByRole('button', { name: label, exact: true }).click();
      await form.getByRole('textbox', { name: 'Message text' }).fill(`${label} receipt`);
      const delivered = fixture.coordinator.waitForEvent(event => event.params.content === `${label} receipt`);
      await form.getByRole('button', { name: 'Send', exact: true }).click();
      assert.equal((await delivered).params.content, `${label} receipt`);
      const row = page.getByRole('log', { name: 'General thread', exact: true }).locator('article').filter({ hasText: `${label} receipt` });
      await row.waitFor();
      assert.ok((await row.locator('header').innerText()).includes(label));
    }
    const history = await fixture.ui.request({ type: 'topic.history', topic: 'general' });
    assert.equal(history.ok, true, history.error);
    assert.deepEqual((history.value as { messages: TopicMessage[] }).messages.filter(row => row.fromKind === 'human').map(row => [row.text, row.kind]), [
      ['Message receipt', 'message'], ['Decision receipt', 'decision'], ['Question receipt', 'question'],
    ]);
    await pageUntil(page, () => (document.querySelector('[aria-label="Message text"]') as HTMLTextAreaElement)?.value === '', 'successful send clears its draft');
  });
});

test('composer physical Enter, Shift+Enter and Meta+Enter send or break lines and Meta+K keeps the draft', async t => {
  const fixture = await composerFixture(t);
  await fixture.pageCase(t, async page => {
    const form = await thread(page);
    const field = form.getByRole('textbox', { name: 'Message text' });
    await field.fill('Single line receipt');
    const single = fixture.coordinator.waitForEvent(event => event.params.content === 'Single line receipt');
    await physical(page, 'Enter');
    assert.equal((await single).params.content, 'Single line receipt');
    await field.fill('first last');
    await field.evaluate(node => (node as HTMLTextAreaElement).setSelectionRange(5, 6));
    await physical(page, 'Enter', { shiftKey: true });
    assert.equal(await field.inputValue(), 'first\nlast');
    await field.evaluate(node => (node as HTMLTextAreaElement).setSelectionRange(10, 10));
    await physical(page, 'Enter');
    assert.equal(await field.inputValue(), 'first\nlast\n');
    await physical(page, 'KeyK', { metaKey: true });
    await page.getByRole('dialog', { name: 'Palette', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await field.evaluate(node => node === document.activeElement), true);
    assert.equal(await field.inputValue(), 'first\nlast\n');
    const multiline = fixture.coordinator.waitForEvent(event => event.params.content === 'first\nlast');
    await physical(page, 'Enter', { metaKey: true });
    assert.equal((await multiline).params.content, 'first\nlast');
    assert.equal(fixture.coordinator.events.filter(event => event.params.content === 'first\nlast').length, 1);
    await pageUntil(page, () => (document.querySelector('[aria-label="Message text"]') as HTMLTextAreaElement)?.value === '', 'multi-line send receipt');
    assert.equal(await page.locator('[data-pane="secondary"]').count(), 0, 'command Enter stays in the composer');
  });
});

test('tilde attaches an artifact chip and the received message carries the selected artifact', async t => {
  const fixture = await composerFixture(t);
  const made = await fixture.ui.request({ type: 'artifact.create', topic: 'general', kind: 'note', title: 'Composer evidence', content: 'Evidence bytes' });
  assert.equal(made.ok, true, made.error);
  const artifact = (made.value as { artifact: { id: string } }).artifact;
  const another = await fixture.ui.request({ type: 'topic.create', title: 'Other artifacts' });
  assert.equal(another.ok, true, another.error);
  const otherTopic = (another.value as { topic: { id: string } }).topic.id;
  const hidden = await Promise.all([
    fixture.ui.request({ type: 'artifact.create', topic: otherTopic, kind: 'note', title: 'Foreign evidence', content: 'Other topic' }),
    fixture.ui.request({ type: 'artifact.create', topic: 'general', kind: 'note', title: 'Archived evidence', content: 'Archived' }),
  ]);
  for (const result of hidden) assert.equal(result.ok, true, result.error);
  assert.equal((await fixture.ui.request({ type: 'artifact.archive', artifact: (hidden[1]!.value as { artifact: { id: string } }).artifact.id })).ok, true);
  await fixture.pageCase(t, async page => {
    const form = await thread(page);
    const field = form.getByRole('textbox', { name: 'Message text' });
    await field.fill('Attached composer receipt');
    await physical(page, 'Backquote', { shiftKey: true });
    const search = page.getByRole('combobox', { name: 'Search palette' });
    assert.equal(await search.inputValue(), '~');
    assert.equal(await page.getByRole('option').filter({ hasText: 'Foreign evidence' }).count(), 0);
    assert.equal(await page.getByRole('option').filter({ hasText: 'Archived evidence' }).count(), 0);
    await search.fill('~Composer evidence');
    await page.getByRole('option').filter({ hasText: 'Composer evidence' }).click();
    assert.match(await form.locator('[data-composer-artifact]').innerText(), /Composer evidence/);
    assert.equal(await field.inputValue(), 'Attached composer receipt');
    const delivered = fixture.coordinator.waitForEvent(event => event.params.content === 'Attached composer receipt');
    await form.getByRole('button', { name: 'Send', exact: true }).click();
    assert.ok((await delivered).params.meta?.artifacts?.includes(artifact.id));
    const history = await fixture.ui.request({ type: 'topic.history', topic: 'general' });
    assert.equal(history.ok, true, history.error);
    const message = (history.value as { messages: TopicMessage[] }).messages.find(row => row.text === 'Attached composer receipt');
    assert.deepEqual(message?.artifacts?.map(row => row.id), [artifact.id]);
    await form.locator('[data-composer-artifact]').waitFor({ state: 'detached' });
    assert.equal(await form.locator('[data-composer-artifact]').count(), 0, 'received attachment leaves the draft');
  });
});

test('per-topic drafts survive reload and hub disconnection without replay and writing marks the sent message read', async t => {
  const fixture = await composerFixture(t);
  const made = await fixture.ui.request({ type: 'topic.create', title: 'Another draft' });
  assert.equal(made.ok, true, made.error);
  const topic = (made.value as { topic: { id: string } }).topic.id;
  const sent: Array<{ type: string; topic: string; upTo?: string }> = [];
  await fixture.pageCase(t, async page => {
    const form = await thread(page);
    const field = form.getByRole('textbox', { name: 'Message text' });
    await field.fill('Write read receipt');
    const delivered = fixture.coordinator.waitForEvent(event => event.params.content === 'Write read receipt');
    await form.getByRole('button', { name: 'Send', exact: true }).click();
    await delivered;
    const history = await fixture.ui.request({ type: 'topic.history', topic: 'general' });
    assert.equal(history.ok, true, history.error);
    const message = (history.value as { messages: TopicMessage[] }).messages.find(row => row.text === 'Write read receipt')!;
    await pageUntil(page, () => (document.querySelector('[aria-label="Message text"]') as HTMLTextAreaElement)?.value === '', 'send settled before drafting');
    const listed = await fixture.ui.request({ type: 'topic.list' });
    assert.equal(listed.ok, true, listed.error);
    assert.equal((listed.value as { topics: Array<{ id: string; readSeq: number }> }).topics.find(row => row.id === 'general')?.readSeq, message.seq);
    await field.fill('General kept draft');
    await thread(page, topic);
    assert.equal(await field.inputValue(), '');
    await field.fill('Another kept draft');
    await page.reload();
    await page.getByRole('form', { name: 'Composer', exact: true }).waitFor();
    assert.equal(await field.inputValue(), 'Another kept draft');
    await thread(page);
    assert.equal(await field.inputValue(), 'General kept draft');
    await fixture.restartHub();
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent === 'Offline', 'disconnected hub receipt');
    assert.equal(await form.getByRole('button', { name: 'Send', exact: true }).isDisabled(), true);
    const before = sent.filter(frame => frame.type === 'topic.send').length;
    await field.focus();
    await physical(page, 'Enter');
    await physical(page, 'Enter', { metaKey: true });
    assert.equal(await field.inputValue(), 'General kept draft');
    const live = () => document.querySelector('[aria-label="Hub connection"]')?.textContent === 'Live';
    await reconnectUntilLive(page);
    assert.equal(await page.evaluate(live), true, 'bounded fresh-epoch reconnect');
    assert.equal(sent.filter(frame => frame.type === 'topic.send').length, before, 'no offline send or reconnect replay');
    assert.equal(await field.inputValue(), 'General kept draft');
    await thread(page, topic);
    assert.equal(await field.inputValue(), 'Another kept draft');
  }, async page => {
    await pausePageClock(page, new Date('2026-10-23T12:00:00Z'));
    page.on('websocket', socket => socket.on('framesent', event => { const frame = JSON.parse(String(event.payload)); if (frame.type === 'topic.send' || frame.type === 'topic.read') sent.push(frame); }));
  });
});

test('a pending send survives topic navigation and a real refusal restores text and artifacts before the newer draft', async t => {
  const fixture = await composerFixture(t);
  const made = await fixture.ui.request({ type: 'artifact.create', topic: 'general', kind: 'note', title: 'Refusal evidence', content: 'Receipt' });
  assert.equal(made.ok, true, made.error);
  const artifact = (made.value as { artifact: { id: string } }).artifact.id;
  const other = await fixture.ui.request({ type: 'topic.create', title: 'Pending neighbor' });
  assert.equal(other.ok, true, other.error);
  const topic = (other.value as { topic: { id: string } }).topic.id;
  let release: (() => void) | undefined;
  let refused = false;
  await fixture.pageCase(t, async page => {
    const form = await thread(page);
    const field = form.getByRole('textbox', { name: 'Message text' });
    await field.fill('Pending original');
    await form.getByRole('button', { name: 'Decision', exact: true }).click();
    await form.getByRole('button', { name: 'Attach an artifact', exact: true }).click();
    await page.getByRole('combobox', { name: 'Search palette' }).fill('~Refusal evidence');
    await page.getByRole('option').filter({ hasText: 'Refusal evidence' }).click();
    await form.getByRole('button', { name: 'Send', exact: true }).click();
    await until(() => !!release, { what: 'real send held before hub acceptance', timeoutMs: 3000 });
    await form.locator('[data-pending-message]').waitFor();
    assert.match(await form.locator('[data-pending-message]').innerText(), /Pending original/);
    assert.equal(await field.isEnabled(), true);
    await field.fill('Newer typing');
    await thread(page, topic);
    await field.fill('Neighbor draft');
    await thread(page);
    assert.equal(await field.inputValue(), 'Newer typing');
    assert.equal(await form.getByRole('button', { name: 'Send', exact: true }).isDisabled(), true);
    assert.equal((await fixture.ui.request({ type: 'artifact.archive', artifact })).ok, true);
    release!();
    await form.getByRole('alert').waitFor();
    assert.equal(refused, true, 'actual hub refusal observed');
    assert.equal(await field.inputValue(), 'Pending original\nNewer typing');
    assert.match(await form.locator('[data-composer-artifact]').innerText(), /Refusal evidence/);
    assert.equal(await form.getByRole('button', { name: 'Decision', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await form.locator('[data-pending-message]').count(), 0);
    await thread(page, topic);
    assert.equal(await field.inputValue(), 'Neighbor draft');
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      let sendId = '';
      route.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'topic.send') { sendId = frame.id; release = () => server.send(message); }
        else server.send(message);
      });
      server.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'result' && frame.id === sendId && frame.ok === false) refused = true;
        route.send(message);
      });
    });
  });
});

test('a held successful receipt keeps newer typing and reload recovers uncertain text without sending it again', async t => {
  const fixture = await composerFixture(t);
  let release: (() => void) | undefined;
  let count = 0;
  await fixture.pageCase(t, async page => {
    const form = await thread(page);
    const field = form.getByRole('textbox', { name: 'Message text' });
    await field.fill('Accepted original');
    const accepted = fixture.coordinator.waitForEvent(event => event.params.content === 'Accepted original');
    await form.getByRole('button', { name: 'Send', exact: true }).click();
    await accepted;
    await until(() => !!release, { what: 'successful hub receipt held at browser edge', timeoutMs: 3000 });
    await field.fill('Next draft');
    assert.equal(await form.getByRole('button', { name: 'Send', exact: true }).isDisabled(), true);
    release!();
    await form.locator('[data-pending-message]').waitFor({ state: 'detached' });
    assert.equal(await field.inputValue(), 'Next draft');
    assert.equal(await form.getByRole('button', { name: 'Send', exact: true }).isEnabled(), true);
    release = undefined;
    await field.fill('Uncertain original');
    const uncertain = fixture.coordinator.waitForEvent(event => event.params.content === 'Uncertain original');
    await form.getByRole('button', { name: 'Send', exact: true }).click();
    await uncertain;
    await until(() => !!release, { what: 'second successful receipt held before reload', timeoutMs: 3000 });
    await field.fill('Newer uncertain draft');
    await page.reload();
    await form.waitFor();
    assert.equal(await field.inputValue(), 'Uncertain original\nNewer uncertain draft');
    assert.equal(await form.locator('[data-pending-message]').count(), 0);
    const history = await fixture.ui.request({ type: 'topic.history', topic: 'general' });
    assert.equal(history.ok, true, history.error);
    assert.equal((history.value as { messages: TopicMessage[] }).messages.filter(row => row.text === 'Uncertain original').length, 1);
    assert.equal(count, 2, 'reload never replays either send');
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      const sends = new Set<string>();
      route.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'topic.send') { sends.add(frame.id); count++; }
        server.send(message);
      });
      server.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'result' && sends.has(frame.id)) { assert.equal(frame.ok, true, frame.error); release = () => route.send(message); }
        else route.send(message);
      });
    });
  });
});

test('the artifact picker loads older inventory pages before selecting an available topic artifact', async t => {
  const fixture = await composerFixture(t);
  const results = await Promise.all(Array.from({ length: 101 }, (_, n) => fixture.ui.request({ type: 'artifact.create', topic: 'general', kind: 'note', title: n === 0 ? 'Oldest composer artifact' : `Newer evidence ${n}`, content: 'Evidence' })));
  for (const result of results) assert.equal(result.ok, true, result.error);
  const artifact = (results[0]!.value as { artifact: { id: string } }).artifact.id;
  await fixture.pageCase(t, async page => {
    const form = await thread(page);
    await form.getByRole('button', { name: 'Attach an artifact', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Palette', exact: true });
    await page.getByRole('combobox', { name: 'Search palette' }).fill('~Oldest composer artifact');
    assert.equal(await dialog.getByRole('option').count(), 0);
    await dialog.getByRole('button', { name: 'More artifacts', exact: true }).press('Enter');
    await dialog.getByRole('option').filter({ hasText: 'Oldest composer artifact' }).click();
    assert.ok((await form.locator('[data-composer-artifact]').innerText()).includes(artifact));
  });
});
