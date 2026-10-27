// Web: public frames, trusted fake messengers and isolated Headless Shell.
import test from 'node:test';
import assert from 'node:assert/strict';
import { connectUi, inProcessSpoke } from '../../hub/test/harness.ts';
import { testMessenger } from '../../hub/test/fakes/messenger.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import type { Inbox, RemoteStatusResult } from '../../shared/wire/index.ts';
import { webFixture } from './harness.ts';
import { nvimOrSkip, startClient } from '../../nvim/test/harness.ts';
import { waitInitialSnapshots } from '../../nvim/test/readiness.ts';
import { until } from '../../hub/test/until.ts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { captureProcess, onCleanup, ownProcess } from '../../hub/test/process-cleanup.ts';
import { parseProcessTable, processTableArgs } from '../../hub/src/process-table.ts';
import { fixtureEnvironment } from '../../test-support/fixture-environment.ts';
import { once } from 'node:events';
import { within } from '../../hub/src/executor/droplet/deadline.ts';
import { realClock } from '../../hub/src/hub/clock.ts';

for (const phone of [false, true]) test(`pairing rows give local approval instructions without an approve control (${phone ? 'phone' : 'desktop'})`, async t => {
  const clock = new FakeClock();
  const telegram = testMessenger('telegram');
  const discord = testMessenger('discord', 'discord');
  const fixture = await webFixture(t, { clock, gatewayRemotes: [telegram, discord] });
  const local = await connectUi(t, fixture.hub.discovery, 'nvim');
  telegram.pair({ userId: '12345', chatId: '12345', guildId: null, name: 'Telegram human' });
  discord.pair({ userId: '23456', chatId: '34567', guildId: '45678', name: 'Discord human' });
  const before = (await local.request({ type: 'inbox.list' })).value as Inbox;
  assert.equal(before.pairings!.length, 2);
  const mutations: string[] = [];
  await fixture.pageCase(t, async page => {
    const section = page.locator('[data-inbox-section="asks"]');
    for (const pairing of before.pairings!) {
      const row = section.locator(`[data-object-id="${pairing.id}"]`);
      await row.waitFor();
      assert.match(await row.innerText(), /approve in the terminal or Neovim/);
      assert.equal(await row.locator('..').getByRole('textbox', { name: 'Approval command', exact: true }).inputValue(), pairing.command);
      await row.click();
      const detail = row.locator('..');
      assert.ok((await detail.innerText()).includes(pairing.text));
      const command = detail.getByRole('textbox', { name: 'Approval command', exact: true });
      assert.equal(await command.inputValue(), pairing.command);
      assert.equal(await command.getAttribute('readonly'), '');
      assert.equal(await detail.locator('button:not([data-object-id])').count(), 0);
      // Actual keydown reaches both the row and its nested native text control.
      for (const field of [false, true]) for (const key of ['Digit1', 'Digit2', 'KeyA', 'KeyD', 'KeyI', 'Enter']) {
        await page.getByRole('button', { name: 'Inbox', exact: true }).click();
        await row.click();
        await (field ? command : row).press(key);
      }
      await page.getByRole('button', { name: 'Inbox', exact: true }).click();
      await row.click();
      assert.equal(await command.inputValue(), pairing.command);
    }
    assert.equal(await section.locator('[data-inbox-kind="pairing"]').count(), 2);
    assert.equal(await section.locator('header > span').textContent(), '2');
    assert.deepEqual(mutations, []);
    assert.deepEqual(((await local.request({ type: 'inbox.list' })).value as Inbox).pairings, before.pairings);
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      route.onMessage(message => {
        const frame = JSON.parse(String(message)) as { type: string };
        if (['pairing.approve', 'approval.answer', 'topic.answer'].includes(frame.type)) mutations.push(frame.type);
        server.send(message);
      });
    });
  }, { phone });
});

