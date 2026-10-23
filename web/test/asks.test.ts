// Web: shared ask cards through authenticated clients and a sealed fake asker.
import test from 'node:test';
import assert from 'node:assert/strict';
import { connectUi, inProcessSpoke } from '../../hub/test/harness.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import { pageUntil, webFixture } from './harness.ts';
import type { Page } from 'playwright-core';
import { askHubFrame } from '../../hub/src/cli/socket-client.ts';
import { until } from '../../hub/test/until.ts';

async function physical(page: Page, code: string) {
  await page.evaluate(code => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { code, key: 'я', bubbles: true, cancelable: true })), code);
}

async function askFixture(t: Parameters<typeof webFixture>[0]) {
  const clock = new FakeClock(new Date('2026-10-23T12:00:00Z'));
  const fixture = await webFixture(t, { clock, timezoneId: 'UTC' });
  const ui = await connectUi(t, fixture.hub.discovery);
  const asker = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', role: 'coordinator', sessionId: 'ask-coord' });
  await asker.waitForPresence(['coord']);
  const ask = async (question: string, free = true) => {
    const result = await asker.call<{ ok: boolean; ask: string; error?: string }>('ask', { topic: 'general', question, options: ['Keep', 'Change', 'Wait'], free });
    assert.equal(result.ok, true, result.error);
    await clock.advance(250);
    return result.ask;
  };
  return { ...fixture, get hub() { return fixture.hub; }, clock, ui, asker, ask };
}

async function thread(page: Page) {
  await page.getByRole('button', { name: 'Topics', exact: true }).click();
  await page.locator('[data-object-id="general"]').click();
  return page.getByRole('log', { name: 'General thread', exact: true });
}

test('an ask shares its question and options in thread and Inbox and physical 2 delivers option 2', async t => {
  const fixture = await askFixture(t);
  const id = await fixture.ask('Which change?');
  await fixture.pageCase(t, async page => {
    const log = await thread(page);
    const card = log.locator(`[data-ask-id="${id}"]`);
    await card.waitFor();
    assert.equal(await card.getByRole('heading', { name: 'Which change?' }).count(), 1);
    assert.deepEqual(await card.locator('[data-ask-option]').allTextContents(), ['1 Keep', '2 Change', '3 Wait']);
    await page.getByRole('button', { name: 'Inbox', exact: true }).click();
    const row = page.getByRole('list', { name: 'Inbox objects', exact: true }).locator(`[data-ask-id="${id}"]`);
    await row.waitFor();
    assert.equal(await row.getByRole('heading', { name: 'Which change?' }).count(), 1);
    assert.deepEqual(await row.locator('[data-ask-option]').allTextContents(), ['1 Keep', '2 Change', '3 Wait']);
    const delivered = fixture.asker.waitForEvent(event => event.params.meta?.answer_to === id);
    await row.focus();
    await physical(page, 'Digit2');
    assert.equal((await delivered).params.content, 'Change');
    await row.locator('[data-ask-outcome]').waitFor();
    assert.match(await row.innerText(), /2 Change.*human/s);
    const folded = (await thread(page)).locator(`[data-ask-id="${id}"]`);
    await folded.locator('[data-ask-outcome]').waitFor();
    assert.equal(await folded.locator('button, input').count(), 0);
    assert.equal(await folded.locator('time').getAttribute('datetime'), '2026-10-23T12:00:00.250Z');
  });
});

test('Escape leaves an ask open and d requires a reason, allows Answer instead and delivers a decline', async t => {
  const fixture = await askFixture(t);
  const id = await fixture.ask('May we ship?', false);
  await fixture.pageCase(t, async page => {
    const card = (await thread(page)).locator(`[data-ask-id="${id}"]`);
    await card.focus();
    await physical(page, 'Escape');
    assert.equal(await card.getAttribute('data-ask-state'), 'open');
    const history = await fixture.ui.request({ type: 'topic.history', topic: 'general' });
    assert.equal(history.ok, true, history.error);
    assert.equal((history.value as { messages: Array<{ id: string; ask?: { state: string } }> }).messages.find(row => row.id === id)?.ask?.state, 'open');
    await card.focus();
    await physical(page, 'KeyD');
    const reason = card.getByRole('textbox', { name: 'Reason', exact: true });
    await reason.waitFor();
    const decline = card.getByRole('button', { name: 'Decline', exact: true });
    assert.equal(await decline.isDisabled(), true);
    await reason.fill('   ');
    assert.equal(await decline.isDisabled(), true);
    await card.getByRole('button', { name: 'Answer instead', exact: true }).click();
    assert.equal(await reason.count(), 0);
    assert.equal(await card.getByRole('textbox', { name: 'Free answer', exact: true }).count(), 0, 'free=false still permits decline only');
    await card.focus();
    await physical(page, 'KeyD');
    await reason.fill('Wait for QA');
    const delivered = fixture.asker.waitForEvent(event => event.params.meta?.answer_to === id);
    await decline.click();
    assert.equal((await delivered).params.content, 'declined: Wait for QA');
    await card.locator('[data-ask-outcome]').waitFor();
    assert.match(await card.innerText(), /Declined: Wait for QA.*human/s);
    const topics = await fixture.ui.request({ type: 'topic.list' });
    assert.equal(topics.ok, true, topics.error);
    assert.notEqual((topics.value as { topics: Array<{ id: string; status: string }> }).topics.find(row => row.id === 'general')?.status, 'closed');
  });
});

