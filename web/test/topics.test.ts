// Web: Topics groups and paged threads through the isolated browser and real hub frames.
import test from 'node:test';
import assert from 'node:assert/strict';
import { connectUi, inProcessSpoke } from '../../hub/test/harness.ts';
import { webFixture, pageUntil } from './harness.ts';
import { until } from '../../hub/test/until.ts';
import type { WebSocketRoute } from 'playwright-core';

test('a fresh snapshot replaces a pending initial history load and ignores its stale reply', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const sent = await ui.request({ type: 'topic.send', topic: 'general', text: 'Initial page across snapshot' });
  assert.equal(sent.ok, true, sent.error);
  const id = (sent.value as { message: { id: string } }).message.id;
  const historyIds = new Set<string>();
  const replies: Array<() => void> = [];
  let snapshotEnds = 0;
  let freshSnapshot: () => void;
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Topics', exact: true }).click();
    await page.locator('[data-object-id="general"]').click();
    await until(() => replies.length === 1, { what: 'initial history reply held', timeoutMs: 3000 });
    const before = snapshotEnds;
    freshSnapshot!();
    await until(() => snapshotEnds > before, { what: 'real replacement snapshot completed', timeoutMs: 3000 });
    await until(() => replies.length === 2, { what: 'replacement initial history requested after reset', timeoutMs: 3000 });
    replies[0]!();
    // The later live row on this socket fences application of the stale result.
    const live = await ui.request({ type: 'topic.send', topic: 'general', text: 'Live after stale reply' });
    assert.equal(live.ok, true, live.error);
    const liveId = (live.value as { message: { id: string } }).message.id;
    await page.locator(`[role="log"] [data-message-id="${liveId}"]`).waitFor();
    assert.equal(await page.locator(`[role="log"] [data-message-id="${id}"]`).count(), 0, 'the old generation cannot populate the replacement thread');
    replies[1]!();
    await page.locator(`[role="log"] [data-message-id="${id}"]`).waitFor();
    assert.deepEqual(await page.locator('[role="log"] [data-message-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-message-id'))), [id, liveId]);
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      freshSnapshot = () => server.send(JSON.stringify({ type: 'resume', id: 'force-fresh-snapshot', epoch: 'expired-epoch', seq: 0 }));
      route.onMessage(message => { const frame = JSON.parse(String(message)); if (frame.type === 'topic.history') historyIds.add(frame.id); server.send(message); });
      server.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'snapshot.end') snapshotEnds++;
        if (frame.type === 'result' && historyIds.has(frame.id)) replies.push(() => route.send(message));
        else route.send(message);
      });
    });
  });
});

test('a rejected earlier page retries with its old top message anchored', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const expected: string[] = [];
  for (let n = 0; n < 150; n++) {
    const sent = await ui.request({ type: 'topic.send', topic: 'general', text: `Retry message ${n}` });
    assert.equal(sent.ok, true, sent.error);
    expected.push((sent.value as { message: { id: string } }).message.id);
  }
  const earlierIds = new Set<string>();
  let rejected = false;
  let release: (() => void) | undefined;
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Topics', exact: true }).click();
    await page.locator('[data-object-id="general"]').click();
    const thread = page.getByRole('log', { name: 'General thread', exact: true });
    await thread.locator('[data-message-id]').nth(99).waitFor();
    const anchor = await thread.locator('[data-message-id]').first().getAttribute('data-message-id');
    const anchorTop = await thread.evaluate(node => {
      node.scrollTop = 0;
      const top = node.querySelector('[data-message-id]')!.getBoundingClientRect().top - node.getBoundingClientRect().top;
      node.dispatchEvent(new Event('scroll'));
      return top;
    });
    const retry = page.getByRole('button', { name: 'Retry', exact: true });
    await retry.waitFor();
    assert.equal(await retry.getAttribute('title'), 'Rejected earlier page');
    await retry.click();
    await until(() => !!release, { what: 'retried earlier reply held', timeoutMs: 3000 });
    release!();
    await thread.locator('[data-message-id]').nth(149).waitFor();
    assert.equal(await thread.locator(`[data-message-id="${anchor}"]`).evaluate((node, top) => Math.abs(node.getBoundingClientRect().top - node.parentElement!.getBoundingClientRect().top - top) < 3, anchorTop), true, 'successful retry preserves the old top message');
    assert.deepEqual(await thread.locator('[data-message-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-message-id'))), expected);
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      route.onMessage(message => { const frame = JSON.parse(String(message)); if (frame.type === 'topic.history' && typeof frame.before === 'number') earlierIds.add(frame.id); server.send(message); });
      server.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'result' && earlierIds.has(frame.id)) {
          if (!rejected) { rejected = true; route.send(JSON.stringify({ type: 'result', id: frame.id, ok: false, error: 'Rejected earlier page' })); }
          else release = () => route.send(message);
        } else route.send(message);
      });
    });
  });
});

