// Runner CLI seam: separate Node processes, real process table, no internal mocks.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function fixture(t: TestContext) {
  const dir = await mkdtemp(join(tmpdir(), 'cland-runner-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
function run(t: TestContext, dir: string, file: string) {
  const code = `import { runSuite } from ${JSON.stringify(runner)}; process.exitCode = await runSuite([['--test', ${JSON.stringify(file)}]], { lockDir: ${JSON.stringify(join(dir, 'lock'))} });`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, NODE_TEST_CONTEXT: '', CLAND_TEST_SKIP_LOCK: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => { if (child.exitCode === null) child.kill('SIGTERM'); await done; });
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
  await writeFile(file, `import { appendFile } from 'node:fs/promises'; import test from 'node:test'; test('fixture', async () => { await appendFile(${JSON.stringify(journal)}, 'start\\n'); await new Promise(r => setTimeout(r, 500)); await appendFile(${JSON.stringify(journal)}, 'end\\n'); });`);
  const first = run(t, dir, file);
  await until(async () => (await readFile(journal, 'utf8').catch(() => '')).includes('start')).catch(error => { throw new Error(String(error) + '\n' + first.output()); });
  const second = run(t, dir, file);
  await until(() => second.output().includes('waiting for the suite lock held by pid'));
  assert.match(second.output(), new RegExp(`held by pid ${first.child.pid} since`));
  assert.equal(await first.done, 0, first.output());
  assert.equal(await second.done, 0, second.output());
  assert.equal(await readFile(journal, 'utf8'), 'start\nend\nstart\nend\n');
});

test('a suite takes over a lock whose holder died', async (t) => {
  const dir = await fixture(t);
  const dead = spawn(process.execPath, ['-e', '']);
  await new Promise<void>((resolve) => dead.on('close', () => resolve()));
  await mkdir(join(dir, 'lock'));
  await writeFile(join(dir, 'lock', 'holder.json'), JSON.stringify({ pid: dead.pid, started: 'yesterday', token: 'dead' }));
  const file = join(dir, 'pass.mjs');
  await writeFile(file, `import test from 'node:test'; test('fixture', () => {});`);
  const suite = run(t, dir, file);
  assert.equal(await suite.done, 0, suite.output());
  assert.match(suite.output(), /taking over stale suite lock/);
});

const harness = fileURLToPath(new URL('./harness.ts', import.meta.url));
for (const outcome of ['failure', 'SIGINT', 'SIGTERM'] as const) {
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
    if (outcome !== 'failure') suite.child.kill(outcome);
    assert.equal(await suite.done, outcome === 'failure' ? 1 : outcome === 'SIGINT' ? 130 : 143, suite.output());
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
  const file = join(dir, 'pass.mjs');
  await writeFile(file, `import test from 'node:test'; test('fixture', () => {});`);
  await mkdir(join(dir, 'lock'));
  const holder = { pid: process.pid, started: 'now', token: 'live' };
  await writeFile(join(dir, 'lock', 'holder.json'), JSON.stringify(holder));
  const suite = run(t, dir, file);
  await until(() => suite.output().includes('waiting for the suite lock'));
  suite.child.kill('SIGTERM');
  assert.equal(await suite.done, 143, suite.output());
  assert.deepEqual(JSON.parse(await readFile(join(dir, 'lock', 'holder.json'), 'utf8')), holder);
});
