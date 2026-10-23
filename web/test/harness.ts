// Web: one scratch projectHub and Headless Shell per file; a context per case.
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from 'playwright-core';
import { accountFixtureEnvironment } from '../../hub/test/account-fixture-env.ts';
import { clandWithEnv, projectHub, tempProject, type ProjectHubOptions } from '../../hub/test/harness.ts';
import { onCleanup, ownProcess, captureProcess } from '../../hub/test/process-cleanup.ts';
import { until } from '../../hub/test/until.ts';
import { browserCache, webPrerequisite } from './prerequisite.ts';
import { askHubFrame } from '../../hub/src/cli/socket-client.ts';
import { decodeTerminalQr } from '../../hub/test/qr-decode.ts';

const traces = fileURLToPath(new URL('../test-results/', import.meta.url));

/** Leave a minute of install-to-pause headroom while preserving the exact target. */
export async function pausePageClock(page: Page, time: Date): Promise<void> {
  await page.clock.install({ time: new Date(time.getTime() - 60_000) });
  await page.clock.pauseAt(time);
}

/** Poll in Playwright's isolated evaluation world; never inject a script tag or eval. */
export async function pageUntil(page: Page, predicate: () => boolean, what: string): Promise<void> {
  await until(() => page.evaluate(predicate), { what, timeoutMs: 3000 });
  assert.equal(await page.evaluate(predicate), true, what);
}

/** Drive paused retry timers without racing real socket I/O or the handshake. */
export async function reconnectUntilLive(page: Page): Promise<void> {
  const live = () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Live';
  let advanced = 0;
  await until(async () => {
    if (await page.evaluate(live)) return true;
    // The retry cap is 10 s and the handshake deadline is 5 s. Never
    // advance beyond that ceiling, even while awaiting the final real receipt.
    if (advanced < 15_000) {
      await page.clock.runFor(250);
      advanced += 250;
    }
    // Each evaluation yields to real browser/socket I/O. Poll for the receipt
    // before advancing again, so a slow connection gets time to complete.
    const pollDeadline = performance.now() + 100;
    do {
      if (await page.evaluate(live)) return true;
    } while (performance.now() < pollDeadline);
    return false;
  }, { what: 'fake-clock hub reconnect is Live', timeoutMs: 15_000 });
  assert.equal(await page.evaluate(live), true, 'fake-clock hub reconnect is Live');
}

