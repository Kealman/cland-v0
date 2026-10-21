// T3: the assertion is teardown of a real CLI which writes after hub shutdown.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { accountFixtureEnvironment } from './account-fixture-env.ts';
import { FakeClock } from './fake-clock.ts';
import { fakeClaude, FAKE_CLAUDE_DIR, until } from './harness.ts';
import { beforeDirectories, captureProcess } from './process-cleanup.ts';

// Capture teardown so assertions can invoke it early. The real test must still
// own it when setup or a child fails before those assertions are reached.
async function capturedFixture(t: TestContext, timings?: Parameters<typeof fakeClaude>[1]) {
  const hooks: Array<() => Promise<void>> = [];
  const context = { after: (hook: () => Promise<void>) => {
    hooks.push(hook);
    t.after(async () => {
      t.mock.restoreAll();
      syncBuiltinESMExports();
      await hook();
    });
  } } as TestContext;
  const fake = await fakeClaude(context, timings);
  return { fake, context, cleanup: () => hooks[0]!() };
}

test('fake Claude cleanup waits for a poll that writes after hub shutdown', { timeout: 15_000 }, async t => {
  // Deliberately defer callback delivery past removal: a closed OS identity,
  // rather than execFile's later callback, proves the writer cannot write again.
  const callbackRelease = Promise.withResolvers<void>();
  t.after(() => callbackRelease.resolve());
  const { fake, context, cleanup } = await capturedFixture(t);
  const env = await accountFixtureEnvironment(fake.env);
  const config = env.CLAUDE_CONFIG_DIR!;
  await fs.writeFile(join(config, 'usage-report.json'), '{}');
  await fs.writeFile(join(config, 'usage-hold'), '');
  beforeDirectories(context, () => fs.writeFile(join(config, 'usage-release'), ''));
  let exited = false;
  let pid: number | undefined;
  const poll = new Promise<void>((resolve, reject) => {
    const child = execFile(join(FAKE_CLAUDE_DIR, 'claude'), ['-p', '/usage'], { env }, error => {
      void callbackRelease.promise.then(() => {
        exited = true;
        if (error) reject(error); else resolve();
      });
    });
    pid = child.pid;
  });
  void poll.catch(() => {});
  // Setup observes the exact in-flight CLI, before triggering teardown.
  await until(async () => (await fs.readFile(join(fake.home, 'polls.jsonl'), 'utf8').catch(() => '')).includes('"/usage"'), { what: 'held usage poll' });
  assert.ok(pid);
  assert.ok(captureProcess(pid), 'the held writer is alive before teardown');
  const remove = fs.rm;
  let liveRemovals = 0;
  // Force the same late-file/rmdir boundary on every OS, rather than depending
  // on Linux directory enumeration timing. The OS identity is the receipt.
  t.mock.method(fs, 'rm', async (...args: Parameters<typeof fs.rm>) => {
    if (args[0] === fake.home && captureProcess(pid) !== null) {
      liveRemovals++;
      await fs.writeFile(join(fake.home, 'late-poll.jsonl'), 'poll still running');
      callbackRelease.resolve();
      await poll;
      throw Object.assign(new Error('directory not empty'), { code: 'ENOTEMPTY', path: fake.home });
    }
    return remove(...args);
  });
  syncBuiltinESMExports();
  await cleanup();
  assert.equal(captureProcess(pid), null, 'the OS writer is gone before cleanup returns');
  assert.equal(exited, false, 'callback delivery is deliberately held past directory removal');
  callbackRelease.resolve();
  await poll;
  assert.equal(await fs.stat(fake.home).catch(() => null), null);
  assert.equal(exited, true, 'the poll callback completes after its OS exit');
  assert.equal(liveRemovals, 0, 'directory removal starts only after the poll exits');
});

