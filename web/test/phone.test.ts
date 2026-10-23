// Web: phone frame through the sealed production edge and touch Headless Shell.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, inProcessSpoke } from '../../hub/test/harness.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import type { EventsPage, Inbox } from '../../shared/wire/index.ts';
import { webFixture, pageUntil } from './harness.ts';

test('the phone frame replaces the rail without losing desktop state', async t => {
  const fixture = await webFixture(t);
  await t.test('five touch slots open the four areas and Inbox is home', async t => {
    await fixture.pageCase(t, async page => {
      assert.deepEqual(page.viewportSize(), { width: 390, height: 844 });
      assert.equal(await page.evaluate(() => navigator.maxTouchPoints > 0 && matchMedia('(pointer: coarse)').matches), true);
      assert.equal(await page.locator('main').getAttribute('aria-label'), 'Inbox');
      assert.equal(await page.locator('nav[aria-label="Areas"]').count(), 0);
      const bar = page.getByRole('navigation', { name: 'Phone areas', exact: true });
      assert.deepEqual(await bar.locator('button').evaluateAll(rows => rows.map(row => row.getAttribute('aria-label'))), ['Inbox', 'Topics', 'Sessions', 'Events', 'More']);
      for (const area of ['Topics', 'Sessions', 'Events', 'Inbox']) {
        await bar.getByRole('button', { name: area, exact: true }).tap();
        await pageUntil(page, () => document.querySelector('main')?.getAttribute('aria-label') === document.querySelector('nav [aria-current="page"]')?.getAttribute('aria-label'), 'tapped area is current');
        assert.equal(await page.locator('main').getAttribute('aria-label'), area);
        assert.equal(await bar.getByRole('button', { name: area, exact: true }).getAttribute('aria-current'), 'page');
      }
    }, undefined, { phone: true });
  });
  await t.test('More has no scrim, closes on Escape, selection and outside taps, and frame controls fit touch', async t => {
    await fixture.pageCase(t, async page => {
      assert.equal(await page.getByRole('button', { name: 'Coordinator', exact: true }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Help', exact: true }).count(), 0);
      const more = page.getByRole('button', { name: 'More', exact: true });
      const sheet = page.getByRole('navigation', { name: 'More areas', exact: true });
      await more.tap();
      await sheet.waitFor();
      assert.deepEqual(await sheet.locator('button').allTextContents(), ['Items', 'Artifacts', 'Accounts', 'Needs youoff', 'Finishedoff', 'Subscribe to notifications']);
      assert.equal(await page.locator('[aria-modal="true"], [data-scrim]').count(), 0);
      const controls = await page.locator('[data-phone] > header button, [data-phone] > header select, nav[aria-label="Phone areas"] button, nav[aria-label="More areas"] button').evaluateAll(nodes => nodes.map(node => ({ name: node.getAttribute('aria-label') ?? node.textContent, height: node.getBoundingClientRect().height, left: node.getBoundingClientRect().left, right: node.getBoundingClientRect().right })));
      for (const control of controls) {
        assert.ok(control.height >= 44, `${control.name}: ${control.height} px`);
        assert.ok(control.left >= 0 && control.right <= 390, `${control.name} fits the phone`);
      }
      assert.ok((await sheet.boundingBox())!.y + (await sheet.boundingBox())!.height <= (await page.getByRole('navigation', { name: 'Phone areas' }).boundingBox())!.y);
      await page.evaluate(() => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'ж', bubbles: true, cancelable: true })));
      await sheet.waitFor({ state: 'detached' });
      assert.equal(await more.evaluate(node => node === document.activeElement), true);
      for (const area of ['Items', 'Artifacts', 'Accounts']) {
        await more.tap();
        await sheet.getByRole('button', { name: area, exact: true }).tap();
        await sheet.waitFor({ state: 'detached' });
        assert.equal(await page.locator('main').getAttribute('aria-label'), area);
        assert.equal(await more.getAttribute('aria-current'), 'page');
      }
      await more.tap();
      await page.getByLabel('Project', { exact: true }).tap();
      await sheet.waitFor({ state: 'detached' });
      await page.getByRole('button', { name: 'Palette', exact: true }).tap();
      await page.getByRole('dialog').waitFor();
    }, undefined, { phone: true });
  });
  await t.test('640 px keeps the collapsed rail and 639 px swaps to the bar without reload', async t => {
    await fixture.pageCase(t, async page => {
      let reloads = 0;
      page.on('framenavigated', frame => { if (frame === page.mainFrame()) reloads++; });
      await page.setViewportSize({ width: 640, height: 844 });
      await page.getByRole('navigation', { name: 'Areas', exact: true }).waitFor();
      assert.equal((await page.locator('aside').boundingBox())!.width, 60);
      assert.equal(await page.getByRole('navigation', { name: 'Phone areas', exact: true }).count(), 0);
      await page.setViewportSize({ width: 639, height: 844 });
      await page.getByRole('navigation', { name: 'Phone areas', exact: true }).waitFor();
      assert.equal(await page.getByRole('navigation', { name: 'Areas', exact: true }).count(), 0);
      assert.equal(reloads, 0);
    }, undefined, { phone: true });
  });
  await t.test('phone selection and split chords leave the saved desktop split intact', async t => {
    const ui = await connectUi(t, fixture.hub.discovery);
    assert.equal((await ui.request({ type: 'task.create', title: 'Phone selection', size: 'S' })).ok, true);
    await fixture.pageCase(t, async page => {
      await page.getByRole('button', { name: 'Items', exact: true }).click();
      await page.keyboard.press('Meta+Backslash');
      const other = page.locator('[data-pane="secondary"]');
      await other.waitFor();
      await other.click();
      await page.getByRole('button', { name: 'Accounts', exact: true }).click();
      await other.getByRole('heading', { name: 'Accounts', exact: true }).waitFor();
      await page.setViewportSize({ width: 390, height: 844 });
      await other.waitFor({ state: 'detached' });
      assert.equal(await page.locator('main').getAttribute('aria-label'), 'Items');
      await page.locator('[data-tree-key=":unscheduled"]').click();
      const row = page.getByRole('treeitem', { name: /T-1 Phone selection/ });
      await row.click();
      const card = page.getByRole('region', { name: 'Item card', exact: true });
      await card.waitFor();
      assert.equal(await card.getAttribute('data-item-id'), 'T-1', 'phone row opens its exact card');
      assert.equal(await page.getByRole('complementary', { name: 'Drawer', exact: true }).count(), 0);
      await card.press('Meta+Enter');
      await card.press('Meta+Backslash');
      assert.equal(await other.count(), 0);
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cland.ui.shell.v1')!));
      assert.equal(saved.secondary, 'Accounts');
      await page.reload();
      await page.getByRole('navigation', { name: 'Phone areas', exact: true }).waitFor();
      assert.equal(await other.count(), 0);
      await page.setViewportSize({ width: 1440, height: 900 });
      await other.getByRole('heading', { name: 'Accounts', exact: true }).waitFor();
      assert.equal(await page.locator('[data-pane]').count(), 2);
      const primaryWidth = (await page.locator('[data-pane="primary"]').boundingBox())!.width;
      assert.ok(Math.abs(primaryWidth / (await other.boundingBox())!.width - 2) < 0.02);
    });
  });
});

