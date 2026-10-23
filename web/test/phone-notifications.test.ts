// Web: sealed phone context, real worker registration and stubbed permission/delivery.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright-core';
import { connectUi, inProcessSpoke } from '../../hub/test/harness.ts';
import { until } from '../../hub/test/until.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import { seedItem } from './items-fixture.ts';
import { webFixture, pageUntil } from './harness.ts';

type NoticeWindow = typeof globalThis & { permissionRequests: number; pushCalls: number; fallbackNotices: number; looking: { visible: boolean; focused: boolean }; held: boolean; releaseRegistration: () => Promise<void>; notices: Array<{ title: string; options: NotificationOptions }> };
async function stub(page: Page, answer = 'granted') {
  await page.addInitScript(answer => {
    const scope = globalThis as NoticeWindow;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => scope.looking.visible ? 'visible' : 'hidden' });
    document.hasFocus = () => scope.looking.focused;
    scope.permissionRequests = 0; scope.pushCalls = 0; scope.fallbackNotices = 0; scope.notices = []; scope.looking = { visible: false, focused: false };
    class StubNotification {
      constructor() { scope.fallbackNotices++; }
      static permission = 'default';
      static async requestPermission() { scope.permissionRequests++; this.permission = answer; return answer; }
    }
    Object.defineProperty(globalThis, 'Notification', { configurable: true, value: StubNotification });
    ServiceWorkerRegistration.prototype.showNotification = async function(title, options) { scope.notices.push({ title, options: options ?? {} }); };
    PushManager.prototype.subscribe = async () => { scope.pushCalls++; throw new Error('Web Push is deferred'); };
  }, answer);
}

test('phone More subscribes on a tap with root worker scope and shared switches without Web Push', async t => {
  const fixture = await webFixture(t);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'More', exact: true }).tap();
    const more = page.getByRole('navigation', { name: 'More areas' });
    assert.equal(await more.getByRole('switch').count(), 2);
    const button = more.getByRole('button', { name: 'Subscribe to notifications', exact: true });
    assert.deepEqual(await page.evaluate(async () => ({ registration: !!await navigator.serviceWorker.getRegistration('/'), prompts: (globalThis as NoticeWindow).permissionRequests, push: (globalThis as NoticeWindow).pushCalls })), { registration: false, prompts: 0, push: 0 });
    const activated = pageUntil(page, () => document.querySelector('[aria-label="Subscribe to notifications"]')?.textContent === 'Subscribed', 'worker activation receipt renders');
    void activated.catch(() => {});
    await button.tap();
    await activated;
    const registration = await page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration('/');
      return { scope: r?.scope, script: r?.active?.scriptURL, permissionRequests: (globalThis as NoticeWindow).permissionRequests, pushCalls: (globalThis as NoticeWindow).pushCalls };
    });
    assert.deepEqual(registration, { scope: new URL('/', page.url()).href, script: new URL('/sw.js', page.url()).href, permissionRequests: 1, pushCalls: 0 });
    await more.getByRole('switch', { name: 'Needs you', exact: true }).tap();
    await more.getByRole('switch', { name: 'Needs you', checked: true }).waitFor();
    await more.getByRole('button', { name: 'Accounts', exact: true }).tap();
    assert.equal(await page.getByRole('region', { name: 'Profile', exact: true }).getByRole('switch').count(), 0);
    await page.reload();
    await page.getByRole('button', { name: 'More', exact: true }).tap();
    await more.getByRole('switch', { name: 'Needs you', checked: true }).waitFor();
    assert.equal(await more.getByRole('switch', { name: 'Finished', checked: false }).count(), 1);
  }, stub, { phone: true, serviceWorkers: 'allow' });
});

