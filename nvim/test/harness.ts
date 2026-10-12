// The Neovim client's seam: the real client (`nvim --clean -u nvim/init.lua`) headless with `--listen`,
// driven over msgpack-RPC with `nvim_input` and read back with `screenstring()`, against a real hub.
import { isolateVerification } from '../../hub/test/harness.ts';
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { ensureNvim, NVIM_DIR, NVIM_VERSION } from '../bin/nvim-path.ts';
import { connectRpc, type Rpc } from './rpc.ts';
import { ownDirectory, ownProcess } from '../../hub/test/process-cleanup.ts';

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

const SCREEN_LUA = `
local rows = {}
for r = 1, vim.o.lines do
  local cells = {}
  for c = 1, vim.o.columns do cells[#cells + 1] = vim.fn.screenstring(r, c) end
  rows[#rows + 1] = table.concat(cells)
end
return rows`;

/**
 * Start the client in `root` as cland-nvim would (NVIM_APPNAME=cland, --clean -u init.lua), headless, and
 * attach a UI of COLUMNS×LINES over the RPC channel, as a terminal UI would (redraws are ignored).
 */
export async function startClient(t: TestContext, bin: string, root: string, env: Record<string, string> = {}): Promise<Client> {
  if (!env.CLAND_COMMAND) await isolateVerification(root);
  const dir = await mkdtemp(join(tmpdir(), 'cland-nv-'));
  ownDirectory(t, dir);
  const sock = join(dir, 'nvim.sock');
  const childEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('CLAND_') && !k.startsWith('NVIM')) childEnv[k] = v;
  // the restart snapshot lives under stdpath('state'): one per test
  Object.assign(childEnv, { NVIM_APPNAME: 'cland', CLAND_ROOT: root, XDG_STATE_HOME: join(dir, 'state') }, env);
  const child = spawn(bin, ['--clean', '-u', INIT_LUA, '--headless', '--listen', sock], { cwd: root, env: childEnv, detached: true, stdio: ['ignore', 'ignore', 'pipe'] });
  ownProcess(t, child.pid);
  let stderr = '';
  child.stderr?.setEncoding('utf8');
  child.stderr?.on('data', (c: string) => (stderr += c));
  let restartAddr: ((addr: string) => void) | null = null;
  const deadline = Date.now() + 10_000;
  while (!existsSync(sock)) {
    if (Date.now() > deadline || child.exitCode !== null) throw new Error(`nvim did not listen on ${sock}:\n${stderr}`);
    await sleep(25);
  }
  const attach = async (path: string): Promise<Rpc> => {
    const rpc = await connectRpc(path);
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
    ownProcess(t, await rpc.request<number>('nvim_call_function', 'getpid', []));
    return rpc;
  };
  const client: Client = {
    rpc: await attach(sock),
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
            client.rpc = await attach(addr);
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
        await sleep(40);
      }
      throw new Error(`the screen never showed ${what} within ${timeoutMs} ms:\n${last.map((l) => `|${l}|`).join('\n')}\n${stderr}`);
    },
  };
  return client;
}

/** HH:MM of an ISO timestamp in this machine's time zone: what the thread shows. */
export const clock = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