test('phone Inbox selection keeps asks in a sheet and replies inline without a drawer', async t => {
  const fixture = await webFixture(t);
  const sender = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', role: 'coordinator', sessionId: 'phone-inbox-coord' });
  t.after(() => sender.close());
  await sender.waitForPresence(['coord']);
  const asked = await sender.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Inline phone choice?', options: ['One', 'Two'] });
  assert.equal(asked.ok, true);
  const message = await sender.call<{ ok: boolean }>('send', { topic: 'general', kind: 'decision', text: 'Phone message\nFull phone body' });
  assert.equal(message.ok, true);
  const request = await sender.call<{ ok: boolean }>('send', { topic: 'general', kind: 'request', request: 'handover', subject: 'coord', text: 'Phone request\nFull request body' });
  assert.equal(request.ok, true);
  const ui = await connectUi(t, fixture.hub.discovery);
  const inbox = await ui.request({ type: 'inbox.list' });
  assert.equal(inbox.ok, true);
  const messageId = (inbox.value as Inbox).messages.find(row => row.text === 'Phone message\nFull phone body')!.id;
  const requestId = (inbox.value as Inbox).requests.find(row => row.text === 'Phone request\nFull request body')!.id;
  await fixture.pageCase(t, async page => {
    const row = page.locator(`[data-object-id="${asked.ask}"]`);
    await row.tap();
    await page.locator(`[data-object-id="${asked.ask}"][aria-pressed="true"]`).waitFor();
    const card = page.getByRole('dialog', { name: 'Answer ask', exact: true });
    await card.locator('[data-ask-option="1"]').waitFor();
    assert.equal(await page.getByRole('complementary', { name: 'Drawer', exact: true }).count(), 0);
    assert.equal(await card.locator('[data-ask-option]').count(), 2, 'sheet ask choices remain available');
    await card.getByRole('button', { name: 'Close sheet', exact: true }).tap();
    await card.waitFor({ state: 'hidden' });
    for (const [id, action, body] of [[messageId, 'd · Mark read', 'Full phone body'], [requestId, 'd · Decline', 'Full request body']] as const) {
      const selected = page.locator(`[data-object-id="${id}"]`);
      await selected.tap();
      await page.locator(`[data-object-id="${id}"][aria-pressed="true"]`).waitFor();
      assert.match(await selected.locator('..').innerText(), new RegExp(body));
      assert.equal(await selected.locator('..').getByRole('button', { name: action, exact: true }).isEnabled(), true);
      assert.equal(await page.getByRole('complementary', { name: 'Drawer', exact: true }).count(), 0);
    }
    assert.equal(await page.locator('[data-pane]').count(), 1);
    assert.equal(await page.locator('[data-area-surface="drawer"]').count(), 0);
  }, undefined, { phone: true });
});