export async function webFixture(t: TestContext, options: { cliLink?: boolean | 'qr'; clock?: ProjectHubOptions['clock']; accountReader?: ProjectHubOptions['accountReader']; timezoneId?: string; prepare?: (root: string) => Promise<void> } = {}) {
  const root = await tempProject(t, 'w-');
  // Playwright creates its own --user-data-dir using os.tmpdir() in this worker.
  // Keep it short and owned, including the browser's artifacts and crash paths.
  const previousTmp = process.env.TMPDIR;
  process.env.TMPDIR = root;
  onCleanup(t, () => { if (previousTmp === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = previousTmp; });
  process.env.PLAYWRIGHT_BROWSERS_PATH = browserCache;
  const env = await accountFixtureEnvironment({ TMPDIR: root, TMP: root, TEMP: root, PLAYWRIGHT_BROWSERS_PATH: browserCache });
  await options.prepare?.(root);
  const hubOptions = { ...(options.clock ? { clock: options.clock } : {}), ...(options.accountReader ? { accountReader: options.accountReader } : {}) };
  let hub = await projectHub(t, root, {}, hubOptions);
  const openers = join(root, 'openers');
  if (options.cliLink) {
    await mkdir(openers);
    for (const name of ['open', 'xdg-open']) {
      const path = join(openers, name);
      await writeFile(path, '#!/bin/sh\nexit 99\n');
      await chmod(path, 0o700);
    }
  }
  const prerequisite = await webPrerequisite();
  if (!prerequisite.available) throw new Error(prerequisite.reason);
  const { chromium } = await import('playwright-core');
  const server = await chromium.launchServer({ executablePath: prerequisite.executablePath, headless: true, env, timeout: 15_000 });
  const child = server.process();
  const exited = once(child, 'exit'); // Armed before any shutdown, including assertion failure.
  const identity = captureProcess(child.pid);
  const census = async () => {
    const result = await promisify(execFile)('ps', ['-e', '-o', 'pid=,pgid='], { cwd: root, env });
    return result.stdout.split('\n').map(line => line.trim().split(/\s+/).map(Number)).filter(([, group]) => group === child.pid).map(([pid]) => pid!);
  };
  const cleanupProcess = ownProcess(undefined, child.pid);
  let browser: Awaited<ReturnType<typeof chromium.connect>> | undefined;
  let closing: Promise<void> | undefined;
  const close = () => closing ??= (async () => {
    let before: number[] = [];
    try { before = await census(); } finally {
      const killGuard = setTimeout(() => { void server.kill().catch(() => {}); }, 5000);
      try { await browser?.close(); } finally {
        try { await server.close(); await exited; } finally {
          clearTimeout(killGuard);
          try { await cleanupProcess(); } finally { await hub.stop(); await hub.stopped; }
        }
      }
    }
    await until(() => captureProcess(child.pid) === null, { what: 'Headless Shell PID reaped', timeoutMs: 5000 });
    assert.equal(captureProcess(child.pid), null);
    await until(async () => (await census()).length === 0, { what: 'browser process-group census empty', timeoutMs: 5000 });
    assert.deepEqual(await census(), [], 'no browser descendant outlives cleanup');
    t.diagnostic(`Web fixture census: browser group ${child.pid}; before ${before.length}; after 0; scratch hub stopped`);
    // A stopped receipt alone is not closed sockets/discovery: prove both edges refuse.
    await assert.rejects(askHubFrame(hub.discovery, { type: 'web.link' }, 500, {}));
  })();
  onCleanup(t, close);
  assert.equal(identity?.group, child.pid, 'Headless Shell owns its process group');
  assert.match(child.spawnfile, /(?:chrome-headless-shell|headless_shell)/);
  const profile = child.spawnargs.find(arg => arg.startsWith('--user-data-dir='));
  assert.ok(profile?.startsWith(`--user-data-dir=${root}/`), 'profile belongs to the scratch root');
  browser = await chromium.connect(server.wsEndpoint(), { timeout: 15_000 });
  let serial = 0;
  const tracePaths: string[] = [];
  const contexts = new Set<unknown>();
  async function pageCase(t: TestContext, body: (page: Page, origin: string, requests: string[]) => Promise<void>, beforeNavigate?: (page: Page) => void | Promise<void>, device: { phone?: boolean; serviceWorkers?: 'allow' | 'block' } = {}) {
    const context = await browser!.newContext({
      ...(device.phone ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } : { viewport: { width: 1440, height: 900 } }),
      serviceWorkers: device.serviceWorkers ?? 'block', ...(options.timezoneId ? { timezoneId: options.timezoneId } : {}),
    });
    assert.ok(!contexts.has(context), 'fresh context'); contexts.add(context);
    context.setDefaultTimeout(3000);
    let passed = false;
    let tracing = false;
    try {
      await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
      tracing = true;
      await context.addInitScript(() => {
        class StubNotification {
          static permission = 'granted';
          static async requestPermission() { return 'granted'; }
          close() {}
        }
        Object.defineProperty(globalThis, 'Notification', { value: StubNotification, configurable: true });
      });
      let url: string;
      if (options.cliLink) {
        const result = await clandWithEnv(root, { PATH: `${openers}:${env.PATH ?? ''}` }, 'web', options.cliLink === 'qr' ? '--qr' : '--no-open');
        assert.equal(result.code, 0, result.stderr);
        if (options.cliLink === 'qr') {
          const [printed, ...qr] = result.stdout.trimEnd().split('\n');
          assert.equal(decodeTerminalQr(qr.join('\n')), printed, 'QR encodes the printed sign-in link');
          assert.match(printed!, /^https:\/\/phone\.example\/auth\?token=[a-f0-9]{64}$/);
          const status = await askHubFrame(hub.discovery, { type: 'hub.status' }, 3000, {}) as { web: { port: number } };
          const link = new URL(printed!);
          // The tunnel is synthetic: redeem its exact path/token on this fixture's loopback edge.
          url = `http://127.0.0.1:${status.web.port}${link.pathname}${link.search}`;
        } else {
          url = result.stdout.trim();
          assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\/auth\?token=[a-f0-9]{64}$/);
        }
      } else {
        ({ url } = await askHubFrame(hub.discovery, { type: 'web.link' }, 3000, {}) as { url: string });
      }
      const origin = new URL(url).origin;
      const requests: string[] = [];
      context.on('request', request => requests.push(request.url()));
      const page = await context.newPage();
      await beforeNavigate?.(page);
      await page.goto(url, { waitUntil: 'load' });
      if (device.phone) await pageUntil(page, () => document.querySelector('nav[aria-label="Phone areas"]')?.children.length === 5, 'five rendered phone slots');
      else await pageUntil(page, () => document.querySelector('nav[aria-label="Areas"]')?.children.length === 7, 'seven rendered rail areas');
      assert.equal(page.url(), `${origin}/`);
      assert.ok((await context.cookies()).some(cookie => /^cland_[a-f0-9]{12}$/.test(cookie.name) && cookie.httpOnly));
      assert.equal((await context.request.get(url)).status(), 401, 'one-time frame link was spent');
      await body(page, origin, requests);
      passed = true;
    } finally {
      try {
        if (tracing && passed) await context.tracing.stop();
        else if (tracing) {
          await mkdir(traces, { recursive: true });
          const path = join(traces, `${process.pid}-${serial++}.zip`);
          await context.tracing.stop({ path });
          tracePaths.push(path);
          t.diagnostic(`Web failure trace: ${path}`);
        }
      } finally { await context.close(); }
    }
    assert.equal(browser!.contexts().length, 0, 'context explicitly closed');
  }
  const restartHub = async () => {
    await hub.stop();
    await hub.stopped;
    hub = await projectHub(t, root, {}, hubOptions);
  };
  return { root, get fakes() { return hub.fakes; }, get hub() { return hub; }, restartHub, browser, server, close, pageCase, tracePaths };
}
