// T3: concurrency lifecycle: init overlaps a separate SQLite writer thread. Shell hook execution and a real Claude fake
// retain the provisioned launch contract; their process receipts are the assertions' subject.
// Held-worker cancellation proves database/worker disposal precedes fixture removal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { HOOK_EVENTS } from '../src/adapters/claude-code.ts';
import { connectUi, eventually, fakeClaude, projectHub, tempProject } from './harness.ts';
import { ownProcess, onCleanup } from './process-cleanup.ts';
import { ownInitWriter } from './init-writer-owner.ts';
import { run, gitRepo, sh } from './init-fixture.ts';

test('the project hook runs `cland hook` from the PATH for a session started by hand, and stands aside in a session the hub launched', async (t) => {
  const root = await tempProject(t, 'cland-init-hook-');
  await gitRepo(root);
  await run(root, 'init');
  const settings = JSON.parse(await readFile(join(root, '.claude', 'settings.json'), 'utf8')) as { hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>> };
  const command = settings.hooks.SessionStart?.[0]?.hooks[0]?.command ?? '';
  // a `cland` on the PATH that records how it was called
  const bin = join(root, '.tmp-bin');
  await mkdir(bin);
  const calls = join(root, '.tmp-calls');
  await writeFile(join(bin, 'cland'), `#!/bin/sh\necho "$@" >> '${calls}'\n`);
  await chmod(join(bin, 'cland'), 0o755);
  const path = `${bin}:${dirname(process.execPath)}:/usr/bin:/bin`;

  const byHand = await sh(root, command, { PATH: path, CLAND_SESSION_NAME: '' });
  assert.equal(byHand.code, 0, byHand.stderr);
  assert.equal(await readFile(calls, 'utf8'), 'hook session-start\n');

  const launched = await sh(root, command, { PATH: path, CLAND_SESSION_NAME: 'coord' });
  assert.equal(launched.code, 0);
  assert.equal(await readFile(calls, 'utf8'), 'hook session-start\n', 'the launch injected its own hooks: the project one does nothing');

  const noCland = await sh(root, command, { PATH: '/usr/bin:/bin', CLAND_SESSION_NAME: '' });
  assert.equal(noCland.code, 0, 'cland not installed: the hook does nothing and fails nothing');
  assert.equal(noCland.stderr, '');
});

test('a Claude Code session launched in the initialised project gets the project hooks and reads AGENTS.md: directly, and through the import once CLAUDE.md exists', async (t) => {
  const root = await tempProject(t, 'cland-init-cc-');
  await gitRepo(root);
  await run(root, 'init');
  const fake = await fakeClaude(t);
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const block = (await readFile(join(root, 'AGENTS.md'), 'utf8')).trim();

  type Context = { instructions: Array<{ file: string; text: string }>; hooks: Record<string, string[]> };
  const launch = async (name: string): Promise<Context> => {
    const r = await ui.request({ type: 'session.launch', name, harness: 'claude-code' }, 30_000);
    assert.equal(r.ok, true, r.error);
    const id = (r.value as { process: { harnessId: string } }).process.harnessId;
    return eventually(`${name}'s context`, async () => JSON.parse(await readFile(join(fake.home, 'jobs', `${id}.context.json`), 'utf8')) as Context);
  };

  const first = await launch('cc-1');
  assert.deepEqual(first.instructions.map((i) => i.file), ['AGENTS.md']);
  assert.equal(first.instructions[0]?.text.trim(), block);
  // each hook event runs the project's hook and the one the launch injected (naming the session and the hub)
  for (const [hookEvent, event] of Object.entries(HOOK_EVENTS)) {
    const commands = first.hooks[hookEvent] ?? [];
    assert.equal(commands.length, 2, hookEvent);
    assert.match(commands[0] ?? '', new RegExp(`cland hook ${event} # managed by cland`));
    assert.match(commands[1] ?? '', new RegExp(`'hook' '${event}' '--session' 'cc-1'`));
  }

  // a CLAUDE.md appears: init adds the import, and the next session reads AGENTS.md through it
  await writeFile(join(root, 'CLAUDE.md'), '# ours\n');
  await run(root, 'init');
  const second = await launch('cc-2');
  assert.deepEqual(second.instructions.map((i) => i.file), ['CLAUDE.md', 'AGENTS.md']);
  assert.equal(second.instructions[1]?.text.trim(), block);
});

