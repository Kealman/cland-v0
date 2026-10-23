// Web: area slots through one scratch hub and the isolated production browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import type { HubFrame } from '../../shared/wire/index.ts';
import { until } from '../../hub/test/until.ts';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi } from '../../hub/test/harness.ts';
import { pageUntil, webFixture } from './harness.ts';

test('area modules keep their slots and live hub state across a restart', async t => {
  const fixture = await webFixture(t, { prepare: async root => {
    await writeFile(join(process.env.XDG_CONFIG_HOME!, 'cland/accounts.toml'), `[accounts.slot-account]\nharness = "codex"\nhome = "${root}/slot-account"\n`);
  } });
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'session.launch', name: 'slot-session', harness: 'codex' })).ok, true);
  const created = await ui.request({ type: 'artifact.create', kind: 'note', title: 'Slot artifact', topic: 'general', content: 'A note' });
  assert.equal(created.ok, true, created.error);
  const artifact = (created.value as { artifact: { id: string } }).artifact;
  await t.test('Sessions, Accounts and Artifacts own pane, page and drawer slots', async t => {
    await fixture.pageCase(t, async page => {
      // Identity belongs to the viewer, independently of deferred capability bytes.
      const reads = Promise.withResolvers<void>();
      await page.route('**/a/**', async route => { await reads.promise; await route.continue(); });
      try {
        for (const [area, id] of [['Sessions', 'slot-session'], ['Accounts', 'codex/slot-account'], ['Artifacts', artifact.id]] as const) {
          await page.getByRole('button', { name: area, exact: true }).click();
          const pane = page.locator('[data-pane="primary"]');
          const module = pane.locator(`[data-area-module="${area}"][data-area-surface="pane"]`);
          await module.waitFor();
          assert.equal(await module.getAttribute('data-key-context'), area.toLowerCase());
          const row = module.locator(`[data-object-id="${id}"]`);
          await row.click();
          const drawer = page.getByRole('complementary', { name: 'Drawer', exact: true });
          await drawer.locator(`[data-area-module="${area}"][data-area-surface="drawer"]`).waitFor();
          await row.press('Meta+Enter');
          const other = page.locator('[data-pane="secondary"]');
          const detail = other.locator(`[data-area-module="${area}"][data-area-surface="page"]`);
          await detail.waitFor();
          if (area === 'Artifacts') {
            const viewer = detail.locator(`[data-artifact-viewer][data-artifact-selection="${id}"]`);
            await viewer.waitFor();
            assert.equal(await viewer.getAttribute('data-artifact-selection'), id);
            assert.equal(await viewer.getByText(id, { exact: true }).textContent(), id);
          }
          assert.ok((await detail.textContent())?.includes(id));
          assert.equal(await drawer.count(), 0);
          await other.getByRole('button', { name: 'Close', exact: true }).click();
          await other.waitFor({ state: 'detached' });
        }
      } finally { reads.resolve(); }
      await page.unrouteAll({ behavior: 'wait' });
      await page.getByRole('button', { name: 'Sessions', exact: true }).click();
      for (const name of ['header', 'accounts', 'verification', 'groups']) {
        assert.equal(await page.locator(`[data-session-slot="${name}"]`).count(), 1);
      }
      for (const area of ['Inbox', 'Topics', 'Events']) {
        await page.getByRole('button', { name: area, exact: true }).click();
        await page.getByRole('list', { name: `${area} objects`, exact: true }).waitFor();
      }
      await page.getByRole('button', { name: 'Items', exact: true }).click();
      await pageUntil(page, () => !!document.querySelector('[role="tree"][aria-label="Items tree"]'), 'existing Items tree renders');
    });
  });

  await t.test('pushed queue, account and artifact frames require no inventory rereads', async t => {
    const received: HubFrame[] = [];
    const sent: Array<{ type: string; id?: string }> = [];
    await fixture.pageCase(t, async page => {
      await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Live', 'authenticated connection');
      await until(() => received.some(frame => frame.type === 'result' && frame.id === 'shell-sessions') && received.some(frame => frame.type === 'result' && frame.id === 'shell-artifacts'), { what: 'initial inventory receipts', timeoutMs: 3000 });
      const local = await connectUi(t, fixture.hub.discovery, 'cli');
      sent.length = 0;
      const queueReceipt = until(() => received.some(frame => frame.type === 'verification.queue' && frame.queue.holder?.kind === 'hand run'), { what: 'queue holder frame delivered to browser', timeoutMs: 3000 });
      assert.equal((await local.request({ type: 'suite.slot', mode: 'hub-only', cwd: fixture.root, head: 'fixture-head', pid: process.pid, token: 'area-queue' })).ok, true);
      await queueReceipt;
      const accountReceipt = until(() => received.some(frame => frame.type === 'account' && frame.account.windows.some(window => window.usedPercent === 81)), { what: 'account replacement delivered to browser', timeoutMs: 3000 });
      fixture.fakes.codex!.feedUsage('slot-session', { rateLimits: { primary: { usedPercent: 81, resetsAt: 4094678400, windowDurationMins: 300 } }, rateLimitsAt: new Date().toISOString() });
      await accountReceipt;
      await page.getByRole('button', { name: 'Artifacts', exact: true }).click();
      const appeared = page.getByRole('button', { name: /Pushed artifact/ }).waitFor();
      const pushed = await ui.request({ type: 'artifact.create', kind: 'note', title: 'Pushed artifact', topic: 'general', content: 'Push' });
      assert.equal(pushed.ok, true, pushed.error);
      await appeared;
      const id = (pushed.value as { artifact: { id: string } }).artifact.id;
      assert.equal(await page.locator(`[data-object-id="${id}"]`).count(), 1);
      const folderResult = await ui.request({ type: 'artifact.create', kind: 'note', title: 'Artifact folder', topic: 'general', folder: true, entry: 'index.md', content: 'Folder' });
      assert.equal(folderResult.ok, true, folderResult.error);
      const folderId = (folderResult.value as { artifact: { id: string } }).artifact.id;
      const removed = page.locator(`[data-object-id="${id}"]`).waitFor({ state: 'detached' });
      assert.equal((await ui.request({ type: 'artifact.move', artifact: id, folder: folderId })).ok, true);
      await removed;
      assert.equal(await page.locator(`[data-object-id="${id}"]`).count(), 0, 'moved child leaves top-level inventory');
      await page.locator(`[data-object-id="${folderId}"]`).waitFor();
      await local.close();
      // A later action receipt fences incoming frames; leave no timer-only absence assertion.
      await page.getByRole('button', { name: 'Sessions', exact: true }).click();
      await page.locator('[data-object-id="slot-session"]').waitFor();
      assert.deepEqual(sent.filter(frame => ['session.list', 'account.list', 'artifact.list'].includes(frame.type)), []);
    }, page => { page.on('websocket', socket => {
      socket.on('framesent', event => sent.push(JSON.parse(String(event.payload))));
      socket.on('framereceived', event => received.push(JSON.parse(String(event.payload))));
    }); });
  });

  await t.test('a restarted hub replaces Sessions and Accounts without reloading the page', async t => {
    await fixture.pageCase(t, async page => {
      await page.getByRole('button', { name: 'Sessions', exact: true }).click();
      await page.locator('[data-object-id="slot-session"]').waitFor();
      await page.getByRole('button', { name: 'Accounts', exact: true }).click();
      await page.locator('[data-object-id="codex/slot-account"]').waitFor();
      await page.clock.install({ time: new Date('2026-10-22T12:00:00Z') });
      await page.clock.pauseAt(new Date('2026-10-22T12:00:01Z'));
      let reloads = 0;
      page.on('framenavigated', frame => { if (frame === page.mainFrame()) reloads++; });
      await fixture.hub.stop(); await fixture.hub.stopped;
      await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Offline', 'old hub disconnected');
      assert.equal(await page.locator('[data-object-id="codex/slot-account"]').count(), 1, 'offline retains last snapshot');
      // Fixture setup while every writer is stopped: the restarted hub has a different inventory.
      const database = new DatabaseSync(join(fixture.root, '.cland/hub.db'));
      try { database.exec('delete from harness_processes'); } finally { database.close(); }
      await writeFile(join(process.env.XDG_CONFIG_HOME!, 'cland/accounts.toml'), '[accounts.new-account]\nharness = "codex"\n');
      await fixture.restartHub();
      const next = await connectUi(t, fixture.hub.discovery);
      assert.equal((await next.request({ type: 'session.launch', name: 'new-session', harness: 'codex' })).ok, true);
      await page.clock.runFor(250);
      await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Live', 'new hub authenticated');
      await page.locator('[data-object-id="codex/new-account"]').waitFor();
      assert.equal(await page.locator('[data-object-id="codex/slot-account"]').count(), 0);
      await page.getByRole('button', { name: 'Sessions', exact: true }).click();
      await page.locator('[data-object-id="new-session"]').waitFor();
      assert.equal(await page.locator('[data-object-id="slot-session"]').count(), 0);
      assert.equal(reloads, 0, 'same document consumes the new snapshot');
    });
  });
});
