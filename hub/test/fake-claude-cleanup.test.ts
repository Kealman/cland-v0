// T3: the assertion is teardown of a real CLI which writes after hub shutdown.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { accountFixtureEnvironment } from './account-fixture-env.ts';
import { FakeClock } from './fake-clock.ts';
import { fakeClaude, FAKE_CLAUDE_DIR, until } from './harness.ts';
import { beforeDirectories, captureProcess, ownProcess, cleanupProcesses, fixtureProcessCensus } from './process-cleanup.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { findFixtureOrphans, removeWorktreeWithFixtures } from '../src/fixture-processes.ts';
import { systemProcesses } from '../src/system-processes.ts';
import { assertFakeClaudeCensus } from './fake-claude-census.ts';
import { residueControl, residueChild, type ResidueCase } from './fixture-residue-control.ts';

// Stop the captured worker group before joining the original controller work.
// Only then discover detached sessions, whose final census gates root removal.
async function nativeControlRoot(c: ResidueCase): Promise<{ root: string; drain: () => Promise<void> }> {
  const root = await c.root();
  const writers = c.own(root, async root => {
    await cleanupProcesses(root, [], undefined, undefined, undefined, { discover: true });
    assert.deepEqual(fixtureProcessCensus(root), [], 'all detached fixture writers exited before root removal');
  }, { afterJoin: true });
  return { root, drain: writers.close };
}

for (const mode of ['dropped cleanup', 'failing body'] as const) {
  test(`fake Claude final census detects ${mode}`, { timeout: 30_000 }, t => residueControl(t, { native: true }).run(async c => {
    const { root } = await nativeControlRoot(c);
    const script = join(root, 'census.test.mjs');
    const marker = join(root, 'session.json');
    const mcp = join(root, 'mcp.json');
    const harness = new URL('./harness.ts', import.meta.url).href;
    const environment = new URL('./account-fixture-env.ts', import.meta.url).href;
    const census = new URL('./fake-claude-census.ts', import.meta.url).href;
    await c.step('MCP configuration setup', () => fs.writeFile(mcp, JSON.stringify({ mcpServers: { cland: { command: process.execPath, args: [new URL('../bin/cland-spoke.ts', import.meta.url).pathname] } } })));
    await c.step('census child script setup', () => fs.writeFile(script, `import test from 'node:test';
import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fakeClaude, FAKE_CLAUDE_DIR, until } from ${JSON.stringify(harness)};
import { accountFixtureEnvironment } from ${JSON.stringify(environment)};
import { assertFakeClaudeCensus } from ${JSON.stringify(census)};
import { systemProcesses } from ${JSON.stringify(new URL('../src/system-processes.ts', import.meta.url).href)};
test('fixture body', async t => {
  const fake = await fakeClaude(${mode === 'dropped cleanup' ? '{ after() {} }' : 't'});
  const env = await accountFixtureEnvironment(fake.env);
  await new Promise((resolve, reject) => execFile(FAKE_CLAUDE_DIR + '/claude', ['--bg', '--mcp-config', ${JSON.stringify(mcp)}], { cwd: process.cwd(), env }, error => error ? reject(error) : resolve()));
  const [session] = await fake.sessions();
  await until(async () => (await fake.log(session.id)).includes('session ready'), { what: 'session ready before body exit' });
  const spoke = (await systemProcesses()).find(row => row.parent === session.pid && row.command.includes('cland-spoke.ts'));
  if (!spoke) throw new Error('spoke launch incomplete');
  await writeFile(${JSON.stringify(marker)}, JSON.stringify({ session, spoke, home: fake.home }));
  ${mode === 'failing body' ? "throw new Error('controlled fixture body failure');" : ''}
});
test('final fake Claude census', assertFakeClaudeCensus);
`));
    const worker = await residueChild(c, 'census worker acquisition', () => spawn(process.execPath, ['--test', '--test-reporter=tap', script], { cwd: root, detached: true, env: fixtureEnvironment(root, process.env, { TMPDIR: root, NODE_TEST_CONTEXT: undefined }), stdio: ['ignore', 'pipe', 'pipe'] }));
    await worker.observe('fixture file native close', () => worker.closed);
    const output = worker.diagnostic();
    const receipt = JSON.parse(await worker.observe('fixture session receipt', () => fs.readFile(marker, 'utf8'))) as { session: { pid: number }; spoke: { pid: number }; home: string };
    await c.acquire('late session ownership', async () => ownProcess(undefined, receipt.session.pid), stop => stop());
    await c.acquire('late spoke ownership', async () => ownProcess(undefined, receipt.spoke.pid), stop => stop());
    if (mode === 'dropped cleanup') {
      assert.ok(captureProcess(receipt.session.pid), 'positive control: omitted teardown leaks the session');
      assert.ok(captureProcess(receipt.spoke.pid), 'positive control: omitted teardown leaks the spoke');
      assert.equal(worker.child.exitCode, 1, output);
      assert.match(output, /not ok \d+ - final fake Claude census/);
      assert.match(output, /fake-Claude session and spoke groups are empty/);
    } else {
      assert.equal(worker.child.exitCode, 1, output);
      assert.match(output, /controlled fixture body failure/);
      assert.match(output, /(?:^|\n)ok \d+ - final fake Claude census/);
      assert.equal(captureProcess(receipt.session.pid), null, 'failing body joins the session');
      assert.equal(captureProcess(receipt.spoke.pid), null, 'failing body joins the spoke');
    }
  }));
}

