// Web: journal pages and human last-look through the sealed hub and Headless Shell.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi } from '../../hub/test/harness.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import { until } from '../../hub/test/until.ts';
import type { EventRow, EventsPage } from '../../shared/wire/index.ts';
import { seedItem } from './items-fixture.ts';
import type { Page } from 'playwright-core';
import { reconnectUntilLive, webFixture, pageUntil, pausePageClock } from './harness.ts';

async function eventsFixture(t: Parameters<typeof webFixture>[0], count = 405) {
  const clock = new FakeClock(new Date('2026-10-23T12:00:00Z'));
  const fixture = await webFixture(t, { clock, timezoneId: 'Europe/Belgrade', prepare: async root => {
    await mkdir(join(root, '.cland'), { recursive: true });
    await seedItem(root, 'T-1', 'task', 'Events task');
    const rows = Array.from({ length: count }, (_, n) => ({ ts: new Date(Date.parse('2026-10-21T23:00:00Z') + n * 300_000).toISOString(),
      event: n % 2 ? 'task-claimed' : 'notification', kind: 'verdict', item: `T-${n + 1}`, result: n % 3 === 0 ? 'not clear' : 'clear', text: `Event ${n}` }));
    await writeFile(join(root, '.cland/journal.jsonl'), rows.map(row => JSON.stringify(row) + '\n').join(''));
  } });
  const ui = await connectUi(t, fixture.hub.discovery);
  return { ...fixture, clock, ui };
}

test('Events groups newest 200 by local day and appends bounded older pages by button and physical A', async t => {
  const fixture = await eventsFixture(t);
  const first = (await fixture.ui.request({ type: 'events.list', limit: 200 })).value as EventsPage;
  const second = (await fixture.ui.request({ type: 'events.list', limit: 200, before: first.before! })).value as EventsPage;
  const third = (await fixture.ui.request({ type: 'events.list', limit: 200, before: second.before! })).value as EventsPage;
  assert.equal(first.rows.length, 200);
  assert.equal(second.rows.length, 200);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Events', exact: true }).click();
    const events = page.getByRole('list', { name: 'Events objects', exact: true });
    await events.locator('[data-event-id]').first().waitFor();
    const ids = () => events.locator('[data-event-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-event-id')));
    assert.deepEqual(await ids(), first.rows.map(row => row.id));
    assert.match(await events.getByRole('heading').first().innerText(), /Fri 23 Oct/);
    await page.getByRole('button', { name: 'A · 200 older events', exact: true }).click();
    await pageUntil(page, () => document.querySelectorAll('[data-event-id]').length === 400, 'second journal page rendered');
    assert.deepEqual(await ids(), [...first.rows, ...second.rows].map(row => row.id));
    await events.locator('[data-event-id]').first().focus();
    await page.keyboard.press('Shift+KeyA');
    await pageUntil(page, () => document.querySelectorAll('[data-event-id]').length > 400, 'last journal page rendered');
    assert.deepEqual(await ids(), [...first.rows, ...second.rows, ...third.rows].map(row => row.id));
    assert.equal(await page.getByRole('button', { name: 'A · 200 older events', exact: true }).count(), 0);
  });
});

async function physical(page: Page, code: string, shiftKey = false) {
  await page.evaluate(({ code, shiftKey }) => document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { code, shiftKey, key: 'я', bubbles: true, cancelable: true })), { code, shiftKey });
}

