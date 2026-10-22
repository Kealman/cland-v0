// T3: real PATH-selected Node worker launch and recovery of a live worker across hub process restarts.
import { completeJournalLines } from './journal-lines.ts';
import { verificationFixture } from './verification-fixture.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { platform, arch, release } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { cland, clandWithEnv, connectUi, eventually, spawnSpoke, startDaemon, tempProject, until, pidAlive } from './harness.ts';
import { ownProcess } from './process-cleanup.ts';
import type { HubStatus } from '../src/protocol.ts';

async function fixture(t: import('node:test').TestContext, script: string, alternateNode = false) {
  const root = await tempProject(t, 'cland-executor-');
  await mkdir(join(root, '.cland'));
  const commands = await verificationFixture(root, { testScript: script });
  await writeFile(join(root, '.cland', 'config.toml'), `[verification]\n${commands}lock_path = ${JSON.stringify(join(root, 'suite.lock'))}\n`);
  const daemonEnv: Record<string, string> = {};
  if (alternateNode) {
    const bin = join(root, 'bin');
    await mkdir(bin);
    const binary = join(bin, 'node');
    await writeFile(binary, `#!${process.execPath}\nimport { spawnSync } from 'node:child_process';\nif (process.argv[2] === '--version') console.log('v99.8.7');\nelse { const r = spawnSync(${JSON.stringify(process.execPath)}, process.argv.slice(2), { stdio: 'inherit' }); process.exit(r.status ?? 1); }\n`);
    await chmod(binary, 0o700);
    daemonEnv.PATH = `${bin}:${process.env.PATH}`;
  }
  const { discovery } = await startDaemon(t, root, daemonEnv);
  const ui = await connectUi(t, discovery, 'cli');
  assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'impl', sessionId: 'executor-caller', role: 'implementer' });
  t.after(() => spoke.close());
  await spoke.waitForPresence(['impl']);
  const env = { CLAND_SESSION_NAME: 'impl', CLAND_SESSION_ID: 'executor-caller', CLAND_ROLE: 'implementer' };
  const created = JSON.parse((await cland(root, 'task', 'create', '--size', 'M', 'executor fixture', '--assignee', 'impl', '--json')).stdout);
  const item = created.item.id as string;
  const made = await ui.request({ type: 'topic.create', title: 'Executor fixture', item });
  const topic = (made.value as { topic: { id: string } }).topic.id;
  const launch = async ({ waitForRunning = false } = {}) => {
    const response = await clandWithEnv(root, env, 'verify', 'auto', '--report', topic, '--to', 'impl', '--json');
    assert.equal(response.code, 0, response.stderr);
    const job = JSON.parse(response.stdout) as { id: string; pid: number | null };
    if (waitForRunning) {
      // Admission can reply before the worker starts; observe the hub's receipt.
      job.pid = await eventually('executor worker running with pid', async () => {
        const status = (await ui.request({ type: 'hub.status', history: true })).value as HubStatus;
        const run = status.suites?.find(run => run.id === job.id);
        return run?.state === 'running' && run.pid ? run.pid : undefined;
      });
    }
    if (job.pid) ownProcess(t, job.pid);
    return job;
  };
  return { root, ui, item, topic, launch, daemonPid: discovery.pid };
}

