// Web: phone Sessions through sealed fake Codex, public frames and Headless Shell.
// CLI session-list processes prove the specified Stop/Archive readback boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi } from '../../hub/test/harness.ts';
import type { HarnessProcessView } from '../../shared/wire/index.ts';
import { pageUntil, webFixture } from './harness.ts';

test('phone Sessions shows counts, one account row and two-line sessions without row actions', async t => {
  const fixture = await webFixture(t, { accountReader: async account => account.name === 'empty' ? [] : [
    { id: '5h', label: '5h', usedPercent: 38, resetsAt: '2026-10-24T22:00:00Z' },
    { id: 'wk', label: 'wk', usedPercent: 81, resetsAt: '2026-10-24T22:00:00Z' },
  ], prepare: async root => {
    for (const name of ['main', 'other', 'empty']) await mkdir(join(root, name));
    await writeFile(join(process.env.XDG_CONFIG_HOME!, 'cland/accounts.toml'), ['main', 'other', 'empty'].map(name =>
      `[accounts.${name}]\nharness = "codex"\nhome = ${JSON.stringify(join(root, name))}`).join('\n'));
  } });
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'account.poll' })).ok, true);
  for (const [name, role] of [['mine', 'aide'], ['waiting', 'implementer'], ['busy', 'implementer'], ['idle', 'reviewer']] as const) {
    const reply = await ui.request({ type: 'session.launch', name, role, harness: 'codex', account: 'main' });
    assert.equal(reply.ok, true, reply.error);
  }
  fixture.fakes.codex!.waitingForApproval('waiting');
  fixture.fakes.codex!.busy('busy');
  fixture.fakes.codex!.idle('idle');
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).tap();
    await page.locator('[data-object-id="idle"]').waitFor();
    assert.deepEqual(await page.locator('[data-session-count]').allTextContents(), ['Waiting 1', 'Busy 1', 'Idle 1', 'Yours 1']);
    const cells = page.locator('[data-account-cell]');
    assert.deepEqual(await cells.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-account-cell'))), ['codex/empty', 'codex/main', 'codex/other']);
    const boxes = await cells.evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { y: r.y, height: r.height, x: r.x, right: r.right }; }));
    assert.equal(new Set(boxes.map(box => box.y)).size, 1, 'accounts occupy one row');
    assert.ok(boxes.every(box => box.height >= 44 && box.x >= 0 && box.right <= 390));
    assert.match(await cells.nth(1).innerText(), /wk\s+81%/);
    assert.equal(await cells.nth(1).getByRole('meter').getAttribute('aria-valuenow'), '81');
    assert.equal((await cells.nth(0).locator('[data-account-share]').textContent())?.trim(), '—');
    assert.equal(await cells.nth(0).getByRole('meter').count(), 0);
    for (const name of ['mine', 'waiting', 'busy', 'idle']) {
      const row = page.locator(`[data-object-id="${name}"]`);
      assert.equal((await row.boundingBox())!.height, 52);
      const lines = await row.locator('[data-session-role], [data-item-requested]').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().y));
      assert.ok(lines[1]! > lines[0]!, 'item is below the identity');
    }
    assert.equal(await page.locator('[data-session-slot="groups"] [data-session-actions]:visible').count(), 0);
    await page.screenshot({ path: 'web/test-results/phone-sessions.png' });
    const busy = (await page.locator('[data-object-id="busy"]').boundingBox())!;
    const touch = await page.context().newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: busy.x + 30, y: busy.y + 24 }] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: busy.x + 250, y: busy.y + 24 }] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await touch.detach();
    assert.equal(await page.locator('[data-area-surface="page"]').count(), 0, 'swiping a row does not open an action');
    assert.equal(await page.locator('[data-session-slot="groups"] [data-session-actions]:visible').count(), 0);
    const sessions = await ui.request({ type: 'session.list' });
    assert.equal((sessions.value as { processes: HarnessProcessView[] }).processes.find(row => row.name === 'busy')?.status, 'running');
    await page.getByRole('button', { name: 'Fold Idle', exact: true }).tap();
    assert.equal(await page.locator('[data-object-id="idle"]').isVisible(), false);
    await page.getByRole('button', { name: 'Fold Idle', exact: true }).tap();
    const opened = page.locator('[data-area-module="Accounts"] [data-account-id="codex/main"]').waitFor();
    await cells.nth(1).tap();
    await opened;
    assert.equal(await page.locator('[data-area-module="Accounts"] input, [data-area-module="Accounts"] select, [data-area-module="Accounts"] textarea, [data-area-module="Accounts"] [role="switch"]').count(), 0);
    assert.equal(await page.getByRole('button', { name: /clear|edit|revoke/i }).count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  }, undefined, { phone: true });
});