test('Events filters the subscription and pages in the hub, preserves filters on reload and clears with physical F', async t => {
  const fixture = await eventsFixture(t);
  const warnings = (await fixture.ui.request({ type: 'events.list', limit: 200, filter: { warnings: true } })).value as EventsPage;
  const tasks = (await fixture.ui.request({ type: 'events.list', limit: 200, filter: { kinds: ['task'] } })).value as EventsPage;
  const sent: Array<{ type: string; filter?: unknown }> = [];
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Events', exact: true }).click();
    const events = page.getByRole('list', { name: 'Events objects', exact: true });
    await events.locator('[data-event-id]').first().waitFor();
    const ids = () => events.locator('[data-event-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-event-id')));
    await events.locator('[data-event-id]').first().focus();
    await physical(page, 'KeyW');
    await pageUntil(page, () => document.querySelector('[data-events-filter]')?.textContent?.includes('warnings only') === true && !document.querySelector('[data-events-loading]'), 'warnings filter receipt');
    assert.deepEqual(await ids(), warnings.rows.map(row => row.id));
    assert.ok(sent.some(frame => frame.type === 'subscribe' && JSON.stringify(frame.filter) === '{"warnings":true}'));
    assert.ok(sent.some(frame => frame.type === 'events.list' && JSON.stringify(frame.filter) === '{"warnings":true}'));
    await physical(page, 'KeyF', true);
    await physical(page, 'Digit2');
    await pageUntil(page, () => document.querySelector('[data-events-filter]')?.textContent?.includes('kind: task') === true && !document.querySelector('[data-events-loading]'), 'task filter receipt');
    assert.deepEqual(await ids(), tasks.rows.map(row => row.id));
    await page.reload();
    await events.locator('[data-event-id]').first().waitFor();
    assert.deepEqual(await ids(), tasks.rows.map(row => row.id));
    await events.locator('[data-event-id]').first().focus();
    await physical(page, 'Digit0');
    await pageUntil(page, () => document.querySelector('[data-events-filter]')?.textContent?.includes('kind: all') === true && !document.querySelector('[data-events-loading]'), 'all kinds receipt');
    assert.equal((await ids()).length, 200);
  }, page => { page.on('websocket', socket => socket.on('framesent', event => sent.push(JSON.parse(String(event.payload))))); });
});

test('Events dims bookkeeping, shows hub coalescing, folds a local day with za and opens an item with Enter', async t => {
  const clock = new FakeClock(new Date('2026-10-23T12:00:00Z'));
  const fixture = await webFixture(t, { clock, timezoneId: 'Europe/Belgrade', prepare: async root => {
    await seedItem(root, 'T-1', 'task', 'Events task');
    await writeFile(join(root, '.cland/journal.jsonl'), [
      { ts: '2026-10-22T23:30:00Z', event: 'notification', kind: 'verdict', item: 'T-1', result: 'clear', text: 'A clear verdict' },
      { ts: '2026-10-23T11:59:00Z', event: 'task-claimed', item: 'T-1', session: 'worker', text: 'Claimed task' },
      { ts: '2026-10-23T11:59:10Z', event: 'task-claimed', item: 'T-1', session: 'worker', text: 'Claimed task' },
    ].map(row => JSON.stringify(row) + '\n').join(''));
  } });
  const ui = await connectUi(t, fixture.hub.discovery);
  const journal = (await ui.request({ type: 'events.list' })).value as EventsPage;
  const claimed = journal.rows.find(row => row.text === 'Claimed task')!;
  assert.equal(claimed.count, 2);
  assert.equal(claimed.bookkeeping, true);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Events', exact: true }).click();
    const events = page.getByRole('list', { name: 'Events objects', exact: true });
    const row = events.locator(`[data-event-id="${claimed.id}"]`);
    await row.waitFor();
    assert.match(await row.innerText(), /×2/);
    assert.equal(await row.getAttribute('data-bookkeeping'), 'true');
    assert.match(await events.getByRole('heading').first().innerText(), /Fri 23 Oct · today/);
    const color = await row.evaluate(node => getComputedStyle(node).color);
    assert.notEqual(color, await events.getByText('A clear verdict', { exact: true }).evaluate(node => getComputedStyle(node).color));
    await row.focus();
    await physical(page, 'KeyZ'); await physical(page, 'KeyA');
    assert.equal(await row.isVisible(), false);
    const fold = events.getByRole('button', { name: 'Fold Fri 23 Oct · today', exact: true });
    assert.equal(await fold.getAttribute('aria-expanded'), 'false');
    await physical(page, 'KeyZ'); await physical(page, 'KeyA');
    await row.waitFor();
    await row.focus(); await physical(page, 'Enter');
    await page.getByRole('region', { name: 'Item card', exact: true }).waitFor();
    assert.equal(await page.getByRole('region', { name: 'Item card', exact: true }).getAttribute('data-item-id'), 'T-1');
  }, async page => { await pausePageClock(page, clock.now()); });
});

