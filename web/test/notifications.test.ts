// Web: sealed hub facts, Notification/visibility stubs and real shell navigation.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright-core';
import { connectUi, inProcessSpoke } from '../../hub/test/harness.ts';
import { until } from '../../hub/test/until.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import { webFixture, pageUntil } from './harness.ts';
import { seedItem } from './items-fixture.ts';

export type NoticeStub = { title: string; options: { body: string; tag: string }; onclick?: () => void; closed?: boolean };
type NotificationWindow = typeof globalThis & { notices: NoticeStub[]; looking: { visible: boolean; focused: boolean }; focusedCalls: number; permissionRequests: number };
async function stub(page: Page, settings = { needsYou: true, finished: false, permission: 'granted', answer: 'granted' }) {
  await page.addInitScript(settings => {
    const scope = globalThis as NotificationWindow;
    scope.notices = []; scope.looking = { visible: false, focused: false }; scope.focusedCalls = 0; scope.permissionRequests = Number(sessionStorage.getItem('permissionRequests') ?? 0);
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => scope.looking.visible ? 'visible' : 'hidden' });
    document.hasFocus = () => scope.looking.focused;
    window.focus = () => { scope.focusedCalls++; scope.looking = { visible: true, focused: true }; };
    class StubNotification {
      static permission = sessionStorage.getItem('notificationPermission') ?? settings.permission;
      static async requestPermission() { scope.permissionRequests++; sessionStorage.setItem('permissionRequests', String(scope.permissionRequests)); this.permission = settings.answer; sessionStorage.setItem('notificationPermission', this.permission); return this.permission; }
      title: string; options: { body: string; tag: string };
      constructor(title: string, options: { body: string; tag: string }) { this.title = title; this.options = options; scope.notices.push(this); }
      close() {}
    }
    Object.defineProperty(globalThis, 'Notification', { configurable: true, value: StubNotification });
    if (!localStorage.getItem('cland.ui.notifications.v1')) localStorage.setItem('cland.ui.notifications.v1', JSON.stringify({ needsYou: settings.needsYou, finished: settings.finished }));
  }, settings);
}
async function notificationFixture(t: Parameters<typeof webFixture>[0]) {
  const clock = new FakeClock(new Date('2026-10-23T12:00:00Z'));
  const fixture = await webFixture(t, { clock, prepare: async root => {
    await seedItem(root, 'R-900000', 'release', 'Notification release', { version: '99.0.0' });
    await seedItem(root, 'T-900001', 'task', 'Notification task', { parent: 'R-900000', status: 'in progress', assignee: 'worker' });
  } });
  const ui = await connectUi(t, fixture.hub.discovery);
  const made = await ui.request({ type: 'topic.create', title: 'Notification topic', item: 'T-900001' });
  assert.equal(made.ok, true, made.error);
  const topic = (made.value as { topic: { id: string } }).topic.id;
  const sender = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', role: 'coordinator', sessionId: 'notification-coord' });
  await sender.waitForPresence(['coord']);
  const ask = async (question: string) => {
    const result = await sender.call<{ ok: boolean; ask: string; error?: string }>('ask', { topic, question, options: ['Yes', 'Wait'], free: true });
    assert.equal(result.ok, true, result.error);
    await clock.advance(250);
    return result.ask;
  };
  return { ...fixture, clock, ui, sender, topic, ask };
}

test('hidden now ask raises one named notification whose click focuses and opens its Inbox row', async t => {
  const fixture = await notificationFixture(t);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await page.keyboard.press('Meta+Backslash');
    await page.locator('[data-pane="secondary"]').getByRole('heading', { name: 'Sessions', exact: true }).click();
    const id = await fixture.ask('Ship the plan?');
    await pageUntil(page, () => (globalThis as NotificationWindow).notices.length === 1, 'one browser notification');
    assert.deepEqual(await page.evaluate(() => (globalThis as NotificationWindow).notices.map(({ title, options }) => ({ title, options }))),
      [{ title: 'coord · T-900001', options: { body: 'Ship the plan?', tag: id } }]);
    await fixture.clock.advance(250);
    assert.equal(await page.evaluate(() => (globalThis as NotificationWindow).notices.length), 1);
    await page.getByRole('button', { name: 'Palette', exact: true }).click();
    const destination = page.locator(`[data-pane="secondary"] [aria-label="Inbox objects"] [data-object-id="${id}"]`);
    const focused = until(async () => await destination.count() === 1 && destination.evaluate(node => node === document.activeElement), { what: 'exact secondary Inbox notification row focused', timeoutMs: 3000 });
    void focused.catch(() => {});
    await page.evaluate(() => (globalThis as NotificationWindow).notices[0]!.onclick!());
    await destination.waitFor();
    assert.equal(await destination.getAttribute('data-object-id'), id);
    await focused;
    assert.equal(await destination.evaluate(node => node === document.activeElement), true);
    assert.equal(await page.getByRole('dialog', { name: 'Palette', exact: true }).count(), 0);
    const row = page.getByRole('list', { name: 'Inbox objects', exact: true }).locator(`[data-ask-id="${id}"]`);
    await row.waitFor();
    assert.equal(await row.getByRole('heading', { name: 'Ship the plan?', exact: true }).count(), 1);
    assert.equal(await page.evaluate(() => (globalThis as NotificationWindow).focusedCalls), 1);
  }, async page => {
    await page.clock.install({ time: fixture.clock.now() });
    await page.clock.pauseAt(fixture.clock.now());
    await stub(page);
  });
});

