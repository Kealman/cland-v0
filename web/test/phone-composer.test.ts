// Web: touch composer through sealed phone/browser, public frames and fake recipients.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright-core';
import { connectUi, inProcessSpoke } from '../../hub/test/harness.ts';
import { seedItem } from './items-fixture.ts';
import { pageUntil, webFixture } from './harness.ts';
import type { HarnessProcessView, TopicMessage } from '../../shared/wire/index.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import { until } from '../../hub/test/until.ts';

async function composerFixture(t: Parameters<typeof webFixture>[0]) {
  const clock = new FakeClock();
  const fixture = await webFixture(t, { clock, prepare: root => seedItem(root, 'T-1', 'task', 'Phone composer') });
  const ui = await connectUi(t, fixture.hub.discovery);
  await ui.request({ type: 'subscribe' });
  const coordinator = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', role: 'coordinator', sessionId: 'phone-composer-coord' });
  await coordinator.waitForPresence(['coord']);
  const made = await ui.request({ type: 'topic.create', title: 'Phone composer', item: 'T-1' });
  assert.equal(made.ok, true, made.error);
  return { ...fixture, ui, coordinator, clock, topic: (made.value as { topic: { id: string } }).topic.id };
}

async function thread(page: Page, topic: string) {
  await page.getByRole('button', { name: 'Topics', exact: true }).tap();
  await page.locator(`[data-object-id="${topic}"]`).tap();
  const form = page.getByRole('form', { name: 'Composer', exact: true });
  await form.waitFor();
  return form;
}

test('phone composer docks two rows of 44 px controls above the bar with the default Coordinator', async t => {
  const fixture = await composerFixture(t);
  await fixture.pageCase(t, async page => {
    const form = await thread(page, fixture.topic);
    const kind = form.getByRole('button', { name: 'Message', exact: true });
    const address = form.getByRole('button', { name: 'Choose addressee', exact: true });
    const field = form.getByRole('textbox', { name: 'Message text', exact: true });
    const send = form.getByRole('button', { name: 'Send', exact: true });
    assert.match(await address.innerText(), /coord.*Coordinator/s);
    const boxes = await Promise.all([kind, address, field, send].map(control => control.boundingBox()));
    for (const box of boxes) assert.ok(box && box.height >= 44 && box.width >= 44, `touch target ${JSON.stringify(box)}`);
    const [k, a, f, s] = boxes.map(box => box!);
    assert.equal(k!.y, a!.y, 'kind and addressee share row one');
    assert.equal(f!.y, s!.y, 'field and Send share row two');
    assert.ok(k!.y + k!.height <= f!.y);
    assert.ok(a!.x >= k!.x + k!.width);
    assert.ok(s!.x >= f!.x + f!.width);
    const formBox = (await form.boundingBox())!;
    const bar = (await page.getByRole('navigation', { name: 'Phone areas' }).boundingBox())!;
    assert.ok(Math.abs(formBox.y + formBox.height - bar.y) < 1, 'composer docks immediately above the bar');
    assert.equal(await form.getByRole('button', { name: 'Attach an artifact', exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  }, undefined, { phone: true });
});

async function physical(page: Page, code: string, modifiers: { metaKey?: boolean; shiftKey?: boolean } = {}) {
  await page.evaluate(({ code, modifiers }) => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { code, key: 'я', bubbles: true, cancelable: true, ...modifiers })), { code, modifiers });
}

test('phone addressee can be cleared in row one and stays implicit after reload', async t => {
  const fixture = await composerFixture(t);
  const worker = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'worker', sessionId: 'phone-clear-worker' });
  await worker.waitForPresence(['coord', 'worker']);
  const sends: Array<{ text: string; to?: string[] }> = [];
  await fixture.pageCase(t, async page => {
    const form = await thread(page, fixture.topic);
    const address = form.getByRole('button', { name: 'Choose addressee', exact: true });
    const field = form.getByRole('textbox', { name: 'Message text' });
    await address.tap();
    await page.getByRole('combobox', { name: 'Search palette' }).fill('@worker');
    await page.getByRole('option').filter({ hasText: 'worker' }).tap();
    await field.fill('@coord Hub addressing after clear');
    await page.reload();
    await form.waitFor();
    assert.equal(await address.innerText(), 'worker', 'chosen addressee survives reload');
    const clear = form.getByRole('button', { name: 'Remove worker', exact: true });
    const clearBox = (await clear.boundingBox())!;
    const addressBox = (await address.boundingBox())!;
    assert.ok(clearBox.height >= 44 && clearBox.width >= 44);
    assert.equal(clearBox.y, addressBox.y, 'clear stays in the addressing row');
    assert.ok(clearBox.y + clearBox.height <= (await field.boundingBox())!.y);
    await clear.tap();
    assert.equal(await address.innerText(), '@');
    await page.reload();
    await form.waitFor();
    assert.equal(await address.innerText(), '@', 'explicit clearing survives reload instead of restoring the item default');
    assert.equal(await field.inputValue(), '@coord Hub addressing after clear');
    assert.deepEqual(sends, [], 'reload never submits the draft');
    const delivered = fixture.coordinator.waitForEvent(event => event.params.content === '@coord Hub addressing after clear');
    await form.getByRole('button', { name: 'Send', exact: true }).tap();
    assert.equal((await delivered).params.content, '@coord Hub addressing after clear');
    await form.locator('[data-pending-message]').waitFor({ state: 'detached' });
    assert.deepEqual(sends, [{ text: '@coord Hub addressing after clear' }], 'hub chooses the recipient without an explicit to');
    const history = await fixture.ui.request({ type: 'topic.history', topic: fixture.topic });
    assert.equal(history.ok, true, history.error);
    assert.deepEqual((history.value as { messages: TopicMessage[] }).messages.find(row => row.text === '@coord Hub addressing after clear')?.to, ['coord']);
    assert.equal(worker.events.some(event => event.params.content === '@coord Hub addressing after clear'), false);
  }, page => { page.on('websocket', socket => socket.on('framesent', event => { const frame = JSON.parse(String(event.payload)); if (frame.type === 'topic.send') sends.push({ text: frame.text, ...(frame.to ? { to: frame.to } : {}) }); })); }, { phone: true });
});