test('an answer in one browser context folds a second context thread and Inbox to the hub outcome within one second', async t => {
  const fixture = await askFixture(t);
  const id = await fixture.ask('Choose across browsers');
  let completedAt: number | undefined;
  await fixture.pageCase(t, async first => {
    const firstCard = (await thread(first)).locator(`[data-ask-id="${id}"]`);
    await firstCard.waitFor();
    const context = await fixture.browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'UTC', serviceWorkers: 'block' });
    context.setDefaultTimeout(3000);
    try {
      const { url } = await askHubFrame(fixture.hub.discovery, { type: 'web.link' }, 3000, {}) as { url: string };
      const second = await context.newPage();
      let departed = false;
      second.on('websocket', socket => socket.on('framereceived', event => {
        const frame = JSON.parse(String(event.payload));
        if (frame.type === 'inbox' && frame.inbox.departures?.some((row: { id: string }) => row.id === id)) departed = true;
      }));
      await second.goto(url);
      await thread(second);
      await second.locator('[data-object-id="general"]').press('Meta+Enter');
      await second.locator('[data-pane="secondary"] [role="log"]').waitFor();
      await second.locator('[data-pane="primary"]').getByRole('heading', { name: 'Topics', exact: true }).click();
      await second.getByRole('button', { name: 'Inbox', exact: true }).click();
      const cards = second.locator(`[data-ask-id="${id}"]`);
      assert.equal(await cards.count(), 2, 'thread and Inbox are mounted in separate panes');
      assert.notDeepEqual(await first.context().cookies(), await context.cookies(), 'independent sign-ins');
      const rendered = cards.locator('[data-ask-outcome]').nth(1).waitFor(); void rendered.catch(() => {});
      const receipt = until(() => completedAt !== undefined, { what: 'answer success receipt on first browser', timeoutMs: 3000 });
      await firstCard.focus();
      await physical(first, 'Digit2');
      await receipt;
      await until(async () => await cards.locator('[data-ask-outcome]').count() === 2, { what: 'both second-context views folded after receipt', timeoutMs: 1000 });
      await rendered;
      assert.ok(performance.now() - completedAt! < 1000, 'hub receipt to both visible outcomes <1s'); // lint-allow-wall-clock: T-1122 C2 explicitly bounds cross-client rendering after the successful hub receipt.
      assert.deepEqual(await cards.locator('[data-ask-outcome]').allTextContents(), ['2 Change', '2 Change']);
      for (const card of await cards.all()) {
        assert.match(await card.innerText(), /2 Change.*human/s);
        assert.equal(await card.locator('time').getAttribute('datetime'), '2026-10-23T12:00:00.250Z');
        assert.equal(await card.locator('button, input, h3').count(), 0);
        assert.equal(await card.evaluate(node => node.getBoundingClientRect().height < 40), true, 'one-line outcome');
      }
      // Confirmed departures cannot remove or reopen the row while the Inbox remains mounted.
      const departure = until(() => departed, { what: 'second browser receives the confirmed Inbox departure', timeoutMs: 3000 });
      await fixture.clock.advance(250);
      await departure;
      await second.getByRole('button', { name: 'Fold Asks and approvals', exact: true }).focus();
      assert.equal(await cards.locator('[data-ask-outcome]').count(), 2);
    } finally { await context.close(); }
  }, page => {
    const answers = new Set<string>();
    page.on('websocket', socket => {
      socket.on('framesent', event => { const frame = JSON.parse(String(event.payload)); if (frame.type === 'topic.answer') answers.add(frame.id); });
      socket.on('framereceived', event => { const frame = JSON.parse(String(event.payload)); if (frame.type === 'result' && answers.has(frame.id) && frame.ok) completedAt = performance.now(); });
    });
  });
});

