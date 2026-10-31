// Web: merged session rows through the scratch hub and isolated Headless Shell.
import test from 'node:test';
import { caseDeadlines } from '../../hub/test/case-deadlines.ts';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { HarnessProcessView } from '../../shared/wire/index.ts';
import { connectUi, inProcessSpoke } from '../../hub/test/harness.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import { resizePage, pageUntil, webFixture } from './harness.ts';

test('Sessions groups count fake sessions and remember folds without hub requests', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  for (const [name, role] of [['my-aide', 'aide'], ['waiting-worker', 'implementer'], ['busy-worker', 'implementer'], ['idle-worker', 'reviewer'], ['stopped-aide', 'aide']]) {
    const launched = await ui.request({ type: 'session.launch', name, role, harness: 'claude-code' });
    assert.equal(launched.ok, true, launched.error);
  }
  assert.equal((await ui.request({ type: 'session.signal', session: 'waiting-worker', event: 'permission', payload: { tool_name: 'Bash', approvalCommand: 'printf waiting' } })).ok, true);
  fixture.fakes['claude-code']!.busy('busy-worker');
  fixture.fakes['claude-code']!.idle('idle-worker');
  assert.equal((await ui.request({ type: 'session.stop', session: 'stopped-aide' })).ok, true);
  const sent: { type: string }[] = [];
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const groups = page.locator('[data-session-slot="groups"]');
    for (const [label, name] of [['Yours', 'my-aide'], ['Waiting', 'waiting-worker'], ['Busy', 'busy-worker'], ['Idle', 'idle-worker'], ['Stopped', 'stopped-aide']] as const) {
      const group = groups.getByRole('region', { name: label, exact: true });
      await group.locator(`[data-object-id="${name}"]`).waitFor();
      assert.ok((await group.locator('header').textContent())?.startsWith(`${label}1`));
      assert.equal(await page.locator(`[data-session-count="${label}"]`).textContent(), `${label} 1`);
    }
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Live', 'authenticated');
    await page.locator('[data-object-id="idle-worker"]').click();
    sent.length = 0;
    await page.getByRole('button', { name: 'Fold Idle', exact: true }).click();
    assert.equal(await page.locator('[data-object-id="idle-worker"]').isVisible(), false);
    assert.deepEqual(sent, [], 'fold is browser-only');
    await page.reload();
    await page.getByRole('button', { name: 'Fold Idle', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Fold Idle', exact: true }).getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('[data-object-id="idle-worker"]').isVisible(), false);
  }, page => { page.on('websocket', socket => socket.on('framesent', event => sent.push(JSON.parse(String(event.payload))))); });
});


