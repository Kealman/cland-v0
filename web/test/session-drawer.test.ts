// Web: selected session drawer through sealed fake harnesses and public hub frames.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inProcessSpoke } from '../../hub/test/harness.ts';
import { sessionUi as connectUi } from '../../hub/test/session-credential-fixture.ts';
import type { HarnessProcessView, SessionHistoryResult, TopicMessage } from '../../shared/wire/index.ts';
import { until } from '../../hub/test/until.ts';
import { pageUntil, webFixture } from './harness.ts';

test('the session drawer approves a fake Codex command and retains its folded outcome after Waiting', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'session.launch', name: 'drawer-worker', harness: 'codex' })).ok, true);
  fixture.fakes.codex!.waitingForApproval('drawer-worker');
  fixture.fakes.codex!.raiseApproval('drawer-worker', { id: 'drawer-once', kind: 'command', subject: { command: 'printf "drawer approval receipt"', cwd: '/scratch' }, choices: ['once', 'always', 'deny'], answerIn: 'hub' });
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const waiting = page.getByRole('region', { name: 'Waiting', exact: true });
    await waiting.locator('[data-object-id="drawer-worker"]').click();
    const drawer = page.getByRole('complementary', { name: 'Drawer', exact: true });
    const card = drawer.getByRole('region', { name: 'Command approval', exact: true });
    await card.waitFor();
    assert.equal(await card.locator('pre').textContent(), 'printf "drawer approval receipt"');
    const departed = waiting.locator('[data-object-id="drawer-worker"]').waitFor({ state: 'detached' });
    await card.getByRole('button', { name: '1 · Approve once', exact: true }).click();
    await drawer.locator('[data-approval-outcome]').waitFor();
    await until(() => fixture.fakes.codex!.approvalAnswers.some(row => row.requestId === 'drawer-once'), { what: 'native fake approval answer', timeoutMs: 3000 });
    fixture.fakes.codex!.busy('drawer-worker');
    await departed;
    assert.equal(fixture.fakes.codex!.approvalAnswers.at(-1)?.choice, 'once');
    assert.match(await drawer.locator('[data-approval-outcome]').textContent() ?? '', /Approved once by the human/);
    await pageUntil(page, () => document.querySelector('[data-object-id="drawer-worker"]')?.getAttribute('aria-pressed') === 'true', 'selected session follows its state change');
  });
});

test('the session drawer pages both directions of cross-topic traffic by number and follows live messages', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const launch = await ui.request({ type: 'session.launch', name: 'traffic-worker', harness: 'codex', role: 'implementer' });
  assert.equal(launch.ok, true, launch.error);
  const process = (launch.value as { process: HarnessProcessView }).process;
  const worker = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: process.name, sessionId: process.sessionId, role: 'implementer' });
  const peer = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'traffic-peer', sessionId: 'traffic-peer' });
  await peer.waitForPresence(['traffic-worker', 'traffic-peer']);
  const made = await ui.request({ type: 'topic.create', title: 'Other traffic' });
  assert.equal(made.ok, true, made.error);
  const topic = (made.value as { topic: { id: string } }).topic.id;
  for (let index = 0; index < 45; index++) {
    const text = `Cross-topic traffic ${String(index).padStart(2, '0')}`;
    const result = index % 2 ? await worker.call<{ ok: boolean; error?: string }>('send', { to: 'traffic-peer', topic, text })
      : await ui.request({ type: 'topic.send', topic: 'general', to: ['traffic-worker'], text });
    assert.equal(result.ok, true, result.error);
  }
  const recent = await ui.request({ type: 'session.history', session: 'traffic-worker', limit: 20 });
  assert.equal(recent.ok, true, recent.error);
  const firstPage = recent.value as SessionHistoryResult;
  assert.equal(firstPage.messages.length, 20);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await page.locator('[data-object-id="traffic-worker"]').click();
    const log = page.getByRole('log', { name: 'traffic-worker recent thread', exact: true });
    await log.locator(`[data-message-id="${firstPage.messages.at(-1)!.id}"]`).waitFor();
    assert.deepEqual(await log.locator('[data-message-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-message-id'))), firstPage.messages.map(row => row.id));
    assert.match(await log.textContent() ?? '', /Cross-topic traffic 43/);
    assert.match(await log.textContent() ?? '', /Cross-topic traffic 44/);
    assert.deepEqual(await log.locator('[data-message-topic]').evaluateAll(nodes => [...new Set(nodes.map(node => node.textContent))].sort()), ['General', 'Other traffic']);
    for (const text of ['Cross-topic traffic 05', 'Cross-topic traffic 00']) {
      const older = log.getByText(text, { exact: true }).waitFor();
      await log.evaluate(node => { node.scrollTop = 0; node.dispatchEvent(new Event('scroll', { bubbles: true })); });
      await older;
    }
    const live = log.getByText('Live outgoing traffic', { exact: true }).waitFor();
    assert.equal((await worker.call<{ ok: boolean }>('send', { to: 'traffic-peer', topic, text: 'Live outgoing traffic' })).ok, true);
    await live;
    assert.equal((await ui.request({ type: 'topic.send', topic: 'general', to: ['traffic-peer'], text: 'Unrelated peer traffic' })).ok, true);
    const incoming = log.getByText('Live incoming traffic', { exact: true }).waitFor();
    assert.equal((await ui.request({ type: 'topic.send', topic: 'general', to: ['traffic-worker'], text: 'Live incoming traffic' })).ok, true);
    await incoming;
    assert.equal(await log.getByText('Unrelated peer traffic', { exact: true }).count(), 0);
    const texts = await log.locator('article').allTextContents();
    for (let index = 0; index < 45; index++) assert.equal(texts.filter(text => text.includes(`Cross-topic traffic ${String(index).padStart(2, '0')}`)).length, 1);
    const seqs = await log.locator('[data-message-seq]').evaluateAll(nodes => nodes.map(node => Number(node.getAttribute('data-message-seq'))));
    assert.deepEqual(seqs, [...new Set(seqs)].sort((a, b) => a - b));
  });
});