test('a refused competing answer recovers the winner and answering from Inbox marks the topic read through the ask', async t => {
  const fixture = await askFixture(t);
  const id = await fixture.ask('Which client wins?');
  let release: (() => void) | undefined;
  let refused = false;
  await fixture.pageCase(t, async loser => {
    await loser.getByRole('button', { name: 'Inbox', exact: true }).click();
    const card = loser.getByRole('list', { name: 'Inbox objects', exact: true }).locator(`[data-ask-id="${id}"]`);
    await card.focus();
    await physical(loser, 'Digit1');
    await until(() => !!release, { what: 'losing answer held before hub', timeoutMs: 3000 });
    await card.getByRole('status').waitFor();
    assert.equal(await card.locator('[data-ask-option="2"]').isDisabled(), true, 'pending cannot double-send');
    const context = await fixture.browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
    context.setDefaultTimeout(3000);
    try {
      const { url } = await askHubFrame(fixture.hub.discovery, { type: 'web.link' }, 3000, {}) as { url: string };
      const winner = await context.newPage();
      await winner.goto(url);
      await winner.getByRole('button', { name: 'Inbox', exact: true }).click();
      const winningCard = winner.getByRole('list', { name: 'Inbox objects', exact: true }).locator(`[data-ask-id="${id}"]`);
      await winningCard.locator('[data-ask-option="2"]').click();
      await winningCard.locator('[data-ask-outcome]').waitFor();
      const topics = await fixture.ui.request({ type: 'topic.list' });
      assert.equal(topics.ok, true, topics.error);
      const history = await fixture.ui.request({ type: 'topic.history', topic: 'general' });
      const askSeq = (history.value as { messages: Array<{ id: string; seq: number }> }).messages.find(row => row.id === id)!.seq;
      assert.ok((topics.value as { topics: Array<{ id: string; readSeq: number }> }).topics.find(row => row.id === 'general')!.readSeq >= askSeq, 'peer hub read receipt reaches ask without viewing the thread');
      const refusal = until(() => refused, { what: 'losing answer actually refused by hub', timeoutMs: 3000 });
      release!();
      await refusal;
      await card.locator('[data-ask-outcome]').waitFor();
      assert.match(await card.innerText(), /2 Change.*human/s);
      assert.equal(await card.getByRole('alert').count(), 0, 'winner replaces the lost answer');
      assert.equal(await card.locator('time').getAttribute('datetime'), '2026-10-23T12:00:00.250Z');
    } finally { await context.close(); }
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      let answerId = '';
      route.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'topic.answer') { answerId = frame.id; release = () => server.send(message); }
        else server.send(message);
      });
      server.onMessage(message => {
        const frame = JSON.parse(String(message));
        // Hold the winning ask delta: recovery must use the hub's durable ask record.
        if (frame.type === 'ask' && frame.ask === id) return;
        if (frame.type === 'result' && frame.id === answerId && !frame.ok) refused = true;
        route.send(message);
      });
    });
  });
});

test('a failed free answer keeps its draft, stays pending until receipt and can be retried', async t => {
  const fixture = await askFixture(t);
  const id = await fixture.ask('What next?');
  let fail: (() => void) | undefined;
  let first = true;
  await fixture.pageCase(t, async page => {
    const card = (await thread(page)).locator(`[data-ask-id="${id}"]`);
    await card.getByRole('textbox', { name: 'Free answer', exact: true }).fill('Check 123 then d');
    const field = card.getByRole('textbox', { name: 'Free answer', exact: true });
    await physical(page, 'Digit2');
    assert.equal(await field.inputValue(), 'Check 123 then d', 'number key in a field never chooses an option');
    assert.equal(await card.getAttribute('data-ask-state'), 'open');
    await card.getByRole('button', { name: 'Send answer', exact: true }).click();
    await until(() => !!fail, { what: 'answer frame held at transport boundary', timeoutMs: 3000 });
    await card.getByRole('status').waitFor();
    assert.equal(await field.isDisabled(), true);
    assert.equal(await card.locator('[data-ask-outcome]').count(), 0);
    fail!();
    await card.getByRole('alert').waitFor();
    assert.equal(await field.inputValue(), 'Check 123 then d');
    assert.equal(await field.isEnabled(), true);
    assert.equal(await card.getAttribute('data-ask-state'), 'open');
    const delivered = fixture.asker.waitForEvent(event => event.params.meta?.answer_to === id);
    await card.getByRole('button', { name: 'Send answer', exact: true }).click();
    assert.equal((await delivered).params.content, 'Check 123 then d');
    await card.locator('[data-ask-outcome]').waitFor();
    assert.match(await card.innerText(), /Check 123 then d.*human/s);
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      route.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'topic.answer' && first) {
          first = false;
          fail = () => route.send(JSON.stringify({ type: 'result', id: frame.id, ok: false, error: 'Scripted delivery failure' }));
        } else server.send(message);
      });
      server.onMessage(message => route.send(message));
    });
  });
});