test('phone Return chords break the line and only Send delivers the multiline message', async t => {
  const fixture = await composerFixture(t);
  const sends: string[] = [];
  await fixture.pageCase(t, async page => {
    const form = await thread(page, fixture.topic);
    const field = form.getByRole('textbox', { name: 'Message text' });
    for (const modifiers of [{}, { shiftKey: true }, { metaKey: true }]) {
      await field.fill('first last');
      await field.evaluate(node => (node as HTMLTextAreaElement).setSelectionRange(5, 6));
      await physical(page, 'Enter', modifiers);
      assert.equal(await field.inputValue(), 'first\nlast');
    }
    assert.deepEqual(sends, []);
    const before = await fixture.ui.request({ type: 'topic.history', topic: fixture.topic });
    assert.equal(before.ok, true, before.error);
    assert.deepEqual((before.value as { messages: TopicMessage[] }).messages.filter(row => row.fromKind === 'human'), []);
    await physical(page, 'Backquote', { shiftKey: true });
    assert.equal(await page.getByRole('dialog', { name: 'Palette', exact: true }).count(), 0, 'artifact shortcut stays desktop-only');
    await physical(page, 'KeyK', { metaKey: true });
    const search = page.getByRole('combobox', { name: 'Search palette' });
    await search.fill('>New line');
    assert.deepEqual((await page.getByRole('option').locator('kbd').innerText()).split(' / ').sort(), ['Enter', '⇧Enter', '⌘Enter'].sort(), 'palette keys match the phone composer map');
    await search.fill('>Send message');
    assert.deepEqual(await page.getByRole('dialog', { name: 'Palette', exact: true }).getByRole('option').allTextContents(), []);
    await search.fill('>Attach an artifact');
    assert.equal(await page.getByRole('dialog', { name: 'Palette', exact: true }).getByRole('option').count(), 0);
    await page.keyboard.press('Escape');
    const delivered = fixture.coordinator.waitForEvent(event => event.params.content === 'first\nlast');
    await form.getByRole('button', { name: 'Send', exact: true }).tap();
    assert.equal((await delivered).params.content, 'first\nlast');
    const history = await fixture.ui.request({ type: 'topic.history', topic: fixture.topic });
    assert.equal(history.ok, true, history.error);
    assert.deepEqual((history.value as { messages: TopicMessage[] }).messages.filter(row => row.fromKind === 'human').map(row => [row.text, row.kind, row.to]), [['first\nlast', 'message', ['coord']]]);
    assert.equal(sends.length, 1);
  }, page => { page.on('websocket', socket => socket.on('framesent', event => { const frame = JSON.parse(String(event.payload)); if (frame.type === 'topic.send') sends.push(frame.text); })); }, { phone: true });
});