test('Topics groups separate waiting, standing, item and closed topics and remember folds', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const task = await ui.request({ type: 'task.create', title: 'Thread item', size: 'S' });
  assert.equal(task.ok, true, task.error);
  const item = (task.value as { item: { id: string } }).item.id;
  const created = await ui.request({ type: 'topic.create', title: 'Item discussion', item });
  assert.equal(created.ok, true, created.error);
  const topic = (created.value as { topic: { id: string } }).topic.id;
  const closed = await ui.request({ type: 'topic.create', title: 'Finished discussion' });
  assert.equal(closed.ok, true, closed.error);
  const closedId = (closed.value as { topic: { id: string } }).topic.id;
  assert.equal((await ui.request({ type: 'topic.close', topic: closedId })).ok, true);
  const waiting = await ui.request({ type: 'topic.create', title: 'Waiting discussion' });
  assert.equal(waiting.ok, true, waiting.error);
  const waitingId = (waiting.value as { topic: { id: string } }).topic.id;
  const coord = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', sessionId: 'coord-groups', role: 'coordinator' });
  await coord.waitForPresence(['coord']);
  assert.equal((await coord.call<{ ok: boolean }>('ask', { topic: waitingId, question: 'Which direction?', options: ['Continue', 'Wait'] })).ok, true);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Topics', exact: true }).click();
    const list = page.getByRole('list', { name: 'Topics objects', exact: true });
    await list.waitFor();
    const module = page.locator('[data-area-module="Topics"][data-area-surface="pane"]');
    await module.waitFor();
    assert.equal(await module.getAttribute('data-key-context'), 'topics');
    assert.deepEqual(await page.locator('[data-topic-group]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-topic-group'))), ['waiting', 'standing', 'items', 'closed']);
    assert.deepEqual(await page.locator('[data-topic-group="standing"] [data-object-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-object-id'))), ['general', 'agents']);
    assert.equal(await page.locator(`[data-topic-group="waiting"] [data-object-id="${waitingId}"]`).count(), 1);
    assert.equal(await page.locator(`[data-topic-group="waiting"] [data-object-id="${waitingId}"] [aria-label="Unread"]`).innerText(), '1');
    assert.equal(await page.locator(`[data-topic-group="items"] [data-object-id="${topic}"]`).innerText().then(text => text.includes(item)), true);
    assert.equal(await page.getByRole('button', { name: 'Fold Closed', exact: true }).getAttribute('aria-expanded'), 'false');
    const general = page.locator('[data-object-id="general"]');
    await general.focus();
    await general.evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'ж', bubbles: true, cancelable: true })));
    await pageUntil(page, () => document.activeElement?.getAttribute('role') === 'log', 'physical Enter enters thread');
    await page.keyboard.press('Escape');
    assert.equal(await general.evaluate(node => node === document.activeElement), true, 'thread Escape returns to its topic');
    await general.press('j');
    assert.equal(await page.locator('[data-object-id="agents"]').evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('Meta+Enter');
    const right = page.locator('[data-pane="secondary"]');
    await right.locator('[data-area-module="Topics"][data-area-surface="page"]').waitFor();
    await right.getByRole('log', { name: 'Agents thread', exact: true }).waitFor();
    assert.ok((await right.getByRole('log').boundingBox())!.height > 500, 'split detail has a bounded, scrollable thread');
    await right.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Fold Item topics', exact: true }).click();
    await page.reload();
    await pageUntil(page, () => document.querySelector('[data-topic-group="items"] [data-fold-toggle]')?.getAttribute('aria-expanded') === 'false', 'item topics fold restored');
    assert.equal(await page.locator('[data-topic-group="items"] [data-fold-toggle]').getAttribute('aria-expanded'), 'false');
  });
});

