// The workbench's public protocol/render seam: a real headless client receiving hub frames.
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
const idle: VerificationQueue = { version: 1, at: '2026-10-11T00:00:00Z', holder: null, waiters: [], metrics: { window: 20, count: 0, wait: { count: 0, medianMs: null, p90Ms: null }, run: { count: 0, medianMs: null, p90Ms: null } } };

test('sessions queue line follows hub snapshots and events, including events racing a refresh', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.git'), { recursive: true });
  const path = join(root, 'stub.sock');
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_SCENARIO_JSON: JSON.stringify({ inbox: {}, verification: idle }), CLAND_STUB_CONTROL: path });
  const control = (command: Record<string, unknown>) => new Promise<Record<string, unknown>>((resolve, reject) => {
    const socket = createConnection(path); let text = '';
    socket.setEncoding('utf8'); socket.on('error', reject);
    socket.on('data', data => { text += data; if (text.includes('\n')) { socket.end(); resolve(JSON.parse(text.slice(0, text.indexOf('\n')))); } });
    socket.write(`${JSON.stringify(command)}\n`);
  });
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await c.waitScreen(s => s.includes('SESSIONS'), 'sessions panel');
  await c.lua("vim.api.nvim_win_set_width(require('cland.layout').win.right, 100)");
  await c.waitScreen(s => s.includes('verify: idle'), 'initial verification snapshot');
  const busy: VerificationQueue = { ...idle, holder: { kind: 'run', id: 'run-1', session: 'impl', item: 'T-1', mode: 'full', pid: 42, worktree: '/candidate', since: idle.at, runMs: 1000, etaMs: 20000 }, waiters: [{ id: 'run-2', session: 'next', item: 'T-2', mode: 'full', worktree: '/next', position: 1, queuedAt: idle.at, waitMs: 5000, etaMs: 20000, expectedRunMs: 21000 }] };
  await control({ emit: { type: 'verification.queue', queue: busy } });
  await c.waitScreen(s => s.includes('verify: impl') && s.includes('next (5s)') && s.includes('ETA 20s'), 'live holder, waiter and next ETA');
  const hand = { ...busy, holder: { ...busy.holder!, kind: 'hand run', id: null, session: null }, waiters: [{ ...busy.waiters[0]!, waitMs: 8000, etaMs: null }] };
  await control({ set: { holdSnapshots: ['hub.status'] } });
  await c.lua("require('cland').refresh_sessions()");
  await control({ waitSnapshot: 'hub.status' });
  await control({ emit: { type: 'verification.queue', queue: hand } });
  await c.waitScreen(s => s.includes('verify: hand run') && s.includes('pid 42') && s.includes('/candidate') && s.includes('since 2026-10-11T00:00:00Z') && s.includes('next (8s)') && s.includes('ETA') && s.includes('unknown'), 'hand-run identity and start while old status snapshot waits');
  await control({ releaseSnapshots: ['hub.status'] });
  const screen = await c.waitScreen(s => s.includes('hub: connected') && s.includes('verify: hand run'), 'event remains after stale snapshot replay');
  assert.ok(!screen.includes('verify: idle'), screen);
  await control({ emit: { type: 'verification.queue', queue: idle } });
  await c.waitScreen(s => s.includes('verify: idle') && !s.includes('next (8s)'), 'completion clears line');
});
