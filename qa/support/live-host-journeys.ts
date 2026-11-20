import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { createServer, createConnection, type Server, type Socket } from 'node:net';
import { mkdir, open, writeFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fixture } from '../../hub/test/host-create-fixture.ts';
import { clandWithEnv, startDaemon, connectUi, eventually, pidAlive } from '../../hub/test/harness.ts';
import { hostDirectory } from '../../shared/fake-host-directory.ts';
import { readyLogin } from '../../hub/test/settled-login-fixture.ts';
import { Store } from '../../hub/src/hub/store.ts';
import { webFixture } from '../../web/test/harness.ts';
import { ensureWebBuild } from '../../hub/test/web-build.ts';
import { nvimOrSkip, startClient } from '../../nvim/test/harness.ts';
import { waitInitialSnapshots } from '../../nvim/test/readiness.ts';
import { tunnelControl } from '../../hub/test/fakes/host-tunnel-control.ts';
import { fileURLToPath } from 'node:url';
import type { Page } from 'playwright-core';
import type { JourneyScope } from './native-journey.ts';
import { closeRelayResources } from './relay-close.ts';
const removalReceipts = new WeakMap<Page, { id?: string; result?: { ok: boolean; value?: { removed: string } } }>();

async function scratch(t: TestContext, scope: JourneyScope) {
  return scope.setup('complete workbench acquisition', async () => {
    await ensureWebBuild(fileURLToPath(new URL('../../', import.meta.url)));
    const prerequisite = await nvimOrSkip();
    if (!('bin' in prerequisite)) throw Error(prerequisite.skip);
    const f = await fixture(t, { cardSignIn: {}, loginRoles: true });
    scope.adoptRoot(f.root);
    await f.hub.stop();
    const env = f.env as Record<string, string>;
    env.CLAND_OPENCODE_BIN = join(f.root, 'bin/opencode');
    env.FAKE_OPENCODE_HOME = join(f.root, 'native-opencode');
    const daemon = await startDaemon(t, f.root, env);
    const closed = Promise.withResolvers<void>();
    let stopped: Promise<void> | undefined;
    const stop = () => stopped ??= (async () => {
      const result = await clandWithEnv(f.root, env, 'hub', 'stop');
      assert.equal(result.code, 0, result.stderr);
      await eventually('journey hub reaped', () => !pidAlive(daemon.discovery.pid) || undefined, 15000);
      assert.equal(pidAlive(daemon.discovery.pid), false);
      closed.resolve();
    })();
    f.stops.push(stop);
    const cli = async (...args: string[]) => scope.step('scratch CLI command', async () => {
      const result = await clandWithEnv(f.root, env, ...args);
      assert.equal(result.code, 0, result.stderr);
      return result.stdout;
    });
    const nvim = await startClient(t, prerequisite.bin, f.root);
    await waitInitialSnapshots(nvim);
    await nvim.lua("vim.api.nvim_set_current_win(require('cland.layout').win.right);vim.api.nvim_win_set_width(0,115)");
    const web = await webFixture(t, { project: async () => ({ root: f.root }), cliLink: true,
      startHub: async () => ({ ...f.hub, discovery: daemon.discovery, stop, stopped: closed.promise }), env });
    // Use the fixture's isolated browser/owner, without its failure traces: those
    // contain the private one-use authentication URL from navigation.
    const pageCase = async (_t: TestContext, body: (page: Page) => Promise<void>) => {
      return scope.step('complete browser context acquisition and body', async () => {
        const context = await web.browser!.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
        context.setDefaultTimeout(3000);
        try {
          const url = (await cli('web', '--no-open')).trim();
          const origin = new URL(url).origin;
          await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
          const page = await context.newPage();
          const removal: { id?: string; result?: { ok: boolean; value?: { removed: string } } } = {};
          removalReceipts.set(page, removal);
          page.on('websocket', socket => {
            socket.on('framesent', event => {
              const frame = JSON.parse(String(event.payload));
              if (frame.type === 'login.remove' && frame.name === 'web-login') removal.id = frame.id;
            });
            socket.on('framereceived', event => {
              const frame = JSON.parse(String(event.payload));
              if (frame.type === 'result' && removal.id && frame.id === removal.id) removal.result = frame;
            });
          });
          await page.goto(url, { waitUntil: 'load' });
          await page.getByRole('button', { name: 'Sessions', exact: true }).waitFor();
          await body(page);
        } finally { await context.close(); }
      });
    };
    const ui = await connectUi(t, daemon.discovery, 'cli');
    return { f, cli, nvim, nvimBinary: prerequisite.bin, web: { ...web, pageCase }, ui };
  });
}