test('opening Events shares the last look, marks newer rows for the visit and clears the Inbox events line', async t => {
  const fixture = await eventsFixture(t, 12);
  assert.equal((await fixture.ui.request({ type: 'subscribe' })).ok, true);
  const previous = '2026-10-21T23:10:00.000Z';
  assert.equal((await fixture.ui.request({ type: 'marks.set', events: previous })).ok, true);
  await fixture.pageCase(t, async page => {
    const footer = page.locator('[data-inbox-events]');
    await footer.waitFor();
    assert.notEqual(await footer.innerText(), '△ 0 new events · ⚠ 0');
    const observed = fixture.ui.waitFor(frame => frame.type === 'marks' && (frame.marks as { events: string }).events === '2026-10-23T12:00:00.000Z');
    await footer.click();
    await observed;
    const marks = await fixture.ui.request({ type: 'marks.get' });
    assert.equal((marks.value as { marks: { events: string } }).marks.events, '2026-10-23T12:00:00.000Z');
    const boundary = page.locator('[data-events-last-look]');
    await boundary.waitFor();
    assert.equal(await boundary.getAttribute('data-events-last-look'), previous);
    await page.locator('[data-event-id]').first().waitFor();
    const first = (await fixture.ui.request({ type: 'events.list', limit: 200 })).value as EventsPage;
    assert.equal(await page.locator('[data-event-new="true"]').count(), first.rows.filter(row => Date.parse(row.ts) > Date.parse(previous)).length);
    await page.getByRole('button', { name: 'Inbox', exact: true }).click();
    await pageUntil(page, () => document.querySelector('[data-inbox-events]')?.textContent === '△ 0 new events · ⚠ 0', 'Inbox reflects the Events visit receipt');
    assert.equal(await footer.innerText(), '△ 0 new events · ⚠ 0');
  }, async page => { await pausePageClock(page, fixture.clock.now()); });
});

test('physical s selects an Events subject in the palette and Enter opens topic, session and artifact subjects', async t => {
  const fixture = await eventsFixture(t, 12);
  const topicReply = await fixture.ui.request({ type: 'topic.create', title: 'Events topic' });
  assert.equal(topicReply.ok, true, topicReply.error);
  const topic = (topicReply.value as { topic: { id: string } }).topic.id;
  assert.equal((await fixture.ui.request({ type: 'session.launch', name: 'events-worker', harness: 'codex' })).ok, true);
  const artifactReply = await fixture.ui.request({ type: 'artifact.create', kind: 'note', title: 'Events artifact', topic: 'general', content: 'Events subject content' });
  assert.equal(artifactReply.ok, true, artifactReply.error);
  const artifact = (artifactReply.value as { artifact: { id: string } }).artifact.id;
  // Serial journal setup is batched; the subject predates the inventory's newest 100.
  for (let offset = 0; offset < 100; offset += 20) {
    const replies = await Promise.all(Array.from({ length: 20 }, (_, index) => fixture.ui.request({ type: 'artifact.create', kind: 'note', title: `Later artifact ${offset + index}`, topic: 'general', content: 'Later' })));
    for (const reply of replies) assert.equal(reply.ok, true, reply.error);
  }
  const inventory = await fixture.ui.request({ type: 'artifact.list' });
  assert.equal((inventory.value as { artifacts: { id: string }[] }).artifacts.some(row => row.id === artifact), false);
  await fixture.pageCase(t, async page => {
    const enterEvents = async () => {
      await page.getByRole('button', { name: 'Events', exact: true }).click();
      await page.locator('[data-event-id]').first().waitFor();
      await page.locator('[data-event-id]').first().focus();
    };
    await enterEvents();
    await physical(page, 'KeyS');
    const palette = page.getByRole('dialog', { name: 'Palette', exact: true });
    await palette.getByRole('combobox').fill('#T-1');
    await palette.getByRole('option', { name: /T-1.*Events task/ }).click();
    await pageUntil(page, () => document.querySelector('[data-events-filter]')?.textContent?.includes('subject: T-1') === true && !document.querySelector('[data-events-loading]'), 'subject filter receipt');
    const expected = (await fixture.ui.request({ type: 'events.list', filter: { subject: { kind: 'item', id: 'T-1' } } })).value as EventsPage;
    assert.deepEqual(await page.locator('[data-event-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-event-id'))), expected.rows.map(row => row.id));
    await physical(page, 'KeyF', true);
    await pageUntil(page, () => document.querySelector('[data-events-filter]')?.textContent?.includes('subject: any') === true && !document.querySelector('[data-events-loading]'), 'cleared subject receipt');
    for (const [subject, target] of [[topic, 'Topics'], ['events-worker', 'Sessions'], [artifact, 'Artifacts']] as const) {
      await enterEvents();
      if (!await page.locator(`[data-event-subject="${subject}"]`).count()) {
        await page.getByRole('button', { name: 'A · 200 older events', exact: true }).click();
        await page.locator(`[data-event-subject="${subject}"]`).first().waitFor();
      }
      const row = page.locator('[data-event-id]').filter({ has: page.locator(`[data-event-subject="${subject}"]`) }).first();
      await row.focus(); await physical(page, 'Enter');
      await page.getByRole('main', { name: target, exact: true }).waitFor();
      if (target === 'Topics') await page.getByRole('log', { name: 'Events topic thread', exact: true }).waitFor();
      if (target === 'Sessions') await page.locator(`[data-object-id="${subject}"]`).first().waitFor();
      if (target === 'Artifacts') await page.locator(`[data-artifact-viewer][data-artifact-selection="${subject}"]`).waitFor();
    }
  });
});


