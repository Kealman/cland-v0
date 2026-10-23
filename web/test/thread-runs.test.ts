// Web: hub run facts → inline folds, physical keys and pinned scroll anchors.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Locator, Page } from 'playwright-core';
import { connectUi, inProcessSpoke } from '../../hub/test/harness.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import { pageUntil, webFixture } from './harness.ts';
import type { ThreadRun, TopicMessage } from '../../shared/wire/index.ts';
import { seedItem } from './items-fixture.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { until } from '../../hub/test/until.ts';

async function openThread(page: Page) {
  await page.getByRole('button', { name: 'Topics', exact: true }).click();
  await page.locator('[data-object-id="general"]').click();
  const log = page.getByRole('log', { name: 'General thread', exact: true });
  await log.locator('[data-run-anchor]').first().waitFor();
  return log;
}

async function activate(page: Page, row: Locator, method: string) {
  await row.focus();
  if (method === 'click') await row.click();
  else if (method === 'Enter') await page.keyboard.press('Enter');
  else {
    // Physical codes remain authoritative even with a non-Latin key value.
    await row.dispatchEvent('keydown', { code: 'KeyZ', key: 'я', bubbles: true });
    await row.dispatchEvent('keydown', { code: 'KeyA', key: 'ф', bubbles: true });
  }
}

test('hub fold lines open and close in place by click Enter and za', async t => {
  const fixture = await webFixture(t, { clock: new FakeClock(Date.parse('2026-10-20T12:00:00Z')), prepare: root => seedItem(root, 'T-900001', 'task', 'Run link target') });
  const ui = await connectUi(t, fixture.hub.discovery);
  const impl = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'impl', sessionId: 'run-impl', role: 'implementer' });
  await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'rev', sessionId: 'run-rev', role: 'reviewer' });
  await impl.waitForPresence(['impl', 'rev']);
  const human = async (text: string) => assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text })).ok, true);
  await human('Open T-900001\n\n' + Array.from({ length: 12 }, (_, i) => `Before paragraph ${i}`).join('\n\n'));
  for (let i = 1; i <= 4; i++) assert.equal((await impl.call<{ ok: boolean }>('send', { topic: 'general', to: ['rev'], text: `Run step ${i}` })).ok, true);
  await human(Array.from({ length: 25 }, (_, i) => `After paragraph ${i}`).join('\n\n'));
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal(history.ok, true);
  const { runs, messages } = history.value as { runs: ThreadRun[]; messages: TopicMessage[] };
  assert.equal(runs.length, 1);
  const run = runs[0]!;
  const ids = messages.filter(message => message.runId === run.id).map(message => message.id);
  await fixture.pageCase(t, async page => {
    const log = await openThread(page);
    const row = log.locator('[data-run-anchor]');
    assert.equal(await row.innerText(), run.foldLine);
    assert.equal(await row.getAttribute('aria-expanded'), 'false');
    assert.equal(await log.locator('article').count(), 2);
    for (const method of ['click', 'Enter', 'za']) {
      await row.evaluate(node => {
        const log = node.closest('[role="log"]')!;
        log.scrollTop += node.getBoundingClientRect().top - log.getBoundingClientRect().top - 160;
      });
      const before = (await row.boundingBox())!.y;
      const expanded = page.waitForFunction(() => document.querySelector('[data-run-anchor]')?.getAttribute('aria-expanded') === 'true'); void expanded.catch(() => {});
      await activate(page, row, method);
      await expanded;
      assert.ok(Math.abs((await row.boundingBox())!.y - before) < 1, `${method} preserves the anchor position`);
      assert.deepEqual(await log.locator(`[data-run-id="${run.id}"] article`).evaluateAll(nodes => nodes.map(node => node.getAttribute('data-message-id'))), ids);
      assert.equal(await page.getByRole('complementary', { name: 'Drawer', exact: true }).count(), 0);
      const collapsed = page.waitForFunction(() => document.querySelector('[data-run-anchor]')?.getAttribute('aria-expanded') === 'false'); void collapsed.catch(() => {});
      await activate(page, row, method);
      await collapsed;
      assert.equal(await log.locator('article').count(), 2);
      assert.equal(await row.innerText(), run.foldLine);
    }
    await row.focus();
    await page.keyboard.press('Shift+/');
    const help = page.getByRole('dialog');
    assert.match(await help.innerText(), /Toggle agent run/);
    assert.equal(await help.locator('[data-key-action="thread-toggle"] kbd').innerText(), 'Enter / za');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Meta+k');
    await page.getByRole('combobox', { name: 'Search palette' }).fill('>Toggle agent run');
    await page.keyboard.press('Enter');
    await pageUntil(page, () => document.querySelector('[data-run-anchor]')?.getAttribute('aria-expanded') === 'true', 'palette restores the anchor and toggles its run');
    await row.click();
    const link = log.locator('[data-item-link="T-900001"]');
    await link.focus();
    const navigated = page.locator('[aria-label="Item card"][data-item-id="T-900001"]').waitFor(); void navigated.catch(() => {});
    await page.keyboard.press('Enter');
    await navigated;
    assert.match(await page.getByRole('region', { name: 'Item card' }).innerText(), /T-900001/);
  });
});

