// Web: fake account registry and source readings through the sealed hub/browser fixture.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AccountList, HubFrame, WebSessionsResult } from '../../shared/wire/index.ts';
import { askHubFrame } from '../../hub/src/cli/socket-client.ts';
import { until } from '../../hub/test/until.ts';
import { connectUi } from '../../hub/test/harness.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import { pageUntil, webFixture, pausePageClock } from './harness.ts';
import { visibleProse } from './prose.ts';

test('Accounts profile shows this browser sign-in, last use and fixed 30-day cookie expiry', async t => {
  const clock = new FakeClock(new Date('2026-10-23T12:00:00Z'));
  const fixture = await webFixture(t, { clock, timezoneId: 'UTC' });
  await fixture.pageCase(t, async page => {
    const profile = page.getByRole('region', { name: 'Profile', exact: true });
    const rendered = profile.locator('time').nth(2).waitFor();
    await page.getByRole('button', { name: 'Accounts', exact: true }).click();
    await rendered;
    const { sessions } = await askHubFrame(fixture.hub.discovery, { type: 'web.sessions' }, 3000, {}) as WebSessionsResult;
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0]!.createdAt, '2026-10-23T12:00:00.000Z');
    assert.deepEqual(await profile.locator('time').evaluateAll(nodes => nodes.map(node => node.getAttribute('datetime'))), [sessions[0]!.createdAt, sessions[0]!.lastUsedAt, '2026-11-22T12:00:00.000Z']);
    for (const fact of ['This browser', 'Created', 'Last used', 'Cookie expires', 'Oct 23, 2026', 'Nov 22, 2026', '12:00 PM']) assert.ok((await profile.textContent())?.includes(fact), fact);
    assert.equal(await profile.locator('[data-account-id]').count(), 0, 'the profile is not a harness account');
    assert.equal(await profile.getByRole('button', { name: /revoke/i }).count(), 0);
    assert.deepEqual(await visibleProse(page), []);

    // Admission updates last use, while creation and expiry retain the original cookie lifetime.
    // Stay below the socket-silence deadline so only this reload changes admission.
    await clock.advance(30_000);
    const renewed = pageUntil(page, () => [...document.querySelectorAll('[aria-label="Profile"] time')].some(node => node.getAttribute('datetime') === '2026-10-23T12:00:30.000Z'), 'last use after browser reconnect');
    await page.reload();
    await renewed;
    assert.deepEqual(await profile.locator('time').evaluateAll(nodes => nodes.map(node => node.getAttribute('datetime'))), ['2026-10-23T12:00:00.000Z', '2026-10-23T12:00:30.000Z', '2026-11-22T12:00:00.000Z']);
  });
});

test('Accounts profile excludes a second browser context sign-in on the same hub', async t => {
  const clock = new FakeClock(new Date('2026-10-23T12:00:00Z'));
  const fixture = await webFixture(t, { clock, timezoneId: 'UTC' });
  const frames: Array<{ type: string }> = [];
  await fixture.pageCase(t, async first => {
    await first.getByRole('button', { name: 'Accounts', exact: true }).click();
    const firstProfile = first.getByRole('region', { name: 'Profile', exact: true });
    await firstProfile.locator('time').nth(2).waitFor();
    await clock.advance(30_000);
    const secondContext = await fixture.browser.newContext({ timezoneId: 'UTC', serviceWorkers: 'block' });
    secondContext.setDefaultTimeout(3000);
    try {
      const { url } = await askHubFrame(fixture.hub.discovery, { type: 'web.link' }, 3000, {}) as { url: string };
      const second = await secondContext.newPage();
      await second.goto(url);
      await second.getByRole('button', { name: 'Accounts', exact: true }).click();
      const secondProfile = second.getByRole('region', { name: 'Profile', exact: true });
      await secondProfile.locator('time').nth(2).waitFor();
      const { sessions } = await askHubFrame(fixture.hub.discovery, { type: 'web.sessions' }, 3000, {}) as WebSessionsResult;
      assert.equal(sessions.length, 2, 'two independent cookie records on the same hub');
      assert.deepEqual(sessions.map(row => row.createdAt).sort(), ['2026-10-23T12:00:00.000Z', '2026-10-23T12:00:30.000Z']);
      assert.deepEqual(await secondProfile.locator('time').evaluateAll(nodes => nodes.map(node => node.getAttribute('datetime'))), ['2026-10-23T12:00:30.000Z', '2026-10-23T12:00:30.000Z', '2026-11-22T12:00:30.000Z']);
      // Re-enter after the second admission: an own-profile read must still exclude it.
      await first.getByRole('button', { name: 'Sessions', exact: true }).click();
      const rendered = firstProfile.locator('time').nth(2).waitFor();
      await first.getByRole('button', { name: 'Accounts', exact: true }).click();
      await rendered;
      assert.deepEqual(await firstProfile.locator('time').evaluateAll(nodes => nodes.map(node => node.getAttribute('datetime'))), ['2026-10-23T12:00:00.000Z', '2026-10-23T12:00:00.000Z', '2026-11-22T12:00:00.000Z']);
      assert.equal(await firstProfile.getByText('This browser', { exact: true }).count(), 1);
      for (const record of sessions) assert.ok(!(await firstProfile.textContent())?.includes(record.id), 'browser identities are not exposed');
      assert.ok(frames.some(frame => frame.type === 'web.session'));
      assert.equal(frames.filter(frame => frame.type === 'web.sessions' || frame.type === 'web.revoke').length, 0);
    } finally { await secondContext.close(); }
  }, page => { page.on('websocket', socket => socket.on('framesent', event => frames.push(JSON.parse(String(event.payload))))); });
});