test('a held older session page preserves live traffic, numeric boundaries and the reading anchor', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'session.launch', name: 'paged-worker', harness: 'codex' })).ok, true);
  for (let index = 0; index < 32; index++) assert.equal((await ui.request({ type: 'topic.send', topic: 'general', to: ['paged-worker'], text: `Paged traffic ${String(index).padStart(2, '0')}` })).ok, true);
  const latest = (await ui.request({ type: 'session.history', session: 'paged-worker', limit: 20 })).value as SessionHistoryResult;
  const boundary = latest.messages[0]!;
  let release: (() => void) | undefined;
  let heldId = '';
  let delivered = false;
  const before: number[] = [];
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await page.locator('[data-object-id="paged-worker"]').click();
    const log = page.getByRole('log', { name: 'paged-worker recent thread', exact: true });
    await log.locator(`[data-message-id="${latest.messages.at(-1)!.id}"]`).waitFor();
    const held = until(() => !!release, { what: 'older numeric session history reply held', timeoutMs: 3000 });
    await log.evaluate(node => { node.scrollTop = 0; node.dispatchEvent(new Event('scroll', { bubbles: true })); });
    await held;
    assert.deepEqual(before, [boundary.seq]);
    const anchor = log.locator(`[data-message-id="${boundary.id}"]`);
    const top = await anchor.evaluate(node => node.getBoundingClientRect().top);
    const live = log.getByText('Live while older page is held', { exact: true }).waitFor();
    assert.equal((await ui.request({ type: 'topic.send', topic: 'general', to: ['paged-worker'], text: 'Live while older page is held' })).ok, true);
    await live;
    const earlier = log.getByText('Paged traffic 00', { exact: true }).waitFor();
    release!();
    await until(() => delivered, { what: 'held older page delivered to browser', timeoutMs: 3000 });
    await earlier;
    assert.ok(Math.abs(await anchor.evaluate(node => node.getBoundingClientRect().top) - top) <= 2, 'prepending retains the visible reading anchor');
    assert.equal(await log.getByText('Live while older page is held', { exact: true }).count(), 1);
    for (let index = 0; index < 32; index++) assert.equal(await log.getByText(`Paged traffic ${String(index).padStart(2, '0')}`, { exact: true }).count(), 1);
    assert.equal(await log.locator('[data-message-id]').count(), 33);
  }, async page => {
    page.on('websocket', socket => socket.on('framereceived', event => { const frame = JSON.parse(String(event.payload)); if (frame.type === 'result' && frame.id === heldId) delivered = true; }));
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      route.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'session.history' && frame.before !== undefined) { heldId = frame.id; before.push(frame.before); }
        server.send(message);
      });
      server.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'result' && frame.id === heldId) release = () => route.send(message);
        else route.send(message);
      });
    });
  });
});