// This cross-client grant needs the real Neovim connection and key map as well as the browser.
test('Neovim pairing card grants the fake messenger and both inboxes remove approved and expired codes', async t => {
  const found = await nvimOrSkip();
  if ('skip' in found) { t.skip(found.skip); return; }
  let nativePid: number | undefined;
  let nativeClose: Promise<unknown[]> | undefined;
  // This guard is registered before Web's close: its hub must outlive Neovim's teardown.
  onCleanup(t, async () => {
    assert.equal(captureProcess(nativePid), null, 'Neovim PID gone before closing its shared hub');
    if (nativeClose) {
      const [code, signal] = await within(nativeClose, 5000, realClock, () => new Error('Neovim native close receipt missing before shared hub stop'));
      t.diagnostic(`Pairing Neovim native close: exit ${String(code)}; signal ${String(signal)}; PID reaped before shared hub close`);
    }
  });
  const clock = new FakeClock();
  const telegram = testMessenger('telegram');
  const discord = testMessenger('discord', 'discord');
  const fixture = await webFixture(t, { clock, gatewayRemotes: [telegram, discord] });
  const autostartedHubs = async () => {
    const result = await promisify(execFile)('ps', processTableArgs(), {
      cwd: fixture.root, env: fixtureEnvironment(fixture.root, process.env), timeout: 5000, maxBuffer: 8 * 1024 * 1024,
    });
    return parseProcessTable(result.stdout).filter(row => row.command.includes(fixture.root)
      && /cland\.ts\s+hub\s+serve\b/.test(row.command)).map(row => row.pid);
  };
  onCleanup(t, async () => {
    // Web's close already joined the embedded hub; every native hub here is a leak.
    const leaked = await autostartedHubs();
    const disposers = leaked.map(pid => ownProcess(undefined, pid));
    for (const dispose of disposers) await dispose();
    await until(async () => (await autostartedHubs()).length === 0, { what: 'fixture-native hub PIDs gone', timeoutMs: 5000 });
    assert.deepEqual(await autostartedHubs(), [], 'no autostarted hub survives fixture teardown');
    assert.deepEqual(leaked, [], 'no autostarted hub required emergency cleanup');
    t.diagnostic('Pairing autostart hub census: 0 before emergency cleanup, 0 after');
  });
  const local = await connectUi(t, fixture.hub.discovery, 'nvim');
  const identity = { userId: '12345', chatId: '12345', guildId: null, name: 'Telegram human' };
  telegram.pair(identity);
  telegram.pair({ ...identity, userId: '12346', chatId: '12346', name: 'Other Telegram human' });
  discord.pair({ userId: '23456', chatId: '34567', guildId: '45678', name: 'Discord human' });
  const before = (await local.request({ type: 'inbox.list' })).value as Inbox;
  const tg = before.pairings!.find(row => row.messenger === 'telegram' && row.userId === identity.userId)!;
  const dc = before.pairings!.find(row => row.messenger === 'discord')!;
  // The child context owns Neovim even if startup/assertions fail. Its disposal
  // completes before the parent's Web fixture can stop the shared hub.
  await t.test('native client is reaped before the shared hub closes', async native => {
    const client = await startClient(native, found.bin, fixture.root);
    nativePid = client.process.pid;
    nativeClose = once(client.process, 'close');
    void nativeClose.catch(() => {});
    await waitInitialSnapshots(client);
    // Pairing's approval key remains ordinary text in the actual General composer.
    await client.input('<Esc><Space>c1a<Esc>');
    assert.match(await client.lua<string>("return table.concat(vim.api.nvim_buf_get_lines(require('cland.views').topic('general').composer.buf,0,-1,false),'\\n')"), /1a/);
    await client.input('<Space>N');
    await client.input('gg1<Esc>'); // No selected action row: the existing count is cancelled, never an approval.
    const lines = () => client.lua<string>("return table.concat(vim.api.nvim_buf_get_lines(require('cland.inbox').full,0,-1,false),'\\n')");
    const select = async (id: string) => {
      await client.lua("local id=...;local b=require('cland.inbox').full;for i=1,vim.api.nvim_buf_line_count(b) do local r=require('cland.panels').row_at(b,i);if r and r.pairing and r.pairing.id==id then vim.api.nvim_win_set_cursor(0,{i,0});return end end;error('missing pairing '..id)", id);
    };
    await client.waitScreen(s => s.includes(tg.code) && s.includes(dc.code), 'both waiting pairing rows');
    assert.ok((await lines()).includes(tg.text));
    assert.ok((await lines()).includes(dc.text));
    assert.match(await lines(), /ASKS AND APPROVALS\s+3/);
    await fixture.pageCase(t, async page => {
      const rows = page.locator('[data-inbox-kind="pairing"]');
      await page.locator(`[data-object-id="${tg.id}"]`).waitFor();
      await page.locator(`[data-object-id="${dc.id}"]`).waitFor();
      // The approval key is scoped to the card: it does nothing on a pairing row.
      await select(tg.id);
      await client.input('1<Ignore>');
      assert.deepEqual(((await local.request({ type: 'inbox.list' })).value as Inbox).pairings, before.pairings);
      await client.input('<CR>');
      await client.waitScreen(s => s.includes('1 approve pairing') && s.includes(tg.expires), 'pairing identity, code and expiry card');
      assert.match(await client.lua<string>("return table.concat(vim.api.nvim_buf_get_lines(0,0,-1,false),'\\n')"), /Telegram.*12345.*Telegram human/s);
      await client.input('q');
      await client.waitScreen(s => /ASKS AND APPROVALS\s+3/.test(s) && !s.includes('1 approve pairing'), 'closing the card leaves all three rows');
      assert.equal(((await local.request({ type: 'remote.status' })).value as RemoteStatusResult).remotes.find(row => row.messenger === 'telegram')!.pairing, null);
      await select(tg.id);
      await client.input('<CR>');
      await client.waitScreen(s => s.includes('1 approve pairing') && s.includes(tg.code), 'reopened pairing card');
      // Durable pairing and publication observers precede the actual approval key.
      const granted = until(async () => {
        const status = (await local.request({ type: 'remote.status' })).value as RemoteStatusResult;
        return status.remotes.find(row => row.messenger === 'telegram')?.pairing?.userId === identity.userId;
      }, { what: 'numeric Telegram grant', timeoutMs: 3000 });
      void granted.catch(() => {});
      const approvedSnapshot = until(() => client.lua<boolean>("local rows=require('cland.state').S.inbox.pairings;return #rows==1 and rows[1].messenger=='discord'"), { what: 'Neovim post-grant snapshot installed', timeoutMs: 3000 });
      void approvedSnapshot.catch(() => {});
      await client.input('1');
      await granted;
      await clock.advance(250);
      await approvedSnapshot;
      await client.waitScreen(s => s.includes('paired Telegram human'), 'paired name receipt');
      await client.waitScreen(s => s.includes(dc.code) && /ASKS AND APPROVALS\s+1/.test(s), 'one remaining Discord row rendered');
      await page.locator(`[data-object-id="${tg.id}"]`).waitFor({ state: 'detached' });
      assert.equal(await rows.count(), 1);
      assert.equal((await lines()).includes(tg.code), false);
      const status = (await local.request({ type: 'remote.status' })).value as RemoteStatusResult;
      assert.deepEqual(status.remotes.find(row => row.messenger === 'telegram')!.pairing, identity);
      await select(dc.id);
      await client.input('<CR>');
      await client.waitScreen(s => s.includes('1 approve pairing') && s.includes(dc.code), 'Discord pairing card');
      await page.locator(`[data-object-id="${dc.id}"]`).click();
      await page.getByRole('complementary', { name: 'Drawer', exact: true }).getByRole('button', { name: 'Split', exact: true }).click();
      const splitDetail = page.locator('[data-pane="secondary"] [data-pairing-detail]');
      await splitDetail.waitFor();
      assert.equal(await splitDetail.getByRole('textbox', { name: 'Approval command', exact: true }).inputValue(), dc.command);
      // Jump without replaying unrelated periodic hub tasks; then drive the exact expiry callback.
      clock.block(Date.parse(dc.expires) - clock.now().getTime() - 1);
      assert.equal(((await local.request({ type: 'inbox.list' })).value as Inbox).pairings![0]!.id, dc.id);
      const expiredSnapshot = until(() => client.lua<boolean>("return #require('cland.state').S.inbox.pairings==0"), { what: 'Neovim expired snapshot installed', timeoutMs: 3000 });
      void expiredSnapshot.catch(() => {});
      await clock.advance(1);
      await clock.advance(250);
      await expiredSnapshot;
      await page.locator(`[data-object-id="${dc.id}"]`).waitFor({ state: 'detached' });
      await splitDetail.waitFor({ state: 'detached' });
      assert.equal(await rows.count(), 0);
      assert.equal((await lines()).includes(dc.code), false);
      assert.deepEqual(((await local.request({ type: 'inbox.list' })).value as Inbox).pairings, []);
      await client.input('1');
      await client.waitScreen(s => s.includes('no live pairing code'), 'stale card reports hub refusal');
      await client.input('<Esc>');
      assert.deepEqual(await client.lua("return require('cland.actions').audit()"), []);
      const final = (await local.request({ type: 'remote.status' })).value as RemoteStatusResult;
      assert.equal(final.remotes.find(row => row.messenger === 'discord')!.pairing, null);
    });
  });
});

test('previous hub inbox without the optional pairings field keeps existing message rows usable', async t => {
  const fixture = await webFixture(t);
  const local = await connectUi(t, fixture.hub.discovery);
  const sender = await inProcessSpoke(t, { cwd: fixture.root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'previous-inbox' });
  const sent = await sender.call<{ ok: boolean }>('send', { topic: 'general', kind: 'decision', text: 'Previous hub report' });
  assert.equal(sent.ok, true);
  const message = ((await local.request({ type: 'inbox.list' })).value as Inbox).messages.find(row => row.text === 'Previous hub report')!;
  let previousShape = false;
  await fixture.pageCase(t, async page => {
    const row = page.locator(`[data-object-id="${message.id}"]`);
    await row.waitFor();
    await row.click();
    assert.match(await row.locator('..').innerText(), /Previous hub report/);
    assert.equal(await page.locator('[data-inbox-kind="pairing"]').count(), 0);
    assert.equal(previousShape, true, 'an actual inbox frame omitted pairings');
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      server.onMessage(message => route.send(JSON.stringify(JSON.parse(String(message)), (key, value: unknown) => {
        if (key === 'pairings') { previousShape = true; return undefined; }
        return value;
      })));
    });
  });
});