/** Fake sshd direct-tcpip for the fixture OpenCode's loopback listeners. */
export async function relays(f: { root: string; beforeStop(work: () => Promise<void>): unknown }, hosts: Array<{ machine: { id: string } }>, control: {
  afterTick?: () => void;
  opened?: (server: Server, path: string) => void;
} = {}) {
  const servers = new Map<string, Server>(), sockets = new Set<Socket>();
  const serverClosed = new WeakSet<Server>();
  const failed = Promise.withResolvers<unknown>();
  const machines = new Map(hosts.map(host => [host.machine.id, host]));
  const mappedMachines = new Set<string>();
  const mapMachine = async (host: { machine: { id: string } }) => {
    if (mappedMachines.has(host.machine.id)) return;
    const directory = hostDirectory(f.root, host.machine.id);
    await mkdir(join(directory, 'home/relay'), { recursive: true });
    await writeFile(join(directory, 'ports.json'), JSON.stringify(Object.fromEntries(Array.from({ length: 65536 - 1024 }, (_, i) => [i + 1024, `relay/${i + 1024}.sock`]))));
    mappedMachines.add(host.machine.id);
  };
  for (const host of hosts) await mapMachine(host);
  let pending = Promise.resolve(), closed = false;
  const tick = async () => {
    for (const id of await readdir(dirname(hostDirectory(f.root, 'fake-probe')))) if (id.startsWith('fake-')) machines.set(id, { machine: { id } });
    for (const host of machines.values()) await mapMachine(host);
    let content: string;
    try {
      const file = await open(join(f.root, 'fake-opencode/serve-ports.jsonl'));
      try {
        const bytes = Buffer.alloc(16385);
        const read = await file.read(bytes, 0, bytes.length, 0);
        if (read.bytesRead > 16384) throw Error('fixture serve-port history exceeds 16 KiB budget');
        content = bytes.subarray(0, read.bytesRead).toString('utf8');
      } finally { await file.close(); }
    }
    catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return; throw e; }
    for (const port of content.trim().split('\n').filter(Boolean).map(Number)) {
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('invalid fixture serve port');
      // Each native listener uses a distinct port; expose it on every fake machine.
      for (const host of machines.values()) {
        const key = `${host.machine.id}:${port}`;
        if (servers.has(key)) continue;
        const server = createServer(a => {
          sockets.add(a); a.on('close', () => sockets.delete(a));
          if (closed) { a.destroy(); return; }
          const b = createConnection({ host: '127.0.0.1', port });
          sockets.add(b); b.on('close', () => sockets.delete(b));
          a.pipe(b).pipe(a); a.on('error', () => b.destroy()); b.on('error', () => a.destroy());
        });
        server.once('close', () => serverClosed.add(server));
        servers.set(key, server);
        const path = join(hostDirectory(f.root, host.machine.id), 'home/relay', `${port}.sock`);
        await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(path, resolve); });
        control.opened?.(server, path);
      }
    }
    control.afterTick?.();
  };
  const timer = setInterval(() => { if (!closed) { pending = pending.then(tick); void pending.catch(error => failed.resolve(error)); } }, 50);
  const close = async () => {
    closed = true; clearInterval(timer);
    await closeRelayResources(pending, () => [
      async () => {
        const closes = [...sockets].map(socket => new Promise<void>(resolve => {
          socket.once('close', () => resolve()); socket.destroy();
        }));
        await Promise.all(closes);
      },
      ...[...new Set(servers.values())].map(server => async () => {
        if (serverClosed.has(server)) return;
        await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
        assert.equal(serverClosed.has(server), true);
        assert.equal(server.listening, false);
      }),
    ]);
  };
  f.beforeStop(close);
  return { close, failed: failed.promise };
}