test('phone badges share attention facts and count every event since the shared last look', async t => {
  const clock = new FakeClock(new Date('2026-10-23T12:00:00Z'));
  const fixture = await webFixture(t, { clock, prepare: async root => {
    await mkdir(join(root, '.cland'));
    await writeFile(join(root, '.cland/journal.jsonl'), Array.from({ length: 205 }, (_, n) => JSON.stringify({ ts: '2026-10-23T11:59:00Z', event: 'notification', kind: 'verdict', item: `T-${n + 1}`, result: 'clear', text: `Phone event ${n}` }) + '\n').join(''));
  } });
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'marks.set', events: '2026-10-23T11:58:00Z' })).ok, true);
  const coord = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', role: 'coordinator', sessionId: 'phone-coord' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const asked = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Phone choice?', options: ['One', 'Two'] });
  assert.equal(asked.ok, true);
  let events = 0;
  let before: string | undefined;
  do {
    const result = await ui.request({ type: 'events.list', limit: 200, ...(before ? { before } : {}) });
    assert.equal(result.ok, true);
    const page = result.value as EventsPage;
    events += page.rows.filter(row => Date.parse(row.ts) > Date.parse('2026-10-23T11:58:00Z')).length;
    before = page.more ? page.before ?? undefined : undefined;
  } while (before);
  assert.ok(events >= 205, 'the complete count needs more than one page');
  await fixture.pageCase(t, async page => {
    await pageUntil(page, () => document.querySelector('[data-area="Inbox"] [data-count]')?.textContent === '1', 'phone attention receipt');
    assert.equal(await page.locator('[data-area="Topics"] [data-count]').textContent(), '0');
    assert.equal(await page.locator('[data-area="Sessions"] [data-count]').textContent(), '0');
    await pageUntil(page, () => !document.querySelector('[data-inbox-events]')?.textContent?.includes('—'), 'complete Inbox event summary');
    await page.locator('[data-area="Events"] [data-count]').filter({ hasText: String(events) }).waitFor();
    assert.equal(await page.locator('[data-area="Events"] [data-count]').textContent(), String(events));
    assert.equal(await page.locator('[data-inbox-events]').textContent(), `△ ${events} new events · ⚠ 0`);
    assert.equal(await page.getByRole('button', { name: 'More', exact: true }).locator('[data-count]').count(), 0);
    assert.equal((await ui.request({ type: 'marks.set', events: '2026-10-23T12:01:00Z' })).ok, true);
    await pageUntil(page, () => document.querySelector('[data-area="Events"] [data-count]')?.textContent === '0', 'shared last look clears the phone badge');
    const answered = await ui.request({ type: 'topic.answer', ask: asked.ask, option: 1 });
    assert.equal(answered.ok, true);
    await clock.advance(250);
    await pageUntil(page, () => document.querySelector('[data-area="Inbox"] [data-count]')?.textContent === '0', 'phone attention count updates');
    assert.equal(await page.locator('[data-area="Topics"] [data-count]').textContent(), '0');
  }, undefined, { phone: true });
});