test('a session drawer keeps TUI-only approvals read-only and prefers a new pending card over a closed one', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'session.launch', name: 'tui-drawer', harness: 'codex' })).ok, true);
  fixture.fakes.codex!.raiseApproval('tui-drawer', { id: 'closed-first', kind: 'command', subject: { command: 'printf previous' }, choices: ['once'], answerIn: 'hub' });
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await page.locator('[data-object-id="tui-drawer"]').click();
    const drawer = page.getByRole('complementary', { name: 'Drawer', exact: true });
    await drawer.getByRole('button', { name: '1 · Approve once', exact: true }).click();
    await drawer.locator('[data-approval-outcome]').waitFor();
    const shown = drawer.getByText('Answer in Neovim', { exact: true }).waitFor();
    fixture.fakes.codex!.raiseApproval('tui-drawer', { id: 'new-tui', kind: 'command', subject: { command: 'printf TUI-only' }, choices: [], answerIn: 'tui' });
    await shown;
    const card = drawer.getByRole('region', { name: 'Command approval', exact: true });
    assert.equal(await card.locator('pre').textContent(), 'printf TUI-only');
    assert.equal(await card.getByRole('button').count(), 0);
    assert.equal(await drawer.locator('[data-approval-outcome]').count(), 0);
    assert.deepEqual(fixture.fakes.codex!.approvalAnswers.map(row => row.requestId), ['closed-first']);
  });
});

test('Retry after a failed session selection refresh reads recent traffic even when older history is complete', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  for (const name of ['refresh-worker', 'refresh-other']) assert.equal((await ui.request({ type: 'session.launch', name, harness: 'codex' })).ok, true);
  const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['refresh-worker'], text: 'Complete short history' });
  assert.equal(sent.ok, true, sent.error);
  let rejectNext = false;
  let rejectedId = '';
  let heldId = '';
  let release: (() => void) | undefined;
  let delivered = false;
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await page.locator('[data-object-id="refresh-worker"]').click();
    const log = page.getByRole('log', { name: 'refresh-worker recent thread', exact: true });
    await log.getByText('Complete short history', { exact: true }).waitFor();
    await page.locator('[data-object-id="refresh-other"]').click();
    rejectNext = true;
    await page.locator('[data-object-id="refresh-worker"]').click();
    const retry = page.getByRole('complementary', { name: 'Drawer', exact: true }).getByRole('button', { name: 'Retry', exact: true });
    await retry.waitFor();
    assert.equal(await retry.getAttribute('title'), 'Selection refresh rejected');
    const read = until(() => !!release, { what: 'explicit recent-page retry reaches hub', timeoutMs: 3000 });
    await retry.click();
    await read;
    release!();
    await until(() => delivered, { what: 'held recent retry reply delivered', timeoutMs: 3000 });
    await retry.waitFor({ state: 'detached' });
    assert.equal(await log.getByText('Complete short history', { exact: true }).count(), 1);
  }, async page => {
    page.on('websocket', socket => socket.on('framereceived', event => { const frame = JSON.parse(String(event.payload)); if (frame.type === 'result' && frame.id === heldId) delivered = true; }));
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      route.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'session.history' && frame.session === 'refresh-worker' && rejectNext) { rejectedId = frame.id; rejectNext = false; }
        else if (frame.type === 'session.history' && frame.session === 'refresh-worker' && rejectedId) { assert.equal(frame.before, undefined, 'retry reads recent traffic, not older history'); heldId = frame.id; }
        server.send(message);
      });
      server.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'result' && frame.id === rejectedId) route.send(JSON.stringify({ type: 'result', id: frame.id, ok: false, error: 'Selection refresh rejected' }));
        else if (frame.type === 'result' && frame.id === heldId) release = () => route.send(message);
        else route.send(message);
      });
    });
  });
});

