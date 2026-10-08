// The Neovim client against a real hub in a temporary project (#23): what the human types reaches a
// session, what a session sends shows in the thread, and nothing loads from the user's configuration.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { realpathSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { cland, killDaemon, readDiscovery, spawnSpoke, startDaemon, tempProject } from '../../hub/test/harness.ts';
import { NVIM_DIR } from '../bin/nvim-path.ts';
import { centreOf, clock, nvimOrSkip, startClient } from './harness.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';

/** The composer's lines, read from its buffer. */
const composerLines = (c: { lua: <T>(code: string) => Promise<T> }) => c.lua<string[]>("return vim.api.nvim_buf_get_lines(vim.fn.bufnr('cland://composer/general'), 0, -1, false)");

test('a message typed in the composer shows queued, reaches a coordinator with the topic, and turns delivered; the reply shows with sender and time', { skip }, async (t) => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const c = await startClient(t, bin, root);
  await c.waitScreen((s) => centreOf(s).includes('No messages in General yet.') && !centreOf(s).includes('▲'), 'the empty General thread, connected');

  await c.input('hello<CR>');
  const queued = await c.waitScreen((s) => /^ you {2}\d\d:\d\d +⌁ queued $/m.test(centreOf(s)) && /^ hello +$/m.test(centreOf(s)), 'hello, queued');
  assert.doesNotMatch(centreOf(queued), /▲/, 'no notice: the client is connected');
  assert.deepEqual(await composerLines(c), ['› '], 'the composer is empty again');

  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'sess-coord' });
  t.after(() => coord.close());
  const event = await coord.waitForEvent((e) => e.params.content === 'hello', 15_000);
  assert.equal(event.params.meta?.topic, 'general');
  assert.equal(event.params.meta?.topic_title, 'General');
  assert.equal(event.params.meta?.from_kind, 'human');
  await c.waitScreen((s) => /^ you {2}\d\d:\d\d +✓ delivered $/m.test(centreOf(s)), 'hello, delivered');

  const reply = await coord.call<{ ok: boolean }>('send', { text: 'hello, human' });
  assert.equal(reply.ok, true);
  const [last] = (await coord.call<{ messages: Array<{ ts: string; text: string }> }>('history', { limit: 1 })).messages;
  assert.equal(last?.text, 'hello, human');
  const screen = await c.waitScreen((s) => centreOf(s).includes('hello, human'), 'the reply');
  assert.match(centreOf(screen), new RegExp(`^ coord {2}coordinator {2}${clock(last?.ts ?? '')} *$`, 'm'), 'sender, role and local time');
  assert.match(centreOf(screen), /^ hello, human *$/m);
  // the human's message keeps its stage; the agent's has none
  assert.match(centreOf(screen), /^ you {2}\d\d:\d\d +✓ delivered $/m);
});

test('Shift+Enter inserts a newline in the composer; Enter sends both lines as one message', { skip }, async (t) => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const c = await startClient(t, bin, root);
  await c.waitScreen((s) => centreOf(s).includes('No messages in General yet.') && !centreOf(s).includes('▲'), 'the empty General thread, connected');
  await c.input('first line<S-CR>second line');
  assert.deepEqual(await composerLines(c), ['› first line', 'second line']);
  assert.deepEqual(await c.lua('return vim.api.nvim_get_mode()'), { mode: 'i', blocking: false });
  await c.input('<CR>');
  const screen = await c.waitScreen((s) => /^ first line *\n second line *$/m.test(centreOf(s)), 'the two-line message');
  assert.match(centreOf(screen), /⌁ queued/);
  assert.deepEqual(await composerLines(c), ['› ']);
});

