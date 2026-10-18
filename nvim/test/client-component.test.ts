import { fileURLToPath } from 'node:url';
// T2: screen permutations consume committed protocol frames through stub-client.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { NVIM_DIR } from '../bin/nvim-path.ts';
import { centreOf, nvimOrSkip, startClient } from './stub-client.ts';
import { tempProject } from './fixture.ts';

const nvim = await nvimOrSkip();

const skip = 'skip' in nvim ? nvim.skip : false;

const bin = 'bin' in nvim ? nvim.bin : '';

const composerLines = (c: { lua: <T>(code: string) => Promise<T> }) => c.lua<string[]>("return vim.api.nvim_buf_get_lines(vim.fn.bufnr('cland://composer/general'), 0, -1, false)");

const notice = (s: string): boolean => /^   ▲ /m.test(centreOf(s));

test('Shift+Enter inserts a newline in the composer; Enter sends both lines as one message', { skip }, async (t) => {
  const root = await tempProject(t);
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, fileURLToPath(new URL('./stub-hub.ts', import.meta.url))]) });
  await c.waitScreen((s) => centreOf(s).includes('No messages in General yet.') && !notice(s), 'the empty General thread, connected');
  await c.input('first line<S-CR>second line');
  assert.deepEqual(await composerLines(c), ['› first line', 'second line']);
  assert.deepEqual(await c.lua('return vim.api.nvim_get_mode()'), { mode: 'i', blocking: false });
  await c.input('<CR>');
  const screen = await c.waitScreen((s) => /^[▎▌] first line *\n[▎▌] second line *$/m.test(centreOf(s)), 'the two-line message');
  assert.match(centreOf(screen), /⌁ queued/);
  assert.deepEqual(await composerLines(c), ['› ']);
});

test('nothing loads from the user configuration: every sourced script is the bundled runtime or nvim/', { skip }, async (t) => {
  const root = await tempProject(t);
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, fileURLToPath(new URL('./stub-hub.ts', import.meta.url))]) });
  await c.waitScreen((s) => s.includes('General'), 'the client');
  const out = await c.rpc.request<{ output: string }>('nvim_exec2', 'scriptnames', { output: true });
  const runtime = realpathSync(await c.lua<string>('return vim.env.VIMRUNTIME'));
  const own = realpathSync(NVIM_DIR);
  const paths = out.output
    .split('\n')
    .map((l) => l.replace(/^\s*\d+:\s*/, '').trim())
    .filter(Boolean)
    .map((p) => p.replace(/^~/, process.env.HOME ?? '~'));
  assert.ok(paths.length > 0);
  assert.ok(paths.includes(join(own, 'init.lua')) || paths.some((p) => realpathSync(p) === join(own, 'init.lua')), `init.lua is sourced:\n${out.output}`);
  const foreign = paths.filter((p) => {
    const real = realpathSync(p);
    return !real.startsWith(`${runtime}/`) && !real.startsWith(`${own}/`);
  });
  assert.deepEqual(foreign, [], `scripts from outside the runtime and nvim/:\n${out.output}`);
  const appname = await c.lua<string>('return vim.env.NVIM_APPNAME');
  assert.equal(appname, 'cland');
  // the ADR 0005 mitigations are in force
  assert.equal(await c.lua('return vim.o.termpastefilter'), 'BS,ESC,DEL');
  assert.equal(await c.lua('return vim.o.scrollback'), 10000);
  assert.equal(await c.lua('return vim.o.cmdheight'), 1);
  assert.equal(await c.lua("return vim.fn.maparg('<S-CR>', 't', false, true).desc"), 'cland: Send Shift+Enter to harness');
});
