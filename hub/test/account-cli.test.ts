// T2: CLI refresh deadline on a held Unix frame; Node's fake timers advance without wall-clock waiting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Socket } from 'node:net';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runAccount } from '../src/cli/account.ts';

test('CLI refresh keeps a held poll alive beyond the ordinary three-second read deadline', { timeout: 5000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'account-cli-'));
  const socket = join(root, 'hub.sock');
  const discovery = join(root, '.cland/hub.json');
  await mkdir(join(root, '.cland'));
  await writeFile(discovery, JSON.stringify({ root, socket, port: 0, secret: 'test', pid: process.pid, version: 'test' }));
  const held = Promise.withResolvers<{ peer: Socket; id: string }>();
  const peers = new Set<Socket>();
  const server = createServer(peer => {
    peers.add(peer);
    peer.on('close', () => peers.delete(peer));
    let buffer = '';
    peer.on('data', chunk => {
      buffer += String(chunk);
      for (;;) {
        const nl = buffer.indexOf('\n');
        if (nl < 0) break;
        const frame = JSON.parse(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        if (frame.type === 'hello') peer.write(JSON.stringify({ type: 'welcome', name: 'cli', presence: [] }) + '\n');
        if (frame.type === 'account.list') peer.write(JSON.stringify({ type: 'result', id: frame.id, ok: true, value: { accounts: [{ name: 'default:claude-code', harness: 'claude-code', path: null, windows: [{ label: '5h', usedPercent: 21, resetsAt: '2099-10-20T00:00:00Z' }], at: '2026-10-16T12:00:00Z', source: { kind: 'session', session: 'second' } }] } }) + '\n');
        if (frame.type === 'account.poll') held.resolve({ peer, id: frame.id });
      }
    });
  });
  await new Promise<void>(resolve => server.listen(socket, resolve));
  t.after(async () => { for (const peer of peers) peer.destroy(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(root, { recursive: true, force: true }); });
  // This is the CLI process environment, not an embedded hub's environment.
  const previous = process.env.CLAND_HUB_FILE;
  process.env.CLAND_HUB_FILE = discovery;
  const output: string[] = [];
  const stdout = t.mock.method(process.stdout, 'write', (chunk: unknown) => { output.push(String(chunk)); return true; });
  t.mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const result = runAccount(['list', '--refresh', '--json'], root);
    const { peer, id } = await held.promise;
    t.mock.timers.tick(3200);
    peer.write(JSON.stringify({ type: 'result', id, ok: true, value: { accounts: [{ name: 'cc', windows: [{ usedPercent: 63 }] }] } }) + '\n');
    assert.equal(await result, 0);
    assert.equal(JSON.parse(output.join('')).accounts[0].windows[0].usedPercent, 63);
    output.length = 0;
    assert.equal(await runAccount(['list'], root), 0);
    assert.match(output.join(''), /default:claude-code.*5h 21%.*session second/);
  } finally {
    t.mock.timers.reset();
    stdout.mock.restore();
    if (previous === undefined) delete process.env.CLAND_HUB_FILE; else process.env.CLAND_HUB_FILE = previous;
  }
});