test('the thread ask links to its Inbox row and thread-row focus answers with physical keys', async t => {
  const fixture = await askFixture(t);
  const id = await fixture.ask('Follow this ask');
  assert.equal((await fixture.asker.call<{ ok: boolean }>('send', { topic: 'general', text: 'Next thread row' })).ok, true);
  await fixture.pageCase(t, async page => {
    const log = await thread(page);
    const message = log.locator(`[data-message-id="${id}"]`);
    const card = message.locator(`[data-ask-id="${id}"]`);
    await card.focus();
    await page.keyboard.press('Shift+/');
    const help = page.getByRole('dialog', { name: 'Topics keys', exact: true });
    await help.waitFor();
    assert.equal(await help.locator('[data-key-action^="ask-"]').count(), 11);
    await page.keyboard.press('Escape');
    await card.getByRole('link', { name: 'In Inbox', exact: true }).click();
    const inbox = page.getByRole('list', { name: 'Inbox objects', exact: true });
    await inbox.locator(`[data-ask-id="${id}"]`).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Inbox', exact: true }).count(), 1);
    await thread(page);
    await message.focus();
    await physical(page, 'KeyJ');
    assert.equal(await log.locator('article').filter({ hasText: 'Next thread row' }).evaluate(node => node === document.activeElement), true, 'ask focus retains thread navigation');
    await physical(page, 'KeyK');
    assert.equal(await message.evaluate(node => node === document.activeElement), true);
    const delivered = fixture.asker.waitForEvent(event => event.params.meta?.answer_to === id);
    await physical(page, 'Digit2');
    assert.equal((await delivered).params.content, 'Change');
    await card.locator('[data-ask-outcome]').waitFor();
  });
});

test('offline asks disable writes and a fresh snapshot recovers an answer without replaying a draft', async t => {
  const fixture = await askFixture(t);
  const id = await fixture.ask('Answer while offline');
  const sent: string[] = [];
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Inbox', exact: true }).click();
    const card = page.getByRole('list', { name: 'Inbox objects', exact: true }).locator(`[data-ask-id="${id}"]`);
    await card.getByRole('textbox', { name: 'Free answer', exact: true }).fill('A draft, never sent');
    await fixture.restartHub();
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent === 'Offline', 'offline receipt');
    assert.equal(await card.getByRole('button', { name: 'Send answer', exact: true }).isDisabled(), true);
    assert.equal(await card.locator('[data-ask-option="2"]').isDisabled(), true);
    assert.equal(await card.getByRole('textbox', { name: 'Free answer', exact: true }).inputValue(), 'A draft, never sent');
    const peer = await connectUi(t, fixture.hub.discovery);
    const answered = await peer.request({ type: 'topic.answer', ask: id, option: 2 });
    assert.equal(answered.ok, true, answered.error);
    const live = pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent === 'Live', 'fresh epoch live');
    await page.clock.runFor(250);
    await live;
    await card.locator('[data-ask-outcome]').waitFor();
    assert.match(await card.innerText(), /2 Change.*human/s);
    assert.deepEqual(sent, [], 'reconnect sends no answer or draft');
    const historyCard = (await thread(page)).locator(`[data-ask-id="${id}"]`);
    await historyCard.locator('[data-ask-outcome]').waitFor();
    assert.match(await historyCard.innerText(), /2 Change.*human/s);
  }, async page => {
    await page.clock.install({ time: fixture.clock.now() });
    await page.clock.pauseAt(fixture.clock.now());
    page.on('websocket', socket => socket.on('framesent', event => { const frame = JSON.parse(String(event.payload)); if (frame.type === 'topic.answer') sent.push(frame.type); }));
  });
});

