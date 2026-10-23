// Web: authenticated thread/composer actions over public frames; sealed busy fake adapter.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright-core';
import type { HarnessProcessView, TopicMessage } from '../../shared/wire/index.ts';
import { connectUi, inProcessSpoke } from '../../hub/test/harness.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import { until } from '../../hub/test/until.ts';
import { pageUntil, webFixture } from './harness.ts';

async function busyFixture(t: Parameters<typeof webFixture>[0]) {
  const clock = new FakeClock();
  const fixture = await webFixture(t, { clock });
  const ui = await connectUi(t, fixture.hub.discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', name: 'worker', role: 'implementer', harness: 'claude-code' });
  assert.equal(launched.ok, true, launched.error);
  const process = (launched.value as { process: HarnessProcessView }).process;
  const fake = fixture.fakes['claude-code']!;
  const peer = await inProcessSpoke(t, { clock, discover: true, cwd: fixture.root, name: 'worker', sessionId: process.sessionId, launchToken: fake.spawns[0]!.launchToken! });
  await peer.waitForPresence(['worker']);
  fake.busy('worker');
  return { ...fixture, ui, fake, clock };
}

async function thread(page: Page, topic = 'general') {
  await page.getByRole('button', { name: 'Topics', exact: true }).click();
  await page.locator(`[data-object-id="${topic}"]`).click();
  return page.getByRole('form', { name: 'Composer', exact: true });
}

test('Withdraw restores a queued message before newer typing only after its receipt', async t => {
  const fixture = await busyFixture(t);
  const other = await fixture.ui.request({ type: 'topic.create', title: 'Neighbor draft' });
  assert.equal(other.ok, true, other.error);
  const neighbor = (other.value as { topic: { id: string } }).topic.id;
  let release: (() => void) | undefined;
  let withdrawals = 0;
  await fixture.pageCase(t, async page => {
    const form = await thread(page);
    const field = form.getByRole('textbox', { name: 'Message text' });
    await field.fill('@worker Queued original');
    const posted = fixture.ui.waitFor(f => f.type === 'message' && (f.message as TopicMessage).text === '@worker Queued original');
    await form.getByRole('button', { name: 'Send', exact: true }).click();
    const message = (await posted).message as TopicMessage;
    const row = page.locator(`[data-message-id="${message.id}"]`);
    assert.equal(await row.locator('[data-delivery-stage]').innerText(), 'queued');
    await form.locator('[data-pending-message]').waitFor({ state: 'detached' });
    await field.fill('Newer typing');
    const withdrawn = fixture.ui.waitFor(f => f.type === 'delivery' && f.message === message.id && f.stage === 'withdrawn');
    void withdrawn.catch(() => {}); // Keep an armed observer handled if the click itself fails.
    await row.getByRole('button', { name: 'Withdraw', exact: true }).click();
    await withdrawn;
    await until(() => !!release, { what: 'successful withdrawal receipt held', timeoutMs: 3000 });
    assert.equal(await row.getByRole('button', { name: 'Withdrawing', exact: true }).isDisabled(), true);
    await row.getByRole('button', { name: 'Withdrawing', exact: true }).evaluate(node => { (node as HTMLButtonElement).click(); (node as HTMLButtonElement).click(); });
    assert.equal(await field.inputValue(), 'Newer typing');
    await thread(page, neighbor);
    await field.fill('Neighbor text');
    await thread(page);
    assert.equal(await field.inputValue(), 'Newer typing');
    assert.equal(await row.getByRole('button', { name: 'Withdrawing', exact: true }).isDisabled(), true);
    await field.fill('Typed while withdrawing');
    release!();
    await pageUntil(page, () => (document.querySelector('[aria-label="Message text"]') as HTMLTextAreaElement)?.value === '@worker Queued original\nTyped while withdrawing', 'withdrawn text restored before latest draft');
    assert.equal(await row.locator('[data-delivery-stage]').innerText(), 'withdrawn');
    assert.equal(await row.getByRole('button').count(), 0);
    assert.equal(withdrawals, 1);
    await thread(page, neighbor);
    assert.equal(await field.inputValue(), 'Neighbor text');
    await thread(page);
    fixture.fake.idle('worker');
    const next = await fixture.ui.request({ type: 'topic.send', topic: 'general', to: ['worker'], text: 'kept next turn' });
    const nextId = (next.value as { message: TopicMessage }).message.id;
    await fixture.ui.waitFor(f => f.type === 'delivery' && f.message === nextId && f.stage === 'injected');
    assert.equal(fixture.fake.injections.some(row => row.message.id === message.id), false);
    await page.reload();
    await form.waitFor();
    assert.equal(await field.inputValue(), '@worker Queued original\nTyped while withdrawing');
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      let withdrawal = '';
      route.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'topic.withdraw') { withdrawal = frame.id; withdrawals++; }
        server.send(message);
      });
      server.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'result' && frame.id === withdrawal) { assert.equal(frame.ok, true, frame.error); release = () => route.send(message); }
        else route.send(message);
      });
    });
  });
});

