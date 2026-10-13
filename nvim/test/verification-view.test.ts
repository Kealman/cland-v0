// The queue's human-facing seam: hub frames, real keys and screenstring().
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient } from './harness.ts';
import type { VerificationQueue } from '../../hub/src/protocol.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));
const idle: VerificationQueue = { version: 1, at: '2026-10-13T00:00:00Z', holder: null, waiters: [], metrics: { window: 20, count: 3, wait: { count: 3, medianMs: 60000, p90Ms: 240000 }, run: { count: 3, medianMs: 360000, p90Ms: 3900000 } } };

test('verify summary opens the ordered queue and ages locally; palette and keys expose the view', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.git'), { recursive: true });
  const path = join(root, 'stub.sock');
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_SCENARIO_JSON: JSON.stringify({ inbox: {}, verification: idle }), CLAND_STUB_CONTROL: path });
  const emit = (queue: VerificationQueue) => new Promise<void>((resolve, reject) => {
    const socket = createConnection(path); let text = '';
    socket.setEncoding('utf8'); socket.on('error', reject);
    socket.on('data', data => { text += data; if (text.includes('\n')) { socket.end(); resolve(); } });
    socket.write(`${JSON.stringify({ emit: { type: 'verification.queue', queue } })}\n`);
  });
  await c.waitScreen(s => s.includes('verify: idle'), 'idle summary');
  await c.lua("vim.api.nvim_win_set_width(require('cland.layout').win.right, 90)");
  const busy: VerificationQueue = { ...idle,
    holder: { kind: 'run', id: 'run-1', session: 'impl-3', item: 'T-3', mode: 'nvim', pid: 42, worktree: '/candidate', since: idle.at, runMs: 235000, etaMs: 360000 },
    waiters: [
      { id: 'run-2', session: 'next-a', item: 'T-4', mode: 'nvim', worktree: '/a', position: 1, queuedAt: idle.at, waitMs: 55000, etaMs: 360000, expectedRunMs: 360000 },
      { id: 'run-3', session: 'next-b', item: 'T-5', mode: 'full', worktree: '/b', position: 2, queuedAt: idle.at, waitMs: 45000, etaMs: 720000, expectedRunMs: 360000 },
    ] };
  await emit(busy);
  await c.waitScreen(s => s.includes('verify: impl-3 3m · 2 waiting · next ~6m'), 'holder summary');
  await c.waitScreen(s => s.includes('verify: impl-3 4m · 2 waiting'), 'run clock without another frame');
  await c.input('<Esc><C-l>gg<CR>');
  await c.input('<Space>s'); // Give the queue the full centre width.
  let screen = await c.waitScreen(s => s.includes('Verification queue') && s.includes('1. next-a') && s.includes('2. next-b'), 'queue demo');
  assert.ok(screen.indexOf('1. next-a') < screen.indexOf('2. next-b'), screen);
  for (const detail of ['T-3 · nvim', 'running 4m', 'worktree /candidate', 'T-4 · nvim', 'waiting 1m', 'ETA ~6m', 'ETA ~12m', 'run median 6m · p90 1h 5m', 'wait median 1m · p90 4m', 'last 3/20 runs']) assert.ok(screen.includes(detail), detail + '\n' + screen);
  await c.input('<Space>?');
  await c.waitScreen(s => s.includes('q') && s.includes('Previous centre view') && s.includes('verification'), 'queue close key in help');
  await c.input('q');
  await c.input('q');
  await c.waitScreen(s => !s.includes('Verification queue'), 'q restores previous centre');
  await c.input('<Space>pOpen verification queue');
  await c.waitScreen(s => s.includes('Open verification queue') && s.includes('no key'), 'palette action');
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('Verification queue') && s.includes('2. next-b'), 'palette opens queue');
  await emit(idle);
  await c.waitScreen(s => s.includes('nothing running · nothing waiting') && s.includes('run median 6m'), 'empty queue keeps metrics');
  await c.input('q<Space>s');
  await emit({ ...busy, holder: null });
  await c.waitScreen(s => s.includes('verify: free · 2 waiting'), 'admission summary');
  await emit({ ...busy, holder: { ...busy.holder!, kind: 'hand run', session: null, id: null, runMs: 3900000, etaMs: null }, waiters: [] });
  await c.waitScreen(s => s.includes('verify: hand run 1h 5m · next ?') && !s.includes('verify: hand run 1h 5m · 0 waiting'), 'hand run and unknown ETA');
  await c.lua("vim.api.nvim_win_set_width(require('cland.layout').win.right, 22)");
  screen = await c.waitScreen(s => s.includes('verify: hand run'), 'narrow summary');
  assert.ok(!screen.includes('5m · next ?'), screen);
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
});