test('live Events retain the 200-row cap, page without gaps and follow the selected coalescing identity', async t => {
  const fixture = await eventsFixture(t);
  assert.equal((await fixture.ui.request({ type: 'subscribe' })).ok, true);
  const edits = { planned: 0, backlog: 0 };
  const edit = async (status: 'planned' | 'backlog') => {
    const count = ++edits[status];
    const pushed = fixture.ui.waitFor(frame => frame.type === 'event' && (frame.row as EventRow).subject.id === 'T-1' && (frame.row as EventRow).text.includes(`→ ${status}`) && ((frame.row as EventRow).count ?? 1) === count);
    assert.equal((await fixture.ui.request({ type: 'task.edit', item: 'T-1', status })).ok, true);
    return (await pushed).row as EventRow;
  };
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Events', exact: true }).click();
    await page.locator('[data-event-id]').nth(199).waitFor();
    const first = await edit('planned');
    await page.locator(`[data-event-id="${first.id}"]`).waitFor();
    const newest = (await fixture.ui.request({ type: 'events.list', limit: 200 })).value as EventsPage;
    const ids = () => page.locator('[data-event-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-event-id')));
    assert.deepEqual(await ids(), newest.rows.map(row => row.id));
    await page.getByRole('button', { name: 'A · 200 older events', exact: true }).click();
    await pageUntil(page, () => document.querySelectorAll('[data-event-id]').length === 400, 'older page after live prepend');
    const older = (await fixture.ui.request({ type: 'events.list', limit: 200, before: newest.before! })).value as EventsPage;
    assert.deepEqual(await ids(), [...newest.rows, ...older.rows].map(row => row.id), 'live cap keeps the next cursor at the visible boundary');
    const selected = page.locator(`[data-event-id="${first.id}"]`);
    await selected.focus();
    await edit('backlog');
    const replacement = await edit('planned');
    assert.equal(replacement.replaces, first.id);
    await page.locator(`[data-event-id="${replacement.id}"]`).waitFor();
    await pageUntil(page, () => document.activeElement?.getAttribute('data-event-id') === document.querySelector('[data-event-id]')?.getAttribute('data-event-id'), 'focus follows coalesced event');
    assert.equal(await page.locator(`[data-event-id="${replacement.id}"]`).evaluate(node => node === document.activeElement), true);
    assert.equal(await page.locator(`[data-event-id="${first.id}"]`).count(), 0);
    assert.match(await page.locator(`[data-event-id="${replacement.id}"]`).innerText(), /×2/);
    assert.equal(await page.locator(`[data-event-id="${older.rows.at(-1)!.id}"]`).count(), 1, 'loaded older page survives live rows');
  });
});

