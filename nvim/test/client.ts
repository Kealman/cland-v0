import { withoutExecutorCredentials } from '../../shared/executor-credentials.ts';
// The Neovim client's seam: the real client (`nvim --clean -u nvim/init.lua`) headless with `--listen`,
// driven over msgpack-RPC with `nvim_input` and read back with `screenstring()`, against a real hub.
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TestContext } from 'node:test';
import { ensureNvim, NVIM_DIR, NVIM_VERSION } from '../bin/nvim-path.ts';
import { connectRpc, type Rpc } from './rpc.ts';
import { beforeDirectories, ownDirectory, ensureFixtureAdmission } from './fixture.ts';
import { headlessNvimLaunch } from './headless-launch.ts';
import { frameFixturesForTest } from './frame-fixtures.ts';

export const INIT_LUA = join(NVIM_DIR, 'init.lua');

/** The pinned binary (downloaded into `.cache/` when missing, or `CLAND_NVIM`), or why the tests skip. */
export async function nvimOrSkip(): Promise<{ bin: string } | { skip: string }> {
  try {
    return { bin: await ensureNvim(process.env, (s) => process.stderr.write(`# ${s}\n`)) };
  } catch (err) {
    return { skip: `no Neovim ${NVIM_VERSION} to run the client with (${err instanceof Error ? err.message : String(err)}); set CLAND_NVIM to a ${NVIM_VERSION} binary` };
  }
}

export type Client = {
  /** The RPC channel; replaced when `:restart` moves the UI to a new server. */
  rpc: Rpc;
  /** The screen as text rows, read with screenstring(). */
  screen: () => Promise<string[]>;
  /** Poll the screen until `predicate` holds; the last screen is quoted on a timeout. */
  waitScreen: (predicate: (text: string) => boolean, what: string, timeoutMs?: number) => Promise<string>;
  input: (keys: string) => Promise<void>;
  lua: <T = unknown>(code: string, ...args: unknown[]) => Promise<T>;
  stderr: () => string;
  process: ChildProcess;
  /** The current mode (`n`, `i`, `t`, …). */
  mode: () => Promise<string>;
  /** Resolves with the new server's address when Neovim sends the UI its `restart` event. */
  restarted: () => Promise<string>;
};

/** The screen size the tests attach their UI with: the smallest the design is drawn for. */
export const COLUMNS = 160;
export const LINES = 45;

/** Each row of the screen cut at its first vertical separator: the centre column when no left panel is open. */
export const centreOf = (text: string): string =>
  text
    .split('\n')
    .map((l) => {
      const i = l.indexOf('│');
      return i < 0 ? l : l.slice(0, i);
    })
    .join('\n');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Stub clients never restart or launch real sessions in T2. Their live handle
 * owns the detached group, so teardown needs neither a PID snapshot nor ps.
 * Restarted servers below still capture an OS identity at their first RPC observation.
 */