test('verify reports the worker PATH Node, candidate Neovim pin and platform in its receipt and journal', async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"', true);
  await mkdir(join(f.root, 'nvim'));
  await writeFile(join(f.root, 'nvim', 'NVIM_VERSION'), 'v0.12.5\n');
  const job = await f.launch();
  const result = await eventually('executor result', async () => {
    const history = await f.ui.request({ type: 'topic.history', topic: f.topic });
    return (history.value as { messages: Array<{ id: string; text: string }> }).messages.find(message => message.id === `suite:${job.id}`);
  });
  const expected = { os: platform(), arch: arch(), release: release(), node: 'v99.8.7', nvim: 'v0.12.5' };
  assert.ok(result.text.includes(`Executor local · ${expected.os} ${expected.arch} · Node v99.8.7 · Neovim v0.12.5`));
  const status = (await f.ui.request({ type: 'hub.status', history: true, flushLogs: true })).value as HubStatus;
  const run = status.suites!.find(run => run.id === job.id)!;
  assert.equal(run.executor, 'local');
  assert.deepEqual(run.platform, expected);
  const receipt = JSON.parse(await readFile(join(f.root, '.cland', 'run', 'suites', job.id, 'result.json'), 'utf8'));
  assert.deepEqual(receipt.platform, expected);
  const log = await readFile(join(f.root, '.cland', 'run', 'suites', job.id, 'suite.log'), 'utf8');
  assert.ok(log.includes(`platform ${expected.os} ${expected.arch} ${expected.release} · Node v99.8.7 · Neovim v0.12.5`));
  assert.ok(log.indexOf('platform ') < log.indexOf('$ npm run typecheck'));
  const view = JSON.parse((await cland(f.root, 'task', 'view', f.item, '--json')).stdout);
  assert.equal(view.item.verify.executor, 'local');
  const journal = completeJournalLines(await readFile(join(f.root, '.cland', 'journal.jsonl'), 'utf8')).map(line => JSON.parse(line));
  for (const event of ['suite-result', 'verification-timing']) {
    const entry = journal.find(entry => entry.event === event && entry.id === job.id);
    assert.equal(entry.executor, 'local');
    assert.deepEqual(entry.platform, expected);
  }
});

test('a pre-executor running job restored from hub.db reports as local exactly once', async t => {
  // T3: recovery of a live suite worker across hub-process restarts.
  const f = await fixture(t, `node -e "const fs=require('fs');const p=setInterval(()=>{if(fs.existsSync('finish'))clearInterval(p)},50)"`);
  const job = await f.launch({ waitForRunning: true });
  assert.ok(job.pid);
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  await until(() => !pidAlive(f.daemonPid), { what: 'the stopped hub process is gone before editing its store' });
  const db = new DatabaseSync(join(f.root, '.cland', 'hub.db'));
  try {
    const row = db.prepare("select value from meta where key = 'suite-jobs'").get() as { value: string };
    const jobs = JSON.parse(row.value);
    for (const run of jobs) { delete run.executor; delete run.lease; delete run.platform; }
    db.prepare("update meta set value = ? where key = 'suite-jobs'").run(JSON.stringify(jobs));
  } finally { db.close(); }
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  const adopted = await eventually('the restarted hub adopts the held live worker', async () => {
    const status = (await ui.request({ type: 'hub.status', history: true })).value as HubStatus;
    return status.suites?.find(run => run.id === job.id && run.state === 'running');
  });
  assert.equal(adopted.pid, job.pid);
  assert.equal(adopted.executor, 'local');
  assert.equal(pidAlive(job.pid), true, 'the restored worker is still alive before its barrier is released');
  assert.equal(adopted.reported, false);
  await writeFile(join(f.root, 'finish'), 'ready');
  const completed = await eventually('the released worker writes its completion receipt', async () => {
    try { return JSON.parse(await readFile(join(f.root, '.cland', 'run', 'suites', job.id, 'result.json'), 'utf8')) as { code: number }; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
  });
  assert.equal(completed.code, 0);
  const read = async () => {
    const history = await ui.request({ type: 'topic.history', topic: f.topic });
    return (history.value as { messages: Array<{ id: string; text: string }> }).messages.filter(message => message.id === `suite:${job.id}`);
  };
  const result = await eventually('legacy result', async () => { const messages = await read(); return messages.length ? messages : undefined; });
  assert.equal(result.length, 1);
  assert.match(result[0]!.text, /auto exit 0/);
  assert.match(result[0]!.text, /Executor local · \S+ \S+ · Node v[\d.]+ · Neovim none/);
  const status = (await ui.request({ type: 'hub.status', history: true })).value as HubStatus;
  assert.equal(status.suites![0]!.executor, 'local');
  assert.equal(status.suites![0]!.platform?.nvim, 'none');
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  await until(() => !pidAlive(next.discovery.pid), { what: 'the second stopped hub is gone before restart' });
  const again = await startDaemon(t, f.root);
  const againUi = await connectUi(t, again.discovery);
  const history = await againUi.request({ type: 'topic.history', topic: f.topic });
  assert.equal((history.value as { messages: Array<{ id: string }> }).messages.filter(message => message.id === `suite:${job.id}`).length, 1);
});
