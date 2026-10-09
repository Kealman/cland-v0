// Runner CLI seam: separate Node processes, real process table, no internal mocks.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { ownDirectory } from './process-cleanup.ts';
import { fileURLToPath } from 'node:url';

const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function fixture(t: TestContext) {
  const dir = await mkdtemp(join(tmpdir(), 'cland-runner-test-'));
  ownDirectory(t, dir);
  return dir;
}
function run(t: TestContext, dir: string, file: string) {
  const code = `import { runSuite } from ${JSON.stringify(runner)}; process.exitCode = await runSuite([['--test', ${JSON.stringify(file)}]], { lockDir: ${JSON.stringify(join(dir, 'lock'))} });`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, NODE_TEST_CONTEXT: '', CLAND_TEST_SKIP_LOCK: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM'); if (child.signalCode !== 'SIGKILL') await done; });
  let output = '';
  child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
  child.stderr.on('data', (chunk: Buffer) => { output += chunk.toString(); });
  const done = new Promise<number | null>((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
  return { child, done, output: () => output };
}
async function until(check: () => boolean | Promise<boolean>) {
  for (let n = 0; n < 800; n++) { if (await check()) return; await delay(25); }
  throw new Error('runner did not reach the expected state');
}

test('two suite invocations serialize and report the holder', async (t) => {
  const dir = await fixture(t);
  const journal = join(dir, 'journal');
  const file = join(dir, 'pass.mjs');
  await writeFile(file, `import assert from 'node:assert/strict'; import { appendFile, readFile } from 'node:fs/promises'; import test from 'node:test'; test('fixture', async () => { const owner = JSON.parse(await readFile(${JSON.stringify(join(dir, 'lock.owner'))}, 'utf8')); assert.equal(owner.runner.pid, process.ppid); assert.equal(typeof owner.runner.started, 'string'); await appendFile(${JSON.stringify(journal)}, 'start\\n'); await new Promise(r => setTimeout(r, 500)); await appendFile(${JSON.stringify(journal)}, 'end\\n'); });`);
  const first = run(t, dir, file);
  await until(async () => (await readFile(journal, 'utf8').catch(() => '')).includes('start')).catch(error => { throw new Error(String(error) + '\n' + first.output()); });
  // The same directory also excludes the old manual mkdir convention in the reverse direction.
  await assert.rejects(mkdir(join(dir, 'lock')), { code: 'EEXIST' });
  const second = run(t, dir, file);
  await until(() => second.output().includes('waiting for the suite lock held by pid'));
  assert.match(second.output(), new RegExp(`held by pid ${first.child.pid} since`));
  assert.equal(await first.done, 0, first.output());
  assert.equal(await second.done, 0, second.output());
  assert.equal(await readFile(journal, 'utf8'), 'start\nend\nstart\nend\n');
});

test('a suite takes over locks left by a killed runner and reaper', async (t) => {
  const dir = await fixture(t);
  const marker = join(dir, 'holder.json');
  const holding = join(dir, 'held.mjs');
  await writeFile(holding, `import test from 'node:test'; import { writeFile } from 'node:fs/promises'; test('holder', async () => { await writeFile(${JSON.stringify(marker)}, JSON.stringify({ pid: process.pid, root: process.env.TMPDIR })); await new Promise(r => setTimeout(r, 60000)); });`);
  const holder = run(t, dir, holding);
  await until(async () => (await readFile(marker, 'utf8').catch(() => '')).length > 0);
  const worker = JSON.parse(await readFile(marker, 'utf8')) as { pid: number; root: string };
  const { captureProcess } = await import('./process-cleanup.ts');
  const workerIdentity = captureProcess(worker.pid);
  // A crashed runner cannot run its cleanup: clean the fixture child explicitly after the check.
  t.after(async () => { const { cleanupProcesses } = await import('./process-cleanup.ts'); await cleanupProcesses(worker.root, workerIdentity ? [workerIdentity] : []); await rm(worker.root, { recursive: true, force: true }); });
  const exited = new Promise<void>(resolve => holder.child.once('exit', () => resolve()));
  holder.child.kill('SIGKILL');
  await exited;
  // Recover a killed reaper through the existing hub-lock public interface too.
  const lockModule = fileURLToPath(new URL('../src/hub/lock.ts', import.meta.url));
  const reaperMarker = join(dir, 'reaper-started');
  const reaperPath = join(dir, 'lock.reaper');
  const reaper = spawn(process.execPath, ['--input-type=module', '-e', `import { acquireLock } from ${JSON.stringify(lockModule)}; import { writeFileSync } from 'node:fs'; acquireLock(${JSON.stringify(reaperPath)}); writeFileSync(${JSON.stringify(reaperMarker)}, 'ready'); setInterval(() => {}, 1000);`], { stdio: 'ignore' });
  const { ownProcess } = await import('./process-cleanup.ts');
  ownProcess(t, reaper.pid);
  await until(async () => (await readFile(reaperMarker, 'utf8').catch(() => '')).length > 0);
  const reaped = new Promise<void>(resolve => reaper.once('exit', () => resolve()));
  reaper.kill('SIGKILL');
  await reaped;
  const file = join(dir, 'pass.mjs');
  await writeFile(file, `import assert from 'node:assert/strict'; import { existsSync } from 'node:fs'; import test from 'node:test'; test('fixture', () => { assert.throws(() => process.kill(${worker.pid}, 0), { code: 'ESRCH' }); assert.equal(existsSync(${JSON.stringify(worker.root)}), false); });`);
  const suite = run(t, dir, file);
  assert.equal(await suite.done, 0, suite.output());
  assert.match(suite.output(), /taking over stale suite lock/);
  assert.throws(() => process.kill(worker.pid, 0), { code: 'ESRCH' });
  assert.equal(await import('node:fs/promises').then(({ stat }) => stat(worker.root)).catch(() => null), null);
});

test('takeover removes a root when the holder dies during its creation', async t => {
  const dir = await fixture(t);
  const marker = join(dir, 'created-root');
  const code = `import fs from 'node:fs/promises'; import { syncBuiltinESMExports } from 'node:module';
const mkdir = fs.mkdir; const mkdtemp = fs.mkdtemp;
async function crash(root) { await fs.writeFile(${JSON.stringify(marker)}, root); process.kill(process.pid, 'SIGKILL'); }
fs.mkdir = async (...args) => { const result = await mkdir(...args); if (String(args[0]).split('/').at(-1).startsWith('cland-suite-')) await crash(String(args[0])); return result; };
fs.mkdtemp = async (...args) => { const result = await mkdtemp(...args); if (String(args[0]).split('/').at(-1).startsWith('cland-suite-')) await crash(result); return result; };
syncBuiltinESMExports();
const { runSuite } = await import(${JSON.stringify(runner)}); await runSuite([], { lockDir: ${JSON.stringify(join(dir, 'lock'))} });`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, CLAND_TEST_SKIP_LOCK: '0' }, stdio: 'ignore' });
  const exited = new Promise<void>(resolve => child.once('exit', () => resolve()));
  const { ownProcess } = await import('./process-cleanup.ts');
  ownProcess(t, child.pid);
  await exited;
  assert.equal(child.signalCode, 'SIGKILL');
  const root = await readFile(marker, 'utf8');
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(dir, 'pass.mjs');
  await writeFile(file, `import test from 'node:test'; import assert from 'node:assert/strict'; import { existsSync } from 'node:fs'; test('crashed root gone before startup', () => assert.equal(existsSync(${JSON.stringify(root)}), false));`);
  const successor = run(t, dir, file);
  assert.equal(await successor.done, 0, successor.output());
});

