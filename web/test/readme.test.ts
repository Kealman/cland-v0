// Web: fresh-clone hub-start lifecycle and CLI-minted browser sign-in, not an already-running fixture hub.
import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { chromium, type Browser } from 'playwright-core';
import { fixtureEnvironment } from '../../test-support/fixture-environment.ts';
import { tempProject } from '../../hub/test/harness.ts';
import { beforeDirectories, captureProcess, onCleanup, ownProcess } from '../../hub/test/process-cleanup.ts';
import { until } from '../../hub/test/until.ts';
import { pageUntil } from './harness.ts';
import { webPrerequisite } from './prerequisite.ts';

const exec = promisify(execFile);
const installation = fileURLToPath(new URL('../../', import.meta.url));

test('the README fresh clone builds, starts its own hub and signs a Headless Shell context in', async t => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  const gettingStarted = readme.split('## Getting started\n')[1]?.split('\n## ')[0];
  assert.ok(gettingStarted, 'README needs a complete getting-started path');
  const snippets = [...gettingStarted.matchAll(/```sh\n([\s\S]*?)```/g)];
  assert.equal(snippets.length, 1, 'write the startup path once');
  const commands = snippets[0]![1]!.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  const shellFunction = 'cland() { node ./hub/bin/cland.ts "$@"; }';
  assert.deepEqual(commands, [
    'git clone https://github.com/Kealman/cland-v0.git cland-v0', 'cd cland-v0',
    'npm install', 'npm run build', shellFunction, 'cland hub start', 'cland web',
  ], 'the literal README commands cover clone, dependencies, build, CLI, hub and browser in order');

  const root = await tempProject(t, 'wr-');
  const seed = join(root, 'seed');
  const checkout = join(root, 'cland-v0');
  const bin = join(root, 'bin');
  await mkdir(seed);
  await mkdir(bin);
  for (const name of ['open', 'xdg-open', 'claude', 'codex', 'opencode']) {
    await writeFile(join(bin, name), name === 'open' || name === 'xdg-open'
      ? '#!/bin/sh\nprintf opened >> "$WEB_OPEN_RECEIPT"\nexit 99\n' : '#!/bin/sh\nexit 127\n', { mode: 0o700 });
  }
  const extras = {
    PATH: `${bin}:${dirname(process.execPath)}:/usr/bin:/bin`, TMPDIR: root, TMP: root, TEMP: root,
    WEB_OPEN_RECEIPT: join(root, 'opened'), CLAND_TEST_FIXTURE_ROOT: checkout,
    CLAND_TEST_ORPHAN_ROOT: checkout, CLAND_TEST_SKIP_ORPHAN_SWEEP: '1',
  };
  const env = fixtureEnvironment(root, process.env, extras);
  for (const key of ['HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME']) await mkdir(env[key]!, { recursive: true });
  const run = (command: string, args: string[], cwd = checkout) => exec(command, args, {
    cwd, env: fixtureEnvironment(root, process.env, extras), timeout: 30_000, maxBuffer: 2 * 1024 * 1024,
  });
  let daemon: { pid: number; reap: () => Promise<void> } | undefined;
  beforeDirectories(t, async () => {
    // Also recover ownership if an assertion/CLI failure happened just after startup.
    if (!daemon) {
      const discovery = await readFile(join(checkout, '.cland/hub.json'), 'utf8').then(JSON.parse, () => null) as { pid: number } | null;
      if (discovery) daemon = { pid: discovery.pid, reap: ownProcess(undefined, discovery.pid) };
    }
    if (!daemon) return;
    try { await run('/bin/sh', ['-c', `${shellFunction}\ncland hub stop`]); }
    finally { await daemon.reap(); }
    await until(() => captureProcess(daemon!.pid) === null, { what: 'README hub PID reaped before clone removal', timeoutMs: 5000 });
    assert.equal(captureProcess(daemon.pid), null);
    t.diagnostic('README scratch hub stopped and PID reaped before directory removal');
  });

  // Seed an independent source repository using filesystem reads, never Git in
  // the live checkout. Exclude live tracker/runtime data and all generated files.
  for (const name of ['package.json', 'package-lock.json', 'hub', 'web', 'shared', 'test-support']) {
    await cp(join(installation, name), join(seed, name), { recursive: true, filter: path => {
      const parts = relative(installation, path).split(sep);
      return !parts.some(part => ['node_modules', 'dist', 'test-results'].includes(part));
    } });
  }
  await run('git', ['init', seed], root);
  await run('git', ['add', '.'], seed);
  await run('git', ['commit', '-m', 'Sealed README source fixture'], seed);
  let link = '';
  for (const command of commands) {
    if (command.startsWith('git clone ')) {
      // Only the remote is substituted: this clone never contacts GitHub/network.
      await run('git', ['clone', '--no-hardlinks', seed, 'cland-v0'], root);
    } else if (command === 'cd cland-v0' || command === shellFunction) {
      continue; // cwd and the literal shell function are applied to subsequent commands.
    } else if (command === 'npm install') {
      // Allowed C1 substitution, as in task worktrees: reuse the root install,
      // avoiding a registry request and another Headless Shell download.
      await symlink(join(installation, 'node_modules'), join(checkout, 'node_modules'), 'dir');
      t.diagnostic('npm install substituted with the root node_modules symlink; no dependency/network install');
    } else if (command === 'npm run build') {
      await run('npm', ['run', 'build']);
      assert.match(await readFile(join(checkout, 'web/dist/index.html'), 'utf8'), /cland-build-stamp/);
    } else {
      const result = await run('/bin/sh', ['-c', `${shellFunction}\n${command === 'cland web' ? `${command} --no-open` : command}`]);
      if (command === 'cland hub start') {
        const discovery = JSON.parse(await readFile(join(checkout, '.cland/hub.json'), 'utf8')) as { pid: number; root: string };
        daemon = { pid: discovery.pid, reap: ownProcess(undefined, discovery.pid) };
        assert.equal(discovery.root, checkout);
        assert.ok(captureProcess(daemon.pid), 'this clone started an owned hub process');
      } else link = result.stdout.trim();
    }
  }
  assert.match(link, /^http:\/\/127\.0\.0\.1:\d+\/auth\?token=[a-f0-9]{64}$/);
  await assert.rejects(readFile(join(root, 'opened')), { code: 'ENOENT' });

  const prerequisite = await webPrerequisite();
  assert.ok(prerequisite.available, prerequisite.available ? '' : prerequisite.reason);
  const previousTmp = process.env.TMPDIR;
  process.env.TMPDIR = root; // Playwright's profile path is allocated by the parent.
  let server;
  try { server = await chromium.launchServer({ executablePath: prerequisite.executablePath, headless: true, env, timeout: 15_000 }); }
  finally { if (previousTmp === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = previousTmp; }
  const child = server.process();
  const exited = once(child, 'exit');
  const reap = ownProcess(undefined, child.pid);
  let browser: Browser | undefined;
  const census = async () => (await run('ps', ['-e', '-o', 'pid=,pgid='], root)).stdout.split('\n')
    .map(line => line.trim().split(/\s+/).map(Number)).filter(([, group]) => group === child.pid).map(([pid]) => pid);
  onCleanup(t, async () => {
    const killGuard = setTimeout(() => { void server.kill().catch(() => {}); }, 5000); // lint-allow-wall-clock: teardown safety deadline only; success waits for OS exit and an empty owned group
    try { await browser?.close(); await server.close(); await exited; }
    finally { clearTimeout(killGuard); await reap(); }
    await until(async () => (await census()).length === 0, { what: 'README Headless Shell process group empty', timeoutMs: 5000 });
    assert.equal(captureProcess(child.pid), null);
    assert.deepEqual(await census(), []);
    t.diagnostic('README Headless Shell PID reaped; final owned process-group census 0');
  });
  assert.match(child.spawnfile, /(?:chrome-headless-shell|headless_shell)/);
  assert.equal(captureProcess(child.pid)?.group, child.pid);
  assert.ok(child.spawnargs.some(arg => arg.startsWith(`--user-data-dir=${root}/`)), 'only the scratch browser profile is used');
  browser = await chromium.connect(server.wsEndpoint(), { timeout: 15_000 });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  context.setDefaultTimeout(3000);
  const origin = new URL(link).origin;
  const outside: string[] = [];
  await context.route('**/*', route => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    outside.push(route.request().url()); return route.abort();
  });
  await context.routeWebSocket('**', route => {
    if (route.url() === `${origin.replace('http:', 'ws:')}/ws`) { route.connectToServer(); return; }
    outside.push(route.url()); return route.close();
  });
  await context.addInitScript(() => {
    class StubNotification {
      static permission = 'granted';
      static async requestPermission() { return 'granted'; }
      close() {}
    }
    Object.defineProperty(globalThis, 'Notification', { value: StubNotification, configurable: true });
  });
  let passed = false;
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  try {
    assert.deepEqual(await context.cookies(), [], 'fresh context starts signed out');
    const page = await context.newPage();
    const auth = page.waitForResponse(response => new URL(response.url()).pathname === '/auth');
    const socket = page.waitForEvent('websocket');
    await page.goto(link);
    assert.equal((await auth).status(), 302);
    assert.equal((await socket).url(), `${origin.replace('http:', 'ws:')}/ws`);
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Live', 'README clone authenticated socket is Live');
    assert.equal(await page.locator('[aria-label="Project"]').textContent(), 'cland-v0');
    assert.equal(page.url(), `${origin}/`);
    const cookies = await context.cookies();
    assert.equal(cookies.length, 1);
    assert.equal(cookies[0]!.httpOnly, true);
    assert.equal(cookies[0]!.sameSite, 'Strict');
    assert.equal((await context.request.get(link)).status(), 401, 'the exact printed link was spent');
    assert.deepEqual(outside, [], 'all browser requests stay on the scratch loopback edge');
    passed = true;
  } finally {
    try {
      if (passed) await context.tracing.stop();
      else {
        const results = fileURLToPath(new URL('../test-results/', import.meta.url));
        await mkdir(results, { recursive: true });
        const trace = join(results, `readme-${process.pid}.zip`);
        await context.tracing.stop({ path: trace });
        t.diagnostic(`README failure trace: ${trace}`);
      }
    } finally { await context.close(); }
  }
  assert.equal(browser.contexts().length, 0);
});