test('init waits for an overlapping hub database writer', { timeout: 10_000 }, async t => {
  const root = await tempProject(t, 'cland-init-writer-');
  await gitRepo(root);
  await run(root, 'init');
  const writer = new DatabaseSync(join(root, '.cland', 'hub.db'));
  const owner = ownInitWriter(t, writer);
  writer.exec('begin immediate');
  // A separate JS thread is necessary: DatabaseSync blocks its thread while the
  // writer holds the database. Prove BUSY on init's actual connection before
  // release, and pin the production wait policy; no pre-exec scheduling inference.
  const module = new URL('../src/cli/init.ts', import.meta.url).href;
  const worker = new Worker(`
    const { parentPort, workerData } = require('node:worker_threads');
    const { DatabaseSync } = require('node:sqlite');
    const assert = require('node:assert/strict');
    const exec = DatabaseSync.prototype.exec;
    let reported = false;
    DatabaseSync.prototype.exec = function(sql) {
      if (!reported && /create table/i.test(sql)) {
        reported = true;
        const timeout = this.prepare('pragma busy_timeout').get().timeout;
        assert.equal(timeout, 5000, 'init must retain the production busy wait policy');
        // A zero-timeout lock attempt is an observation of actual SQLite BUSY,
        // not permission to begin a write. Restore the observed production policy
        // before the real schema write; never manufacture a timeout for it.
        exec.call(this, 'pragma busy_timeout = 0');
        try {
          assert.throws(() => exec.call(this, 'begin immediate'), error => error.errcode === 5);
        } finally { exec.call(this, 'pragma busy_timeout = ' + timeout); }
        parentPort.postMessage({ type: 'busy-observed', timeout });
      }
      return exec.call(this, sql);
    };
    import(workerData.module).then(async ({ runInit }) => {
      let stdout = '';
      const code = await runInit(['--json'], workerData.root, text => { stdout += text; });
      parentPort.postMessage({ type: 'result', code, stdout });
    });
  `, { eval: true, workerData: { module, root } });
  owner.attach(worker);
  const exited = once(worker, 'exit', { signal: t.signal });
  const results: Array<{ code: number; stdout: string }> = [];
  const starting = new Promise<void>((resolve, reject) => {
    worker.on('message', message => {
      if (message.type === 'busy-observed') { assert.equal(message.timeout, 5000); resolve(); }
      if (message.type === 'result') results.push(message);
    });
    worker.once('error', reject);
    t.signal.addEventListener('abort', () => reject(t.signal.reason), { once: true });
    worker.once('exit', () => { if (results.length === 0) reject(new Error('init exited before its BUSY receipt')); });
  });
  try {
    await starting;
    assert.equal(results.length, 0, 'init cannot complete while the writer holds its transaction');
    writer.exec('commit');
    assert.deepEqual(await exited, [0]);
    const completed = results.at(-1);
    assert.ok(completed, 'init sent its result before worker exit');
    assert.equal(completed.code, 0);
    assert.ok(JSON.parse(completed.stdout).changes.length > 0);
  } finally {
    await owner.cleanup();
  }
});


test('init writer ownership joins a held worker before fixture removal on cancellation', async t => {
  const root = await tempProject(t, 'cland-init-cancel-');
  const project = join(root, 'project');
  const receipt = join(root, 'disposed.json');
  const fixture = join(root, 'cancelled-writer.test.mjs');
  const ownerModule = new URL('./init-writer-owner.ts', import.meta.url).href;
  const cleanupModule = new URL('./process-cleanup.ts', import.meta.url).href;
  await writeFile(fixture, `
    import { test } from 'node:test';
    import { DatabaseSync } from 'node:sqlite';
    import { Worker } from 'node:worker_threads';
    import { once } from 'node:events';
    import { mkdirSync, writeFileSync } from 'node:fs';
    import { ownInitWriter } from ${JSON.stringify(ownerModule)};
    import { ownDirectory, onCleanup } from ${JSON.stringify(cleanupModule)};
    const cancel = new AbortController();
    test('held writer cancellation fixture', { signal: cancel.signal }, async t => {
      const root = ${JSON.stringify(project)};
      mkdirSync(root);
      ownDirectory(t, root);
      const writer = new DatabaseSync(root + '/writer.db');
      const owner = ownInitWriter(t, writer);
      writer.exec('begin immediate');
      const worker = new Worker(\`const { parentPort } = require('node:worker_threads'); parentPort.postMessage('held'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);\`, { eval: true });
      owner.attach(worker);
      onCleanup(t, () => { writeFileSync(${JSON.stringify(receipt)}, JSON.stringify(owner.state)); });
      await once(worker, 'message');
      cancel.abort(new Error('intentional held-worker cancellation'));
      // Deliberately no body finally: only the registered owner can join teardown.
      await new Promise(() => {});
    });
  `);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('CLAND_') && key !== 'NODE_TEST_CONTEXT'));
  const child = spawn(process.execPath, ['--test', '--test-reporter=tap', fixture], { cwd: root, env, timeout: 10_000, signal: t.signal, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', chunk => { output += String(chunk); });
  child.stderr.on('data', chunk => { output += String(chunk); });
  const exited = new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  const closed = new Promise<void>(resolve => child.once('close', () => resolve()));
  const stop = ownProcess(t, child.pid);
  onCleanup(t, async () => { await stop(); await closed; });
  assert.notEqual(await exited, 0, output);
  assert.match(output, /intentional held-worker cancellation/);
  assert.deepEqual(JSON.parse(await readFile(receipt, 'utf8')), { writerClosed: true, workerJoined: true });
  await assert.rejects(stat(project), { code: 'ENOENT' });
});