test('phone waiting session page shows its command and both Back paths focus the same row', async t => {
  const fixture = await webFixture(t, { prepare: () => writeFile(join(process.env.XDG_CONFIG_HOME!, 'cland/accounts.toml'), '[accounts.phone-account]\nharness = "codex"\n') });
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'session.launch', name: 'phone-waiting', harness: 'codex', account: 'phone-account', model: 'gpt-phone' })).ok, true);
  const command = 'printf "' + 'the complete pending command '.repeat(12) + 'final argument"';
  fixture.fakes.codex!.waitingForApproval('phone-waiting', command);
  fixture.fakes.codex!.feedUsage('phone-waiting', { total: { inputTokens: 100, outputTokens: 25, reasoningTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 125, cost: 0.25 } });
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).tap();
    const row = page.locator('[data-object-id="phone-waiting"]');
    for (const back of ['button', 'browser']) {
      await row.tap();
      const detail = page.locator('[data-area-module="Sessions"][data-area-surface="page"]');
      await detail.getByRole('button', { name: 'Stop', exact: true }).waitFor();
      assert.equal(await page.getByRole('list', { name: 'Sessions objects', exact: true }).count(), 0);
      for (const fact of ['gpt-phone', 'phone-account', '125 tok', '$0.25', 'waiting for approval']) assert.ok((await detail.innerText()).includes(fact), fact);
      assert.equal(await detail.locator('code').textContent(), command);
      if (back === 'button') await page.screenshot({ path: 'web/test-results/phone-session-page.png' });
      const bounds = (await detail.boundingBox())!;
      assert.equal(bounds.x, 0);
      assert.equal(bounds.width, 390);
      assert.equal(await page.locator('[data-pane="secondary"]').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
      const control = page.getByRole('button', { name: 'Back to Sessions', exact: true });
      assert.ok((await control.boundingBox())!.height >= 44);
      if (back === 'button') await control.tap(); else await page.goBack();
      await row.waitFor();
      await pageUntil(page, () => document.activeElement?.getAttribute('data-object-id') === 'phone-waiting', 'originating row focus restored after Back');
      assert.equal(await row.getAttribute('aria-pressed'), 'true');
      assert.equal(await detail.count(), 0);
    }
  }, undefined, { phone: true });
});

test('phone Back restores focus when Stop moves the session into a folded group', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'session.launch', name: 'moving-session', harness: 'codex' })).ok, true);
  for (const back of ['button', 'browser']) {
    if (back === 'browser') assert.equal((await ui.request({ type: 'session.resume', session: 'moving-session', relaunch: true })).ok, true);
    fixture.fakes.codex!.busy('moving-session');
    await fixture.pageCase(t, async page => {
      await page.getByRole('button', { name: 'Sessions', exact: true }).tap();
      const fold = page.getByRole('button', { name: 'Fold Stopped', exact: true });
      await fold.tap();
      assert.equal(await fold.getAttribute('aria-expanded'), 'false');
      await page.locator('[data-object-id="moving-session"]').tap();
      const detail = page.locator('[data-area-module="Sessions"][data-area-surface="page"]');
      await detail.getByRole('button', { name: 'Stop', exact: true }).tap();
      const stopped = detail.getByRole('button', { name: 'Resume', exact: true }).waitFor();
      await detail.getByRole('button', { name: 'Confirm', exact: true }).tap();
      await stopped;
      if (back === 'button') await page.getByRole('button', { name: 'Back to Sessions', exact: true }).tap(); else await page.goBack();
      const row = page.getByRole('region', { name: 'Stopped', exact: true }).locator('[data-object-id="moving-session"]');
      await row.waitFor();
      assert.equal(await fold.getAttribute('aria-expanded'), 'true');
      await pageUntil(page, () => document.activeElement?.getAttribute('data-object-id') === 'moving-session', 'stopped row has focus after its destination fold commits open');
      assert.equal(await row.evaluate(node => node === document.activeElement), true);
    }, undefined, { phone: true });
  }
});