test('held Events pages preserve newer coalescing pushes and obsolete filter replies cannot replace the current filter', async t => {
  const fixture = await eventsFixture(t);
  const held = new Map<string, () => void>();
  const requests = new Map<string, { before?: string; filter?: { warnings?: boolean } }>();
  let holding = false;
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Events', exact: true }).click();
    await page.locator('[data-event-id]').nth(199).waitFor();
    holding = true;
    await page.getByRole('button', { name: 'A · 200 older events', exact: true }).click();
    await until(() => held.size === 1, { what: 'older page receipt held', timeoutMs: 3000 });
    for (const status of ['planned', 'backlog', 'planned'] as const) assert.equal((await fixture.ui.request({ type: 'task.edit', item: 'T-1', status })).ok, true);
    const first = (await fixture.ui.request({ type: 'events.list' })).value as EventsPage;
    const second = (await fixture.ui.request({ type: 'events.list', before: first.before! })).value as EventsPage;
    const group = first.rows.find(row => row.count === 2)!;
    await page.locator(`[data-event-id="${group.id}"]`).waitFor();
    holding = false;
    for (const release of held.values()) release(); held.clear();
    await pageUntil(page, () => !document.querySelector('[data-events-loading]'), 'older receipt applied after live burst');
    assert.deepEqual(await page.locator('[data-event-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-event-id'))), [...first.rows, ...second.rows].map(row => row.id));
    holding = true;
    await page.locator('[data-event-id]').first().focus();
    await physical(page, 'KeyW');
    await until(() => held.size === 1, { what: 'obsolete warnings page held', timeoutMs: 3000 });
    holding = false;
    await physical(page, 'KeyF', true);
    await pageUntil(page, () => document.querySelector('[data-events-filter]')?.textContent?.includes('all levels') === true && !document.querySelector('[data-events-loading]'), 'clear filter receipt applied');
    for (const release of held.values()) release(); held.clear();
    // Fence the stale reply with a real later row on the same socket.
    const pushed = await fixture.ui.request({ type: 'artifact.create', kind: 'note', title: 'After stale filter', topic: 'general', content: 'Fence' });
    assert.equal(pushed.ok, true, pushed.error);
    await page.locator('[data-event-id]').filter({ hasText: 'After stale filter' }).first().waitFor();
    assert.match(await page.locator('[data-events-filter]').innerText(), /all levels/);
    assert.equal(await page.locator('[data-event-id]').count(), 200);
    assert.ok(await page.locator('[data-event-id][data-bookkeeping="true"]').count() > 0);
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      route.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'events.list' && frame.id.startsWith('action:')) requests.set(frame.id, frame);
        server.send(message);
      });
      server.onMessage(message => {
        const frame = JSON.parse(String(message));
        const request = requests.get(frame.id);
        if (holding && frame.type === 'result' && request && (request.before || request.filter?.warnings)) held.set(frame.id, () => route.send(message));
        else route.send(message);
      });
    });
  });
});

test('an Inbox alongside filtered Events still counts new events outside that filter', async t => {
  const fixture = await eventsFixture(t, 12);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Events', exact: true }).click();
    await page.locator('[data-event-id]').first().waitFor();
    await page.locator('[data-event-id]').first().focus();
    await physical(page, 'KeyW');
    await pageUntil(page, () => document.querySelector('[data-events-filter]')?.textContent?.includes('warnings only') === true && !document.querySelector('[data-events-loading]'), 'warning filter applied');
    await page.keyboard.press('Meta+Backslash');
    const secondary = page.locator('[data-pane="secondary"]');
    await secondary.focus();
    await page.getByRole('button', { name: 'Inbox', exact: true }).click();
    await secondary.locator('[data-inbox-events]').waitFor();
    await fixture.clock.advance(60_000);
    assert.equal((await fixture.ui.request({ type: 'task.edit', item: 'T-1', status: 'planned' })).ok, true);
    await pageUntil(page, () => document.querySelector('[data-pane="secondary"] [data-inbox-events]')?.textContent === '△ 1 new events · ⚠ 0', 'unfiltered Inbox updates beside filtered Events');
    assert.equal(await secondary.locator('[data-inbox-events]').innerText(), '△ 1 new events · ⚠ 0');
    const events = page.locator('[data-pane="primary"]');
    assert.equal(await events.locator('[data-event-id][data-bookkeeping="true"]').count(), 0);
  }, async page => { await pausePageClock(page, fixture.clock.now()); });
});

