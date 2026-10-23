// Web: the rendered connection against the real cookie-authenticated edge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Response } from 'playwright-core';
import { until } from '../../hub/test/until.ts';
import { reconnectUntilLive, pageUntil, webFixture } from './harness.ts';

test('the printed web link connects the shell and reconnects with backoff after a hub restart', async t => {
  const fixture = await webFixture(t, { cliLink: true });
  await t.test('printed link, secret confinement and reconnect backoff', async t => {
    const responses: Response[] = [];
    const frames: string[] = [];
    await fixture.pageCase(t, async (page, origin) => {
      await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Live', 'the hub connection is live');
      const dot = page.locator('[aria-label="Hub connection"] > span');
      assert.equal(await dot.getAttribute('data-live'), 'true');
      const liveColour = await dot.evaluate(element => getComputedStyle(element).backgroundColor);
      assert.equal(await page.locator('[aria-label="Project"]').textContent(), basename(fixture.root));
      assert.equal(page.url(), `${origin}/`);
      await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
      // install() keeps ticking. Pause before disconnect so real edge/DOM work
      // cannot consume any of the retry delays asserted below.
      await page.clock.pauseAt(new Date('2026-01-02T00:00:00Z'));
      const attempts: string[] = [];
      const closed: boolean[] = [];
      page.on('websocket', socket => {
        const index = attempts.length;
        attempts.push(socket.url());
        closed.push(false);
        socket.once('close', () => { closed[index] = true; });
      });
      await fixture.hub.stop();
      await fixture.hub.stopped;
      await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Offline', 'the stopped hub is offline');
      assert.equal(await dot.getAttribute('data-live'), 'false');
      assert.notEqual(await dot.evaluate(element => getComputedStyle(element).backgroundColor), liveColour);
      assert.equal(await page.locator('[aria-label="Project"]').textContent(), basename(fixture.root));
      await page.clock.runFor(249);
      assert.equal(attempts.length, 0, 'no immediate retry loop');
      const retry = page.waitForEvent('websocket');
      await page.clock.runFor(1);
      await retry;
      await until(() => closed[0] === true, { what: 'failed retry socket closed', timeoutMs: 3000 });
      assert.equal(closed[0], true);
      assert.equal(attempts.length, 1);
      await fixture.restartHub();
      await page.clock.runFor(499);
      assert.equal(attempts.length, 1, 'the second retry backs off to 500 ms');
      await page.clock.runFor(1);
      await reconnectUntilLive(page);
      await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Live', 'the restarted hub is live without reload');
      assert.equal(await dot.evaluate(element => getComputedStyle(element).backgroundColor), liveColour);
      assert.equal(attempts.length, 2);
      assert.ok(attempts.every(url => url === `${origin.replace('http:', 'ws:')}/ws`));
      // The browser can read cookie metadata through automation, never through page JS.
      const cookies = await page.context().cookies();
      assert.equal(cookies.length, 1);
      assert.match(cookies[0]!.name, /^cland_[a-f0-9]{12}$/);
      assert.equal(cookies[0]!.httpOnly, true);
      assert.equal(cookies[0]!.sameSite, 'Strict');
      assert.equal(await page.evaluate(() => document.cookie), '');
      const auth = responses.find(response => new URL(response.url()).pathname === '/auth');
      assert.equal(auth?.status(), 302);
      assert.equal((await auth!.allHeaders()).location, '/');
      const scripts = responses.filter(response => new URL(response.url()).pathname.endsWith('.js'));
      assert.ok(scripts.length > 0, 'the production bundle was loaded');
      for (const response of scripts) {
        const csp = (await response.allHeaders())['content-security-policy'] ?? '';
        assert.match(csp, /script-src 'self'/);
        assert.ok(!/unsafe-inline|unsafe-eval/.test(csp));
      }
      const secret = fixture.hub.discovery.secret;
      const scan = (value: unknown) => assert.equal(JSON.stringify(value).includes(secret), false, 'hub secret never crosses the browser boundary');
      scan(await page.context().storageState());
      scan(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })));
      scan(frames);
      for (const response of responses) {
        scan({ url: response.url(), status: response.status(), headers: await response.allHeaders() });
        if (response.status() === 200) scan((await response.body()).toString());
      }
      const dist = fileURLToPath(new URL('../dist/', import.meta.url));
      const files = (await readdir(dist, { recursive: true, withFileTypes: true })).filter(file => file.isFile());
      assert.ok(files.length > 0);
      for (const file of files) {
        const path = relative(dist, join(file.parentPath, file.name)).split('/').map(encodeURIComponent).join('/');
        const response = await page.context().request.get(`${origin}/${path}`);
        assert.equal(response.status(), 200, path);
        scan(response.headers());
        scan((await response.body()).toString());
      }
      for (const path of ['/auth?token=unknown', '/absent.js']) {
        const response = await page.context().request.get(`${origin}${path}`);
        scan(response.headers());
        scan((await response.body()).toString());
      }
    }, page => {
      page.on('response', response => responses.push(response));
      page.on('websocket', socket => {
        socket.on('framesent', event => frames.push(String(event.payload)));
        socket.on('framereceived', event => frames.push(String(event.payload)));
      });
    });
  });

  await t.test('an older page reloads once when welcome names the current bundle build', async t => {
    await fixture.pageCase(t, async page => {
      await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Live', 'the original page is live');
      await page.locator('meta[name="cland-build-stamp"]').evaluate(element => element.setAttribute('content', 'older-page'));
      let documents = 0;
      page.on('framenavigated', frame => { if (frame === page.mainFrame()) documents++; });
      const reloaded = page.waitForEvent('framenavigated', { predicate: frame => frame === page.mainFrame() });
      await fixture.restartHub();
      await reloaded;
      await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Live', 'current bundle is live after reload');
      assert.equal(documents, 1, 'one reload replaces the older page');
      assert.match(await page.locator('meta[name="cland-build-stamp"]').getAttribute('content') ?? '', /^[a-f0-9]{64}$/);
    });
    await fixture.pageCase(t, async page => {
      await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Live', 'the page is initially live');
      await page.locator('meta[name="cland-build-stamp"]').evaluate(element => element.setAttribute('content', 'persistently-old-page'));
      await page.addInitScript(() => {
        const observer = new MutationObserver(() => {
          const meta = document.querySelector('meta[name="cland-build-stamp"]');
          if (meta) { meta.setAttribute('content', 'persistently-old-page'); observer.disconnect(); }
        });
        observer.observe(document, { childList: true, subtree: true });
      });
      let documents = 0;
      page.on('framenavigated', frame => { if (frame === page.mainFrame()) documents++; });
      const reloaded = page.waitForEvent('framenavigated', { predicate: frame => frame === page.mainFrame() });
      await fixture.restartHub();
      await reloaded;
      await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Live', 'a persistently stale entry stops reloading and remains usable');
      assert.equal(await page.locator('meta[name="cland-build-stamp"]').getAttribute('content'), 'persistently-old-page');
      assert.equal(documents, 1, 'a stale proxy cannot cause a reload loop');
    });
  });

  await t.test('a protocol refusal displays Restart hub and stops retrying', async t => {
    let connections = 0;
    await fixture.pageCase(t, async page => {
      await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Restart hub', 'protocol refusal names the recovery');
      await page.clock.install();
      await page.clock.runFor(60_000);
      assert.equal(connections, 1, 'protocol skew cannot be repaired by reconnecting');
      assert.equal(await page.locator('[aria-label="Hub connection"] > span').getAttribute('data-live'), 'false');
    }, async page => {
      await page.routeWebSocket('**/ws', route => {
        connections++;
        const server = route.connectToServer();
        route.onMessage(message => {
          const frame = JSON.parse(String(message)) as { type: string; protocol?: number };
          if (frame.type === 'hello') frame.protocol = 999;
          server.send(JSON.stringify(frame));
        });
      });
    });
  });
});