test('the drawer composer delivers to the selected fake Codex session in its item topic or General', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const made = await ui.request({ type: 'task.create', title: 'Drawer routing', size: 'S', assignee: 'item-worker' });
  assert.equal(made.ok, true, made.error);
  const item = (made.value as { item: { id: string } }).item.id;
  const created = await ui.request({ type: 'topic.create', title: 'Drawer item', item });
  assert.equal(created.ok, true, created.error);
  const topic = (created.value as { topic: { id: string } }).topic.id;
  for (const name of ['item-worker', 'free-worker']) {
    const launch = await ui.request({ type: 'session.launch', name, harness: 'codex', role: 'implementer' });
    assert.equal(launch.ok, true, launch.error);
    const process = (launch.value as { process: HarnessProcessView }).process;
    const spoke = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name, sessionId: process.sessionId, role: 'implementer' });
    await spoke.waitForPresence([name]);
    fixture.fakes.codex!.idle(name);
  }
  assert.equal((await ui.request({ type: 'task.claim', item, as: { name: 'item-worker' } })).ok, true);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    for (const [name, destination, label] of [['item-worker', topic, 'Drawer item'], ['free-worker', 'general', 'General']] as const) {
      await page.locator(`[data-object-id="${name}"]`).click();
      const form = page.getByRole('complementary', { name: 'Drawer', exact: true }).getByRole('form', { name: 'Composer', exact: true });
      await form.locator('[data-composer-address]').waitFor();
      assert.equal(await form.locator('[data-composer-address]').textContent(), `To ${name} in ${label}`);
      assert.equal(await form.getByRole('button', { name: 'Choose a session (@)', exact: true }).count(), 0);
      const field = form.getByRole('textbox', { name: 'Message text' });
      assert.equal(await field.evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2', key: '@', shiftKey: true, bubbles: true, cancelable: true }))), true, 'physical @ keeps native input');
      await field.press('@');
      assert.equal(await form.getByRole('textbox', { name: 'Message text' }).inputValue(), '@', 'fixed addressee leaves @ available for message text');
      assert.equal(await page.getByRole('dialog', { name: 'Palette', exact: true }).count(), 0);
      const text = `Drawer message to ${name}`;
      let delivered: TopicMessage | undefined;
      const completion = until(async () => {
        const history = await ui.request({ type: 'topic.history', topic: destination, limit: 50 });
        assert.equal(history.ok, true, history.error);
        delivered = (history.value as { messages: TopicMessage[] }).messages.find(row => row.text === text);
        return delivered?.stage === 'injected' && fixture.fakes.codex!.injections.some(row => row.process.name === name && row.message.text === text);
      }, { what: `durable injected receipt for ${name} composer message`, timeoutMs: 3000 });
      await form.getByRole('textbox', { name: 'Message text' }).fill(text);
      await form.getByRole('textbox', { name: 'Message text' }).press('Enter');
      await completion;
      const injected = fixture.fakes.codex!.injections.find(row => row.process.name === name && row.message.text === text)!;
      assert.deepEqual(injected.message.to, [name]);
      assert.equal(injected.message.topic, destination);
      assert.equal(injected.topic?.id, destination);
      assert.equal(injected.outcome, 'accept');
      assert.equal(delivered?.id, injected.message.id);
      assert.equal(delivered?.stage, 'injected');
      await form.locator('[data-pending-message]').waitFor({ state: 'detached' });
      assert.equal(await form.getByRole('textbox', { name: 'Message text' }).inputValue(), '');
    }
  });
});

test('desktop Enter and Open thread focus the selected session log with shared physical thread keys', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'session.launch', name: 'focus-worker', harness: 'codex' })).ok, true);
  const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['focus-worker'], text: 'Focus this session message' });
  assert.equal(sent.ok, true, sent.error);
  const message = (sent.value as { message: { id: string } }).message;
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const row = page.locator('[data-session-slot="groups"] [data-object-id="focus-worker"]');
    await row.click();
    const log = page.getByRole('log', { name: 'focus-worker recent thread', exact: true });
    await log.locator(`[data-message-id="${message.id}"]`).waitFor();
    const focused = () => document.activeElement?.getAttribute('role') === 'log' && document.activeElement.getAttribute('aria-label') === 'focus-worker recent thread';
    const entered = pageUntil(page, focused, 'desktop Enter focuses selected session log');
    await row.evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'я', bubbles: true, cancelable: true })));
    await entered;
    await page.keyboard.press('j');
    assert.equal(await log.locator(`[data-message-id="${message.id}"]`).evaluate(node => node === document.activeElement), true);
    const back = pageUntil(page, () => document.activeElement?.getAttribute('data-object-id') === 'focus-worker', 'thread Escape returns to selected session row');
    await page.keyboard.press('Escape');
    await back;
    await page.getByRole('complementary', { name: 'Drawer', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
    const opened = pageUntil(page, focused, 'Open thread mounts and focuses the selected session log');
    await page.locator('[data-session-detail="focus-worker"]').getByRole('button', { name: 'Open thread', exact: true }).click();
    await opened;
    await page.keyboard.press('Escape');
    await row.press('Meta+Backslash');
    await page.locator('[data-session-detail="focus-worker"]').getByRole('button', { name: 'Open thread', exact: true }).click();
    const secondary = page.locator('[data-pane="secondary"]');
    await secondary.getByRole('log', { name: 'focus-worker recent thread', exact: true }).waitFor();
    await pageUntil(page, focused, 'Open thread focuses its log in the split detail');
    assert.equal(await page.getByRole('complementary', { name: 'Drawer', exact: true }).count(), 0);
  });
});