async function accountsFixture(t: TestContext) {
  const clock = new FakeClock(new Date('2026-10-23T12:00:00Z'));
  const resetsAt = '2026-10-23T15:10:00Z';
  const fixture = await webFixture(t, { clock, timezoneId: 'UTC', accountReader: async () => [
    { id: '5h', label: '5h', usedPercent: 12, resetsAt }, { id: 'wk', label: 'wk', usedPercent: 19, resetsAt },
  ], prepare: async root => {
    for (const name of ['a-main', 'b-limited', 'c-codex']) await mkdir(join(root, name));
    await writeFile(join(process.env.XDG_CONFIG_HOME!, 'cland/accounts.toml'), [
      `[accounts.c-codex]\nharness = "codex"\nhome = ${JSON.stringify(join(root, 'c-codex'))}`,
      `[accounts.a-main]\nharness = "claude-code"\nconfig_dir = ${JSON.stringify(join(root, 'a-main'))}`,
      `[accounts.b-limited]\nharness = "claude-code"\nconfig_dir = ${JSON.stringify(join(root, 'b-limited'))}`,
    ].join('\n'));
  } });
  const ui = await connectUi(t, fixture.hub.discovery);
  // Complete the fake reader before the session readings; no provider binaries run.
  assert.equal((await ui.request({ type: 'account.poll' })).ok, true);
  for (const [name, account, shares] of [['reading-worker', 'a-main', [38, 81]], ['limited-worker', 'b-limited', [100, 88]]] as const) {
    assert.equal((await ui.request({ type: 'session.launch', name, harness: 'claude-code', account })).ok, true);
    assert.equal((await ui.request({ type: 'session.signal', session: name, event: 'mod-measure', at: clock.now().getTime(), payload: { rateLimits: [
      { kind: 'five_hour', percentUsed: shares[0], resetsAt }, { kind: 'seven_day', percentUsed: shares[1], resetsAt },
    ] } })).ok, true);
  }
  await clock.advance(1000); // Publish the coalesced source readings before asserting the durable view.
  assert.equal((await ui.request({ type: 'session.signal', session: 'limited-worker', event: 'turn-end', payload: { hook_event_name: 'StopFailure', error: 'rate_limit' } })).ok, true);
  const listed = await ui.request({ type: 'account.list' });
  assert.equal(listed.ok, true, listed.error);
  assert.ok((listed.value as AccountList).accounts.find(row => row.name === 'b-limited')?.limited, 'durable limited mark before opening browser');
  assert.equal((listed.value as AccountList).accounts.find(row => row.name === 'a-main')?.windows[0]?.usedPercent, 38, 'source reading durable before opening browser');
  return { ...fixture, clock, ui };
}

