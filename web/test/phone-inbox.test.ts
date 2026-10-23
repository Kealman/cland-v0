// Web: phone Inbox through public hub frames and the sealed touch browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, inProcessSpoke } from '../../hub/test/harness.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import type { Inbox } from '../../shared/wire/index.ts';
import { webFixture, pageUntil } from './harness.ts';
import { seedItem } from './items-fixture.ts';

test('phone Inbox keeps four touch folds and changes its empty title for a live ask', async t => {
  const clock = new FakeClock(new Date('2026-10-23T12:00:00Z'));
  const fixture = await webFixture(t, { clock });
  const sender = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', role: 'coordinator', sessionId: 'phone-home-coord' });
  await sender.waitForPresence(['coord']);
  await fixture.pageCase(t, async page => {
    const inbox = page.getByRole('list', { name: 'Inbox objects', exact: true });
    const title = page.locator('[data-pane="primary"] > [data-fold-block] > header');
    await inbox.waitFor();
    await pageUntil(page, () => document.querySelector('[data-pane="primary"] > [data-fold-block] > header')?.textContent?.includes('Nothing needs you') === true, 'empty phone title');
    assert.match(await title.innerText(), /Inbox.*✓ Nothing needs you/s);
    assert.equal(await inbox.locator('[data-inbox-events]').isVisible(), true);
    assert.equal(await inbox.locator('[data-inbox-archive-toggle]').isVisible(), true);
    assert.deepEqual(await inbox.getByRole('heading').allTextContents(), ['Asks and approvals', 'Plan approvals', 'Requests to you', 'Messages to you']);
    assert.equal(await inbox.locator('[data-inbox-empty]').count(), 4);
    const sections = inbox.locator('[data-inbox-section]');
    for (const section of await sections.all()) {
      const fold = section.locator('[data-fold-toggle]');
      const button = (await fold.boundingBox())!, box = (await section.boundingBox())!;
      assert.ok(button.height >= 44, `${await fold.getAttribute('aria-label')}: ${button.height} px`);
      assert.equal(Math.round(button.width), Math.round(box.width), 'whole section header is tappable');
      assert.equal(await section.locator('header > span').innerText(), '0');
    }
    const messages = inbox.getByRole('button', { name: 'Fold Messages to you', exact: true });
    await messages.tap();
    await page.reload();
    await messages.waitFor();
    assert.equal(await messages.getAttribute('aria-expanded'), 'false', 'phone fold survives reload');
    const asked = await sender.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'A phone decision?', options: ['One', 'Two'] });
    assert.equal(asked.ok, true);
    await clock.advance(250);
    await inbox.locator(`[data-object-id="${asked.ask}"]`).waitFor();
    assert.match(await title.innerText(), /1 need you/);
    assert.doesNotMatch(await title.innerText(), /Nothing needs you/);
    assert.equal(await sections.first().locator('header > span').innerText(), '1');
  }, undefined, { phone: true });
});

