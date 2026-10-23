// Web: phone asks through sealed touch/browser, public frames and fake asker receipts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { connectUi, inProcessSpoke } from '../../hub/test/harness.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import { webFixture, pageUntil } from './harness.ts';
import { askHubFrame } from '../../hub/src/cli/socket-client.ts';
import { until } from '../../hub/test/until.ts';
import type { Page } from 'playwright-core';

async function fixtureFor(t: Parameters<typeof webFixture>[0]) {
  const clock = new FakeClock(new Date('2026-10-23T12:00:00Z'));
  const fixture = await webFixture(t, { clock, timezoneId: 'UTC' });
  const ui = await connectUi(t, fixture.hub.discovery);
  const asker = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', role: 'coordinator', sessionId: 'phone-asks-coord' });
  await asker.waitForPresence(['coord']);
  const result = await asker.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Which change should we make on the phone?', options: ['Keep', 'Change', 'Wait'], free: true });
  assert.equal(result.ok, true);
  await clock.advance(250);
  return { ...fixture, ui, asker, clock, id: result.ask };
}
const sheet = (page: Page) => page.getByRole('dialog', { name: 'Answer ask', exact: true });
const row = (page: Page, id: string) => page.getByRole('list', { name: 'Inbox objects', exact: true }).locator(`[data-object-id="${id}"]`);

test('phone ask row opens a numbered touch sheet with header facts and a free answer', async t => {
  const fixture = await fixtureFor(t);
  await fixture.pageCase(t, async page => {
    await row(page, fixture.id).tap();
    const dialog = sheet(page);
    await dialog.waitFor();
    assert.equal(await row(page, fixture.id).getAttribute('aria-pressed'), 'true');
    assert.equal(await dialog.getByRole('heading', { name: 'Which change should we make on the phone?', exact: true }).count(), 1);
    assert.match(await dialog.locator('header').innerText(), /General.*coord/s);
    assert.equal(await dialog.locator('header time').getAttribute('datetime'), '2026-10-23T12:00:00.000Z');
    assert.equal(await dialog.getByRole('link', { name: 'Open thread', exact: true }).count(), 1);
    assert.deepEqual(await dialog.locator('[data-ask-option]').allTextContents(), ['1 Keep', '2 Change', '3 Wait']);
    for (const option of await dialog.locator('[data-ask-option]').all()) {
      const box = (await option.boundingBox())!;
      assert.ok(box.height >= 48, `${box.height} px option`);
      assert.ok(box.width >= 350, `${box.width} px full-width option`);
    }
    assert.equal(await dialog.getByRole('textbox', { name: 'Free answer', exact: true }).count(), 1);
    assert.equal(await dialog.getByRole('button', { name: 'Send answer', exact: true }).isDisabled(), true);
    const bounds = await dialog.evaluate(node => ({ bottom: node.getBoundingClientRect().bottom, viewport: visualViewport!.offsetTop + visualViewport!.height }));
    assert.ok(Math.abs(bounds.bottom - bounds.viewport) < 1, 'sheet sits on visual viewport bottom');
  }, undefined, { phone: true });
});

test('focused phone free answer follows a resized visual viewport with three-line question and 44 px options', async t => {
  const fixture = await fixtureFor(t);
  const question = 'Which change on this very long phone decision should we make? '.repeat(8);
  const asked = await fixture.asker.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question, options: ['Keep', 'Change', 'Wait'], free: true });
  assert.equal(asked.ok, true);
  await fixture.clock.advance(250);
  await fixture.pageCase(t, async page => {
    await row(page, asked.ask).tap();
    const dialog = sheet(page);
    await dialog.getByRole('textbox', { name: 'Free answer', exact: true }).focus();
    await page.setViewportSize({ width: 390, height: 500 });
    await pageUntil(page, () => document.querySelector('[data-phone]') !== null && visualViewport!.height === 500 && Math.abs(document.querySelector('[data-bottom-sheet]')!.getBoundingClientRect().bottom - (visualViewport!.offsetTop + visualViewport!.height)) < 1, 'sheet follows the resized phone visual viewport');
    const questionStyle = await dialog.locator('h3').evaluate(node => ({ clamp: getComputedStyle(node).webkitLineClamp, height: node.getBoundingClientRect().height, line: parseFloat(getComputedStyle(node).lineHeight) }));
    assert.equal(questionStyle.clamp, '3');
    assert.ok(questionStyle.height <= questionStyle.line * 3 + 1, 'question occupies at most three lines');
    for (const option of await dialog.locator('[data-ask-option]').all()) assert.equal((await option.boundingBox())!.height, 44);
    assert.ok((await dialog.getByRole('button', { name: 'Send answer', exact: true }).boundingBox())!.y < 500, 'send remains in view');
    await dialog.getByRole('button', { name: 'Close sheet', exact: true }).tap();
    await sheet(page).waitFor({ state: 'hidden' });
    await page.setViewportSize({ width: 390, height: 844 });
    await row(page, asked.ask).tap();
    for (const option of await sheet(page).locator('[data-ask-option]').all()) assert.ok((await option.boundingBox())!.height >= 48, 'fresh opening has the unfocused option size');
  }, undefined, { phone: true });
});

