// T3: stdio hub child startup/shutdown, missing/stale discovery and real hub restart/reconnect.
// Screen permutations live in client-component.test.ts; workbench owns the shared real-hub flow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { cland, killDaemon, readDiscovery, spawnSpoke, startDaemon, tempProject } from '../../hub/test/harness.ts';
import { centreOf, nvimOrSkip, startClient } from './harness.ts';

const nvim = await nvimOrSkip();

const skip = 'skip' in nvim ? nvim.skip : false;

const bin = 'bin' in nvim ? nvim.bin : '';

const notice = (s: string): boolean => /^   ▲ /m.test(centreOf(s));

test('the client spawns `cland hub serve --stdio` as its child when asked, and speaks the same frames', { skip }, async (t) => {
  const root = await tempProject(t);
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio' });
  await c.waitScreen((s) => centreOf(s).includes('No messages in General yet.') && !notice(s), 'General, connected over stdio', 20_000);
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

test('with no hub running, the client starts the project hub and connects to it', { skip }, async (t) => {
  const root = await tempProject(t);
  const c = await startClient(t, bin, root);
  try {
    await c.waitScreen((s) => centreOf(s).includes('No messages in General yet.') && !notice(s), 'General, connected', 20_000);
  } finally {
    const d = await readDiscovery(root).catch(() => null);
    if (d) t.after(() => killDaemon(d.pid));
  }
  const status = await cland(root, 'hub', 'status');
  assert.equal(status.code, 0, status.stderr);
  const journal = await cland(root, 'hub', 'journal', '--kind', 'hub-started', '--json');
  const started = JSON.parse(journal.stdout.trim());
  assert.deepEqual(started.starter, { client: 'nvim', parentPid: c.process.pid, cwd: root });
});

test('a stale hub.json (its hub killed, its socket gone) makes the client start a hub after a few failed connects', { skip }, async (t) => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const dead = spawnSync(process.execPath, ['-e', '0']).pid;
  await writeFile(join(root, '.cland', 'hub.json'), JSON.stringify({ socket: join(root, '.cland', 'gone.sock'), port: 1, secret: 'f'.repeat(64), pid: dead, version: '0.0.0' }));
  const c = await startClient(t, bin, root);
  try {
    await c.waitScreen((s) => centreOf(s).includes('No messages in General yet.') && !notice(s), 'General, connected to a hub it started', 30_000);
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
  await c.waitScreen((s) => centreOf(s).includes('No messages in General yet.') && !notice(s), 'General, connected');
  await c.input('before<CR>');
  await c.waitScreen((s) => /^[▎▌] before *$/m.test(centreOf(s)), 'the first message');
  // Observe the workbench's CLI boundary, retaining the real command and its completion callback.
  await c.lua(`
    local system = vim.system
    vim.system = function(cmd, opts, cb)
      if cmd[3] == 'hub' and cmd[4] == 'start' then
        return system(cmd, opts, function(out)
          vim.schedule(function() vim.g.cland_autostart_result = out.stdout end)
          cb(out)
        end)
      end
      return system(cmd, opts, cb)
    end
  `);
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  await c.waitScreen((s) => notice(s), 'a notice that the hub is gone');
  const until = Date.now() + 5000;
  let automatic = '';
  while (Date.now() < until) {
    automatic = await c.lua<string>("return vim.g.cland_autostart_result or ''");
    if (automatic) break;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  assert.match(automatic, /autostart deferred/);
  await assert.rejects(readDiscovery(root), { code: 'ENOENT' });
  const restarted = await startDaemon(t, root);
  assert.match(restarted.result.stdout, /hub started for/);
  await c.waitScreen((s) => !notice(s), 'the notice cleared on reconnect', 15_000);
  await c.input('after<CR>');
  const screen = await c.waitScreen((s) => /^[▎▌] after *$/m.test(centreOf(s)), 'the second message');
  assert.equal(centreOf(screen).match(/^[▎▌] before *$/gm)?.length, 1, 'the history merged without duplicates');
});