test('phone kind chip opens a checked inline sheet that lifts history and sends Question', async t => {
  const fixture = await composerFixture(t);
  await fixture.pageCase(t, async page => {
    const form = await thread(page, fixture.topic);
    const log = page.getByRole('log', { name: 'Phone composer thread', exact: true });
    const before = (await log.boundingBox())!;
    const chip = form.locator('button[aria-expanded]');
    await chip.tap();
    assert.equal(await chip.getAttribute('aria-expanded'), 'true');
    const sheet = form.getByRole('group', { name: 'Send kind', exact: true });
    await sheet.waitFor();
    assert.deepEqual(await sheet.getByRole('button').allTextContents(), ['Message✓', 'Decision', 'Question']);
    assert.deepEqual(await sheet.getByRole('button').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-pressed'))), ['true', 'false', 'false']);
    for (const option of await sheet.getByRole('button').all()) assert.ok((await option.boundingBox())!.height >= 44);
    const bounds = (await sheet.boundingBox())!;
    const after = (await log.boundingBox())!;
    assert.ok(Math.abs(before.height - after.height - bounds.height - 8) < 1, 'inline sheet takes space from history including its row gap');
    assert.ok(bounds.y >= after.y + after.height && bounds.y + bounds.height <= (await chip.boundingBox())!.y);
    assert.equal(await page.locator('dialog[open], [data-bottom-sheet]').count(), 0, 'no modal or scrim');
    assert.equal(await log.evaluate(node => document.elementFromPoint(20, node.getBoundingClientRect().y + 10) === node || node.contains(document.elementFromPoint(20, node.getBoundingClientRect().y + 10))), true, 'history stays reachable');
    await sheet.getByRole('button', { name: 'Question', exact: true }).tap();
    await sheet.waitFor({ state: 'detached' });
    const questionChip = form.locator('button[aria-expanded]');
    assert.equal(await questionChip.innerText(), 'Question');
    assert.equal(await questionChip.getAttribute('aria-expanded'), 'false');
    await questionChip.tap();
    assert.equal(await sheet.getByRole('button', { name: 'Question', exact: true }).getAttribute('aria-pressed'), 'true');
    await questionChip.tap();
    await form.getByRole('textbox', { name: 'Message text' }).fill('Phone question receipt');
    const delivered = fixture.coordinator.waitForEvent(event => event.params.content === 'Phone question receipt');
    await form.getByRole('button', { name: 'Send', exact: true }).tap();
    await delivered;
    const history = await fixture.ui.request({ type: 'topic.history', topic: fixture.topic });
    assert.equal(history.ok, true, history.error);
    assert.equal((history.value as { messages: TopicMessage[] }).messages.find(row => row.text === 'Phone question receipt')?.kind, 'question');
    await form.locator('[data-pending-message]').waitFor({ state: 'detached' });
    await questionChip.tap();
    await page.screenshot({ path: 'web/test-results/phone-composer.png' });
  }, undefined, { phone: true });
});

test('phone queued messages show 44 px Withdraw below the text and restore only on receipt until the turn starts', async t => {
  const fixture = await composerFixture(t);
  const launched = await fixture.ui.request({ type: 'session.launch', name: 'worker', role: 'implementer', harness: 'claude-code' });
  assert.equal(launched.ok, true, launched.error);
  const process = (launched.value as { process: HarnessProcessView }).process;
  const fake = fixture.fakes['claude-code']!;
  const worker = await inProcessSpoke(t, { clock: fixture.clock, discover: true, cwd: fixture.root, name: 'worker', sessionId: process.sessionId, launchToken: fake.spawns[0]!.launchToken! });
  await worker.waitForPresence(['worker']);
  fake.busy('worker');
  let release: (() => void) | undefined;
  await fixture.pageCase(t, async page => {
    const form = await thread(page, fixture.topic);
    await form.getByRole('button', { name: 'Choose addressee', exact: true }).tap();
    await page.getByRole('combobox', { name: 'Search palette' }).fill('@worker');
    await page.getByRole('option').filter({ hasText: 'worker' }).tap();
    assert.equal(await form.getByRole('button', { name: 'Choose addressee', exact: true }).innerText(), 'worker');
    const field = form.getByRole('textbox', { name: 'Message text' });
    await field.fill('Queued phone original');
    const posted = fixture.ui.waitFor(f => f.type === 'message' && (f.message as TopicMessage).text === 'Queued phone original');
    await form.getByRole('button', { name: 'Send', exact: true }).tap();
    const message = (await posted).message as TopicMessage;
    const row = page.locator(`[data-message-id="${message.id}"]`);
    const withdraw = row.getByRole('button', { name: 'Withdraw', exact: true });
    await withdraw.waitFor();
    const text = (await row.getByText('Queued phone original', { exact: true }).boundingBox())!;
    const queued = (await row.locator('[data-delivery-stage]').boundingBox())!;
    const target = (await withdraw.boundingBox())!;
    assert.equal(await row.locator('[data-delivery-stage]').innerText(), 'queued');
    assert.ok(target.height >= 44 && target.width >= 44);
    assert.ok(queued.y >= text.y + text.height && target.y >= text.y + text.height, 'queue and Withdraw sit below text');
    await form.locator('[data-pending-message]').waitFor({ state: 'detached' });
    const withdrawn = fixture.ui.waitFor(f => f.type === 'delivery' && f.message === message.id && f.stage === 'withdrawn');
    await withdraw.tap();
    await withdrawn;
    await until(() => !!release, { what: 'phone withdrawal successful receipt held', timeoutMs: 3000 });
    assert.equal(await row.getByRole('button', { name: 'Withdrawing', exact: true }).isDisabled(), true);
    assert.equal(await field.inputValue(), '');
    await field.fill('Newer phone draft');
    release!();
    await pageUntil(page, () => (document.querySelector('[aria-label="Message text"]') as HTMLTextAreaElement)?.value === 'Queued phone original\nNewer phone draft', 'receipt restores withdrawn phone text before newer typing');
    assert.equal(await row.locator('[data-delivery-stage]').innerText(), 'withdrawn');
    assert.equal(await row.getByRole('button').count(), 0);
    const next = await fixture.ui.request({ type: 'topic.send', topic: fixture.topic, to: ['worker'], text: 'Phone next turn' });
    assert.equal(next.ok, true, next.error);
    const nextId = (next.value as { message: TopicMessage }).message.id;
    const nextRow = page.locator(`[data-message-id="${nextId}"]`);
    await nextRow.getByRole('button', { name: 'Withdraw', exact: true }).waitFor();
    const injected = fixture.ui.waitFor(f => f.type === 'delivery' && f.message === nextId && f.stage === 'injected');
    fake.idle('worker');
    await injected;
    await pageUntil(page, () => [...document.querySelectorAll('[data-delivery-stage]')].some(node => node.textContent === 'injected'), 'phone message submission rendered');
    assert.equal(await nextRow.locator('[data-delivery-stage]').innerText(), 'injected');
    assert.equal(await nextRow.getByRole('button', { name: 'Withdraw', exact: true }).count(), 0);
    assert.equal(fake.injections.some(row => row.message.id === message.id), false);
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      let withdrawal = '';
      route.onMessage(payload => { const frame = JSON.parse(String(payload)); if (frame.type === 'topic.withdraw') withdrawal = frame.id; server.send(payload); });
      server.onMessage(payload => { const frame = JSON.parse(String(payload)); if (frame.type === 'result' && frame.id === withdrawal) { assert.equal(frame.ok, true, frame.error); release = () => route.send(payload); } else route.send(payload); });
    });
  }, { phone: true });
});