test('a queued message loses Withdraw when the fake session takes its next turn', async t => {
  const fixture = await busyFixture(t);
  const sent = await fixture.ui.request({ type: 'topic.send', topic: 'general', to: ['worker'], text: 'Take this next turn' });
  assert.equal(sent.ok, true, sent.error);
  const message = (sent.value as { message: TopicMessage }).message;
  await fixture.pageCase(t, async page => {
    await thread(page);
    const row = page.locator(`[data-message-id="${message.id}"]`);
    await row.getByRole('button', { name: 'Withdraw', exact: true }).waitFor();
    assert.equal(await row.locator('[data-delivery-stage]').innerText(), 'queued');
    const injected = fixture.ui.waitFor(f => f.type === 'delivery' && f.message === message.id && f.stage === 'injected');
    fixture.fake.idle('worker');
    await injected;
    await pageUntil(page, () => document.querySelector('[data-delivery-stage]')?.textContent === 'injected', 'rendered injected delivery receipt');
    assert.equal(await row.getByRole('button', { name: 'Withdraw', exact: true }).count(), 0);
    assert.equal(fixture.fake.injections.filter(row => row.message.id === message.id).length, 1);
    assert.equal(await page.getByRole('textbox', { name: 'Message text' }).inputValue(), '');
  });
});

test('withdrawn text stays ahead of a newer pending send on receipt or reload', async t => {
  const fixture = await busyFixture(t);
  for (const outcome of ['refused', 'success', 'reload'] as const) await t.test(outcome, async t => {
    const tail = outcome === 'reload' ? '\nNewest C' : 'Newest C';
    const sent = await fixture.ui.request({ type: 'topic.send', topic: 'general', to: ['worker'], text: `Older ${outcome}` });
    assert.equal(sent.ok, true, sent.error);
    const id = (sent.value as { message: TopicMessage }).message.id;
    const made = await fixture.ui.request({ type: 'artifact.create', topic: 'general', kind: 'note', title: `Pending ${outcome}`, content: 'Held send' });
    assert.equal(made.ok, true, made.error);
    const artifact = (made.value as { artifact: { id: string } }).artifact.id;
    let submit: (() => void) | undefined;
    let receipt: (() => void) | undefined;
    let sendCount = 0;
    await fixture.pageCase(t, async page => {
      const form = await thread(page);
      const field = form.getByRole('textbox', { name: 'Message text' });
      await form.getByRole('button', { name: 'Attach an artifact', exact: true }).click();
      await page.getByRole('combobox', { name: 'Search palette' }).fill(`~Pending ${outcome}`);
      await page.getByRole('option').filter({ hasText: `Pending ${outcome}` }).click();
      await field.fill('Newer B');
      await form.getByRole('button', { name: 'Send', exact: true }).click();
      await until(() => !!submit, { what: 'newer send held before admission', timeoutMs: 3000 });
      await field.fill(tail);
      await page.locator(`[data-message-id="${id}"]`).getByRole('button', { name: 'Withdraw', exact: true }).click();
      await pageUntil(page, () => document.querySelector('[data-delivery-stage]')?.textContent === 'withdrawn', 'older withdrawal applied');
      await until(async () => (await field.inputValue()) === `Older ${outcome}\n${tail}`, { what: 'withdrawn text returns while newer send pending', timeoutMs: 3000 });
      assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('cland.ui.draft.general.v1')) ?? '{}').text, `Older ${outcome}\nNewer B\n${tail}`);
      if (outcome === 'success') {
        await field.focus();
        await field.evaluate(node => (node as HTMLTextAreaElement).setSelectionRange(0, 0));
        await page.keyboard.type('Edited ');
        await field.evaluate(node => { const field = node as HTMLTextAreaElement; field.setSelectionRange(field.value.length, field.value.length); });
        await page.keyboard.type(' later');
        assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('cland.ui.draft.general.v1')) ?? '{}').text, 'Edited Older success\nNewer B\nNewest C later');
      }
      if (outcome === 'refused') assert.equal((await fixture.ui.request({ type: 'artifact.archive', artifact })).ok, true);
      submit!();
      await until(() => !!receipt, { what: 'actual newer send result held', timeoutMs: 3000 });
      if (outcome === 'reload') { await page.reload(); await form.waitFor(); }
      else { receipt!(); await form.locator('[data-pending-message]').waitFor({ state: 'detached' }); }
      assert.equal(await field.inputValue(), outcome === 'success' ? 'Edited Older success\nNewest C later' : `Older ${outcome}\nNewer B\n${tail}`);
      assert.equal(sendCount, 1, 'receipt/reload never replays the newer send');
    }, async page => {
      await page.routeWebSocket('**/ws', route => {
        const server = route.connectToServer();
        let pending = '';
        route.onMessage(payload => {
          const frame = JSON.parse(String(payload));
          if (frame.type === 'topic.send') { pending = frame.id; sendCount++; submit = () => server.send(payload); }
          else server.send(payload);
        });
        server.onMessage(payload => {
          const frame = JSON.parse(String(payload));
          if (frame.type === 'result' && frame.id === pending) { assert.equal(frame.ok, outcome !== 'refused', frame.error); receipt = () => route.send(payload); }
          else route.send(payload);
        });
      });
    });
  });
});