test('fake Claude cleanup retains a delayed writer and its home at the drain deadline', { timeout: 15_000 }, async t => {
  const clock = new FakeClock();
  let release: (() => Promise<void>) | undefined;
  let poll: Promise<void> | undefined;
  // Register before the captured ownership hook, including setup-error paths.
  t.after(async () => {
    t.mock.restoreAll(); syncBuiltinESMExports();
    await release?.();
    await poll?.catch(() => {});
  });
  const { fake, cleanup } = await capturedFixture(t, { writerClock: clock });
  const config = join(fake.home, 'config');
  await fs.mkdir(config);
  const env = await accountFixtureEnvironment({ ...fake.env, CLAUDE_CONFIG_DIR: config });
  await fs.writeFile(join(config, 'usage-report.json'), '{}');
  await fs.writeFile(join(config, 'usage-hold'), '');
  release = () => fs.writeFile(join(config, 'usage-release'), '').catch(error => {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  });
  let pid: number | undefined;
  poll = new Promise<void>((resolve, reject) => {
    const child = execFile(join(FAKE_CLAUDE_DIR, 'claude'), ['-p', '/usage'], { env }, error => error ? reject(error) : resolve());
    pid = child.pid;
  });
  void poll.catch(() => {});
  await until(async () => (await fs.readFile(join(fake.home, 'polls.jsonl'), 'utf8').catch(() => '')).includes('"/usage"'), { what: 'registered delayed usage writer' });
  assert.ok(pid);
  const read = fs.readFile;
  // Advance only the drain's complete clock after it reads the real writer's
  // registration. The held process remains alive beyond the diagnostic bound.
  t.mock.method(fs, 'readFile', async (...args: Parameters<typeof fs.readFile>) => {
    const result = await read(...args);
    if (args[0] === join(fake.home, 'writers', `${pid}.json`)) clock.block(6000);
    return result;
  });
  const remove = fs.rm;
  let removals = 0;
  t.mock.method(fs, 'rm', async (...args: Parameters<typeof fs.rm>) => {
    if (args[0] === fake.home) removals++;
    return remove(...args);
  });
  syncBuiltinESMExports();
  try {
    await assert.rejects(cleanup(), error => {
      assert.match(String(error), /writer.*5000 ms/);
      assert.match(String(error), new RegExp(`pid ${pid}\\b`));
      return true;
    });
    assert.ok(captureProcess(pid), 'a drain deadline reports rather than kills the delayed writer');
    assert.ok(await fs.stat(fake.home), 'the writer retains its home');
    assert.equal(removals, 0, 'no directory removal while the delayed writer is alive');
  } finally {
    t.mock.restoreAll(); syncBuiltinESMExports();
    await release();
    await poll.catch(() => {});
    await cleanup();
  }
  await poll;
  assert.equal(captureProcess(pid), null, 'the delayed writer has exited');
  assert.equal(await fs.stat(fake.home).catch(() => null), null, 'cleanup removes the home after writer exit');
});

test('fake Claude cleanup stops a hook after its session exits and fences later CLIs', { timeout: 15_000 }, async t => {
  const { fake, context, cleanup } = await capturedFixture(t);
  const env = await accountFixtureEnvironment(fake.env);
  const script = join(fake.home, 'late-hook.cjs');
  await fs.writeFile(script, `const fs = require('node:fs');
fs.writeFileSync(process.argv[2], String(process.pid));
setInterval(() => fs.appendFileSync(process.argv[3], 'late hook\\n'), 10);`);
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
  const settings = { hooks: { SessionStart: [{ hooks: [{ type: 'command', async: true,
    command: [process.execPath, script, join(fake.home, 'hook-pid'), join(fake.home, 'late-hook.log')].map(quote).join(' '),
  }] }] } };
  const run = (args: string[]) => new Promise<void>((resolve, reject) => {
    execFile(join(FAKE_CLAUDE_DIR, 'claude'), args, { cwd: fake.home, env }, error => error ? reject(error) : resolve());
  });
  try {
    await run(['--bg', '--settings', JSON.stringify(settings)]);
    await until(async () => !!(await fs.stat(join(fake.home, 'late-hook.log')).catch(() => null)), { what: 'hook late-write receipt' });
    const hookPid = Number(await fs.readFile(join(fake.home, 'hook-pid'), 'utf8'));
    const [session] = await fake.sessions();
    assert.ok(session);
    process.kill(session.pid, 'SIGKILL');
    await until(() => captureProcess(session.pid) === null, { what: 'session OS exit' });
    assert.ok(captureProcess(hookPid), 'hook survives its session');
    await cleanup();
    assert.equal(captureProcess(hookPid), null, 'hook is gone when cleanup returns');
    assert.equal(await fs.stat(fake.home).catch(() => null), null);
    // cwd must remain valid for execFile; admission rejects before fake startup
    // can recreate the removed home, even with the stale fixture environment.
    await new Promise<void>((resolve, reject) => {
      execFile(join(FAKE_CLAUDE_DIR, 'claude'), ['agents', '--json'], { env }, error => error ? reject(error) : resolve());
    });
    assert.equal(await fs.stat(fake.home).catch(() => null), null, 'late CLI cannot recreate the home');
  } finally { await cleanup(); }
});