test('Sessions rows render merged facts, holds, waiting detail and physical selection keys', async t => {
  const clock = new FakeClock();
  const fixture = await webFixture(t, { clock, prepare: () => writeFile(join(process.env.XDG_CONFIG_HOME!, 'cland/accounts.toml'), `[accounts.row-account]\nharness = "claude-code"\n`) });
  const ui = await connectUi(t, fixture.hub.discovery);
  const ids: string[] = [];
  for (const title of ['First work', 'Latest work', 'Requested work']) {
    const made = await ui.request({ type: 'task.create', title, size: 'S' });
    assert.equal(made.ok, true, made.error);
    ids.push((made.value as { item: { id: string } }).item.id);
  }
  const launch = await ui.request({ type: 'session.launch', name: 'facts-reviewer', role: 'reviewer', harness: 'claude-code', model: 'opus', account: 'row-account' });
  assert.equal(launch.ok, true, launch.error);
  const launchedProcess = (launch.value as { process: HarnessProcessView }).process;
  const rev = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: launchedProcess.name, sessionId: launchedProcess.sessionId, role: 'reviewer' });
  await rev.waitForPresence([launchedProcess.name]);
  for (const id of ids.slice(0, 2)) {
    await clock.advance(1000);
    assert.equal((await rev.call<{ ok: boolean }>('task.hold', { id })).ok, true);
  }
  fixture.fakes['claude-code']!.feedUsage(launchedProcess.name, { total: { inputTokens: 100, outputTokens: 23, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 123, cost: 0.25 } });
  const command = 'printf "the whole pending command, including its final argument"';
  assert.equal((await ui.request({ type: 'session.signal', session: launchedProcess.name, event: 'permission', payload: { tool_name: 'Bash', approvalCommand: command } })).ok, true);
  assert.equal((await ui.request({ type: 'session.launch', name: 'second-row', harness: 'codex' })).ok, true);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const row = page.locator('[data-object-id="facts-reviewer"]');
    await row.waitFor();
    await page.clock.runFor(1000);
    const text = await row.textContent();
    assert.equal(await row.locator('[data-session-age]').textContent(), '1s');
    await page.clock.runFor(60_000);
    assert.equal(await row.locator('[data-session-age]').textContent(), '1m');
    for (const fact of ['▲', 'facts-reviewer', 'Reviewer', 'Claude Code', 'opus', 'row-account', ids[1]!, 'review +1', 'waiting for approval', '$0.25']) assert.ok(text?.includes(fact), fact);
    assert.equal(await row.locator('[data-session-role]').evaluate(node => getComputedStyle(node).color), 'rgb(247, 120, 186)');
    const desktop = await row.locator('[aria-label="waiting for approval"], [data-session-role], [data-item-requested]').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().y));
    assert.equal(new Set(desktop).size, 1, 'P22 facts share one desktop line at 1440 px');
    await row.click();
    const detail = page.locator('[data-session-detail="facts-reviewer"]');
    await detail.waitFor();
    assert.equal(await detail.locator('code').textContent(), command);
    assert.equal(await page.getByRole('button', { name: 'Attach', exact: true }).count(), 0, 'Sessions has no terminal Attach action');
    await row.evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyJ', key: 'о', bubbles: true, cancelable: true })));
    const second = page.locator('[data-object-id="second-row"]');
    await pageUntil(page, () => document.querySelector('[data-object-id="second-row"]')?.getAttribute('aria-pressed') === 'true', 'j selects the next session');
    assert.equal(await detail.count(), 0);
    await second.press('ArrowUp');
    assert.equal(await row.getAttribute('aria-pressed'), 'true');
    await row.press('ArrowDown');
    await second.press('k');
    assert.equal(await row.getAttribute('aria-pressed'), 'true');
    await resizePage(page, { width: 600, height: 900 });
    await pageUntil(page, () => document.querySelector('[data-phone]')?.getAttribute('data-phone') === 'true', 'phone layout committed before measuring rows');
    const narrow = async () => {
      const facts = await row.evaluate(node => {
        const fact = (text: string) => [...node.querySelectorAll('span')].find(span => span.textContent === text)!;
        const rect = (element: Element) => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, height: r.height }; };
        return { row: rect(node), name: rect(fact('facts-reviewer')), role: rect(fact('Reviewer')),
          state: rect(node.querySelector('[data-session-age]')!.parentElement!), harness: rect(fact('Claude Code')),
          item: rect(node.querySelector('[data-item-requested]')!) };
      });
      assert.equal(facts.row.height, 52, 'P27 row is 52 px tall');
      assert.equal(facts.name.y, facts.role.y);
      assert.equal(facts.name.y, facts.state.y);
      assert.ok(facts.state.x > facts.role.right, 'state and age sit at the right');
      assert.ok(facts.harness.y > facts.name.y, 'harness is on the second line');
      assert.equal(facts.harness.y, facts.item.y);
      assert.ok(facts.row.right <= 600, 'row fits the viewport');
      assert.ok(facts.item.right <= facts.row.right);
      for (const text of ['opus', 'row-account', '$0.25']) assert.equal(await row.getByText(text, { exact: true }).isVisible(), false, text);
      assert.equal(await row.locator('[data-session-role]').evaluate(node => getComputedStyle(node).color), 'rgb(247, 120, 186)');
      assert.equal(await page.locator('[data-session-detail="facts-reviewer"]').isVisible(), false);
      assert.equal(await page.locator('[data-session-slot="groups"] [data-session-actions]:visible').count(), 0);
    };
    await narrow();
    assert.equal((await second.boundingBox())?.height, 52, 'ordinary rows are also two lines');
    assert.equal(await second.locator('code').count(), 0, 'ordinary rows have no pending command');
    const pending = row.locator('code');
    assert.equal(await pending.isVisible(), true, 'waiting command is visible without unfolding');
    assert.equal(await pending.textContent(), command);
    const commandBox = await pending.boundingBox();
    assert.ok(commandBox && commandBox.width > 0 && commandBox.x + commandBox.width <= 600);
    for (const id of ids.slice(0, 2)) assert.equal((await rev.call<{ ok: boolean }>('task.hold', { id, release: true })).ok, true);
    assert.equal((await ui.request({ type: 'topic.send', topic: 'general', to: ['facts-reviewer'], text: `review request ${ids[2]}` })).ok, true);
    await pageUntil(page, () => document.querySelector('[data-object-id="facts-reviewer"] [data-item-requested]')?.getAttribute('data-item-requested') === 'true', 'requested work arrives as a dimmed hub row');
    assert.ok((await row.textContent())?.includes(`${ids[2]} review`));
    assert.equal(await row.locator('[data-item-requested]').evaluate(node => getComputedStyle(node).color), 'rgb(138, 148, 163)');
    await narrow();
  }, async page => {
    await page.clock.install({ time: new Date(clock.now().getTime() - 1000) });
    await page.clock.pauseAt(clock.now());
  });
});