test('reading the top of a long thread marks only the last message on screen', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const coord = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', sessionId: 'coord-partial', role: 'coordinator' });
  await coord.waitForPresence(['coord']);
  const long = await coord.call<{ ok: boolean; message: { id: string } }>('send', { topic: 'general', text: Array.from({ length: 100 }, (_, n) => `Line ${n}`).join('\n\n') });
  assert.equal(long.ok, true);
  assert.equal((await coord.call<{ ok: boolean }>('send', { topic: 'general', text: 'Offscreen tail' })).ok, true);
  const reads: Array<{ upTo?: string }> = [];
  let releaseRead: (() => void) | undefined;
  await fixture.pageCase(t, async page => {
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-01-02T00:00:00Z'));
    await page.getByRole('button', { name: 'Topics', exact: true }).click();
    await page.locator('[data-object-id="general"]').click();
    const thread = page.getByRole('log', { name: 'General thread', exact: true });
    await thread.locator('[data-message-id]').filter({ hasText: 'Offscreen tail' }).waitFor();
    await thread.evaluate(node => { node.scrollTop = 0; node.dispatchEvent(new Event('scroll')); });
    const visible = await thread.locator('[data-message-id]').first().getAttribute('data-message-id');
    await page.clock.runFor(600);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.clock.runFor(1000);
    assert.equal(reads.length, 0, 'hiding the page cancels an incomplete visible interval');
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.clock.runFor(600);
    assert.equal((await coord.call<{ ok: boolean }>('send', { topic: 'general', text: 'New offscreen message' })).ok, true);
    await thread.locator('[data-message-id]').filter({ hasText: 'New offscreen message' }).waitFor();
    await page.clock.runFor(400);
    await until(() => reads.length === 1, { what: 'partial viewport read receipt', timeoutMs: 3000 });
    assert.equal(reads[0]?.upTo, visible);
    const pending = await ui.request({ type: 'topic.list' });
    assert.equal((pending.value as { topics: { id: string; unread: number }[] }).topics.find(row => row.id === 'general')?.unread, 3, 'a sent frame alone is not an applied read mark');
    const visibleSeq = Number(await thread.locator('[data-message-id]').first().getAttribute('data-message-seq'));
    const marked = ui.waitFor(frame => {
      const topic = frame.topic as { id: string; readSeq?: number; unread: number } | undefined;
      return frame.type === 'topic' && topic?.id === 'general' && topic.readSeq === visibleSeq && topic.unread === 2;
    }, 3000);
    void marked.catch(() => {});
    releaseRead!();
    await marked;
    const list = await ui.request({ type: 'topic.list' });
    assert.equal((list.value as { topics: { id: string; unread: number }[] }).topics.find(row => row.id === 'general')?.unread, 2);
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      route.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'topic.read') { reads.push(frame); releaseRead = () => server.send(message); }
        else server.send(message);
      });
    });
  });
});

