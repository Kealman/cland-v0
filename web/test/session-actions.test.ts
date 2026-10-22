// Web: session actions through a sealed fake harness, public frames and Headless Shell.
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, inProcessSpoke } from '../../hub/test/harness.ts';
import { until } from '../../hub/test/until.ts';
import type { HarnessProcessView } from '../../shared/wire/index.ts';
import { pageUntil, webFixture } from './harness.ts';

test('Stop confirms in place, Escape keeps the busy session, and Enter stops it', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'session.launch', name: 'stop-worker', role: 'implementer', harness: 'codex' })).ok, true);
  fixture.fakes.codex!.busy('stop-worker');
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const row = page.locator('[data-object-id="stop-worker"]');
    await row.click();
    await row.press('x');
    const confirm = page.getByRole('group', { name: 'Confirm Stop stop-worker', exact: true });
    await confirm.waitFor();
    await confirm.getByRole('button', { name: 'Cancel', exact: true }).focus();
    await page.keyboard.press('Enter');
    await pageUntil(page, () => !document.querySelector('[aria-label="Confirm Stop stop-worker"]'), 'Enter on Cancel leaves the session running');
    await row.press('x');
    await confirm.waitFor();
    assert.equal(await page.locator('[data-session-detail="stop-worker"]').getByRole('button', { name: 'Stop', exact: true }).count(), 0);
    await page.keyboard.press('Escape');
    assert.equal(await confirm.count(), 0);
    const running = await cland(fixture.root, 'session', 'list', '--json');
    assert.equal(running.code, 0, running.stderr);
    assert.equal((JSON.parse(running.stdout).processes as HarnessProcessView[]).find(p => p.name === 'stop-worker')?.status, 'running');
    await row.press('x');
    await confirm.waitFor();
    const stopped = page.getByRole('region', { name: 'Stopped', exact: true }).locator('[data-object-id="stop-worker"]').waitFor();
    await page.keyboard.press('Enter');
    await stopped;
    const listed = await cland(fixture.root, 'session', 'list', '--json');
    assert.equal(listed.code, 0, listed.stderr);
    assert.equal((JSON.parse(listed.stdout).processes as HarnessProcessView[]).find(p => p.name === 'stop-worker')?.status, 'stopped');
    await pageUntil(page, () => !document.querySelector('[aria-label="Confirm Stop stop-worker"]'), 'confirmation cleared after receipt');
  });
});

test('Offline session actions are disabled and do not replay after reconnect', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'session.launch', name: 'offline-worker', harness: 'codex' })).ok, true);
  let disconnect!: () => void;
  const mutations: string[] = [];
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const row = page.locator('[data-object-id="offline-worker"]');
    await row.click();
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Live', 'authenticated');
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    disconnect();
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Offline', 'socket disconnected');
    const actions = page.locator('[data-session-actions="offline-worker"]');
    assert.equal(await actions.getByRole('button', { name: 'Stop', exact: true }).isDisabled(), true);
    await row.press('x');
    assert.equal(await actions.getByRole('group').count(), 0);
    await page.clock.runFor(250);
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Live', 'reconnected');
    assert.equal(await actions.getByRole('button', { name: 'Stop', exact: true }).isDisabled(), false);
    assert.deepEqual(mutations, []);
    const listed = await ui.request({ type: 'session.list' });
    assert.equal((listed.value as { processes: HarnessProcessView[] }).processes.find(p => p.name === 'offline-worker')?.status, 'running');
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      route.onMessage(message => {
        const frame = JSON.parse(String(message)) as { type: string };
        if (['session.stop', 'session.resume', 'session.archive'].includes(frame.type)) mutations.push(frame.type);
        server.send(message);
      });
      disconnect = () => { route.close(); server.close(); };
    });
  });
});

test('A failed Stop shows the hub reason and a pending confirmation sends only once', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'session.launch', name: 'failed-worker', harness: 'codex' })).ok, true);
  const fake = fixture.fakes.codex!;
  const stop = fake.stop.bind(fake);
  fake.stop = async () => { throw new Error('Planted adapter stop refusal'); };
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const row = page.locator('[data-object-id="failed-worker"]');
    await row.click();
    await row.press('x');
    const actions = page.locator('[data-session-actions="failed-worker"]');
    await actions.getByRole('button', { name: 'Confirm', exact: true }).click();
    await actions.getByRole('alert').waitFor();
    assert.match(await actions.getByRole('alert').textContent() ?? '', /Planted adapter stop refusal/);
    const listed = await ui.request({ type: 'session.list' });
    assert.equal((listed.value as { processes: HarnessProcessView[] }).processes.find(p => p.name === 'failed-worker')?.status, 'running');
    await page.keyboard.press('Escape');
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    let count = 0;
    fake.stop = async (...args) => { count++; await held; return stop(...args); };
    try {
      await row.press('x');
      await actions.getByRole('group').waitFor();
      await page.keyboard.press('Enter');
      await until(() => count === 1, { what: 'fake adapter received Stop', timeoutMs: 3000 });
      await page.keyboard.press('Enter');
      assert.equal(await actions.getByRole('button', { name: 'Confirm', exact: true }).isDisabled(), true);
      assert.equal(count, 1);
      const stopped = page.getByRole('region', { name: 'Stopped', exact: true }).locator('[data-object-id="failed-worker"]').waitFor();
      release();
      await stopped;
      assert.equal(count, 1);
    } finally { release(); fake.stop = stop; }
  });
});