test('phone session page confirms 44 px Stop/Archive actions with scratch CLI receipts', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'session.launch', name: 'phone-busy', harness: 'codex' })).ok, true);
  fixture.fakes.codex!.busy('phone-busy');
  const listed = async (archived = false) => {
    const reply = await cland(fixture.root, 'session', 'list', ...(archived ? ['--archived'] : []), '--json');
    assert.equal(reply.code, 0, reply.stderr);
    return (JSON.parse(reply.stdout).processes as HarnessProcessView[]).find(row => row.name === 'phone-busy');
  };
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).tap();
    await page.locator('[data-object-id="phone-busy"]').tap();
    const detail = page.locator('[data-area-module="Sessions"][data-area-surface="page"]');
    const checkHeight = async (name: string) => assert.ok((await detail.getByRole('button', { name, exact: true }).boundingBox())!.height >= 44, name);
    await detail.getByRole('button', { name: 'Stop', exact: true }).waitFor();
    await checkHeight('Stop');
    await checkHeight('Capabilities');
    await detail.getByRole('button', { name: 'Stop', exact: true }).tap();
    const confirm = detail.getByRole('group', { name: 'Confirm Stop phone-busy', exact: true });
    await confirm.waitFor();
    assert.equal((await listed())?.status, 'running');
    await checkHeight('Confirm');
    await checkHeight('Cancel');
    await page.keyboard.press('Escape');
    assert.equal(await confirm.count(), 0);
    assert.equal(await detail.isVisible(), true, 'Escape cancels confirmation before leaving the page');
    await detail.getByRole('button', { name: 'Stop', exact: true }).tap();
    const stopped = detail.getByRole('button', { name: 'Resume', exact: true }).waitFor();
    await confirm.getByRole('button', { name: 'Confirm', exact: true }).tap();
    await stopped;
    assert.equal((await listed())?.status, 'stopped');
    await checkHeight('Resume');
    await checkHeight('Archive');
    await detail.getByRole('button', { name: 'Archive', exact: true }).tap();
    const archive = detail.getByRole('group', { name: 'Confirm Archive phone-busy', exact: true });
    await archive.waitFor();
    await archive.getByRole('button', { name: 'Cancel', exact: true }).tap();
    assert.equal((await listed())?.archivedAt, null);
    await detail.getByRole('button', { name: 'Archive', exact: true }).tap();
    const archived = detail.getByRole('button', { name: 'Archive', exact: true }).waitFor({ state: 'detached' });
    await archive.getByRole('button', { name: 'Confirm', exact: true }).tap();
    await archived;
    const receipt = await listed(true);
    assert.ok(receipt?.archivedAt);
    assert.equal(await detail.isVisible(), true);
  }, undefined, { phone: true });
});

test('phone verify line opens the shared queue in a full-height sheet and Close restores the list', async t => {
  const fixture = await webFixture(t);
  const holder = await connectUi(t, fixture.hub.discovery, 'cli');
  assert.equal((await holder.request({ type: 'suite.slot', mode: 'hub-only', cwd: fixture.root, head: 'phone-recorded-head', pid: process.pid, token: 'phone-hand-run' })).ok, true);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).tap();
    const line = page.locator('[data-session-slot="verification"] button');
    await pageUntil(page, () => document.querySelector('[data-session-slot="verification"]')?.textContent?.includes('verify: human') === true, 'hand run summary rendered');
    await line.tap();
    const sheet = page.getByRole('dialog', { name: 'Verification queue', exact: true });
    await sheet.getByRole('table', { name: 'Verification queue', exact: true }).waitFor();
    const bounds = (await sheet.locator(':scope > section').boundingBox())!;
    assert.deepEqual({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }, { x: 0, y: 0, width: 390, height: 844 });
    assert.equal(await sheet.evaluate(node => node.matches(':modal')), true);
    await page.screenshot({ path: 'web/test-results/phone-sessions-queue.png' });
    assert.match(await sheet.locator('[data-verification-row]').textContent() ?? '', /local 1\/1human/);
    const close = sheet.getByRole('button', { name: 'Close sheet', exact: true });
    assert.ok((await close.boundingBox())!.height >= 44);
    await close.tap();
    assert.equal(await sheet.count(), 0);
    assert.equal(await page.getByRole('list', { name: 'Sessions objects', exact: true }).isVisible(), true);
    assert.equal(await line.evaluate(node => node === document.activeElement), true);
    await line.press('Enter');
    await sheet.waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await sheet.count(), 0);
    assert.equal(await line.evaluate(node => node === document.activeElement), true);
  }, undefined, { phone: true });
});