async function palette(page: Page, label: string) {
  await page.getByRole('button', { name: 'Palette', exact: true }).click();
  await page.getByRole('combobox', { name: 'Search palette', exact: true }).fill(label);
  return page.getByRole('option').filter({ hasText: label });
}

test('palette switches persist per browser and request permission only on the first enabling gesture', async t => {
  const fixture = await notificationFixture(t);
  await fixture.pageCase(t, async page => {
    assert.equal(await page.evaluate(() => (globalThis as NotificationWindow).permissionRequests), 0);
    await (await palette(page, 'Notifications · Needs you: off')).click();
    assert.equal(await page.evaluate(() => (globalThis as NotificationWindow).permissionRequests), 1);
    await (await palette(page, 'Notifications · Finished: off')).click();
    assert.equal(await page.evaluate(() => (globalThis as NotificationWindow).permissionRequests), 1);
    await page.reload();
    await (await palette(page, 'Notifications · Needs you: on')).waitFor();
    await page.keyboard.press('Escape');
    await (await palette(page, 'Notifications · Finished: on')).waitFor();
    assert.equal(await page.evaluate(() => (globalThis as NotificationWindow).permissionRequests), 1);
    await page.keyboard.press('Escape');
    await (await palette(page, 'Notifications · Needs you: on')).click();
    await (await palette(page, 'Notifications · Needs you: off')).click();
    assert.equal(await page.evaluate(() => (globalThis as NotificationWindow).permissionRequests), 1);
  }, page => stub(page, { needsYou: false, finished: false, permission: 'default', answer: 'granted' }));
});

test('looking, disabled and watch-layer asks stay silent without later replay', async t => {
  let watchReceived = false;
  const fixture = await notificationFixture(t);
  await fixture.pageCase(t, async page => {
    await page.evaluate(() => { (globalThis as NotificationWindow).looking = { visible: true, focused: true }; });
    const visible = await fixture.ask('Visible question');
    await page.getByRole('list', { name: 'Inbox objects', exact: true }).locator(`[data-object-id="${visible}"]`).waitFor();
    assert.equal(await page.evaluate(() => (globalThis as NotificationWindow).notices.length), 0);
    await (await palette(page, 'Notifications · Needs you: on')).click();
    await page.evaluate(() => { (globalThis as NotificationWindow).looking = { visible: false, focused: false }; });
    const disabled = await fixture.ask('Disabled question');
    await page.getByRole('list', { name: 'Inbox objects', exact: true }).locator(`[data-object-id="${disabled}"]`).waitFor();
    assert.equal(await page.evaluate(() => (globalThis as NotificationWindow).notices.length), 0);
    await (await palette(page, 'Notifications · Needs you: off')).click();
    assert.equal((await fixture.ui.request({ type: 'visibility.set', surface: 'topics', target: fixture.topic, mode: 'mute' })).ok, true);
    const watched = await fixture.ask('Muted question');
    const inbox = await fixture.ui.request({ type: 'inbox.list' });
    assert.equal((inbox.value as { asks: Array<{ id: string; layer?: string }> }).asks.find(row => row.id === watched)?.layer, 'watch');
    await until(() => watchReceived, { what: 'browser receives the exact watch-layer ask', timeoutMs: 3000 });
    assert.equal(watchReceived, true);
    assert.equal(await page.evaluate(() => (globalThis as NotificationWindow).notices.length), 0);
    await page.reload();
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.includes('Live') === true && document.querySelectorAll('[data-inbox-empty]').length === 4, 'fresh snapshot renders the muted Inbox');
    assert.equal(await page.evaluate(() => (globalThis as NotificationWindow).notices.length), 0, 'fresh snapshots do not replay waiting rows');
  }, async page => {
    await stub(page);
    page.on('websocket', socket => socket.on('framereceived', event => {
      const frame = JSON.parse(String(event.payload));
      if (frame.type === 'inbox' && frame.inbox.asks.some((row: { question: string; layer: string }) => row.question === 'Muted question' && row.layer === 'watch')) watchReceived = true;
    }));
  });
});

test('denied permission keeps both switches off with a browser-settings tooltip', async t => {
  const fixture = await notificationFixture(t);
  await fixture.pageCase(t, async page => {
    await (await palette(page, 'Notifications · Needs you: off')).click();
    const needs = await palette(page, 'Notifications · Needs you: off');
    assert.match(await needs.getAttribute('title') ?? '', /blocked.*site settings/);
    await page.keyboard.press('Escape');
    const finished = await palette(page, 'Notifications · Finished: off');
    assert.match(await finished.getAttribute('title') ?? '', /blocked.*site settings/);
    assert.equal(await page.evaluate(() => (globalThis as NotificationWindow).permissionRequests), 1);
    await page.keyboard.press('Escape');
    await (await palette(page, 'Notifications · Finished: off')).click();
    assert.equal(await page.evaluate(() => (globalThis as NotificationWindow).permissionRequests), 1, 'a denied browser is never prompted again');
  }, page => stub(page, { needsYou: false, finished: false, permission: 'default', answer: 'denied' }));
});