test('held history pages retain live messages, newer ask state and the scrolling anchor', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  for (let n = 0; n < 205; n++) assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: `History ${n}` })).ok, true);
  const coord = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', sessionId: 'coord-race', role: 'coordinator' });
  await coord.waitForPresence(['coord']);
  const asked = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Race question', options: ['One', 'Two'] });
  assert.equal(asked.ok, true);
  let hold = true;
  let release: (() => void) | undefined;
  const historyIds = new Set<string>();
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Topics', exact: true }).click();
    await page.locator('[data-object-id="general"]').click();
    await until(() => !!release, { what: 'initial history reply held', timeoutMs: 3000 });
    const settled = page.locator(`[role="log"] [data-ask-id="${asked.ask}"][data-ask-state="answered"]`).waitFor(); void settled.catch(() => {});
    assert.equal((await ui.request({ type: 'topic.answer', ask: asked.ask, option: 2 })).ok, true);
    assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: 'Live across initial page' })).ok, true);
    await page.locator('[role="log"] [data-message-id]').filter({ hasText: 'Live across initial page' }).waitFor();
    release!(); release = undefined; hold = false;
    const ask = page.locator(`[role="log"] [data-message-id="${asked.ask}"]`);
    await ask.waitFor();
    await settled;
    assert.equal(await ask.locator('[data-ask-id]').getAttribute('data-ask-state'), 'answered', 'older page cannot reopen an answered ask');
    assert.equal(await ask.locator('[data-ask-outcome]').innerText(), '2 Two', 'older page retains the chosen outcome');
    const thread = page.getByRole('log', { name: 'General thread', exact: true });
    const anchor = await thread.locator('[data-message-id]').first().getAttribute('data-message-id');
    hold = true;
    const anchorTop = await thread.evaluate(node => {
      node.scrollTop = 0;
      const top = node.querySelector('[data-message-id]')!.getBoundingClientRect().top - node.getBoundingClientRect().top;
      node.dispatchEvent(new Event('scroll'));
      return top;
    });
    await until(() => !!release, { what: 'earlier history reply held', timeoutMs: 3000 });
    assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: 'Live across earlier page' })).ok, true);
    await thread.locator('[data-message-id]').filter({ hasText: 'Live across earlier page' }).waitFor();
    release!(); release = undefined; hold = false;
    await thread.locator('[data-message-id]').nth(202).waitFor();
    assert.equal(await thread.locator(`[data-message-id="${anchor}"]`).evaluate((node, top) => Math.abs(node.getBoundingClientRect().top - node.parentElement!.getBoundingClientRect().top - top) < 3, anchorTop), true, 'a live append cannot consume the pending page anchor');
    await thread.evaluate(node => { node.scrollTop = 0; node.dispatchEvent(new Event('scroll')); });
    await thread.locator('[data-message-id]').nth(208).waitFor();
    const fresh = await ui.request({ type: 'topic.history', topic: 'general', limit: 200 });
    const older = await ui.request({ type: 'topic.history', topic: 'general', before: (fresh.value as { messages: { seq: number }[] }).messages[0]!.seq, limit: 200 });
    assert.equal(fresh.ok && older.ok, true);
    const expected = [...(older.value as { messages: { id: string }[] }).messages, ...(fresh.value as { messages: { id: string }[] }).messages].map(row => row.id);
    assert.deepEqual(await thread.locator('[data-message-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-message-id'))), expected);
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      route.onMessage(message => { const frame = JSON.parse(String(message)); if (frame.type === 'topic.history') historyIds.add(frame.id); server.send(message); });
      server.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (hold && frame.type === 'result' && historyIds.has(frame.id)) release = () => route.send(message);
        else route.send(message);
      });
    });
  });
});

test('reconnect resumes missed thread deltas and only rereads history after a fresh snapshot', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: 'Before disconnect' })).ok, true);
  let socket: WebSocketRoute;
  const frames: Array<{ type: string; resume?: { epoch: string; seq: number } }> = [];
  const snapshots: unknown[] = [];
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Topics', exact: true }).click();
    await page.locator('[data-object-id="general"]').click();
    await page.locator('[role="log"] [data-message-id]').filter({ hasText: 'Before disconnect' }).waitFor();
    const reads = frames.filter(frame => frame.type === 'topic.history').length;
    const snapshotCount = snapshots.length;
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-01-02T00:00:00Z'));
    socket!.close();
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent === 'Offline', 'browser disconnect observed');
    assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: 'During disconnect' })).ok, true);
    await page.clock.runFor(250);
    await page.locator('[role="log"] [data-message-id]').filter({ hasText: 'During disconnect' }).waitFor();
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent === 'Live', 'resumed connection ready');
    assert.ok(frames.filter(frame => frame.type === 'hello').at(-1)?.resume, 'hello carries the last applied model cursor');
    assert.equal(frames.filter(frame => frame.type === 'topic.history').length, reads);
    assert.equal(snapshots.length, snapshotCount, 'ring replay needs no snapshot');
    assert.equal(await page.locator('[role="log"] [data-message-id]').count(), 2);
    await fixture.restartHub();
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent === 'Offline', 'hub restart observed');
    await page.clock.runFor(250);
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent === 'Live' && document.querySelectorAll('[role="log"] [data-message-id]').length === 2, 'fresh snapshot restores thread history');
    assert.equal(frames.filter(frame => frame.type === 'topic.history').length, reads + 1);
    assert.ok(snapshots.length > snapshotCount);
    assert.deepEqual(await page.locator('[role="log"] article p').allTextContents(), ['Before disconnect', 'During disconnect']);
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      socket = route;
      const server = route.connectToServer();
      route.onMessage(message => { frames.push(JSON.parse(String(message))); server.send(message); });
      server.onMessage(message => { const frame = JSON.parse(String(message)); if (frame.type === 'snapshot') snapshots.push(frame); route.send(message); });
    });
  });
});