export async function liveWorkbenches(t: TestContext, scope: JourneyScope) {
  const { f, cli, nvim, nvimBinary, web, ui } = await scratch(t, scope);
  await scope.step('complete remote-session and workbench journey', async () => {
    const hosts: Array<{ id: string; state: string; machine: { id: string } }> = [];
    for (let i = 0; i < 2; i++) hosts.push(JSON.parse(await cli('host', 'create', 'agents')));
    assert.ok(hosts.every(host => host.state === 'ready'));
    await relays(f, hosts);
    const store = f.own(new Store(join(f.root, '.cland/hub.db')));
    await readyLogin(f.root, f.env, store.hosts.logins, 'opencode');
    // A second independent disk is needed for the second host binding.
    const { settledLogin } = await import('../../hub/test/settled-login-fixture.ts');
    await settledLogin(store.hosts.logins, hosts[1]!.id, 'opencode', { provider: 'fake', region: 'fake-1', project: f.root, env: f.env });
    store.hosts.logins.unbind(`opencode-${hosts[1]!.id}`.slice(0, 32), hosts[1]!.id);
    for (const [i, host] of hosts.entries()) {
      const result = await ui.request({ type: 'session.launch', name: `journey-${i}`, host: host.id, harness: 'opencode', cwd: f.root, model: 'opencode/fake-paid' }, 60000);
      assert.equal(result.ok, true, result.error);
    }
    await eventually('two running remote session receipts', async () => {
      const rows = JSON.parse(await cli('session', 'list', '--json')).processes;
      return hosts.every((host, i) => rows.some((row: { name: string; host: string; status: string; pid: number }) => row.name === `journey-${i}` && row.host === host.id && row.status === 'running' && row.pid)) || undefined;
    }, 60000);
    await nvim.waitScreen(s => s.includes('agents 2/2 hosts') && hosts.every(host => s.includes(host.id)), 'two live host-named session rows');
    await nvim.input('<Esc>gg/Hosts<CR>za');
    await nvim.waitScreen(s => hosts.every(host => s.includes(host.id)) && s.includes('sessions journey'), 'expanded live host list');
    await web.pageCase(t, async page => {
      await page.getByRole('button', { name: 'Sessions', exact: true }).click();
      if (!await page.locator('[data-host-id]').count()) await page.getByRole('button', { name: 'Fold Hosts', exact: true }).click();
      for (const host of hosts) await page.locator(`[data-host-id="${host.id}"]`).waitFor();
      for (const [i, host] of hosts.entries()) {
        const row = page.locator(`[data-object-id="journey-${i}"]`);
        await row.getByTitle('Host the session runs on').waitFor();
        assert.equal(await row.getByTitle('Host the session runs on').innerText(), host.id);
      }
      const red = nvim.waitScreen(s => s.includes(hosts[0]!.id + ' unreachable'), 'live Neovim outage', 3000);
      void red.catch(() => {});
      const alert = page.getByText(hosts[0]!.id + ' unreachable', { exact: true });
      const shown = alert.waitFor({ timeout: 3000 }); void shown.catch(() => {});
      try {
        await tunnelControl(f.root, hosts[0]!.id, 'down', f.env); await Promise.all([red, shown]);
        assert.match(await alert.innerText(), /unreachable/);
        assert.equal(await page.locator('[data-host-pool="agents"]').getAttribute('data-error'), 'true');
        const marks = await nvim.lua<Array<{ text: string; group: string }>>(`local b=require('cland.panels').bufs.sessions;local out={};local ls=vim.api.nvim_buf_get_lines(b,0,-1,false)
          for _,m in ipairs(vim.api.nvim_buf_get_extmarks(b,vim.api.nvim_create_namespace('cland.panels'),0,-1,{details=true})) do out[#out+1]={text=ls[m[2]+1]:sub(m[3]+1,m[4].end_col),group=m[4].hl_group} end;return out`);
        assert.ok(marks.some(mark => mark.text.includes(hosts[0]!.id + ' unreachable') && mark.group === 'ClandRed'));
      } finally { await tunnelControl(f.root, hosts[0]!.id, 'up', f.env); }
      t.diagnostic(JSON.stringify({ platform: process.platform, hosts: hosts.map(host => host.id), browserBinary: web.server.process().spawnfile, nvimBinary, cliStartedHub: true, outageRendered: true }));
    });
  });
}