test('phone message and request replies unfold inline, share topic drafts and reach the sender', async t => {
  const clock = new FakeClock(new Date('2026-10-23T12:00:00Z'));
  const fixture = await webFixture(t, { clock });
  const ui = await connectUi(t, fixture.hub.discovery);
  const sender = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', role: 'coordinator', sessionId: 'phone-reply-coord' });
  await sender.waitForPresence(['coord']);
  const created = await ui.request({ type: 'topic.create', title: 'Phone replies' });
  assert.equal(created.ok, true);
  const topic = (created.value as { topic: { id: string } }).topic.id;
  for (const frame of [
    { topic, kind: 'decision', text: 'Phone report\nComplete report text' },
    { topic: 'general', kind: 'request', request: 'handover', subject: 'coord', text: 'Phone request\nComplete request text' },
  ]) assert.equal((await sender.call<{ ok: boolean }>('send', frame)).ok, true);
  const listed = await ui.request({ type: 'inbox.list' });
  assert.equal(listed.ok, true);
  const message = (listed.value as Inbox).messages.find(row => row.text.startsWith('Phone report'))!.id;
  const request = (listed.value as Inbox).requests.find(row => row.text.startsWith('Phone request'))!.id;
  await fixture.pageCase(t, async page => {
    const inbox = page.getByRole('list', { name: 'Inbox objects', exact: true });
    const row = inbox.locator(`[data-object-id="${message}"]`);
    await row.waitFor();
    const lines = await row.evaluate(node => [...node.children].map(child => ({ text: child.textContent, top: child.getBoundingClientRect().top, bottom: child.getBoundingClientRect().bottom, left: child.getBoundingClientRect().left, right: child.getBoundingClientRect().right })));
    const preview = lines.find(line => line.text === 'Phone report')!;
    const senderLine = lines.find(line => line.text === 'coord')!;
    assert.ok(preview.top >= senderLine.bottom, 'preview is on the second line');
    assert.ok(lines.every(line => line.left >= 0 && line.right <= 390), 'row facts fit the phone');
    await row.tap();
    const detail = row.locator('..');
    const field = detail.getByRole('textbox', { name: 'Message text', exact: true });
    await field.waitFor();
    assert.equal(await field.getAttribute('rows'), '1');
    assert.match(await detail.innerText(), /Complete report text/);
    assert.match(await detail.locator('[data-composer-recipient]').innerText(), /coord/);
    assert.equal(await page.locator('[data-area-surface="drawer"]').count(), 0);
    const focused = pageUntil(page, () => !!document.activeElement?.closest('[data-inbox-reply]'), 'physical r focuses inline reply');
    await row.evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', key: 'я', bubbles: true, cancelable: true })));
    await focused;
    assert.equal(await field.evaluate(node => node === document.activeElement), true);
    await field.fill('Phone draft survives');
    await inbox.locator(`[data-object-id="${request}"]`).tap();
    const requestDetail = inbox.locator(`[data-object-id="${request}"]`).locator('..');
    const requestField = requestDetail.getByRole('textbox', { name: 'Message text', exact: true });
    assert.equal(await requestField.inputValue(), '', 'other topic has its own draft');
    await requestField.fill('Request topic draft');
    await page.reload();
    await requestField.waitFor();
    assert.equal(await requestField.inputValue(), 'Request topic draft');
    await row.tap();
    assert.equal(await field.inputValue(), 'Phone draft survives');
    const delivered = sender.waitForEvent(event => event.params.content === 'Phone draft survives' && event.params.meta?.reply_to === message);
    await detail.getByRole('button', { name: 'Send', exact: true }).tap();
    const receipt = await delivered;
    assert.equal(receipt.params.meta?.topic, topic);
    await clock.advance(250);
    await detail.locator('[data-inbox-outcome]').waitFor();
    assert.match(await detail.innerText(), /answered/);
    assert.equal(await row.isVisible(), false, 'settled message keeps only its folded outcome');
    await inbox.locator(`[data-object-id="${request}"]`).tap();
    assert.equal(await requestField.inputValue(), 'Request topic draft');
    const reply = sender.waitForEvent(event => event.params.content === 'Request topic draft' && event.params.meta?.reply_to === request);
    await requestDetail.getByRole('button', { name: 'Send', exact: true }).tap();
    assert.equal((await reply).params.meta?.topic, 'general');
    await clock.advance(250);
    await requestDetail.locator('[data-inbox-outcome]').waitFor();
    assert.match(await requestDetail.innerText(), /replied/);
    assert.equal(await inbox.locator(`[data-object-id="${request}"]`).isVisible(), false, 'settled request keeps only its folded outcome');
  }, undefined, { phone: true });
});

test('phone waiting plans show their counts without Plan actions and touch footers close the list', async t => {
  const fixture = await webFixture(t, { prepare: async root => {
    await seedItem(root, 'R-900000', 'release', 'Phone release', { version: '99.0.0' });
    await seedItem(root, 'E-900010', 'epic', 'Phone epic', { parent: 'R-900000' });
    await seedItem(root, 'T-900100', 'task', 'Phone task', { parent: 'E-900010' });
    await writeFile(join(root, '.cland/config.toml'), '[plan]\napproval = "human"\n');
  } });
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'task.plan', item: 'E-900010', op: 'set', yaml: 'stages:\n  - name: Build\n    qa: { scope: none, when: after-stage }\n    lanes:\n      - [T-900100]\n' })).ok, true);
  await fixture.pageCase(t, async page => {
    const inbox = page.getByRole('list', { name: 'Inbox objects', exact: true });
    const plan = inbox.locator('[data-object-id="E-900010"]');
    await plan.waitFor();
    assert.match(await plan.innerText(), /1 stages · 1 lanes · 1 items/);
    assert.match(await plan.getAttribute('title') ?? '', /desktop.*Plan/i);
    await plan.tap();
    await plan.press('Enter');
    assert.equal(await page.locator('main').getAttribute('aria-label'), 'Inbox');
    assert.equal(await page.getByRole('button', { name: /Open Plan|Approve/ }).count(), 0);
    const events = inbox.locator('[data-inbox-events]');
    const archive = inbox.locator('[data-inbox-archive-toggle]');
    for (const control of [events, archive]) assert.ok((await control.boundingBox())!.height >= 44, `${await control.innerText()} fits touch`);
    assert.deepEqual(await inbox.locator(':scope > button').evaluateAll(nodes => nodes.map(node => node.hasAttribute('data-inbox-events') ? 'events' : node.hasAttribute('data-inbox-archive-toggle') ? 'archive' : 'other')), ['events', 'archive']);
    await archive.tap();
    await inbox.getByRole('list', { name: 'Inbox archive', exact: true }).waitFor();
    assert.equal(await archive.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('main').getAttribute('aria-label'), 'Inbox');
    await events.tap();
    await page.getByRole('list', { name: 'Events objects', exact: true }).waitFor();
    assert.equal(await page.locator('main').getAttribute('aria-label'), 'Events');
  }, undefined, { phone: true });
});