test('phone Decline shares the label row, needs a reason and delivers the unchanged decline', async t => {
  const fixture = await fixtureFor(t);
  await fixture.pageCase(t, async page => {
    await row(page, fixture.id).tap();
    const dialog = sheet(page);
    const field = dialog.getByRole('textbox', { name: 'Free answer', exact: true });
    const toggle = dialog.getByRole('button', { name: 'Decline', exact: true });
    const labelBounds = (await dialog.locator('label').boundingBox())!;
    const fieldBounds = (await field.boundingBox())!;
    const toggleBounds = (await toggle.boundingBox())!;
    assert.ok(toggleBounds.y <= labelBounds.y && toggleBounds.y + toggleBounds.height >= labelBounds.y + labelBounds.height && toggleBounds.y + toggleBounds.height <= fieldBounds.y, 'Decline is alongside the field label, above the field');
    await field.fill('Keep my answer');
    await toggle.tap();
    const reason = dialog.getByRole('textbox', { name: 'Reason', exact: true });
    const decline = dialog.locator('[data-ask-send]');
    assert.equal(await decline.innerText(), 'Decline');
    assert.equal(await decline.isDisabled(), true);
    await reason.fill('   ');
    assert.equal(await decline.isDisabled(), true);
    const colour = await decline.evaluate(node => ({ colour: getComputedStyle(node).color, failed: getComputedStyle(node).getPropertyValue('--failed').trim() }));
    const expectedColour = await decline.evaluate(node => { const probe = document.createElement('span'); probe.style.color = 'var(--failed)'; node.append(probe); const colour = getComputedStyle(probe).color; probe.remove(); return colour; });
    assert.equal(colour.colour, expectedColour, 'decline uses the danger text token');
    await dialog.getByRole('button', { name: 'Answer instead', exact: true }).tap();
    assert.equal(await field.inputValue(), 'Keep my answer');
    await dialog.locator('[data-ask-decline]').tap();
    await reason.fill('Wait for QA');
    const delivered = fixture.asker.waitForEvent(event => event.params.meta?.answer_to === fixture.id);
    await decline.tap();
    const receipt = await delivered;
    assert.equal(receipt.params.content, 'declined: Wait for QA');
    await dialog.waitFor({ state: 'hidden' });
    const folded = page.getByRole('list', { name: 'Inbox objects', exact: true }).locator(`[data-ask-id="${fixture.id}"]`);
    await folded.locator('[data-ask-outcome]').waitFor();
    assert.match(await folded.innerText(), /Declined: Wait for QA.*human/s);
    const topics = await fixture.ui.request({ type: 'topic.list' });
    assert.equal(topics.ok, true);
    assert.notEqual((topics.value as { topics: Array<{ id: string; status: string }> }).topics.find(topic => topic.id === 'general')!.status, 'closed');
  }, undefined, { phone: true });
});

async function physical(page: Page, code: string) {
  await page.evaluate(code => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { code, key: 'я', bubbles: true, cancelable: true })), code);
}