test('a real withdrawal refusal retains the message with the hub reason in its tooltip', async t => {
  const fixture = await busyFixture(t);
  const sent = await fixture.ui.request({ type: 'topic.send', topic: 'general', to: ['worker'], text: 'Racing withdrawal' });
  assert.equal(sent.ok, true, sent.error);
  const message = (sent.value as { message: TopicMessage }).message;
  let release: (() => void) | undefined;
  let releaseStage: (() => void) | undefined;
  let reason = '';
  await fixture.pageCase(t, async page => {
    const form = await thread(page);
    const field = form.getByRole('textbox', { name: 'Message text' });
    await field.fill('Unchanged draft');
    const row = page.locator(`[data-message-id="${message.id}"]`);
    await row.getByRole('button', { name: 'Withdraw', exact: true }).click();
    await until(() => !!release, { what: 'withdraw request held before hub admission', timeoutMs: 3000 });
    const injected = fixture.ui.waitFor(f => f.type === 'delivery' && f.message === message.id && f.stage === 'injected');
    fixture.fake.idle('worker');
    await injected;
    await until(() => !!releaseStage, { what: 'injected delta held at browser edge', timeoutMs: 3000 });
    release!();
    const failed = row.getByRole('alert');
    await failed.waitFor();
    assert.match(reason, /cannot withdraw.*injected/);
    assert.equal(await failed.getAttribute('title'), reason);
    assert.equal(await row.getByRole('button', { name: 'Withdraw', exact: true }).getAttribute('title'), reason);
    assert.equal(await row.locator('[data-delivery-stage]').innerText(), 'queued');
    assert.match(await row.innerText(), /Racing withdrawal/);
    assert.equal(await field.inputValue(), 'Unchanged draft');
    releaseStage!();
    await pageUntil(page, () => document.querySelector('[data-delivery-stage]')?.textContent === 'injected', 'late injected delta applied');
    assert.equal(await row.getByRole('button', { name: 'Withdraw', exact: true }).count(), 0);
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      let withdrawal = '';
      const heldStages: string[] = [];
      route.onMessage(payload => {
        const frame = JSON.parse(String(payload));
        if (frame.type === 'topic.withdraw') { withdrawal = frame.id; release = () => server.send(payload); }
        else server.send(payload);
      });
      server.onMessage(payload => {
        const frame = JSON.parse(String(payload));
        // Exercise the documented older-hub fallback, without authoritative eligibility.
        delete frame.withdrawable;
        if (typeof frame.message === 'object') delete frame.message.withdrawable;
        for (const row of frame.value?.messages ?? []) delete row.withdrawable;
        const legacy = JSON.stringify(frame);
        if (frame.type === 'delivery' && frame.message === message.id && frame.stage !== 'queued') {
          heldStages.push(legacy);
          if (frame.stage === 'injected') releaseStage = () => { for (const stage of heldStages) route.send(stage); };
          return;
        }
        if (frame.type === 'result' && frame.id === withdrawal) { assert.equal(frame.ok, false); reason = frame.error; }
        route.send(legacy);
      });
    });
  });
});