test('takeover reaps a child paused before its identity is published', async t => {
  const dir = await fixture(t);
  const marker = join(dir, 'paused-runner.json');
  const lock = join(dir, 'lock');
  const file = join(dir, 'pass.mjs');
  await writeFile(file, `import test from 'node:test'; test('fixture', () => {});`);
  const code = `import fs from 'node:fs/promises'; import cp from 'node:child_process'; import { syncBuiltinESMExports } from 'node:module';
const spawn = cp.spawn; const rename = fs.rename;
cp.spawn = (...args) => { const child = spawn(...args); process.kill(child.pid, 'SIGSTOP'); return child; };
fs.rename = async (from, to) => {
  if (to === ${JSON.stringify(`${lock}.owner`)}) {
    const value = JSON.parse(await fs.readFile(from, 'utf8'));
    if (value.runner) { await fs.writeFile(${JSON.stringify(marker)}, JSON.stringify(value)); process.kill(process.pid, 'SIGKILL'); }
  }
  return rename(from, to);
};
syncBuiltinESMExports();
const { runSuite } = await import(${JSON.stringify(runner)}); await runSuite([['--test', ${JSON.stringify(file)}]], { lockDir: ${JSON.stringify(lock)} });`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, CLAND_TEST_SKIP_LOCK: '0' }, stdio: 'ignore' });
  const exited = new Promise<void>(resolve => child.once('exit', () => resolve()));
  const { ownProcess, cleanupProcesses } = await import('./process-cleanup.ts');
  ownProcess(t, child.pid);
  await exited;
  assert.equal(child.signalCode, 'SIGKILL');
  const previous = JSON.parse(await readFile(marker, 'utf8')) as { root: string; runner: { pid: number; started: string } };
  t.after(async () => { await cleanupProcesses(previous.root, [previous.runner], () => {}, '', [previous.runner]); await rm(previous.root, { recursive: true, force: true }); });
  // The durable sidecar still has no runner anchor: cwd proof alone must recover the stopped child.
  assert.equal(JSON.parse(await readFile(`${lock}.owner`, 'utf8')).runner, undefined);
  await writeFile(file, `import test from 'node:test'; import assert from 'node:assert/strict'; import { existsSync } from 'node:fs'; test('unpublished child gone before startup', () => { assert.throws(() => process.kill(${previous.runner.pid}, 0), { code: 'ESRCH' }); assert.equal(existsSync(${JSON.stringify(previous.root)}), false); });`);
  const successor = run(t, dir, file);
  assert.equal(await successor.done, 0, successor.output());
});