test('hidden now task reaching done notifies once and its click opens the item card', async t => {
  const fixture = await notificationFixture(t);
  await fixture.pageCase(t, async page => {
    await (await palette(page, 'Notifications · Finished: off')).click();
    await page.keyboard.press('Meta+Backslash');
    const done = await fixture.ui.request({ type: 'task.edit', item: 'T-900001', status: 'done' });
    assert.equal(done.ok, true, done.error);
    await pageUntil(page, () => (globalThis as NotificationWindow).notices.length === 1, 'finished notification delivered');
    assert.deepEqual(await page.evaluate(() => (globalThis as NotificationWindow).notices.map(({ title, options }) => ({ title, options }))),
      [{ title: 'worker · T-900001', options: { body: 'Finished · Notification task', tag: 'T-900001' } }]);
    const duplicate = await fixture.ui.request({ type: 'task.edit', item: 'T-900001', title: 'Updated done task' });
    assert.equal(duplicate.ok, true, duplicate.error);
    await page.getByRole('button', { name: 'Palette', exact: true }).click();
    await page.evaluate(() => (globalThis as NotificationWindow).notices[0]!.onclick!());
    const card = page.getByRole('region', { name: 'Item card', exact: true });
    await card.waitFor();
    assert.equal(await page.getByRole('dialog', { name: 'Palette', exact: true }).count(), 0);
    assert.match(await card.innerText(), /done/);
    assert.equal(await card.getAttribute('data-item-id'), 'T-900001');
    assert.equal(await page.evaluate(() => (globalThis as NotificationWindow).notices.length), 1);
  }, stub);
});

test('revoked browser permission disables saved switches on reload and explains why', async t => {
  const fixture = await notificationFixture(t);
  await fixture.pageCase(t, async page => {
    const needs = await palette(page, 'Notifications · Needs you: off');
    await needs.waitFor();
    assert.match(await needs.getAttribute('title') ?? '', /blocked.*site settings/);
    await page.keyboard.press('Escape');
    const finished = await palette(page, 'Notifications · Finished: off');
    await finished.waitFor();
    assert.match(await finished.getAttribute('title') ?? '', /blocked.*site settings/);
    assert.equal(await page.evaluate(() => (globalThis as NotificationWindow).permissionRequests), 0);
  }, page => stub(page, { needsYou: true, finished: true, permission: 'denied', answer: 'denied' }));
});

test('one browser shares switch changes between its open tabs', async t => {
  const fixture = await notificationFixture(t);
  await fixture.pageCase(t, async (page, origin) => {
    const second = await page.context().newPage();
    try {
      await second.goto(origin);
      await (await palette(second, 'Notifications · Needs you: on')).waitFor();
      await page.getByRole('button', { name: 'Palette', exact: true }).click();
      await page.getByRole('combobox', { name: 'Search palette', exact: true }).fill('Notifications · Needs you');
      await second.getByRole('option').filter({ hasText: 'Notifications · Needs you: on' }).click();
      await page.getByRole('option').filter({ hasText: 'Notifications · Needs you: off' }).waitFor();
      assert.equal(await page.getByRole('option').filter({ hasText: 'Notifications · Needs you: on' }).count(), 0);
    } finally { await second.close(); }
  }, stub);
});

test('a task moved out of Now by another item delta stays silent when it later finishes', async t => {
  const fixture = await notificationFixture(t);
  let layerReceived = false;
  await fixture.pageCase(t, async page => {
    await (await palette(page, 'Notifications · Finished: off')).click();
    const created = await fixture.ui.request({ type: 'task.create', title: 'Earlier current release', kind: 'release', version: '98.0.0' });
    assert.equal(created.ok, true, created.error);
    await until(() => layerReceived, { what: 'browser receives task layer demotion from another item', timeoutMs: 3000 });
    assert.equal(layerReceived, true);
    const done = await fixture.ui.request({ type: 'task.edit', item: 'T-900001', status: 'done', title: 'Finished outside Now' });
    assert.equal(done.ok, true, done.error);
    await page.getByRole('button', { name: 'Items', exact: true }).click();
    await page.getByText('1 done hidden', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => (globalThis as NotificationWindow).notices.length), 0);
  }, async page => {
    await stub(page);
    await page.addInitScript(() => localStorage.setItem('cland.ui.items.v1', JSON.stringify({ tree: { hideDone: true } })));
    page.on('websocket', socket => socket.on('framereceived', event => {
      const frame = JSON.parse(String(event.payload));
      if (frame.type === 'task' && frame.id !== 'T-900001' && frame.layers?.['T-900001'] === 'background') layerReceived = true;
    }));
  });
});