test('fake Claude cleanup names the late file when directory removal stays busy', { timeout: 10_000 }, async t => {
  const { fake, context, cleanup } = await capturedFixture(t);
  const remove = fs.rm;
  let attempts = 0;
  t.mock.method(fs, 'rm', async (...args: Parameters<typeof fs.rm>) => {
    if (args[0] === fake.home) {
      attempts++;
      await fs.mkdir(join(fake.home, 'jobs'), { recursive: true });
      await fs.writeFile(join(fake.home, 'jobs', 'late-hook.log'), 'late hook');
      throw Object.assign(new Error('directory busy'), { code: attempts % 2 ? 'ENOTEMPTY' : 'EBUSY', path: fake.home });
    }
    return remove(...args);
  });
  syncBuiltinESMExports();
  try {
    await assert.rejects(cleanup(), error => {
      assert.match(String(error), /jobs\/late-hook\.log/);
      assert.match(String(error), /1000 ms/);
      return true;
    });
    assert.ok(attempts > 1, 'both ENOTEMPTY and EBUSY are retried');
  } finally {
    t.mock.restoreAll(); syncBuiltinESMExports();
    await remove(fake.home, { recursive: true, force: true });
    await cleanup();
  }
});

test('fake Claude cleanup retries transient ENOTEMPTY and EBUSY', async t => {
  const { fake, context, cleanup } = await capturedFixture(t);
  const remove = fs.rm;
  let attempts = 0;
  t.mock.method(fs, 'rm', async (...args: Parameters<typeof fs.rm>) => {
    if (args[0] === fake.home && ++attempts <= 2) {
      throw Object.assign(new Error('transient removal race'), { code: attempts === 1 ? 'ENOTEMPTY' : 'EBUSY' });
    }
    return remove(...args);
  });
  syncBuiltinESMExports();
  try {
    await cleanup();
    assert.equal(attempts, 3);
    assert.equal(await fs.stat(fake.home).catch(() => null), null);
  } finally {
    t.mock.restoreAll(); syncBuiltinESMExports();
    await cleanup();
  }
});

test('captured fake Claude teardown survives setup rejection and child error', { timeout: 20_000 }, async t => {
  for (const failure of ['setup', 'child'] as const) {
    let fixture: Awaited<ReturnType<typeof capturedFixture>> | undefined;
    let pid: number | undefined;
    let poll: Promise<void> | undefined;
    try {
      await t.test(failure, async scope => {
        fixture = await capturedFixture(scope);
        const { fake, context } = fixture;
        const config = join(fake.home, 'config');
        await fs.mkdir(config);
        await fs.writeFile(join(config, 'usage-report.json'), '{}');
        await fs.writeFile(join(config, failure === 'child' ? 'usage-fail' : 'usage-hold'), '');
        beforeDirectories(context, () => fs.writeFile(join(config, 'usage-release'), ''));
        const env = await accountFixtureEnvironment({ ...fake.env, CLAUDE_CONFIG_DIR: config });
        await assert.rejects(async () => {
          poll = new Promise<void>((resolve, reject) => {
            const child = execFile(join(FAKE_CLAUDE_DIR, 'claude'), ['-p', '/usage'], { env }, error => error ? reject(error) : resolve());
            pid = child.pid;
          });
          void poll.catch(() => {});
          if (failure === 'setup') {
            await until(async () => !!await fs.stat(join(fake.home, 'polls.jsonl')).catch(() => null), { what: 'held poll before setup rejection' });
            throw new Error('deliberate setup rejection');
          }
          await poll;
        }, failure === 'setup' ? /deliberate setup rejection/ : /429 rate limited/);
      });
      assert.ok(fixture);
      assert.equal(await fs.stat(fixture.fake.home).catch(() => null), null, `${failure}: real test hook removes home`);
      assert.ok(pid);
      assert.equal(captureProcess(pid), null, `${failure}: writer has exited`);
    } finally {
      // Also dispose the deliberately red version, whose captured hook was lost.
      await fixture?.cleanup();
      await poll?.catch(() => {});
    }
  }
});