test('SIGTERM during bootstrap preparation never spawns a suite child', async t => {
  const dir = await fixture(t);
  const lock = join(dir, 'lock');
  const marker = join(dir, 'preparing.json');
  const spawned = join(dir, 'spawned');
  const file = join(dir, 'pass.mjs');
  await writeFile(file, `import test from 'node:test'; test('fixture', () => {});`);
  const code = `import fs from 'node:fs/promises'; import { appendFileSync } from 'node:fs'; import cp from 'node:child_process'; import { syncBuiltinESMExports } from 'node:module';
const writeFile = fs.writeFile; const spawn = cp.spawn;
cp.spawn = (...args) => { appendFileSync(${JSON.stringify(spawned)}, 'spawned'); return spawn(...args); };
fs.writeFile = async (...args) => {
  if (String(args[0]).split('/').at(-1).startsWith('bootstrap-')) {
    await writeFile(${JSON.stringify(marker)}, JSON.stringify({ root: String(args[0]).slice(0, String(args[0]).lastIndexOf('/')) }));
    process.kill(process.pid, 'SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return writeFile(...args);
};
syncBuiltinESMExports();
const { runSuite } = await import(${JSON.stringify(runner)}); process.exitCode = await runSuite([['--test', ${JSON.stringify(file)}]], { lockDir: ${JSON.stringify(lock)} });`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, CLAND_TEST_SKIP_LOCK: '0' }, stdio: 'ignore' });
  const done = new Promise<number | null>(resolve => child.once('close', resolve));
  const { ownProcess } = await import('./process-cleanup.ts');
  ownProcess(t, child.pid);
  assert.equal(await done, 143);
  const prepared = JSON.parse(await readFile(marker, 'utf8')) as { root: string };
  const { existsSync } = await import('node:fs');
  assert.equal(existsSync(spawned), false, 'a signal during preparation must not start any suite child');
  for (const path of [prepared.root, lock, `${lock}.owner`]) assert.equal(existsSync(path), false, path);
});