test('a paged run keeps its full hub count and the first open message anchored on prepend', async t => {
  const fixture = await webFixture(t, { clock: new FakeClock(Date.parse('2026-10-20T12:00:00Z')), prepare: async root => {
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), '[hygiene]\nrate_limit_max = 1000\nloop_breaker_max = 1000\n');
  } });
  const ui = await connectUi(t, fixture.hub.discovery);
  const impl = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'impl', sessionId: 'page-impl', role: 'implementer' });
  await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'rev', sessionId: 'page-rev', role: 'reviewer' });
  await impl.waitForPresence(['impl', 'rev']);
  for (let i = 0; i < 105; i++) assert.equal((await impl.call<{ ok: boolean }>('send', { topic: 'general', to: ['rev'], text: `Paged run message ${i}` })).ok, true);
  const history = await ui.request({ type: 'topic.history', topic: 'general', limit: 100 });
  assert.equal(history.ok, true);
  const { runs, messages } = history.value as { runs: ThreadRun[]; messages: TopicMessage[] };
  await fixture.pageCase(t, async page => {
    const log = await openThread(page);
    const row = log.locator('[data-run-anchor]');
    assert.equal(await row.innerText(), runs[0]!.foldLine);
    assert.equal(runs[0]!.messageCount, 105);
    await row.click();
    await pageUntil(page, () => document.querySelectorAll('[role="log"] article').length === 100, 'suffix opens before paging');
    const oldFirst = log.locator(`article[data-message-id="${messages[0]!.id}"]`);
    const top = await oldFirst.evaluate(node => node.getBoundingClientRect().top);
    const loaded = page.waitForFunction(() => document.querySelectorAll('[role="log"] article').length === 105); void loaded.catch(() => {});
    await log.evaluate(node => { node.scrollTop = 0; node.dispatchEvent(new Event('scroll')); });
    await loaded;
    assert.ok(Math.abs((await oldFirst.boundingBox())!.y - top) < 1, 'prepend retains the actual message offset inside an open run');
    assert.equal(await row.innerText(), runs[0]!.foldLine);
    assert.equal(await row.count(), 1);
    assert.equal(await row.getAttribute('aria-expanded'), 'true');
    assert.deepEqual(await log.locator('article p').allTextContents(), Array.from({ length: 105 }, (_, i) => `Paged run message ${i}`));
  });
});