function ownStubClient(t: TestContext, child: ChildProcess, cleanup = beforeDirectories): void {
  let closed = false;
  child.once('close', () => { closed = true; });
  cleanup(t, async () => {
    if (!closed) {
      const close = once(child, 'close', { signal: AbortSignal.timeout(5000) });
      // Never signal a remembered PID after its child handle has observed exit.
      if (child.pid !== undefined && child.exitCode === null && child.signalCode === null) {
        try { process.kill(-child.pid, 'SIGKILL'); }
        catch (error) {
          // macOS can report EPERM for a group being reaped. The close receipt
          // and bounded disappearance check below must still both complete.
          if (!['ESRCH', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
        }
      }
      await close;
    }
    // An interrupted Neovim can exit before its stdio stub. Observe the whole
    // group's disappearance before removing any fixture directory (bounded 5 s).
    const until = Date.now() + 5000;
    while (child.pid !== undefined) {
      try { process.kill(-child.pid, 0); }
      catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ESRCH') return;
        if (code !== 'EPERM') throw error;
      }
      if (Date.now() >= until) throw new Error('stub Neovim process group did not exit');
      await sleep(25);
    }
  });
}

const SCREEN_LUA = `
local rows = {}
for r = 1, vim.o.lines do
  local cells = {}
  for c = 1, vim.o.columns do cells[#cells + 1] = vim.fn.screenstring(r, c) end
  rows[#rows + 1] = table.concat(cells)
end
return rows`;

/**
 * Start the client in `root` as cland-nvim would (NVIM_APPNAME=cland-nvim, --clean -u init.lua), headless, and
 * attach a UI of COLUMNS×LINES over the RPC channel, as a terminal UI would (redraws are ignored).
 */
export async function createClient(t: TestContext, bin: string, root: string, env: Record<string, string> = {}, opts: { centre?: 'general' | 'explorer'; screenPollMs?: number; launcher?: boolean } = {}, native?: { isolateVerification: (root: string) => Promise<void>; ownProcess: (t: TestContext, pid: number | undefined) => unknown; ownDirectory: (t: TestContext, path: string) => unknown; beforeDirectories: typeof beforeDirectories }): Promise<Client> {
  await ensureFixtureAdmission();
  const stubOnly = env.CLAND_HUB_TRANSPORT === 'stdio'
    && env.CLAND_COMMAND === JSON.stringify([process.execPath, fileURLToPath(new URL('./stub-hub.ts', import.meta.url))]);
  if (!stubOnly && !native) throw new Error('stub-client requires the recorded stdio stub');
  if (!env.CLAND_COMMAND) await native!.isolateVerification(root);
  const dir = await mkdtemp(join(tmpdir(), 'cland-nv-'));
  if (native) native.ownDirectory(t, dir); else ownDirectory(t, dir);
  const sock = join(dir, 'nvim.sock');
  const childEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('CLAND_') && !k.startsWith('NVIM')) childEnv[k] = v;
  // the restart snapshot lives under stdpath('state'): one per test
  Object.assign(childEnv, { NVIM_APPNAME: 'cland-nvim', CLAND_ROOT: root, XDG_STATE_HOME: join(dir, 'state') }, env);
  if (stubOnly) childEnv.CLAND_STUB_FRAME_FIXTURES = frameFixturesForTest(process.argv[1]);
  // Replay stress belongs to the Neovim stub, never to real hubs or production.
  for (const key of ['CLAND_STUB_SNAPSHOT_DELAY_MS', 'CLAND_STUB_ROLE_DELAY_MS']) {
    if (env.CLAND_COMMAND && process.env[key]) childEnv[key] = process.env[key];
  }
  if (opts.launcher) childEnv.CLAND_NVIM = bin;
  const launchEnv = withoutExecutorCredentials(childEnv);
  const launch = () => opts.launcher
    ? spawn(join(NVIM_DIR, 'bin/cland-nvim'), ['--headless', '--listen', sock], { cwd: root, env: launchEnv, detached: true, stdio: ['ignore', 'ignore', 'pipe'] })
    : spawn(bin, ['--clean', '-u', INIT_LUA, '--headless', '--listen', sock], { cwd: root, env: launchEnv, detached: true, stdio: ['ignore', 'ignore', 'pipe'] });
  const child = stubOnly ? headlessNvimLaunch(bin, sock, launch) : launch();
  if (stubOnly) ownStubClient(t, child, native?.beforeDirectories);
  else native!.ownProcess(t, child.pid);
  let stderr = '';
  child.stderr?.setEncoding('utf8');
  child.stderr?.on('data', (c: string) => (stderr += c));
  let restartAddr: ((addr: string) => void) | null = null;
  const deadline = Date.now() + 10_000;
  let initialRpc: Rpc;
  for (;;) {
    try {
      // The socket name can exist between bind() and listen(); wait for an accepted connection.
      initialRpc = await connectRpc(sock);
      break;
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ECONNREFUSED') throw err;
      if (Date.now() > deadline || child.exitCode !== null) throw new Error(`nvim did not listen on ${sock}:\n${stderr}`, { cause: err });
      await sleep(25);
    }
  }
  const attach = async (rpc: Rpc): Promise<Rpc> => {
    t.after(() => rpc.close());
    rpc.onNotification((method, params) => {
      if (method !== 'redraw') return;
      for (const batch of params as unknown[][]) {
        if (Array.isArray(batch) && batch[0] === 'restart') {
          const args = batch[1] as unknown[];
          const addr = Array.isArray(args) ? String(args[0]) : '';
          restartAddr?.(addr);
        }
      }
    });
    await rpc.request('nvim_ui_attach', COLUMNS, LINES, { rgb: true, ext_linegrid: true });
    if (!stubOnly || rpc !== initialRpc) native!.ownProcess(t, await rpc.request<number>('nvim_call_function', 'getpid', []));
    return rpc;
  };
  const client: Client = {
    rpc: await attach(initialRpc),
    screen: async () => client.rpc.request<string[]>('nvim_exec_lua', SCREEN_LUA, []),
    process: child,
    stderr: () => stderr,
    input: async (keys) => {
      await client.rpc.request('nvim_input', keys);
    },
    lua: <T = unknown>(code: string, ...args: unknown[]) => client.rpc.request<T>('nvim_exec_lua', code, args),
    mode: async () => (await client.rpc.request<{ mode: string }>('nvim_get_mode')).mode,
    restarted: () =>
      new Promise<string>((resolve) => {
        restartAddr = (addr) => {
          restartAddr = null;
          resolve(addr);
        };
      }).then(async (addr) => {
        // as a UI does: wait for the old server to close the channel, then attach to the new one
        await client.rpc.closed;
        const until = Date.now() + 10_000;
        for (;;) {
          try {
            client.rpc = await attach(await connectRpc(addr));
            return addr;
          } catch (err) {
            if (Date.now() > until) throw err;
            await sleep(50);
          }
        }
      }),
    waitScreen: async (predicate, what, timeoutMs = 10_000) => {
      const until = Date.now() + timeoutMs;
      let last: string[] = [];
      while (Date.now() < until) {
        last = await client.screen();
        const text = last.join('\n');
        if (predicate(text)) return text;
        await sleep(opts.screenPollMs ?? 40);
      }
      throw new Error(`the screen never showed ${what} within ${timeoutMs} ms:\n${last.map((l) => `|${l}|`).join('\n')}\n${stderr}`);
    },
  };
  if (opts.centre !== 'explorer') {
    await client.waitScreen(s => s.includes('EXPLORER') || s.includes('General') || s.includes('BOARD'), 'first workbench screen');
    await client.input('<Esc><Space>g');
    await client.waitScreen(s => s.includes('General') && !s.includes('EXPLORER') && !s.includes('BOARD'), 'General test centre');
    await client.lua(`assert(vim.wait(5000, function()
      local s = require('cland.state').S
      return s.ui.view.kind == 'thread' and s.ui.view.id == 'general' and vim.b.cland_role == 'composer'
    end), 'General composer at test startup')`);
  }
  return client;
}

/** HH:MM of an ISO timestamp in this machine's time zone: what the thread shows. */
export const clock = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