test('Events help keeps every key reachable by native scrolling in a small viewport', async t => {
  const fixture = await eventsFixture(t, 12);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Events', exact: true }).click();
    await page.locator('[data-event-id]').first().focus();
    await page.keyboard.press('Shift+Slash');
    const help = page.getByRole('dialog', { name: 'Events keys', exact: true });
    await help.waitFor();
    assert.equal(await help.locator('[data-key-action="events-kind-8"] dt').innerText(), 'Filter topic events');
    const actions = await help.locator('[data-key-action]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-key-action')));
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
    for (let step = 0; step <= actions.length; step++) {
      const atBottom = await help.evaluate(node => node.scrollTop + node.clientHeight >= node.scrollHeight - 1);
      if (atBottom) break;
      const before = await observed.evaluate(state => state.ended);
      const completed = until(async () => (await observed.evaluate(state => state.ended)) > before, { what: 'native Events help page scroll completed', timeoutMs: 3000 });
      await page.keyboard.press('PageDown'); await completed;
      assert.ok(step < actions.length, 'bounded help traversal');
    }
    assert.deepEqual((await observed.evaluate(state => [...state.seen])).sort(), actions.sort());
    assert.equal(await help.locator('[data-key-action]').last().evaluate(node => {
      const row = node.getBoundingClientRect(), dialog = node.closest('dialog')!.getBoundingClientRect();
      return row.top >= dialog.top && row.bottom <= Math.min(innerHeight, dialog.bottom);
    }), true);
    await observed.dispose();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Meta+KeyK');
    const palette = page.getByRole('dialog', { name: 'Palette', exact: true });
    await palette.getByRole('combobox').fill('>Filter rule events');
    await palette.getByRole('option', { name: /Filter rule events/ }).click();
    await pageUntil(page, () => document.querySelector('[data-events-filter]')?.textContent?.includes('kind: rule') === true && !document.querySelector('[data-events-loading]'), 'palette-only rule filter receipt');
    assert.equal(await page.locator('[data-event-id]').count(), 0);
  }, page => page.setViewportSize({ width: 900, height: 560 }));
});

test('Events refreshes its filtered feed after a hub restart without replaying the last-look write', async t => {
  const fixture = await eventsFixture(t, 12);
  const writes: unknown[] = [];
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Events', exact: true }).click();
    await page.locator('[data-event-id]').first().waitFor();
    await page.locator('[data-event-id]').first().focus();
    await physical(page, 'Digit2');
    await pageUntil(page, () => document.querySelector('[data-events-filter]')?.textContent?.includes('kind: task') === true && !document.querySelector('[data-events-loading]'), 'task filter initial receipt');
    assert.equal(writes.length, 1);
    const before = (await fixture.ui.request({ type: 'marks.get' })).value;
    await fixture.hub.stop(); await fixture.hub.stopped;
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Offline', 'old epoch disconnected');
    await fixture.restartHub();
    const next = await connectUi(t, fixture.hub.discovery);
    assert.equal((await next.request({ type: 'task.edit', item: 'T-1', status: 'planned' })).ok, true);
    await reconnectUntilLive(page);
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Live', 'new epoch connected');
    await page.locator('[data-event-id]').filter({ hasText: 'backlog → planned' }).waitFor();
    const expected = (await next.request({ type: 'events.list', filter: { kinds: ['task'] } })).value as EventsPage;
    assert.deepEqual(await page.locator('[data-event-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-event-id'))), expected.rows.map(row => row.id));
    assert.equal(writes.length, 1, 'reads resume, visit write does not replay');
    assert.deepEqual((await next.request({ type: 'marks.get' })).value, before);
  }, async page => {
    await pausePageClock(page, fixture.clock.now());
    page.on('websocket', socket => socket.on('framesent', event => { const frame = JSON.parse(String(event.payload)); if (frame.type === 'marks.set') writes.push(frame); }));
  });
});

test('rail digits navigate while its other keys keep the active area and focused Events rows keep kind filters', async t => {
  const fixture = await eventsFixture(t, 12);
  await fixture.pageCase(t, async page => {
    const sessions = page.getByRole('button', { name: 'Sessions', exact: true });
    await sessions.click();
    assert.equal(await sessions.evaluate(node => node === document.activeElement), true);
    await physical(page, 'KeyL');
    const launch = page.getByRole('form', { name: 'Launch a session', exact: true });
    await launch.waitFor();
    await launch.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Events', exact: true }).click();
    await physical(page, 'Digit2');
    await page.getByRole('main', { name: 'Items', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Events', exact: true }).click();
    await page.locator('[data-event-id]').first().focus();
    await physical(page, 'Digit2');
    await pageUntil(page, () => document.querySelector('[data-events-filter]')?.textContent?.includes('kind: task') === true && !document.querySelector('[data-events-loading]'), 'row digit keeps the Events filter');
    assert.equal(await page.getByRole('main', { name: 'Events', exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Events', exact: true }).click();
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit6', key: 'я', bubbles: true, cancelable: true })));
    await page.getByRole('main', { name: 'Artifacts', exact: true }).waitFor();
  });
});