test('At narrow width a tap or Enter opens the session page', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'session.launch', name: 'narrow-worker', harness: 'codex', model: 'gpt-fake-1' })).ok, true);
  await fixture.pageCase(t, async page => {
    await page.setViewportSize({ width: 600, height: 900 });
    assert.equal(await page.evaluate(() => window.matchMedia('(max-width: 639px)').matches), true);
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await page.locator('[data-object-id="narrow-worker"]').click();
    const detail = page.locator('[data-pane="primary"] [data-area-surface="page"]');
    await detail.getByRole('button', { name: 'Stop', exact: true }).waitFor();
    assert.ok((await detail.textContent())?.includes('gpt-fake-1'));
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const row = page.locator('[data-object-id="narrow-worker"]');
    await row.focus();
    await page.keyboard.press('Enter');
    await detail.getByRole('table', { name: 'narrow-worker capabilities', exact: true }).waitFor();
    assert.equal(await page.locator('[data-pane="secondary"]').count(), 0);
  });
});

test('The session page shows facts and capabilities and shares all four actions', async t => {
  const fixture = await webFixture(t, { prepare: () => writeFile(join(process.env.XDG_CONFIG_HOME!, 'cland/accounts.toml'), '[accounts.page-account]\nharness = "codex"\n') });
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'session.launch', name: 'page-worker', harness: 'codex', model: 'gpt-fake-1', account: 'page-account' })).ok, true);
  fixture.fakes.codex!.feedUsage('page-worker', { total: { inputTokens: 100, outputTokens: 25, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 125, cost: 0.25 } });
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const row = page.locator('[data-object-id="page-worker"]');
    await row.click();
    await row.press('Meta+Enter');
    const detail = page.locator('[data-pane="secondary"] [data-area-surface="page"]');
    await detail.getByRole('table', { name: 'page-worker capabilities', exact: true }).waitFor();
    for (const fact of ['gpt-fake-1', 'page-account', '$0.25', '125 tok']) assert.ok((await detail.textContent())?.includes(fact), fact);
    await detail.getByRole('button', { name: 'Capabilities', exact: true }).click();
    assert.equal(await detail.getByRole('table').count(), 0);
    await page.keyboard.press('c');
    await detail.getByRole('table').waitFor();
    await detail.getByRole('button', { name: 'Stop', exact: true }).click();
    const stop = detail.getByRole('group', { name: 'Confirm Stop page-worker', exact: true });
    await stop.waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await stop.count(), 0);
    await page.keyboard.press('x');
    await stop.waitFor();
    const stopped = detail.getByRole('button', { name: 'Resume', exact: true }).waitFor();
    await page.keyboard.press('Enter');
    await stopped;
    const resumed = detail.getByRole('button', { name: 'Stop', exact: true }).waitFor();
    await page.keyboard.press('r');
    await resumed;
    await page.keyboard.press('x');
    await stop.waitFor();
    await stop.getByRole('button', { name: 'Confirm', exact: true }).click();
    await detail.getByRole('button', { name: 'Resume', exact: true }).waitFor();
    await page.keyboard.press('d');
    const archive = detail.getByRole('group', { name: 'Confirm Archive page-worker', exact: true });
    await archive.waitFor();
    await archive.getByRole('button', { name: 'Confirm', exact: true }).click();
    await pageUntil(page, () => !document.querySelector('[data-pane="primary"] [data-object-id="page-worker"]'), 'page archive removed list row');
    const listed = await ui.request({ type: 'session.list', archived: true });
    assert.ok((listed.value as { processes: HarnessProcessView[] }).processes.find(p => p.name === 'page-worker')?.archivedAt);
  });
});

test('Unavailable resume shows its reason and offers a fresh launch with the same brief', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const made = await ui.request({ type: 'artifact.create', kind: 'prompt', title: 'Session brief', topic: 'general', content: 'Continue the recorded session work.' });
  assert.equal(made.ok, true, made.error);
  const brief = (made.value as { artifact: { id: string } }).artifact.id;
  assert.equal((await ui.request({ type: 'session.launch', name: 'fresh-worker', role: 'implementer', harness: 'codex', brief })).ok, true);
  assert.equal((await ui.request({ type: 'session.stop', session: 'fresh-worker' })).ok, true);
  fixture.fakes.codex!.scriptResume('fresh-worker', 'gone');
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await page.locator('[data-object-id="fresh-worker"]').click();
    const actions = page.locator('[data-session-actions="fresh-worker"]');
    await actions.getByRole('button', { name: 'Resume', exact: true }).click();
    await actions.getByRole('alert').waitFor();
    assert.match(await actions.getByRole('alert').textContent() ?? '', /fake conversation gone/);
    const fresh = actions.getByRole('button', { name: 'Launch fresh', exact: true });
    await fresh.waitFor();
    assert.equal(await fresh.getAttribute('title'), `Same brief: ${brief}`);
    const started = actions.getByRole('button', { name: 'Stop', exact: true }).waitFor();
    await fresh.click();
    await started;
    const listed = await ui.request({ type: 'session.list' });
    assert.equal((listed.value as { processes: HarnessProcessView[] }).processes.find(p => p.name === 'fresh-worker')?.status, 'running');
    assert.ok(fixture.fakes.codex!.spawns.at(-1)!.brief!.text.includes('Continue the recorded session work.'));
    assert.equal(fixture.fakes.codex!.spawns.at(-1)!.resumeConversation, undefined);
  });
});

