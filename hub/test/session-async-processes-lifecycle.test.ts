// T3: real file-backed stderr and native session spawn/list/resume/stop instrumentation prove async process I/O.
import { onCleanup } from './process-cleanup.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { syncBuiltinESMExports } from 'node:module';
import { connectSocket, connectUi, eventually, fakeCodex, nativeProjectHub, startDaemon, tempProject } from './harness.ts';

test('production CLI with file-backed stderr sends request audits through the async file logger', async t => {
  const root = await tempProject(t);
  const preload = join(root, 'guard-stderr.mjs');
  await writeFile(preload, `
    if (process.argv.includes('serve')) {
      const stderr = process.stderr;
      const nativeWrite = stderr.write.bind(stderr);
      nativeWrite('file-backed-stderr=' + (stderr._type === 'fs') + '\\n');
      stderr.write = (chunk, ...args) => {
        if (String(chunk).includes('"event":"audit"')) nativeWrite('SYNC_REQUEST_LOG\\n');
        return nativeWrite(chunk, ...args);
      };
    }
  `);
  const { discovery } = await startDaemon(t, root, { NODE_OPTIONS: `--import=${preload}` });
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  assert.equal((await ui.request({ type: 'task.list', as: { name: 'impl' } })).ok, true);
  assert.match((await ui.request({ type: 'task.close', item: 'T-1', as: { name: 'impl' } })).error ?? '', /forbidden/);
  const logs = await eventually('production audits appended', async () => {
    const text = await readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8');
    return text.includes('"tool":"task.close"') ? text : undefined;
  });
  assert.match(logs, /file-backed-stderr=true/);
  assert.doesNotMatch(logs, /SYNC_REQUEST_LOG/);
});

test('session launch, list, resume, relaunch and stop spawn no synchronous process', async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const daemon = await nativeProjectHub(t, root, fake.env);
  const ui = await connectSocket(daemon.discovery!.socket);
  onCleanup(t, () => ui.close());
  ui.send({ type: 'hello', protocol: 2, secret: daemon.discovery!.secret, client: 'instrumented' });
  assert.equal((await ui.next()).type, 'welcome');
  const originals = { spawnSync: cp.spawnSync, execSync: cp.execSync, execFileSync: cp.execFileSync };
  const calls: string[] = [];
  const restore = () => { Object.assign(cp, originals); syncBuiltinESMExports(); };
  onCleanup(t, restore);
  for (const key of Object.keys(originals) as Array<keyof typeof originals>) {
    Object.assign(cp, { [key]: (command: string) => { calls.push(`${key}: ${command}`); throw new Error('synchronous process in a session request'); } });
  }
  syncBuiltinESMExports();
  try {
    let id = 0;
    for (const frame of [
      { type: 'session.launch', name: 'impl', harness: 'codex' },
      { type: 'session.list' },
      { type: 'hub.status' },
      { type: 'session.resume', session: 'impl' },
      { type: 'session.resume', session: 'impl', relaunch: true },
      { type: 'session.stop', session: 'impl' },
    ]) {
      ui.send({ ...frame, id: String(++id) });
      let answer;
      do { answer = await ui.next(30_000); } while (answer.type !== 'result' || answer.id !== String(id));
      assert.equal(answer.ok, true, `${frame.type}: ${String(answer.error)}`);
      if (frame.type === 'session.launch') {
        const idle = await eventually('first turn completes before resume', async () => {
          ui.send({ type: 'session.list', id: String(++id) });
          do { answer = await ui.next(30_000); } while (answer.type !== 'result' || answer.id !== String(id));
          const processes = (answer.value as { processes: Array<{ state: string }> }).processes;
          return processes[0]?.state === 'idle' ? processes[0] : undefined;
        });
        assert.equal(idle.state, 'idle', 'first turn completes before resume');
      }
    }
    assert.deepEqual(calls, []);
  } finally { restore(); }
});