test('one injected recipient removes Withdraw while the broadcast remains queued', async t => {
  const fixture = await busyFixture(t);
  const launched = await fixture.ui.request({ type: 'session.launch', name: 'idle', role: 'implementer', harness: 'claude-code' });
  assert.equal(launched.ok, true, launched.error);
  const process = (launched.value as { process: HarnessProcessView }).process;
  const peer = await inProcessSpoke(t, { clock: fixture.clock, discover: true, cwd: fixture.root, name: 'idle', sessionId: process.sessionId, launchToken: fixture.fake.spawns.at(-1)!.launchToken! });
  await peer.waitForPresence(['idle']);
  fixture.fake.busy('idle');
  const sent = await fixture.ui.request({ type: 'topic.send', topic: 'general', to: ['worker', 'idle'], text: 'Broadcast waiting' });
  assert.equal(sent.ok, true, sent.error);
  const message = (sent.value as { message: TopicMessage }).message;
  assert.equal(message.withdrawable, true);
  let releaseVisibility: (() => void) | undefined;
  let latestVisibility: TopicMessage[] | undefined;
  await fixture.pageCase(t, async page => {
    await thread(page);
    const row = page.locator(`[data-message-id="${message.id}"]`);
    await row.getByRole('button', { name: 'Withdraw', exact: true }).waitFor();
    assert.equal((await fixture.ui.request({ type: 'visibility.set', surface: 'topics', target: 'general', mode: 'mute' })).ok, true);
    await until(() => !!releaseVisibility, { what: 'pre-submission visibility refresh held', timeoutMs: 3000 });
    const excluded = fixture.ui.waitFor(frame => frame.type === 'delivery' && frame.message === message.id && frame.stage === 'queued' && frame.withdrawable === false);
    fixture.fake.idle('idle');
    await excluded;
    await until(async () => (await row.getByRole('button', { name: 'Withdraw', exact: true }).count()) === 0, { what: 'authoritative partial-injection exclusion rendered', timeoutMs: 3000 });
    assert.equal(await row.locator('[data-delivery-stage]').innerText(), 'queued');
    releaseVisibility!();
    await until(async () => (await row.getAttribute('data-layer')) === 'watch', { what: 'held refresh applied after submission delta', timeoutMs: 3000 });
    assert.equal(await row.getByRole('button', { name: 'Withdraw', exact: true }).count(), 0, 'stale visibility cannot erase a newer exclusion');
    assert.equal((await fixture.ui.request({ type: 'visibility.set', surface: 'topics', target: 'general', mode: 'pin' })).ok, true);
    await until(() => !!latestVisibility?.some(row => row.id === message.id && row.layer === 'now'), { what: 'fresh browser visibility projection received', timeoutMs: 3000 });
    assert.equal(latestVisibility?.find(row => row.id === message.id)?.withdrawable, false);
    await until(async () => (await row.getAttribute('data-layer')) === 'now', { what: 'current visibility projection applied', timeoutMs: 3000 });
    assert.equal(await row.getByRole('button', { name: 'Withdraw', exact: true }).count(), 0);
    const history = await fixture.ui.request({ type: 'topic.history', topic: 'general' });
    assert.equal((history.value as { messages: TopicMessage[] }).messages.find(row => row.id === message.id)?.withdrawable, false);
    await page.reload();
    await page.getByRole('form', { name: 'Composer', exact: true }).waitFor();
    assert.equal(await row.getByRole('button', { name: 'Withdraw', exact: true }).count(), 0);
    assert.equal(await row.locator('[data-delivery-stage]').innerText(), 'queued');
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      let held = false;
      route.onMessage(payload => server.send(payload));
      server.onMessage(payload => {
        const frame = JSON.parse(String(payload));
        if (!held && frame.type === 'visibility' && frame.rows?.messages?.some((row: TopicMessage) => row.id === message.id)) {
          held = true; releaseVisibility = () => route.send(payload);
        } else {
          if (frame.type === 'visibility' && frame.rows?.messages) latestVisibility = frame.rows.messages;
          route.send(payload);
        }
      });
    });
  });
});