test('phone sheet Escape, close, scrim and a touch swipe never answer or decline an ask', async t => {
  const fixture = await fixtureFor(t);
  const sent: string[] = [];
  const assertOpen = async () => {
    const history = await fixture.ui.request({ type: 'topic.history', topic: 'general' });
    assert.equal(history.ok, true);
    assert.equal((history.value as { messages: Array<{ id: string; ask?: { state: string } }> }).messages.find(message => message.id === fixture.id)?.ask?.state, 'open');
  };
  await fixture.pageCase(t, async page => {
    for (const method of ['Escape from field', 'Escape from option', 'close', 'scrim']) {
      await row(page, fixture.id).tap();
      const dialog = sheet(page);
      await dialog.waitFor();
      if (method === 'Escape from field') {
        await dialog.getByRole('textbox', { name: 'Free answer', exact: true }).fill('Do not send this');
        await physical(page, 'Escape');
      } else if (method === 'Escape from option') {
        await dialog.locator('[data-ask-option="1"]').focus();
        await physical(page, 'Escape');
      } else if (method === 'close') await dialog.getByRole('button', { name: 'Close sheet', exact: true }).tap();
      else await page.touchscreen.tap(10, 10);
      await dialog.waitFor({ state: 'hidden' });
      await assertOpen();
      assert.equal(await row(page, fixture.id).getAttribute('aria-pressed'), 'true', method);
      assert.equal(await row(page, fixture.id).evaluate(node => node === document.activeElement), true, 'focus returns to the selected row');
    }
    await row(page, fixture.id).tap();
    const dialog = sheet(page);
    const question = (await dialog.locator('h3').boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 190, y: question.y + 5 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 190, y: question.y + 70 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally { await cdp.detach(); }
    assert.equal(await dialog.isVisible(), true, 'swipe has no sheet gesture');
    await assertOpen();
    assert.deepEqual(sent, [], 'no answer frame on dismissal or swipe');
  }, page => { page.on('websocket', socket => socket.on('framesent', event => { const frame = JSON.parse(String(event.payload)); if (frame.type === 'topic.answer') sent.push(frame.type); })); }, { phone: true });
});

test('a second phone context answers, closing the first sheet and retaining its outcome until Inbox departure', async t => {
  const fixture = await fixtureFor(t);
  let departed = false;
  await fixture.pageCase(t, async first => {
    await row(first, fixture.id).tap();
    await sheet(first).waitFor();
    const secondContext = await fixture.browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, timezoneId: 'UTC', serviceWorkers: 'block' });
    secondContext.setDefaultTimeout(3000);
    try {
      const { url } = await askHubFrame(fixture.hub.discovery, { type: 'web.link' }, 3000, {}) as { url: string };
      const second = await secondContext.newPage();
      await second.goto(url);
      await second.locator('nav[aria-label="Phone areas"]').waitFor();
      assert.notDeepEqual(await first.context().cookies(), await secondContext.cookies(), 'independent signed-in contexts');
      await row(second, fixture.id).tap();
      const folded = first.getByRole('list', { name: 'Inbox objects', exact: true }).locator(`[data-ask-id="${fixture.id}"]`);
      const hidden = sheet(first).waitFor({ state: 'hidden' }); void hidden.catch(() => {});
      const outcome = folded.locator('[data-ask-outcome]').waitFor(); void outcome.catch(() => {});
      const delivered = fixture.asker.waitForEvent(event => event.params.meta?.answer_to === fixture.id);
      await sheet(second).locator('[data-ask-option="2"]').tap();
      assert.equal((await delivered).params.content, 'Change');
      await hidden;
      await outcome;
      assert.match(await folded.innerText(), /2 Change.*human/s);
      assert.equal(await folded.locator('time').getAttribute('datetime'), '2026-10-23T12:00:00.250Z');
      assert.ok((await folded.boundingBox())!.height < 40, 'one-line outcome');
      await fixture.clock.advance(250);
      await until(() => departed, { what: 'confirmed departure delivered to first phone', timeoutMs: 3000 });
      await first.getByRole('button', { name: 'Fold Asks and approvals', exact: true }).focus();
      assert.equal(await folded.isVisible(), true, 'same Inbox visit retains outcome after departure');
      await first.getByRole('button', { name: 'Topics', exact: true }).tap();
      await first.getByRole('list', { name: 'Topics objects', exact: true }).waitFor();
      await first.getByRole('button', { name: 'Inbox', exact: true }).tap();
      await first.getByRole('list', { name: 'Inbox objects', exact: true }).waitFor();
      assert.equal(await folded.count(), 0, 'leaving the Inbox removes settled rows');
      await first.locator('[data-inbox-archive-toggle]').tap();
      await first.getByRole('list', { name: 'Inbox archive', exact: true }).getByText('Which change should we make on the phone?', { exact: false }).waitFor();
    } finally { await secondContext.close(); }
  }, page => { page.on('websocket', socket => socket.on('framereceived', event => { const frame = JSON.parse(String(event.payload)); if (frame.type === 'inbox' && frame.inbox.departures?.some((row: { id: string }) => row.id === fixture.id)) departed = true; })); }, { phone: true });
});

test('phone thread asks offer Answer and open the same sheet for free answers', async t => {
  const fixture = await fixtureFor(t);
  await fixture.pageCase(t, async page => {
    await row(page, fixture.id).tap();
    await sheet(page).getByRole('link', { name: 'Open thread', exact: true }).tap();
    await sheet(page).waitFor({ state: 'hidden' });
    const log = page.getByRole('log', { name: 'General thread', exact: true });
    const card = log.locator(`[data-ask-id="${fixture.id}"]`);
    await card.waitFor();
    assert.equal(await card.getByRole('heading', { name: 'Which change should we make on the phone?', exact: true }).count(), 1);
    assert.equal(await card.locator('[data-ask-option], input, [data-ask-send]').count(), 0, 'phone thread answers only in its sheet');
    const answer = card.getByRole('button', { name: 'Answer', exact: true });
    assert.ok((await answer.boundingBox())!.height >= 44);
    await answer.tap();
    const dialog = sheet(page);
    await dialog.waitFor();
    assert.deepEqual(await dialog.locator('[data-ask-option]').allTextContents(), ['1 Keep', '2 Change', '3 Wait']);
    await dialog.getByRole('textbox', { name: 'Free answer', exact: true }).fill('Check the phone first');
    const delivered = fixture.asker.waitForEvent(event => event.params.meta?.answer_to === fixture.id);
    await dialog.getByRole('button', { name: 'Send answer', exact: true }).tap();
    assert.equal((await delivered).params.content, 'Check the phone first');
    await dialog.waitFor({ state: 'hidden' });
    await card.locator('[data-ask-outcome]').waitFor();
    assert.match(await card.innerText(), /Check the phone first.*human/s);
  }, undefined, { phone: true });
});