export async function webLogins(t: TestContext, scope: JourneyScope) {
  const { f, cli, nvim, nvimBinary, web, ui } = await scratch(t, scope);
  await scope.step('complete web login and workbench journey', async () => {
    await relays(f, []);
    const waiting = await ui.request({ type: 'session.launch', role: 'login-worker', name: 'login-waiter', harness: 'opencode', cwd: f.root }, 60000);
    assert.equal(waiting.ok, true, waiting.error);
    await nvim.lua("vim.cmd('Cland panel inbox right')");
    await nvim.waitScreen(s => s.includes('waiting for a login opencode'), 'real launch waits in Neovim inbox');
    await web.pageCase(t, async page => {
      await page.getByRole('button', { name: 'Sessions', exact: true }).click();
      if (!await page.getByRole('region', { name: 'Hosts in agents' }).count()) await page.getByRole('button', { name: 'Fold Hosts', exact: true }).click();
      const pool = page.getByRole('region', { name: 'Hosts in agents' });
      await pool.getByRole('button', { name: 'Add', exact: true }).click();
      await pool.getByLabel('Harness').selectOption('opencode');
      await pool.getByLabel('Name').fill('web-login');
      await pool.getByRole('button', { name: 'Start sign-in', exact: true }).click();
      const row = page.locator('[data-login-name="web-login"]');
      await row.waitFor({ timeout: 60000 });
      try {
        await eventually('web-created login ready in CLI', async () => JSON.parse(await cli('login', 'list', '--json')).some((r: { name: string; state: string }) => r.name === 'web-login' && ['ready', 'in-use'].includes(r.state)) || undefined, 15000);
        // Native sign-in can reuse its already-ready host. Prove the positive
        // placement receipt rather than requiring a transient boot frame.
        await eventually('web-added login placed the queued session', async () => JSON.parse(await cli('session', 'list', '--json')).processes.some((r: { name: string; pid: number; status: string }) => r.name === 'login-waiter' && r.pid && r.status === 'running') || undefined, 60000);
        await nvim.lua("vim.cmd('Cland panel sessions right')");
        await nvim.waitScreen(s => s.includes('login-waiter') && s.includes('host-'), 'queued session rendered after web login');
      } catch (error) {
        t.diagnostic(JSON.stringify({ loginRows: JSON.parse(await cli('login', 'list', '--json')), browserRow: await row.innerText() }));
        throw error;
      }
      // Cancel placement before removal so this login is free and removable.
      const cancelled = await ui.request({ type: 'session.stop', session: 'login-waiter' });
      assert.equal(cancelled.ok, true, cancelled.error);
      // Disk logins belong to hosts. Ending a session alone keeps the disk bound.
      const retained = JSON.parse(await cli('login', 'list', '--json')).find((r: { name: string }) => r.name === 'web-login');
      for (const binding of retained.bindings as Array<{ host: string }>) await cli('host', 'stop', binding.host);
      await eventually('stopped session released login', async () => JSON.parse(await cli('login', 'list', '--json')).some((r: { name: string; state: string }) => r.name === 'web-login' && r.state === 'ready') || undefined, 30000);
      await row.getByRole('button', { name: 'Remove', exact: true }).click();
      const removed = eventually('web removal durable response', () => removalReceipts.get(page)?.result, 30000);
      void removed.catch(() => {});
      try {
        await row.getByRole('button', { name: 'Confirm', exact: true }).click();
        const result = await removed;
        assert.equal(result.ok, true);
        assert.deepEqual(result.value, { removed: 'web-login' });
      } finally { await Promise.allSettled([removed]); }
      await row.waitFor({ state: 'detached', timeout: 30000 });
      const names = JSON.parse(await cli('login', 'list', '--json')).map((r: { name: string }) => r.name);
      assert.equal(names.includes('web-login'), false);
      t.diagnostic(JSON.stringify({ webAdded: true, neovimReasonChanged: true, cliRemoved: true, platform: process.platform, browserBinary: web.server.process().spawnfile, nvimBinary }));
    });
  });
}