for (const kind of ['reused holder PID', 'dead automatic empty lock', 'unknown manual empty lock'] as const) {
  test(`suite lock handles ${kind}`, async t => {
    const dir = await fixture(t);
    const lock = join(dir, 'lock');
    await mkdir(lock);
    const old = new Date(Date.now() - 16 * 60_000);
    if (kind !== 'unknown manual empty lock') {
      const pid = kind === 'reused holder PID' ? process.pid : 2147483647;
      if (kind === 'dead automatic empty lock') assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
      const metadata = { pid, started: 'Mon Oct 5 12:00:00 1900', since: old.toISOString(), token: 'dead-fixture' };
      await writeFile(`${lock}.owner`, JSON.stringify(metadata));
      await utimes(`${lock}.owner`, old, old);
      if (kind === 'reused holder PID') await writeFile(join(lock, 'holder.json'), JSON.stringify(metadata));
    }
    await utimes(lock, old, old);
    const file = join(dir, 'pass.mjs');
    await writeFile(file, `import test from 'node:test'; test('fixture', () => {});`);
    const suite = run(t, dir, file);
    if (kind === 'unknown manual empty lock') {
      await until(() => suite.output().includes('WARNING: ownerless manual suite lock'));
      assert.match(suite.output(), /age 96[0-9]s; no owner recorded \(a manual lock\); if no suite is running, remove it with/);
      await delay(1200);
      assert.equal(suite.child.exitCode, null);
      assert.deepEqual(await import('node:fs/promises').then(({ readdir }) => readdir(lock)), []);
      suite.child.kill('SIGTERM');
      assert.equal(await suite.done, 143, suite.output());
      assert.deepEqual(await import('node:fs/promises').then(({ readdir }) => readdir(lock)), []);
      await rm(lock, { recursive: true });
    } else {
      assert.equal(await suite.done, 0, suite.output());
      assert.match(suite.output(), /taking over stale suite lock/);
    }
  });
}

for (const started of [new Date().toISOString(), null, 'unreadable-start-time']) {
  test(`a live older-version holder with start ${String(started)} keeps its lock`, async t => {
    const dir = await fixture(t);
    const lock = join(dir, 'lock');
    await mkdir(lock);
    const metadata = { pid: process.pid, token: 'legacy-fixture', ...(started === null ? {} : { started }) };
    await writeFile(`${lock}.owner`, JSON.stringify(metadata));
    const old = new Date(Date.now() - 60_000);
    await utimes(`${lock}.owner`, old, old);
    const file = join(dir, 'pass.mjs');
    await writeFile(file, `import test from 'node:test'; test('fixture', () => {});`);
    const suite = run(t, dir, file);
    await until(() => suite.output().includes('waiting for the suite lock') || suite.output().includes('taking over stale suite lock'));
    assert.match(suite.output(), /holder from an older version/);
    await delay(1200);
    assert.equal(suite.child.exitCode, null);
    assert.deepEqual(JSON.parse(await readFile(`${lock}.owner`, 'utf8')), metadata);
    suite.child.kill('SIGTERM');
    assert.equal(await suite.done, 143, suite.output());
    await rm(lock, { recursive: true });
    await rm(`${lock}.owner`);
  });
}