test('read marks wait one visible second and never include offscreen messages or a hidden page', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const coord = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', sessionId: 'coord-read', role: 'coordinator' });
  await coord.waitForPresence(['coord']);
  const sent = await coord.call<{ ok: boolean }>('send', { topic: 'general', text: 'Visible read receipt' });
  assert.equal(sent.ok, true);
  const frames: Array<{ type: string; upTo?: string }> = [];
  await fixture.pageCase(t, async page => {
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-01-02T00:00:00Z'));
    await page.getByRole('button', { name: 'Topics', exact: true }).click();
    await page.locator('[data-object-id="general"]').click();
    const message = page.locator('[role="log"] [data-message-id]').filter({ hasText: 'Visible read receipt' });
    await message.waitFor();
    const id = await message.getAttribute('data-message-id');
    await page.clock.runFor(999);
    assert.equal(frames.filter(frame => frame.type === 'topic.read').length, 0);
    await page.clock.runFor(1);
    await until(() => frames.some(frame => frame.type === 'topic.read' && frame.upTo === id), { what: 'exact visible read frame', timeoutMs: 3000 });
    await until(async () => {
      const list = await ui.request({ type: 'topic.list' });
      return (list.value as { topics: { id: string; unread: number }[] }).topics.find(row => row.id === 'general')?.unread === 0;
    }, { what: 'second frame client observes topic unread zero', timeoutMs: 3000 });
    const list = await ui.request({ type: 'topic.list' });
    assert.equal((list.value as { topics: { id: string; unread: number }[] }).topics.find(row => row.id === 'general')?.unread, 0);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    const before = frames.filter(frame => frame.type === 'topic.read').length;
    assert.equal((await coord.call<{ ok: boolean }>('send', { topic: 'general', text: 'Hidden unread receipt' })).ok, true);
    await page.locator('[role="log"] [data-message-id]').filter({ hasText: 'Hidden unread receipt' }).waitFor();
    await page.clock.runFor(2000);
    assert.equal(frames.filter(frame => frame.type === 'topic.read').length, before);
    const hidden = await ui.request({ type: 'topic.list' });
    assert.equal((hidden.value as { topics: { id: string; unread: number }[] }).topics.find(row => row.id === 'general')?.unread, 1);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.clock.runFor(1000);
    await until(() => frames.filter(frame => frame.type === 'topic.read').length === before + 1, { what: 'new visible interval marks hidden message', timeoutMs: 3000 });
    assert.equal(frames.filter(frame => frame.type === 'topic.read').length, before + 1);
  }, page => { page.on('websocket', socket => socket.on('framesent', event => frames.push(JSON.parse(String(event.payload))))); });
});