test('Capabilities shows the read-only adapter table or the missing adapter', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'session.launch', name: 'cap-worker', harness: 'codex' })).ok, true);
  const unmanaged = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'no-adapter' });
  await unmanaged.waitForPresence(['no-adapter']);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const row = page.locator('[data-object-id="cap-worker"]');
    await row.click();
    await row.press('c');
    const table = page.getByRole('table', { name: 'cap-worker capabilities', exact: true });
    await table.waitFor();
    assert.deepEqual(await table.locator('tr').allTextContents(), [
      'busyreliable', 'idlereliable', 'waiting for approvalreliable', 'waiting for humanreliable', 'unknownalways',
      'Historynone', 'Usagereliable', 'Model changenone', 'Approval relaynone', 'Terminalnone',
    ]);
    assert.equal(await table.locator('button, input, select, textarea').count(), 0);
    await page.keyboard.press('Escape');
    assert.equal(await table.count(), 0);
    await page.locator('[data-object-id="no-adapter"]').click();
    await page.keyboard.press('c');
    await page.getByText('No adapter for no-adapter', { exact: true }).waitFor();
    assert.equal(await page.getByRole('table').count(), 0);
  });
});

test('Archive confirms once and moves the stopped session into the archive', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'session.launch', name: 'archive-worker', harness: 'codex' })).ok, true);
  assert.equal((await ui.request({ type: 'session.stop', session: 'archive-worker' })).ok, true);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const row = page.locator('[data-object-id="archive-worker"]');
    await row.click();
    await row.press('d');
    const confirm = page.getByRole('group', { name: 'Confirm Archive archive-worker', exact: true });
    await confirm.waitFor();
    await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await confirm.count(), 0);
    assert.equal(await page.getByRole('region', { name: 'Stopped', exact: true }).locator('[data-object-id="archive-worker"]').count(), 1);
    await page.locator('[data-session-detail="archive-worker"]').getByRole('button', { name: 'Archive', exact: true }).click();
    await confirm.waitFor();
    const removed = row.waitFor({ state: 'detached' });
    await confirm.getByRole('button', { name: 'Confirm', exact: true }).click();
    await removed;
    await page.getByRole('button', { name: 'Show archived sessions', exact: true }).click();
    const archived = page.getByRole('region', { name: 'Archived', exact: true }).locator('[data-object-id="archive-worker"]');
    await archived.waitFor();
    assert.equal(await page.getByRole('region', { name: 'Stopped', exact: true }).locator('[data-object-id="archive-worker"]').count(), 0);
    assert.equal(await archived.count(), 1);
    const listed = await ui.request({ type: 'session.list', archived: true });
    assert.ok((listed.value as { processes: HarnessProcessView[] }).processes.find(p => p.name === 'archive-worker')?.archivedAt);
  });
});

test('Resume relaunches the stopped session with its name, role and claim', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'task.create', title: 'Resume this work', size: 'S' })).ok, true);
  const launched = await ui.request({ type: 'session.launch', name: 'resume-worker', role: 'implementer', harness: 'codex', item: 'T-1' });
  assert.equal(launched.ok, true, launched.error);
  const before = (launched.value as { process: HarnessProcessView }).process;
  const spoke = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: before.name, sessionId: before.sessionId, launchToken: fixture.fakes.codex!.spawns[0]!.launchToken! });
  await spoke.waitForEvent(e => e.params.meta?.kind === 'role');
  assert.equal((await ui.request({ type: 'session.stop', session: before.name })).ok, true);
  await spoke.close();
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const row = page.locator('[data-object-id="resume-worker"]');
    await row.click();
    const resumed = page.locator('[data-session-detail="resume-worker"]').getByRole('button', { name: 'Stop', exact: true }).waitFor();
    await row.press('r');
    await resumed;
    const listed = await cland(fixture.root, 'session', 'list', '--json');
    assert.equal(listed.code, 0, listed.stderr);
    const after = (JSON.parse(listed.stdout).processes as HarnessProcessView[]).find(p => p.name === before.name)!;
    assert.equal(after.status, 'running');
    assert.equal(after.role, 'implementer');
    assert.equal(after.sessionId, before.sessionId);
    assert.equal(after.harnessSessionId, before.harnessSessionId);
    const item = await ui.request({ type: 'task.view', item: 'T-1' });
    assert.equal((item.value as { item: { claim: { sessionId: string } } }).item.claim.sessionId, before.sessionId);
  });
});
