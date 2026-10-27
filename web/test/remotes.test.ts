// Web: production Telegram, loopback fake Bot API and isolated Headless Shell.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultConfig, renderConfig } from '../../hub/src/init/config.ts';
import { Store } from '../../hub/src/hub/store.ts';
import { setSecret } from '../../hub/src/remote/secrets.ts';
import { fakeTelegramFixture, TELEGRAM_TEST_TOKEN } from '../../hub/test/fakes/telegram/fake-api.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import { control, pairing } from '../../hub/test/telegram-polling-fixture.ts';
import { within } from '../../hub/src/executor/droplet/deadline.ts';
import { until } from '../../hub/test/until.ts';
import { connectUi } from '../../hub/test/harness.ts';
import type { HubFrame } from '../../shared/wire/index.ts';
import { pageUntil, resizePage, webFixture } from './harness.ts';

for (const phone of [false, true]) test(`Sessions Remotes renders native outage within one second and clears its error on recovery (${phone ? 'phone' : 'desktop'})`, async t => {
  const clock = new FakeClock();
  const name = phone ? `Fixture human ${'long-paired-name'.repeat(8)}` : pairing.name;
  const native = fakeTelegramFixture(t, { clock });
  const fake = await native.start();
  const polled = fake.waitForPoll();
  const logs: Record<string, unknown>[] = [];
  const fixture = await webFixture(t, { clock, log: entry => { logs.push(entry); }, env: { CLAND_TELEGRAM_API_ROOT: fake.url }, prepare: async root => {
    await mkdir(join(root, '.cland'), { recursive: true });
    const config = defaultConfig('Web Remotes fixture');
    config.remote.telegram.enabled = true;
    config.verification.lockPath = join(root, 'suite.lock');
    await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
    setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
    const seed = new Store(join(root, '.cland/hub.db'));
    try {
      seed.remotes.forMessenger('telegram').setPairing({ ...pairing, name });
      seed.remotes.forMessenger('telegram').set('mute', 'true');
    } finally { seed.close(); }
  } });
  const poll = await within(polled, 1_000);
  const frames: HubFrame[] = [];
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    // A second browser-owned socket uses its HttpOnly cookie and the literal
    // previous protocol-2 hello. Safe state may arrive; management stays local.
    const authorityFrames = await within(page.evaluate(() => new Promise<unknown[]>(resolve => {
      const socket = new WebSocket(`${location.origin.replace('http:', 'ws:')}/ws`);
      const frames: Array<{ type: string; id?: string }> = [];
      socket.onopen = () => socket.send(JSON.stringify({ type: 'hello', protocol: 2, client: 'ui' }));
      socket.onmessage = event => {
        const frame = JSON.parse(String(event.data)) as { type: string; id?: string };
        frames.push(frame);
        if (frame.type === 'welcome') socket.send(JSON.stringify({ type: 'remote.status', id: 'remote-refusal' }));
        if (frame.type === 'result' && frame.id === 'remote-refusal') { socket.close(); resolve(frames); }
      };
    })), 1_000) as HubFrame[];
    const refusal = authorityFrames.find(frame => frame.type === 'result' && frame.id === 'remote-refusal');
    assert.ok(refusal?.type === 'result' && !refusal.ok);
    assert.equal(refusal.code, 'cli-neovim-only');
    assert.match(refusal.error, /remote management stays on the local connection/);
    assert.ok(authorityFrames.some(frame => frame.type === 'remote.state' && frame.remotes[0]?.connection === 'connected'));
    const section = page.locator('[data-session-slot="remotes"]');
    const row = section.locator('[data-remote="telegram"]');
    await row.waitFor();
    assert.match(await section.innerText(), /Remotes/);
    assert.match(await row.innerText(), /telegram.*connected.*paired Fixture human.*muted.*outbox 0/s);
    const plain = await row.evaluate(node => getComputedStyle(node).color);
    assert.notEqual(plain, 'rgb(255, 123, 114)');
    if (phone) {
      const bounds = await section.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 320, 'Remotes sits inside the phone Sessions screen');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 320, 'no horizontal phone page scroll');
      assert.equal(await row.evaluate(node => node.scrollWidth <= node.clientWidth), true, 'long paired names wrap within the row');
    }
    const snapshot = frames.find(frame => frame.type === 'snapshot' && frame.domain === 'sessions');
    assert.ok(snapshot?.type === 'snapshot' && snapshot.domain === 'sessions');
    assert.equal(snapshot.value.remotes?.[0]?.pairedName, name);
    // The same failed held native poll as nvim/test/remotes.test.ts. Arm the
    // actual red DOM receipt before triggering; setup has a separate bound.
    const offline = until(() => page.evaluate(() => {
      const row = document.querySelector('[data-remote="telegram"]');
      return !!row && /offline since.*fake outage/s.test(row.textContent ?? '')
        && getComputedStyle(row).color === 'rgb(255, 123, 114)';
    }), { what: 'native outage rendered red within one second', timeoutMs: 1_000, loadFactor: 1 });
    void offline.catch(() => {});
    await control(fake.url, 'fault', { method: 'getUpdates', code: 500, description: 'fake outage' });
    const closed = fake.waitForPollClose(poll.id);
    await control(fake.url, 'release-polls', {});
    await within(closed, 1_000);
    await offline;
    assert.match(await row.innerText(), /offline since.*fake outage/s);
    assert.equal(await row.evaluate(node => getComputedStyle(node).color), 'rgb(255, 123, 114)');
    if (phone) assert.equal(await row.evaluate(node => node.scrollWidth <= node.clientWidth), true, 'failure facts also fit the phone row');
    assert.ok(frames.some(frame => frame.type === 'remote.state' && frame.remotes[0]?.connection === 'offline'), 'browser receives the actual remote-state push');
    await until(() => logs.some(entry => entry.event === 'telegram-poll-retry'), { what: 'native retry delay armed', timeoutMs: 1_000 });
    assert.ok(logs.some(entry => entry.event === 'telegram-poll-retry'));
    const recovered = until(() => page.evaluate(() => {
      const row = document.querySelector('[data-remote="telegram"]');
      return !!row && /connected/.test(row.textContent ?? '') && !row.textContent?.includes('fake outage')
        && getComputedStyle(row).color !== 'rgb(255, 123, 114)';
    }), { what: 'native recovery rendered plain', timeoutMs: 1_000, loadFactor: 1 });
    void recovered.catch(() => {});
    await clock.advance(1_000);
    await recovered;
    assert.match(await row.innerText(), /connected.*paired Fixture human.*muted.*outbox 0/s);
    assert.equal(await row.evaluate(node => getComputedStyle(node).color), plain);
    assert.equal(JSON.stringify(frames).includes(TELEGRAM_TEST_TOKEN), false);
    await page.reload();
    await pageUntil(page, () => document.querySelector('[data-remote="telegram"]')?.textContent?.includes('connected') === true, 'remote snapshot renders after reload');
    assert.match(await row.innerText(), /connected.*paired Fixture human.*muted.*outbox 0/s);
    const local = await connectUi(t, fixture.hub.discovery, 'cli');
    let activePoll = 0;
    await until(async () => {
      const state = await control<{ pendingPolls: Array<{ id: number }> }>(fake.url, 'state');
      activePoll = state.pendingPolls[0]?.id ?? 0;
      return activePoll > 0;
    }, { what: 'native poll ready for fatal stop', timeoutMs: 1_000 });
    const stopped = until(() => page.evaluate(() => {
      const row = document.querySelector('[data-remote="telegram"]');
      return !!row && /stopped.*wrong or revoked token \(401\)/s.test(row.textContent ?? '')
        && getComputedStyle(row).color === 'rgb(255, 123, 114)';
    }), { what: 'native stopped cause rendered red', timeoutMs: 1_000, loadFactor: 1 });
    void stopped.catch(() => {});
    await control(fake.url, 'fault', { method: 'getUpdates', code: 401 });
    const stoppedPoll = fake.waitForPollClose(activePoll);
    await control(fake.url, 'release-polls', {});
    await within(stoppedPoll, 1_000);
    await stopped;
    assert.match(await row.innerText(), /stopped.*wrong or revoked token \(401\)/s);
    assert.equal(await row.evaluate(node => getComputedStyle(node).color), 'rgb(255, 123, 114)');
    const boundary = frames.length;
    const disabled = until(() => frames.slice(boundary).some(frame => frame.type === 'remote.state'
      && frame.remotes[0]?.connection === 'disabled' && frame.remotes[0]?.enabled === false),
    { what: 'browser receives configuration-disabled remote state', timeoutMs: 1_000 });
    void disabled.catch(() => {});
    const disabling = await local.request({ type: 'config.set', key: 'remote.telegram.enabled', value: false });
    assert.equal(disabling.ok, true, JSON.stringify(disabling));
    await disabled;
    await section.waitFor({ state: 'detached' });
    assert.equal(await section.count(), 0);
    assert.equal(JSON.stringify(frames).includes(TELEGRAM_TEST_TOKEN), false);
    if (!phone) {
      let previousSnapshot = false;
      const reads: string[] = [];
      await page.routeWebSocket('**/ws', route => {
        const server = route.connectToServer();
        route.onMessage(message => {
          reads.push((JSON.parse(String(message)) as { type: string }).type);
          server.send(message);
        });
        server.onMessage(message => {
          const frame = JSON.parse(String(message)) as HubFrame;
          if (frame.type === 'remote.state') return;
          if (frame.type === 'snapshot' && frame.domain === 'sessions') {
            delete frame.value.remotes;
            previousSnapshot = true;
          }
          route.send(JSON.stringify(frame));
        });
      });
      await page.reload();
      await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Live', 'previous-hub snapshot remains usable');
      assert.equal(previousSnapshot, true);
      assert.equal(await section.count(), 0);
      assert.equal(await page.locator('[data-session-slot="verification"]').count(), 1);
      assert.equal(reads.includes('remote.status'), false);
    }
  }, async page => {
    if (phone) await resizePage(page, { width: 320, height: 844 });
    page.on('websocket', socket => socket.on('framereceived', event => frames.push(JSON.parse(String(event.payload)) as HubFrame)));
  }, { phone });
});