test('a refused answer recovers its durable outcome beyond the seven-day archive without replacing newer Inbox rows', async t => {
  const fixture = await askFixture(t);
  assert.equal((await fixture.ui.request({ type: 'topic.send', topic: 'general', text: 'Before the durable ask, at the same clock time' })).ok, true);
  const id = await fixture.ask('A durable decision');
  let release: (() => void) | undefined;
  let refused = false;
  const recoveries: Array<{ type: string; limit?: number }> = [];
  await fixture.pageCase(t, async loser => {
    await loser.getByRole('button', { name: 'Inbox', exact: true }).click();
    const inbox = loser.getByRole('list', { name: 'Inbox objects', exact: true });
    const card = inbox.locator(`[data-ask-id="${id}"]`);
    await card.locator('[data-ask-option="1"]').click();
    await until(() => !!release, { what: 'losing answer held before durable winner', timeoutMs: 3000 });
    const context = await fixture.browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
    context.setDefaultTimeout(3000);
    try {
      const { url } = await askHubFrame(fixture.hub.discovery, { type: 'web.link' }, 3000, {}) as { url: string };
      const winner = await context.newPage();
      await winner.goto(url);
      await winner.getByRole('button', { name: 'Inbox', exact: true }).click();
      await winner.locator(`[data-ask-id="${id}"] [data-ask-option="2"]`).click();
      await winner.locator(`[data-ask-id="${id}"] [data-ask-outcome]`).waitFor();
      // Put the durable ask beyond a normal latest-page lookup.
      for (let n = 0; n < 110; n++) assert.equal((await fixture.ui.request({ type: 'topic.send', topic: 'general', text: `Later human message ${n}` })).ok, true);
      const next = await fixture.ask('A newer open question');
      const nextCard = inbox.locator(`[data-ask-id="${next}"]`);
      await nextCard.waitFor();
      const count = await loser.getByRole('button', { name: 'Inbox', exact: true }).textContent();
      fixture.clock.block(8 * 86400_000);
      const archive = await fixture.ui.request({ type: 'inbox.list', archive: true });
      assert.equal(archive.ok, true, archive.error);
      assert.equal((archive.value as { archive: Array<{ id: string }> }).archive.some(row => row.id === id), false, 'winner is outside archive retention');
      const refusal = until(() => refused, { what: 'old competing answer refused', timeoutMs: 3000 });
      release!();
      await refusal;
      await card.locator('[data-ask-outcome]').waitFor();
      assert.match(await card.innerText(), /2 Change.*human/s);
      assert.equal(await card.locator('time').getAttribute('datetime'), '2026-10-23T12:00:00.250Z');
      assert.equal(await nextCard.getAttribute('data-ask-state'), 'open');
      assert.equal(await loser.getByRole('button', { name: 'Inbox', exact: true }).textContent(), count);
      assert.equal(recoveries.filter(frame => frame.type === 'topic.history').length, 2, 'two bounded history reads locate the exact ask without loading the thread');
      assert.ok(recoveries.filter(frame => frame.type === 'topic.history').every(frame => frame.limit === 1));
    } finally { await context.close(); }
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      let answerId = '';
      route.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'topic.answer') { answerId = frame.id; release = () => server.send(message); }
        else { if (frame.type === 'topic.history' || frame.type === 'inbox.list') recoveries.push(frame); server.send(message); }
      });
      server.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'ask' && frame.ask === id) return;
        if (frame.type === 'result' && frame.id === answerId && !frame.ok) refused = true;
        route.send(message);
      });
    });
  });
});

test('In Inbox from a secondary thread opens and focuses that pane list while the primary thread keeps its ask', async t => {
  const fixture = await askFixture(t);
  const id = await fixture.ask('An ask in both panes');
  await fixture.pageCase(t, async page => {
    await thread(page);
    await page.locator('[data-object-id="general"]').press('Meta+Enter');
    const primary = page.locator('[data-pane="primary"]');
    const secondary = page.locator('[data-pane="secondary"]');
    const original = primary.locator(`[data-ask-id="${id}"]`);
    const copy = secondary.locator(`[data-ask-id="${id}"]`);
    await copy.waitFor();
    assert.equal(await original.count(), 1);
    await copy.getByRole('link', { name: 'In Inbox', exact: true }).click();
    await secondary.locator('[data-area-module="Inbox"][data-area-surface="pane"]').waitFor();
    const destination = secondary.getByRole('list', { name: 'Inbox objects', exact: true }).locator(`[data-ask-id="${id}"]`);
    await destination.waitFor();
    assert.equal(await destination.evaluate(node => node === document.activeElement), true, 'focus belongs to the destination ask');
    assert.equal(await original.count(), 1, 'primary thread remains in place');
    const delivered = fixture.asker.waitForEvent(event => event.params.meta?.answer_to === id);
    await physical(page, 'Digit2');
    assert.equal((await delivered).params.content, 'Change');
    await original.locator('[data-ask-outcome]').waitFor();
  });
});