test('Sessions selected human wait names its topic and usage falls back to tokens', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'asking-coordinator', role: 'coordinator', harness: 'claude-code' });
  assert.equal(launched.ok, true, launched.error);
  const launchedProcess = (launched.value as { process: HarnessProcessView }).process;
  const coord = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: launchedProcess.name, sessionId: launchedProcess.sessionId, role: 'coordinator' });
  await coord.waitForPresence([launchedProcess.name]);
  const made = await ui.request({ type: 'topic.create', title: 'A human decision' });
  assert.equal(made.ok, true, made.error);
  const topic = (made.value as { topic: { id: string } }).topic.id;
  assert.equal((await coord.call<{ ok: boolean }>('ask', { topic, question: 'Which option?', options: ['One', 'Two'] })).ok, true);
  assert.equal((await ui.request({ type: 'session.signal', session: launchedProcess.name, event: 'elicitation' })).ok, true);
  fixture.fakes['claude-code']!.feedUsage(launchedProcess.name, { total: { inputTokens: 1200, outputTokens: 34, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 1234 } });
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const row = page.locator('[data-object-id="asking-coordinator"]');
    await row.click();
    const detail = page.locator('[data-session-detail="asking-coordinator"]');
    assert.ok((await detail.textContent())?.includes('A human decision'));
    assert.ok((await row.textContent())?.includes('1.2k tok'));
  });
});

test('Sessions caps stopped rows at the latest twenty and reads merged archives with A', async t => {
  const clock = new FakeClock();
  const fixture = await webFixture(t, { clock });
  const ui = await connectUi(t, fixture.hub.discovery);
  for (let n = 0; n < 22; n++) {
    await clock.advance(1000);
    const name = `stopped-${String(n).padStart(2, '0')}`;
    assert.equal((await ui.request({ type: 'session.launch', name, harness: 'codex' })).ok, true);
    assert.equal((await ui.request({ type: 'session.stop', session: name })).ok, true);
  }
  assert.equal((await ui.request({ type: 'session.archive', session: 'stopped-00' })).ok, true);
  const sent: { type: string; archived?: boolean }[] = [];
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const stopped = page.getByRole('region', { name: 'Stopped', exact: true });
    await stopped.locator('[data-object-id="stopped-21"]').waitFor();
    assert.equal(await stopped.locator('[data-object-id]').count(), 20);
    assert.equal(await stopped.locator('[data-object-id="stopped-01"]').count(), 0);
    assert.equal(await stopped.locator('[data-object-id]').first().getAttribute('data-object-id'), 'stopped-21');
    assert.ok((await stopped.locator('header').textContent())?.includes('21'));
    assert.ok((await stopped.textContent())?.includes('1 archived'));
    await page.keyboard.press('Shift+/');
    const help = page.getByRole('dialog', { name: 'Sessions keys' });
    await help.waitFor();
    assert.equal(await help.locator('[data-key-action="session-archive-toggle"] dt').textContent(), 'Show archived sessions');
    assert.equal(await help.locator('[data-key-action="session-archive-toggle"] kbd').textContent(), 'A');
    await page.keyboard.press('Escape');
    const appeared = page.locator('[data-object-id="stopped-00"]').waitFor();
    await page.keyboard.press('Shift+a');
    await appeared;
    assert.equal(await page.getByRole('button', { name: 'Show archived sessions', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('region', { name: 'Archived', exact: true }).locator('[data-object-id="stopped-00"]').count(), 1);
    assert.equal(sent.filter(frame => frame.type === 'session.list' && frame.archived === true).length, 1);
    const nextArchived = page.getByRole('region', { name: 'Archived', exact: true }).locator('[data-object-id="stopped-01"]').waitFor();
    assert.equal((await ui.request({ type: 'session.archive', session: 'stopped-01' })).ok, true);
    await nextArchived;
    assert.ok((await stopped.textContent())?.includes('2 archived'));
    await page.getByRole('button', { name: 'Show archived sessions', exact: true }).click();
    assert.equal(await page.locator('[data-object-id="stopped-00"]').count(), 0);
  }, page => { page.on('websocket', socket => socket.on('framesent', event => sent.push(JSON.parse(String(event.payload))))); });
});