const harness = fileURLToPath(new URL('./harness.ts', import.meta.url));
for (const outcome of ['failure', 'SIGINT', 'SIGTERM', 'SIGKILL'] as const) {
  test(`a ${outcome} after launching a real daemon and fake harness leaves no process or project`, async (t) => {
    const dir = await fixture(t);
    const marker = join(dir, 'started.json');
    const file = join(dir, 'daemon.mjs');
    await writeFile(file, `
import test from 'node:test';
import { writeFile } from 'node:fs/promises';
import { tempProject, startDaemon, fakeClaude, connectUi, clauseAnswered } from ${JSON.stringify(harness)};
test('intentional fixture', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', name: 'coord', role: 'coordinator', harness: 'claude-code' }, 30000);
  if (!launched.ok) throw new Error(JSON.stringify(launched));
  await clauseAnswered(ui, 'coord');
  await writeFile(${JSON.stringify(marker)}, JSON.stringify({ root, suiteRoot: process.env.TMPDIR, pid: discovery.pid, sessions: await fake.sessions() }));
  ${outcome === 'failure' ? "throw new Error('intentional failure after daemon start');" : 'await new Promise(r => setTimeout(r, 60000));'}
});`);
    const suite = run(t, dir, file);
    await until(async () => (await readFile(marker, 'utf8').catch(() => '')).length > 0).catch(error => { throw new Error(String(error) + '\n' + suite.output()); });
    const started = JSON.parse(await readFile(marker, 'utf8')) as { root: string; suiteRoot: string; pid: number; sessions: Array<{ pid: number }> };
    if (outcome === 'SIGKILL') {
      const exited = new Promise<void>(resolve => suite.child.once('exit', () => resolve()));
      suite.child.kill('SIGKILL');
      await exited;
      const successorFile = join(dir, 'successor.mjs');
      await writeFile(successorFile, `import test from 'node:test'; import assert from 'node:assert/strict'; import { existsSync } from 'node:fs'; test('old run gone before startup', () => { for (const pid of ${JSON.stringify([started.pid, ...started.sessions.map(s => s.pid)])}) assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' }); assert.equal(existsSync(${JSON.stringify(started.suiteRoot)}), false); });`);
      const successor = run(t, dir, successorFile);
      assert.equal(await successor.done, 0, successor.output());
      assert.match(successor.output(), /taking over stale suite lock/);
    } else {
      if (outcome !== 'failure') suite.child.kill(outcome);
      assert.equal(await suite.done, outcome === 'failure' ? 1 : outcome === 'SIGINT' ? 130 : 143, suite.output());
    }
    const { execFileSync } = await import('node:child_process');
    const table = execFileSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' });
    for (const pid of [started.pid, ...started.sessions.map(s => s.pid)]) assert.doesNotMatch(table, new RegExp(`^\\s*${pid}\\s`, 'm'), suite.output());
    assert.equal(await readFile(join(started.root, '.cland', 'hub.json'), 'utf8').catch(() => null), null);
    assert.equal(await import('node:fs/promises').then(({ stat }) => stat(started.suiteRoot)).catch(() => null), null);
    assert.doesNotMatch(table, new RegExp(started.suiteRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
}

test('the final sweep reports and kills an orphan even when its test passed', async (t) => {
  const dir = await fixture(t);
  const marker = join(dir, 'orphan.json');
  const file = join(dir, 'orphan.mjs');
  await writeFile(file, `
import test from 'node:test'; import { spawn } from 'node:child_process'; import { mkdtemp, writeFile } from 'node:fs/promises'; import { tmpdir } from 'node:os'; import { join } from 'node:path';
test('leaks a detached child deliberately', async () => {
  const root = await mkdtemp(join(tmpdir(), 'orphan-'));
  const child = spawn(process.execPath, ['-e', 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)'], { cwd: root, detached: true, stdio: 'ignore' });
  child.unref();
  await writeFile(${JSON.stringify(marker)}, JSON.stringify({ root, pid: child.pid }));
});`);
  const suite = run(t, dir, file);
  assert.equal(await suite.done, 0, suite.output());
  const orphan = JSON.parse(await readFile(marker, 'utf8')) as { root: string; pid: number };
  assert.match(suite.output(), new RegExp(`cleanup pid ${orphan.pid}:`));
  assert.throws(() => process.kill(orphan.pid, 0), { code: 'ESRCH' });
});

test('a waiting runner exits on SIGTERM without releasing the live holder', async (t) => {
  const dir = await fixture(t);
  const marker = join(dir, 'started');
  const release = join(dir, 'release');
  const held = join(dir, 'held.mjs');
  await writeFile(held, `import test from 'node:test'; import { writeFile, access } from 'node:fs/promises'; test('holder', async () => { await writeFile(${JSON.stringify(marker)}, 'ready'); while (!await access(${JSON.stringify(release)}).then(() => true, () => false)) await new Promise(r => setTimeout(r, 25)); });`);
  const holder = run(t, dir, held);
  await until(async () => (await readFile(marker, 'utf8').catch(() => '')).length > 0);
  const file = join(dir, 'pass.mjs');
  await writeFile(file, `import test from 'node:test'; test('fixture', () => {});`);
  const waiting = run(t, dir, file);
  await until(() => waiting.output().includes('waiting for the suite lock'));
  waiting.child.kill('SIGTERM');
  assert.equal(await waiting.done, 143, waiting.output());
  const secondWaiter = run(t, dir, file);
  await until(() => secondWaiter.output().includes('waiting for the suite lock'));
  assert.equal(holder.child.exitCode, null);
  await writeFile(release, 'go');
  assert.equal(await holder.done, 0, holder.output());
  assert.equal(await secondWaiter.done, 0, secondWaiter.output());
});

test('a fixture path quoted by the invoking shell never kills that shell', async (t) => {
  const dir = await fixture(t);
  const cleanupModule = fileURLToPath(new URL('./process-cleanup.ts', import.meta.url));
  const script = `import { cleanupProcesses } from ${JSON.stringify(cleanupModule)}; await cleanupProcesses(${JSON.stringify(dir)});`;
  // The shell's command line names the temporary directory, just like a user's cleanup command.
  const quoted = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
  const child = spawn('sh', ['-c', `${quoted(process.execPath)} --input-type=module -e ${quoted(script)}; echo parent-survived`], { stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
  const result = await new Promise<number | null>(resolve => child.on('close', resolve));
  assert.equal(result, 0);
  assert.match(output, /parent-survived/);
});