test('hidden phone ask goes once through the worker and its message opens the exact Inbox row', async t => {
  const clock = new FakeClock(new Date('2026-10-23T12:00:00Z'));
  const fixture = await webFixture(t, { clock, prepare: async root => {
    await seedItem(root, 'R-900000', 'release', 'Phone release', { version: '99.0.0' });
    await seedItem(root, 'T-900001', 'task', 'Phone task', { parent: 'R-900000' });
  } });
  const ui = await connectUi(t, fixture.hub.discovery);
  const made = await ui.request({ type: 'topic.create', title: 'Phone topic', item: 'T-900001' });
  assert.equal(made.ok, true, made.error);
  const topic = (made.value as { topic: { id: string } }).topic.id;
  const sender = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', role: 'coordinator' });
  await sender.waitForPresence(['coord']);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'More', exact: true }).tap();
    const activated = pageUntil(page, () => document.querySelector('[aria-label="Subscribe to notifications"]')?.textContent === 'Subscribed', 'worker activated');
    void activated.catch(() => {});
    await page.getByRole('button', { name: 'Subscribe to notifications', exact: true }).tap();
    await activated;
    await page.getByRole('switch', { name: 'Needs you', exact: true }).tap();
    await page.getByRole('switch', { name: 'Needs you', checked: true }).waitFor();
    await page.getByRole('button', { name: 'Topics', exact: true }).tap();
    const notified = pageUntil(page, () => (globalThis as NoticeWindow).notices.length === 1, 'worker showNotification receipt');
    void notified.catch(() => {});
    const ask = await sender.call<{ ok: boolean; ask: string }>('ask', { topic, question: 'Ship from the phone?', free: true });
    assert.equal(ask.ok, true);
    await clock.advance(250);
    await notified;
    assert.deepEqual(await page.evaluate(() => (globalThis as NoticeWindow).notices), [{ title: 'coord · T-900001', options: { body: 'Ship from the phone?', tag: ask.ask, data: { area: 'Inbox', id: ask.ask } } }]);
    const row = page.locator(`[data-area-module="Inbox"] [data-object-id="${ask.ask}"]`);
    const focused = until(async () => await row.count() === 1 && row.evaluate(node => node === document.activeElement), { what: 'exact notification row focused', timeoutMs: 3000 });
    void focused.catch(() => {});
    await page.evaluate(target => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'notification-open', target } })), { area: 'Inbox', id: ask.ask });
    await focused;
    await row.waitFor();
    assert.equal(await row.evaluate(node => document.activeElement === node), true);
    await clock.advance(250);
    assert.equal(await page.evaluate(() => (globalThis as NoticeWindow).notices.length), 1);
    await page.goto(new URL(`/?area=inbox&row=${encodeURIComponent(ask.ask)}`, page.url()).href);
    await until(async () => await row.count() === 1 && row.evaluate(node => node === document.activeElement), { what: 'cold notification row focused', timeoutMs: 3000 });
    assert.equal(await row.evaluate(node => document.activeElement === node), true);
  }, stub, { phone: true, serviceWorkers: 'allow' });
});

test('phone subscription denial turns saved switches off and explains browser settings without registering', async t => {
  const fixture = await webFixture(t);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'More', exact: true }).tap();
    const more = page.getByRole('navigation', { name: 'More areas' });
    await more.getByRole('switch', { name: 'Needs you', checked: true }).waitFor();
    const button = more.getByRole('button', { name: 'Subscribe to notifications', exact: true });
    const denied = more.getByRole('switch', { name: 'Needs you', checked: false }).waitFor();
    void denied.catch(() => {});
    await button.tap();
    await denied;
    assert.equal(await more.getByRole('switch', { name: 'Finished', checked: false }).count(), 1);
    assert.match(await button.getAttribute('title') ?? '', /blocked.*site settings/);
    assert.deepEqual(await page.evaluate(async () => ({ saved: JSON.parse(localStorage.getItem('cland.ui.notifications.v1')!), registration: !!await navigator.serviceWorker.getRegistration('/'), prompts: (globalThis as NoticeWindow).permissionRequests })), { saved: { needsYou: false, finished: false }, registration: false, prompts: 1 });
    await button.tap();
    assert.equal(await page.evaluate(() => (globalThis as NoticeWindow).permissionRequests), 1);
  }, async page => {
    await stub(page, 'denied');
    await page.addInitScript(() => localStorage.setItem('cland.ui.notifications.v1', JSON.stringify({ needsYou: true, finished: true })));
  }, { phone: true, serviceWorkers: 'allow' });
});