test('gs from an item reveals its claimed session inside a folded group', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const made = await ui.request({ type: 'task.create', title: 'Claimed session item', size: 'S', assignee: 'claimed-worker' });
  assert.equal(made.ok, true, made.error);
  const item = (made.value as { item: { id: string } }).item.id;
  const launched = await ui.request({ type: 'session.launch', name: 'claimed-worker', harness: 'codex', role: 'implementer' });
  assert.equal(launched.ok, true, launched.error);
  const launchedProcess = (launched.value as { process: HarnessProcessView }).process;
  const worker = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: launchedProcess.name, sessionId: launchedProcess.sessionId, role: 'implementer' });
  await worker.waitForPresence([launchedProcess.name]);
  const claimed = await worker.call<{ ok: boolean; error?: string }>('task.claim', { id: item });
  assert.equal(claimed.ok, true, claimed.error);
  fixture.fakes.codex!.idle(launchedProcess.name);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await page.getByRole('button', { name: 'Fold Idle', exact: true }).click();
    await page.getByRole('button', { name: 'Items', exact: true }).click();
    const tree = page.getByRole('tree', { name: 'Items tree' });
    await tree.locator('[data-tree-key=":unscheduled"]').click();
    await page.keyboard.press('l');
    await tree.locator(`[data-object-id="${item}"]`).click();
    await page.keyboard.press('g'); await page.keyboard.press('s');
    const row = page.locator('[data-session-slot="groups"] [data-object-id="claimed-worker"]');
    await row.waitFor();
    assert.equal(await row.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('button', { name: 'Fold Idle', exact: true }).getAttribute('aria-expanded'), 'true');
    assert.ok((await row.textContent())?.includes(item));
    assert.equal(await page.locator('[data-session-detail="claimed-worker"]').count(), 1);
  });
});

test('Sessions renders deaf health and clears it after the next injection', async t => {
  const scope = caseDeadlines(t, { timeoutMs: 15_000 });
  const clock = new FakeClock();
  const fixture = await scope.wait('fixture setup', () => webFixture(scope.fixtures, { clock }));
  const ui = await scope.wait('UI setup', () => connectUi(scope.fixtures, fixture.hub.discovery));
  await scope.wait('subscription setup', () => ui.request({ type: 'subscribe' }));
  const launched = await scope.wait('fake launch setup', () => ui.request({ type: 'session.launch', harness: 'claude-code', name: 'held-worker', role: 'implementer' }));
  assert.equal(launched.ok, true, launched.error);
  const process = (launched.value as { process: HarnessProcessView }).process;
  const peer = await scope.wait('spoke setup', () => inProcessSpoke(scope.fixtures, { discover: true, cwd: fixture.root, name: 'held-worker', sessionId: process.sessionId, launchToken: fixture.fakes['claude-code']!.spawns[0]!.launchToken! }));
  await scope.wait('spoke presence setup', () => peer.waitForPresence(['held-worker']));
  fixture.fakes['claude-code']!.busy('held-worker');
  const sent = await scope.wait('held input send', () => ui.request({ type: 'topic.send', topic: 'general', to: ['held-worker'], text: 'held human input' }));
  assert.equal(sent.ok, true, sent.error);
  const id = (sent.value as { message: { id: string } }).message.id;
  await scope.wait('rendered deaf and recovery receipts', () => fixture.pageCase(scope.fixtures, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await page.locator('[data-object-id="held-worker"]').waitFor();
    await clock.advance(300_001);
    const row = page.locator('[data-state="deaf"]:has([data-object-id="held-worker"])');
    await row.waitFor();
    assert.match(await row.textContent() ?? '', /deaf/);
    fixture.fakes['claude-code']!.idle('held-worker');
    await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'injected');
    await page.locator('[data-state="idle"]:has([data-object-id="held-worker"])').waitFor();
    assert.equal(await row.count(), 0);
  }));
});
