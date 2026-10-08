// The Neovim client's seam: the real client (`nvim --clean -u nvim/init.lua`) headless with `--listen`,
// driven over msgpack-RPC with `nvim_input` and read back with `screenstring()`, against a real hub.
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { ensureNvim, NVIM_DIR, NVIM_VERSION } from '../bin/nvim-path.ts';
import { connectRpc, type Rpc } from './rpc.ts';

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
  rpc: Rpc;
  /** The screen as text rows, read with screenstring(). */
  screen: () => Promise<string[]>;
  /** Poll the screen until `predicate` holds; the last screen is quoted on a timeout. */
  waitScreen: (predicate: (text: string) => boolean, what: string, timeoutMs?: number) => Promise<string>;
  input: (keys: string) => Promise<void>;
  lua: <T = unknown>(code: string, ...args: unknown[]) => Promise<T>;
  stderr: () => string;
  process: ChildProcess;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SCREEN_LUA = `
local rows = {}
for r = 1, vim.o.lines do
  local cells = {}
  for c = 1, vim.o.columns do cells[#cells + 1] = vim.fn.screenstring(r, c) end
  rows[#rows + 1] = table.concat(cells)
end
return rows`;

/** Start the client in `root` as cland-nvim would (NVIM_APPNAME=cland, --clean -u init.lua), headless. */
export async function startClient(t: TestContext, bin: string, root: string, env: Record<string, string> = {}): Promise<Client> {
  const dir = await mkdtemp(join(tmpdir(), 'cland-nv-'));
  const sock = join(dir, 'nvim.sock');
  const childEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('CLAND_') && !k.startsWith('NVIM')) childEnv[k] = v;
  Object.assign(childEnv, { NVIM_APPNAME: 'cland', CLAND_ROOT: root }, env);
  const child = spawn(bin, ['--clean', '-u', INIT_LUA, '--headless', '--listen', sock], { cwd: root, env: childEnv, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr?.setEncoding('utf8');
  child.stderr?.on('data', (c: string) => (stderr += c));
  t.after(async () => {
    child.kill('SIGKILL');
    await rm(dir, { recursive: true, force: true });
  });
  const deadline = Date.now() + 10_000;
  while (!existsSync(sock)) {
    if (Date.now() > deadline || child.exitCode !== null) throw new Error(`nvim did not listen on ${sock}:\n${stderr}`);
    await sleep(25);
  }
  const rpc = await connectRpc(sock);
  t.after(() => rpc.close());
  const screen = async () => rpc.request<string[]>('nvim_exec_lua', SCREEN_LUA, []);
  return {
    rpc,
    screen,
    process: child,
    stderr: () => stderr,
    input: async (keys) => {
      await rpc.request('nvim_input', keys);
    },
    lua: <T = unknown>(code: string, ...args: unknown[]) => rpc.request<T>('nvim_exec_lua', code, args),
    waitScreen: async (predicate, what, timeoutMs = 10_000) => {
      const until = Date.now() + timeoutMs;
      let last: string[] = [];
      while (Date.now() < until) {
        last = await screen();
        const text = last.join('\n');
        if (predicate(text)) return text;
        await sleep(40);
      }
      throw new Error(`the screen never showed ${what} within ${timeoutMs} ms:\n${last.map((l) => `|${l}|`).join('\n')}\n${stderr}`);
    },
  };
}

/** HH:MM of an ISO timestamp in this machine's time zone: what the thread shows. */
export const clock = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