test('Accounts lists the fake registry with every window, path, source and limited mark', async t => {
  const fixture = await accountsFixture(t);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Accounts', exact: true }).click();
    await page.locator('[data-account-id="claude-code/a-main"]').waitFor();
    assert.deepEqual(await page.locator('[data-account-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-account-id'))), ['claude-code/a-main', 'claude-code/b-limited', 'codex/c-codex']);
    const main = page.locator('[data-account-id="claude-code/a-main"]');
    for (const fact of ['Claude Code', join(fixture.root, 'a-main'), '5h', '38%', 'wk', '81%', '↻15:10', '<1m', 'from reading-worker']) assert.ok((await main.textContent())?.includes(fact), fact);
    const limited = page.locator('[data-account-id="claude-code/b-limited"]');
    for (const fact of ['100%', '88%', 'limited', '15:10', 'limited-worker', 'rate_limit', 'since 12:00']) assert.ok((await limited.textContent())?.includes(fact), fact);
    assert.ok((await page.locator('[data-account-id="codex/c-codex"]').textContent())?.includes('poll'));
    assert.equal(await page.getByRole('button', { name: /clear/i }).count(), 0);
    assert.deepEqual(await visibleProse(page), []);
  }, async page => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await pausePageClock(page, fixture.clock.now());
  });
});

test('entering Accounts polls once and ordinary account updates never repeat it', async t => {
  const fixture = await accountsFixture(t);
  const sent: Array<{ type: string; id: string }> = [];
  const received: HubFrame[] = [];
  await fixture.pageCase(t, async page => {
    const firstPoll = until(() => sent.some(frame => frame.type === 'account.poll'), { what: 'area entry account.poll frame', timeoutMs: 3000 });
    await page.getByRole('button', { name: 'Accounts', exact: true }).click();
    await firstPoll;
    const poll = sent.find(frame => frame.type === 'account.poll')!;
    await until(() => received.some(frame => frame.type === 'result' && frame.id === poll.id && frame.ok), { what: 'poll completion receipt', timeoutMs: 3000 });
    const update = pageUntil(page, () => document.querySelector('[data-account-id="claude-code/a-main"]')?.textContent?.includes('42%') === true, 'rendered account delta');
    assert.equal((await fixture.ui.request({ type: 'session.signal', session: 'reading-worker', event: 'mod-measure', at: fixture.clock.now().getTime(), payload: { rateLimits: [{ kind: 'five_hour', percentUsed: 42, resetsAt: '2026-10-23T15:10:00Z' }] } })).ok, true);
    await fixture.clock.advance(1000);
    await update;
    await page.getByRole('button', { name: 'Accounts', exact: true }).click();
    await page.getByRole('button', { name: 'Fold a-main', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Fold a-main', exact: true }).getAttribute('aria-expanded'), 'false');
    assert.equal(sent.filter(frame => frame.type === 'account.poll').length, 1);
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const secondPoll = until(() => sent.filter(frame => frame.type === 'account.poll').length === 2, { what: 'next Accounts entry poll', timeoutMs: 3000 });
    await page.getByRole('button', { name: 'Accounts', exact: true }).click();
    await secondPoll;
    assert.equal(sent.filter(frame => frame.type === 'account.poll').length, 2);
  }, page => { page.on('websocket', socket => {
    socket.on('framesent', event => sent.push(JSON.parse(String(event.payload))));
    socket.on('framereceived', event => received.push(JSON.parse(String(event.payload))));
  }); });
});

test('Sessions account strip shows worst windows, limited reset, tooltips and a folding Accounts link', async t => {
  const fixture = await accountsFixture(t);
  const sent: Array<{ type: string }> = [];
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const strip = page.locator('[data-session-slot="accounts"]');
    await strip.locator('[data-account-cell="claude-code/a-main"]').waitFor();
    assert.deepEqual(await strip.locator('[data-account-cell]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-account-cell'))), ['claude-code/a-main', 'claude-code/b-limited', 'codex/c-codex']);
    const main = strip.locator('[data-account-cell="claude-code/a-main"]');
    for (const fact of ['a-main', 'Claude Code', 'wk', '81%', '↻15:10']) assert.ok((await main.textContent())?.includes(fact), fact);
    assert.equal(await main.getByRole('meter').getAttribute('aria-valuenow'), '81');
    assert.equal(await main.locator('[data-account-share]').evaluate(node => getComputedStyle(node).color), 'rgb(240, 180, 41)');
    for (const fact of ['5h 38% ↻15:10', 'wk 81% ↻15:10', '<1m', 'from reading-worker']) assert.ok((await main.getAttribute('title'))?.includes(fact), fact);
    const limited = strip.locator('[data-account-cell="claude-code/b-limited"]');
    for (const fact of ['limited', '15:10', 'limited-worker']) assert.ok((await limited.textContent())?.includes(fact), fact);
    assert.equal(await limited.evaluate(node => getComputedStyle(node).color), 'rgb(255, 123, 114)');
    assert.equal(await limited.getByRole('meter').getAttribute('aria-valuenow'), '100');
    assert.deepEqual(await visibleProse(page), []);
    assert.equal(sent.filter(frame => frame.type === 'account.poll').length, 0, 'the Sessions strip does not poll');
    const fold = strip.getByRole('button', { name: 'Fold Accounts', exact: true });
    await fold.focus(); await fold.press('ArrowLeft');
    assert.equal(await fold.getAttribute('aria-expanded'), 'false');
    assert.equal(await main.isVisible(), false);
    await page.reload();
    await page.locator('[data-session-slot="accounts"]').getByRole('button', { name: 'Fold Accounts', exact: true }).waitFor();
    assert.equal(await fold.getAttribute('aria-expanded'), 'false');
    await fold.press('ArrowRight');
    assert.equal(await main.isVisible(), true);
    const accounts = page.locator('[data-area-module="Accounts"][data-area-surface="pane"]').waitFor();
    await strip.getByRole('link', { name: 'Accounts', exact: true }).click();
    await accounts;
    assert.equal(await page.locator('[data-account-id="claude-code/a-main"]').count(), 1);
    assert.deepEqual(await visibleProse(page), []);
  }, async page => {
    page.on('websocket', socket => socket.on('framesent', event => sent.push(JSON.parse(String(event.payload)))));
    await pausePageClock(page, fixture.clock.now());
  });
});