test('an open run keeps its anchor pinned while scrolling its messages', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const impl = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'impl', sessionId: 'pin-impl', role: 'implementer' });
  await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'rev', sessionId: 'pin-rev', role: 'reviewer' });
  await impl.waitForPresence(['impl', 'rev']);
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: 'Before the run' })).ok, true);
  for (let i = 1; i <= 4; i++) assert.equal((await impl.call<{ ok: boolean }>('send', {
    topic: 'general', to: ['rev'], text: Array.from({ length: 10 }, (_, j) => `Run ${i} paragraph ${j}`).join('\n\n'),
  })).ok, true);
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: Array.from({ length: 35 }, (_, i) => `After paragraph ${i}`).join('\n\n') })).ok, true);
  await fixture.pageCase(t, async page => {
    const log = await openThread(page);
    const row = log.locator('[data-run-anchor]');
    await row.click();
    await pageUntil(page, () => document.querySelector('[data-run-anchor]')?.getAttribute('aria-expanded') === 'true', 'run expanded before scrolling');
    const pinned = page.waitForFunction(() => {
      const row = document.querySelector('[data-run-anchor]')!;
      return Math.abs(row.getBoundingClientRect().top - row.closest('[role="log"]')!.getBoundingClientRect().top) < 1;
    }); void pinned.catch(() => {});
    await log.evaluate(node => {
      const run = node.querySelector('[data-run-id]')!;
      node.scrollTop += run.getBoundingClientRect().top - node.getBoundingClientRect().top + 450;
    });
    await pinned;
    assert.equal(await row.evaluate(node => {
      const box = node.getBoundingClientRect();
      return Math.abs(box.top - node.closest('[role="log"]')!.getBoundingClientRect().top) < 1 &&
        document.elementFromPoint(box.left + 30, box.top + box.height / 2) === node;
    }), true, 'anchor stays on top of the scrolled messages');
    const before = (await row.boundingBox())!.y;
    await activate(page, row, 'Enter');
    await pageUntil(page, () => document.querySelector('[data-run-anchor]')?.getAttribute('aria-expanded') === 'false', 'pinned run collapsed');
    assert.equal(await log.locator('article').count(), 2);
    assert.ok(Math.abs((await row.boundingBox())!.y - before) < 1, 'collapse retains the pinned anchor position');
    assert.equal(await row.evaluate(node => node === document.activeElement), true);
  });
});

test('protected messages stay unfolded and live growth replaces the hub fold line', async t => {
  const fixture = await webFixture(t, { clock: new FakeClock(Date.parse('2026-10-20T12:00:00Z')) });
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const impl = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'impl', sessionId: 'live-impl', role: 'implementer' });
  const rev = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'rev', sessionId: 'live-rev', role: 'reviewer' });
  const coord = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', sessionId: 'live-coord', role: 'coordinator' });
  const aide = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'helper', sessionId: 'live-helper', role: 'aide' });
  await impl.waitForPresence(['impl', 'rev', 'coord', 'helper']);
  const send = async (sender: typeof impl, text: string, to?: string[], kind?: string) => {
    const received = ui.waitFor(frame => frame.type === 'message' && (frame.message as TopicMessage).topic === 'general' && (frame.message as TopicMessage).text === text);
    const result = await sender.call<{ ok: boolean; error?: string }>('send', { topic: 'general', text, ...(to ? { to } : {}), ...(kind ? { kind } : {}) });
    assert.equal(result.ok, true, result.error);
    return received;
  };
  await send(impl, 'Before the ask', ['rev']);
  const ask = await send(impl, 'Which direction?', ['coord'], 'question');
  assert.ok((ask.message as TopicMessage).ask);
  await send(impl, 'Between ask and answer', ['rev']);
  assert.equal((await coord.call<{ ok: boolean }>('ask.answer', { ask: (ask.message as TopicMessage).id, text: 'Use the existing path' })).ok, true);
  await send(impl, 'Before the verdict', ['rev']);
  await send(rev, 'review clear · run boundary', ['impl']);
  await send(impl, 'Before the human', ['rev']);
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: 'Human reply', to: ['impl'] })).ok, true);
  await send(impl, 'Before report to human', ['rev']);
  await send(impl, 'Report to human');
  await send(impl, 'Before Aide address', ['rev']);
  await send(impl, 'Message to helper', ['helper']);
  await send(impl, 'Before Aide sender', ['rev']);
  await send(aide, 'Message from helper', ['impl']);
  await send(impl, 'Initial tail step', ['rev']);
  const tail = await send(rev, 'Second tail step', ['impl']);
  const initialRun = tail.run as ThreadRun;
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal(history.ok, true);
  const messages = (history.value as { messages: TopicMessage[] }).messages;
  const protectedRows = messages.filter(message => !message.runId);
  assert.equal(protectedRows.length, 7, 'real ask, answer, verdict, human, to-human and both Aide directions');
  let historyReads = 0;
  await fixture.pageCase(t, async page => {
    const log = await openThread(page);
    for (const message of protectedRows) {
      const article = log.locator(`article[data-message-id="${message.id}"]`);
      assert.equal(await article.count(), 1, message.text);
      assert.equal(await article.evaluate(node => node.closest('[data-run-id]') === null), true, message.text);
    }
    const row = log.locator(`[data-run-id="${initialRun.id}"] [data-run-anchor]`);
    assert.equal(await row.innerText(), initialRun.foldLine);
    const reads = historyReads;
    const updated = page.waitForFunction(() => [...document.querySelectorAll('[data-run-anchor]')].some(node => node.textContent?.includes('Third tail step'))); void updated.catch(() => {});
    const third = await send(impl, 'Third tail step', ['rev']);
    await updated;
    assert.equal(await row.innerText(), (third.run as ThreadRun).foldLine);
    assert.equal((third.run as ThreadRun).id, initialRun.id);
    assert.equal(await row.getAttribute('aria-expanded'), 'false');
    assert.equal(await log.locator(`article[data-message-id="${(third.message as TopicMessage).id}"]`).count(), 0);
    await row.click();
    await pageUntil(page, () => [...document.querySelectorAll('[data-run-anchor]')].some(node => node.textContent?.includes('Third tail step') && node.getAttribute('aria-expanded') === 'true'), 'live run opens');
    const rendered = log.locator('article').filter({ hasText: 'Fourth tail step' }).waitFor(); void rendered.catch(() => {});
    const fourth = await send(rev, 'Fourth tail step', ['impl']);
    await rendered;
    assert.equal(await row.innerText(), (fourth.run as ThreadRun).foldLine);
    assert.equal(await row.getAttribute('aria-expanded'), 'true');
    assert.equal(await log.locator(`[data-run-id="${initialRun.id}"] article`).count(), 4);
    assert.equal(historyReads, reads, 'live growth needs no extra history read');
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      route.onMessage(message => { if (JSON.parse(String(message)).type === 'topic.history') historyReads++; server.send(message); });
    });
  });
});