test('orphan sweep joins a fake Claude session after its fixture worker is killed', { timeout: 30_000 }, t => residueControl(t, { native: true }).run(async c => {
  const { root, drain } = await nativeControlRoot(c);
  const project = join(root, 'project');
  await c.step('separate project setup', () => fs.mkdir(project));
  const marker = join(root, 'launched.json');
  const script = join(root, 'worker.mjs');
  const harness = new URL('./harness.ts', import.meta.url).href;
  const environment = new URL('./account-fixture-env.ts', import.meta.url).href;
  const mcp = join(root, 'mcp.json');
  await c.step('MCP configuration setup', () => fs.writeFile(mcp, JSON.stringify({ mcpServers: { cland: { command: process.execPath, args: [new URL('../bin/cland-spoke.ts', import.meta.url).pathname] } } })));
  await c.step('SIGKILL worker script setup', () => fs.writeFile(script, `import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fakeClaude, FAKE_CLAUDE_DIR, until } from ${JSON.stringify(harness)};
import { accountFixtureEnvironment } from ${JSON.stringify(environment)};
const fake = await fakeClaude({ after() {} });
const env = await accountFixtureEnvironment(fake.env);
await new Promise((resolve, reject) => execFile(FAKE_CLAUDE_DIR + '/claude', ['--bg', '--mcp-config', ${JSON.stringify(mcp)}], { cwd: process.cwd(), env }, error => error ? reject(error) : resolve()));
const [session] = await fake.sessions();
await until(async () => (await fake.log(session.id)).includes('session ready'), { what: 'session ready before worker death' });
await writeFile(${JSON.stringify(marker)}, JSON.stringify({ ...session, home: fake.home }));
setInterval(() => {}, 1000);
`));
  const worker = await residueChild(c, 'SIGKILL worker acquisition', () => spawn(process.execPath, [script], { cwd: project, detached: true, env: fixtureEnvironment(root, process.env, { TMPDIR: root }), stdio: ['ignore', 'pipe', 'pipe'] }));
  await worker.observe('worker session receipt setup', () => until(async () => !!await fs.stat(marker).catch(() => null), { what: 'worker session receipt' }));
  const session = JSON.parse(await worker.observe('session receipt read', () => fs.readFile(marker, 'utf8'))) as { pid: number; home: string };
  await c.acquire('live session ownership', async () => ownProcess(undefined, session.pid), stop => stop());
  const spoke = (await c.step('live spoke discovery', () => systemProcesses())).find(row => row.parent === session.pid && row.command.includes('cland-spoke.ts'));
  assert.ok(spoke, 'positive control: session owns a live spoke');
  await c.acquire('live spoke ownership', async () => ownProcess(undefined, spoke.pid), stop => stop());
  assert.ok(captureProcess(session.pid), 'positive control: detached session is alive');
  await c.step('worker SIGKILL', async () => { worker.child.kill('SIGKILL'); });
  const [, signal] = await worker.observe('killed fixture worker native close', () => worker.closed);
  assert.equal(signal, 'SIGKILL', 'worker close confirms the injected signal');
  assert.ok(captureProcess(session.pid), 'positive control: worker SIGKILL leaves the session alive');
  assert.equal(session.home.startsWith(project + '/'), false, 'the fake home is separate from its project cwd');
  const orphans = await c.step('private receipt orphan discovery', () => findFixtureOrphans(root, undefined, undefined, project));
  assert.ok(orphans.some(orphan => orphan.process.pid === session.pid && orphan.owned), 'orphan sweep recognizes the session through its private ownership receipt');
  assert.equal(orphans.find(orphan => orphan.process.pid === session.pid)?.root, session.home, 'only the allocated fake home is disposable');
  await c.step('guarded worktree removal', () => removeWorktreeWithFixtures(project, async () => {
    assert.equal(captureProcess(session.pid), null, 'session exited before root removal');
    assert.equal(captureProcess(spoke.pid), null, 'spoke exited before root removal');
    await drain(); // Settle fallback discovery while its original root still exists.
    await fs.rm(project, { recursive: true, force: true });
  }));
  assert.equal(captureProcess(session.pid), null, 'empty session census after sweep');
  assert.equal(captureProcess(spoke.pid), null, 'empty spoke census after sweep');
}));

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
    // cland-allow-child-env: accountFixtureEnvironment seals owned fake profiles; config is inspected to hold the poll under test
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
    // cland-allow-child-env: accountFixtureEnvironment seals owned fake profiles; config is inspected to hold the poll under test
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
            // cland-allow-child-env: accountFixtureEnvironment seals owned fake profiles; config is inspected to hold the poll under test
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

test('Claude cleanup file ends with no fake sessions or spokes', assertFakeClaudeCensus);