test('accounts without readings show dashes and a failed registry poll exposes no file values', async t => {
  let registry = '';
  const fixture = await webFixture(t, { accountReader: async () => [], prepare: async root => {
    registry = join(process.env.XDG_CONFIG_HOME!, 'cland/accounts.toml');
    await writeFile(registry, `[accounts.unread]\nharness = "codex"\nhome = ${JSON.stringify(join(root, 'unread'))}\n[accounts.open]\nharness = "opencode"\ndb = ${JSON.stringify(join(root, 'open.db'))}\n`);
  } });
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const strip = page.locator('[data-session-slot="accounts"]');
    for (const id of ['opencode/open', 'codex/unread']) {
      const cell = strip.locator(`[data-account-cell="${id}"]`);
      await cell.waitFor();
      assert.ok((await cell.textContent())?.includes('—'));
      assert.equal(await cell.getByRole('meter').count(), 0);
      assert.ok(!(await cell.textContent())?.includes('0%'));
    }
    await strip.getByRole('link', { name: 'Accounts', exact: true }).click();
    await page.locator('[data-account-id="opencode/open"]').waitFor();
    assert.ok((await page.locator('[data-account-id="opencode/open"]').textContent())?.includes('no limit data'));
    assert.ok((await page.locator('[data-account-id="codex/unread"]').textContent())?.includes('no reading yet'));
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await writeFile(registry, '[accounts.invalid]\nharness = "codex"\ntoken = "fake-secret-never-exposed"\n');
    const error = page.getByRole('alert').filter({ hasText: 'unknown key "token"' }).waitFor();
    await page.getByRole('button', { name: 'Accounts', exact: true }).click();
    await error;
    assert.ok((await page.getByRole('alert').textContent())?.includes(registry));
    assert.ok(!(await page.locator('body').textContent())?.includes('fake-secret-never-exposed'));
    assert.equal(await page.locator('[data-account-id]').count(), 0, 'failed registry reply replaces the old registry');
  });
});