test('live messages and ask outcomes replace thread facts without another history or topic-list read', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'worker', harness: 'codex', role: 'reviewer' });
  assert.equal(launched.ok, true, launched.error);
  const fake = fixture.fakes.codex!;
  const worker = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'worker', assignRole: false,
    sessionId: (launched.value as { process: { sessionId: string } }).process.sessionId, launchToken: fake.spawns[0]!.launchToken! });
  await worker.waitForPresence(['worker']);
  fake.scriptInject('worker', 'hold');
  const coord = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', sessionId: 'coord-id', role: 'coordinator' });
  await coord.waitForPresence(['coord']);
  const frames: Array<{ type: string }> = [];
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Topics', exact: true }).click();
    await page.locator('[data-object-id="general"]').click();
    const thread = page.getByRole('log', { name: 'General thread', exact: true });
    await thread.waitFor();
    await pageUntil(page, () => document.querySelector('[role="log"]')?.getAttribute('data-loaded') === 'true', 'initial thread page received');
    const reads = frames.filter(frame => frame.type === 'topic.history').length;
    const lists = frames.filter(frame => frame.type === 'topic.list').length;
    const asked = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Choose a route', options: ['First', 'Second'] });
    assert.equal(asked.ok, true);
    const id = asked.ask;
    const ask = thread.locator(`[data-message-id="${id}"]`);
    await ask.waitFor();
    assert.equal(await ask.locator('[data-ask-id]').getAttribute('data-ask-state'), 'open');
    assert.equal(await ask.getByRole('heading', { name: 'Choose a route', exact: true }).count(), 1);
    const settled = ask.locator('[data-ask-id][data-ask-state="answered"]').waitFor(); void settled.catch(() => {});
    assert.equal((await ui.request({ type: 'topic.answer', ask: id, option: 2 })).ok, true);
    await settled;
    assert.equal(await ask.locator('[data-ask-id]').getAttribute('data-ask-state'), 'answered');
    assert.equal(await ask.locator('[data-ask-outcome]').innerText(), '2 Second');
    const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['worker'], text: 'Queued live message' });
    assert.equal(sent.ok, true, sent.error);
    const queued = thread.locator('[data-message-id]').filter({ hasText: 'Queued live message' });
    await queued.waitFor();
    assert.ok(['queued', 'delivered'].includes(await queued.locator('[data-delivery-stage]').innerText()));
    const messageId = (sent.value as { message: { id: string } }).message.id;
    await until(() => fake.injections.some(row => row.message.id === messageId), { what: 'adapter has the held message', timeoutMs: 3000 });
    const injected = queued.locator('[data-delivery-stage]').filter({ hasText: 'injected' }).waitFor();
    void injected.catch(() => {});
    fake.settle('worker', messageId);
    await injected;
    assert.equal(await queued.locator('[data-delivery-stage]').innerText(), 'injected');
    assert.equal(frames.filter(frame => frame.type === 'topic.history').length, reads);
    assert.equal(frames.filter(frame => frame.type === 'topic.list').length, lists);
    const fresh = await ui.request({ type: 'topic.history', topic: 'general' });
    assert.equal(fresh.ok, true, fresh.error);
    assert.deepEqual(await thread.locator('[data-message-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-message-id'))), (fresh.value as { messages: { id: string }[] }).messages.map(row => row.id));
  }, page => { page.on('websocket', socket => socket.on('framesent', event => frames.push(JSON.parse(String(event.payload))))); });
});

test('300 messages open at the end and page backwards without gaps, repeats or a moving anchor', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const expected: string[] = [];
  for (let n = 1; n <= 300; n++) {
    const result = await ui.request({ type: 'topic.send', topic: 'general', text: `Message ${n} · T-999` });
    assert.equal(result.ok, true, result.error);
    expected.push((result.value as { message: { id: string } }).message.id);
  }
  const history: Array<{ before?: number }> = [];
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Topics', exact: true }).click();
    await page.locator('[data-object-id="general"]').click();
    const thread = page.getByRole('log', { name: 'General thread', exact: true });
    await thread.locator(`[data-message-id="${expected.at(-1)}"]`).waitFor();
    assert.equal(await thread.evaluate(node => Math.abs(node.scrollHeight - node.clientHeight - node.scrollTop) < 2), true);
    assert.equal(await thread.locator('[data-message-id]').count(), 100);
    for (const total of [200, 300]) {
      const anchor = await thread.locator('[data-message-id]').first().getAttribute('data-message-id');
      const anchorTop = await thread.evaluate(node => {
        node.scrollTop = 0;
        const top = node.querySelector('[data-message-id]')!.getBoundingClientRect().top - node.getBoundingClientRect().top;
        node.dispatchEvent(new Event('scroll'));
        return top;
      });
      // The load completion is the DOM count, independently of the transport receipt.
      await thread.locator('[data-message-id]').nth(total - 1).waitFor();
      assert.equal(await thread.locator(`[data-message-id="${anchor}"]`).evaluate((node, top) => Math.abs(node.getBoundingClientRect().top - node.parentElement!.getBoundingClientRect().top - top) < 3, anchorTop), true, 'prepending retains the former top line');
    }
    assert.deepEqual(await thread.locator('[data-message-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-message-id'))), expected);
    assert.equal(history.length, 3);
    assert.equal(history[0]?.before, undefined);
    assert.ok(history.slice(1).every(frame => typeof frame.before === 'number'));
    assert.equal(await thread.locator('[data-item-link="T-999"]').count(), 300);
  }, page => {
    page.on('websocket', socket => socket.on('framesent', event => {
      const frame = JSON.parse(String(event.payload));
      if (frame.type === 'topic.history') history.push(frame);
    }));
  });
});