test('expanding and collapsing reschedule visible read marks for the displayed run', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const impl = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'impl', sessionId: 'read-impl', role: 'implementer' });
  await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'rev', sessionId: 'read-rev', role: 'reviewer' });
  await impl.waitForPresence(['impl', 'rev']);
  assert.equal((await impl.call<{ ok: boolean }>('send', { topic: 'general', to: ['rev'], text: Array.from({ length: 60 }, (_, i) => `Long first message ${i}`).join('\n\n') })).ok, true);
  assert.equal((await impl.call<{ ok: boolean }>('send', { topic: 'general', to: ['rev'], text: 'Run tail' })).ok, true);
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal(history.ok, true);
  const messages = (history.value as { messages: TopicMessage[] }).messages;
  const reads: string[] = [];
  await fixture.pageCase(t, async page => {
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-01-02T00:00:00Z'));
    const log = await openThread(page);
    const row = log.locator('[data-run-anchor]');
    await page.clock.runFor(50);
    await row.click();
    await pageUntil(page, () => document.querySelector('[data-run-anchor]')?.getAttribute('aria-expanded') === 'true', 'run expanded before visible interval');
    assert.equal(await log.evaluate(node => node.scrollTop), 0, 'expansion changes visible rows without a scroll');
    await page.clock.runFor(1000);
    await until(() => reads.includes(messages[0]!.id), { what: 'visible open-run read frame', timeoutMs: 3000 });
    assert.ok(!reads.includes(messages[1]!.id), 'the open run does not read its offscreen tail');
    await row.click();
    await pageUntil(page, () => document.querySelector('[data-run-anchor]')?.getAttribute('aria-expanded') === 'false', 'run collapsed before visible interval');
    await page.clock.runFor(1000);
    await until(async () => {
      const list = await ui.request({ type: 'topic.list' });
      return (list.value as { topics: { id: string; readSeq: number }[] }).topics.find(topic => topic.id === 'general')?.readSeq === messages[1]!.seq;
    }, { what: 'peer observes last loaded message read through collapsed anchor', timeoutMs: 3000 });
    const list = await ui.request({ type: 'topic.list' });
    assert.equal((list.value as { topics: { id: string; readSeq: number }[] }).topics.find(topic => topic.id === 'general')?.readSeq, messages[1]!.seq);
  }, page => { page.on('websocket', socket => socket.on('framesent', event => { const frame = JSON.parse(String(event.payload)); if (frame.type === 'topic.read') reads.push(frame.upTo); })); });
});