test('waiting plan and TUI-bound Claude approval each notify through the phone worker', async t => {
  const { writeFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const clock = new FakeClock(new Date('2026-10-23T12:00:00Z'));
  const fixture = await webFixture(t, { clock, prepare: async root => {
    await seedItem(root, 'R-900000', 'release', 'Phone release', { version: '99.0.0' });
    await seedItem(root, 'E-900010', 'epic', 'Phone epic', { parent: 'R-900000', assignee: 'planner' });
    await seedItem(root, 'T-900100', 'task', 'Phone task', { parent: 'E-900010' });
    await writeFile(join(root, '.cland/config.toml'), '[plan]\napproval = "human"\n');
  } });
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'session.launch', name: 'phone-claude', harness: 'claude-code' })).ok, true);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'More', exact: true }).tap();
    const activated = pageUntil(page, () => document.querySelector('[aria-label="Subscribe to notifications"]')?.textContent === 'Subscribed', 'worker activated');
    void activated.catch(() => {});
    await page.getByRole('button', { name: 'Subscribe to notifications', exact: true }).tap();
    await activated;
    await page.getByRole('switch', { name: 'Needs you', exact: true }).tap();
    await page.getByRole('switch', { name: 'Needs you', checked: true }).waitFor();
    await page.getByRole('button', { name: 'More', exact: true }).tap();
    const planNotice = pageUntil(page, () => (globalThis as NoticeWindow).notices.length === 1, 'plan worker notification');
    void planNotice.catch(() => {});
    assert.equal((await ui.request({ type: 'task.plan', item: 'E-900010', op: 'set', yaml: 'stages:\n  - name: Build\n    qa: { scope: none, when: after-stage }\n    lanes:\n      - [T-900100]\n' })).ok, true);
    await clock.advance(250);
    await planNotice;
    assert.deepEqual(await page.evaluate(() => (globalThis as NoticeWindow).notices[0]), { title: 'planner · E-900010', options: { body: 'Plan approval · Phone epic', tag: 'E-900010', data: { area: 'Inbox', id: 'E-900010' } } });
    const approvalNotice = pageUntil(page, () => (globalThis as NoticeWindow).notices.length === 2, 'TUI approval worker notification');
    void approvalNotice.catch(() => {});
    fixture.fakes['claude-code']!.raiseApproval('phone-claude', { id: 'phone-native', kind: 'command', subject: { command: 'echo phone approval' }, choices: [], answerIn: 'tui' });
    await clock.advance(250);
    const inbox = (await ui.request({ type: 'inbox.list' })).value as import('../../shared/wire/index.ts').Inbox;
    const approval = inbox.approvals.find(row => row.session === 'phone-claude')!;
    await approvalNotice;
    assert.deepEqual(await page.evaluate(() => (globalThis as NoticeWindow).notices[1]), { title: 'phone-claude · phone-claude', options: { body: 'echo phone approval', tag: approval.id, data: { area: 'Inbox', id: approval.id } } });
    await page.locator(`[data-object-id="${approval.id}"]`).waitFor();
    assert.equal(await page.locator('[data-approval-choice]').count(), 0);
    assert.equal(await page.evaluate(() => (globalThis as NoticeWindow).notices.length), 2);
  }, stub, { phone: true, serviceWorkers: 'allow' });
});


for (const suppression of ['looking', 'disabled'] as const) test(`held registration suppresses a notification after ${suppression} changes`, async t => {
  const clock = new FakeClock(new Date('2026-10-23T12:00:00Z'));
  const fixture = await webFixture(t, { clock });
  const sender = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', role: 'coordinator' });
  await sender.waitForPresence(['coord']);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'More', exact: true }).tap();
    const activated = pageUntil(page, () => document.querySelector('[aria-label="Subscribe to notifications"]')?.textContent === 'Subscribed', 'worker activated');
    void activated.catch(() => {});
    await page.getByRole('button', { name: 'Subscribe to notifications', exact: true }).tap();
    await activated;
    await page.getByRole('switch', { name: 'Needs you', exact: true }).tap();
    await page.getByRole('switch', { name: 'Needs you', checked: true }).waitFor();
    await page.evaluate(fallback => {
      const scope = globalThis as NoticeWindow;
      const get = navigator.serviceWorker.getRegistration.bind(navigator.serviceWorker);
      let first = true;
      navigator.serviceWorker.getRegistration = async (...args) => {
        if (!first) return get(...args);
        first = false;
        scope.held = true;
        return new Promise(resolve => {
          scope.releaseRegistration = async () => { const registration = await get(...args); resolve(fallback ? undefined : registration); };
        });
      };
    }, suppression === 'disabled');
    const held = pageUntil(page, () => (globalThis as NoticeWindow).held, 'delivery registration lookup held');
    void held.catch(() => {});
    const ask = await sender.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Hold notification delivery?', free: true });
    assert.equal(ask.ok, true);
    await clock.advance(250);
    await held;
    if (suppression === 'looking') await page.evaluate(() => { (globalThis as NoticeWindow).looking = { visible: true, focused: true }; });
    else {
      await page.getByRole('switch', { name: 'Needs you', exact: true }).tap();
      await page.getByRole('switch', { name: 'Needs you', checked: false }).waitFor();
    }
    await page.evaluate(async () => { await (globalThis as NoticeWindow).releaseRegistration(); });
    assert.deepEqual(await page.evaluate(() => ({ worker: (globalThis as NoticeWindow).notices.length, page: (globalThis as NoticeWindow).fallbackNotices })), { worker: 0, page: 0 });
  }, stub, { phone: true, serviceWorkers: 'allow' });
});