test('the client spawns `cland hub serve --stdio` as its child when asked, and speaks the same frames', { skip }, async (t) => {
  const root = await tempProject(t);
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio' });
  await c.waitScreen((s) => centreOf(s).includes('No messages in General yet.') && !centreOf(s).includes('▲'), 'General, connected over stdio', 20_000);
  await c.input('over stdio<CR>');
  await c.waitScreen((s) => /⌁ queued/.test(centreOf(s)) && centreOf(s).includes('over stdio'), 'the message, queued');
  // the child is the project's hub: a session finds it through hub.json
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'sess-coord' });
  t.after(() => coord.close());
  await coord.waitForEvent((e) => e.params.content === 'over stdio', 15_000);
  await c.waitScreen((s) => /✓ delivered/.test(centreOf(s)), 'the message, delivered');
  // quitting closes the child's stdin, which stops the hub
  const { pid } = await readDiscovery(root);
  await c.input('<Esc>:qa!<CR>');
  const until = Date.now() + 10_000;
  const alive = (p: number) => {
    try {
      process.kill(p, 0);
      return true;
    } catch {
      return false;
    }
  };
  while (alive(pid) && Date.now() < until) await new Promise((r) => setTimeout(r, 50));
  assert.equal(alive(pid), false, 'the stdio hub stopped with its parent');
});

test('nothing loads from the user configuration: every sourced script is the bundled runtime or nvim/', { skip }, async (t) => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const c = await startClient(t, bin, root);
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
  assert.equal(await c.lua("return vim.fn.maparg('<S-CR>', 't', false, true).desc"), 'cland: Shift+Enter to the terminal job as CSI-u (ESC[13;2u)');
});

test('with no hub running, the client starts the project hub and connects to it', { skip }, async (t) => {
  const root = await tempProject(t);
  const c = await startClient(t, bin, root);
  try {
    await c.waitScreen((s) => centreOf(s).includes('No messages in General yet.') && !centreOf(s).includes('▲'), 'General, connected', 20_000);
  } finally {
    const d = await readDiscovery(root).catch(() => null);
    if (d) t.after(() => killDaemon(d.pid));
  }
  const status = await cland(root, 'hub', 'status');
  assert.equal(status.code, 0, status.stderr);
});

test('a stale hub.json (its hub killed, its socket gone) makes the client start a hub after a few failed connects', { skip }, async (t) => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const dead = spawnSync(process.execPath, ['-e', '0']).pid;
  await writeFile(join(root, '.cland', 'hub.json'), JSON.stringify({ socket: join(root, '.cland', 'gone.sock'), port: 1, secret: 'f'.repeat(64), pid: dead, version: '0.0.0' }));
  const c = await startClient(t, bin, root);
  try {
    await c.waitScreen((s) => centreOf(s).includes('No messages in General yet.') && !centreOf(s).includes('▲'), 'General, connected to a hub it started', 30_000);
  } finally {
    const d = await readDiscovery(root).catch(() => null);
    if (d && d.pid !== dead) t.after(() => killDaemon(d.pid));
  }
  assert.notEqual((await readDiscovery(root)).pid, dead);
  assert.equal((await cland(root, 'hub', 'status')).code, 0);
});

test('the client follows its hub through a restart and keeps the thread', { skip }, async (t) => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const c = await startClient(t, bin, root);
  await c.waitScreen((s) => centreOf(s).includes('No messages in General yet.') && !centreOf(s).includes('▲'), 'General, connected');
  await c.input('before<CR>');
  await c.waitScreen((s) => /^ before *$/m.test(centreOf(s)), 'the first message');
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  await c.waitScreen((s) => centreOf(s).includes('▲'), 'a notice that the hub is gone');
  await startDaemon(t, root);
  await c.waitScreen((s) => !centreOf(s).includes('▲'), 'the notice cleared on reconnect', 15_000);
  await c.input('after<CR>');
  const screen = await c.waitScreen((s) => /^ after *$/m.test(centreOf(s)), 'the second message');
  assert.equal(centreOf(screen).match(/^ before *$/gm)?.length, 1, 'the history merged without duplicates');
});