test('phone per-topic drafts survive navigation and reload with their chosen kind', async t => {
  const fixture = await composerFixture(t);
  const made = await fixture.ui.request({ type: 'topic.create', title: 'Other phone draft' });
  assert.equal(made.ok, true, made.error);
  const other = (made.value as { topic: { id: string } }).topic.id;
  await fixture.pageCase(t, async page => {
    const form = await thread(page, fixture.topic);
    const field = form.getByRole('textbox', { name: 'Message text' });
    await field.fill('Phone draft\nkept across reload');
    await form.locator('button[aria-expanded]').tap();
    await form.getByRole('group', { name: 'Send kind' }).getByRole('button', { name: 'Decision', exact: true }).tap();
    await page.getByRole('button', { name: 'Back to Topics', exact: true }).tap();
    await page.locator(`[data-object-id="${other}"]`).tap();
    await field.fill('Other draft');
    await form.locator('button[aria-expanded]').tap();
    await form.getByRole('group', { name: 'Send kind' }).getByRole('button', { name: 'Question', exact: true }).tap();
    await page.getByRole('button', { name: 'Back to Topics', exact: true }).tap();
    await page.locator(`[data-object-id="${fixture.topic}"]`).tap();
    assert.equal(await field.inputValue(), 'Phone draft\nkept across reload');
    assert.equal(await form.locator('button[aria-expanded]').innerText(), 'Decision');
    await page.reload();
    await form.waitFor();
    assert.equal(await field.inputValue(), 'Phone draft\nkept across reload');
    assert.equal(await form.locator('button[aria-expanded]').innerText(), 'Decision');
    await page.getByRole('button', { name: 'Back to Topics', exact: true }).tap();
    await page.locator(`[data-object-id="${other}"]`).tap();
    assert.equal(await field.inputValue(), 'Other draft');
    assert.equal(await form.locator('button[aria-expanded]').innerText(), 'Question');
    for (const topic of [fixture.topic, other]) {
      const history = await fixture.ui.request({ type: 'topic.history', topic });
      assert.equal(history.ok, true, history.error);
      assert.deepEqual((history.value as { messages: TopicMessage[] }).messages.filter(row => row.fromKind === 'human'), [], 'reload never submits a draft');
    }
  }, undefined, { phone: true });
});
