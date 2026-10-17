// T3: delivered remote workers exit before their receipts release provider capacity.
// Real shell completion with failed spend settlement proves the process receipt
// boundary; unconfirmed deletion policy lives in suite-accounting (T2).
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture } from './remote-fixture.ts';
import { cland, clandWithEnv, eventually, projectHub, spawnSpoke } from './harness.ts';
import { onCleanup, ownProcess } from './process-cleanup.ts';
import type { VerificationQueue } from '../src/protocol.ts';

// Both kinds of executor stop at a file barrier in their own candidate checkout.
const barrier = `node -e "const fs=require('fs');fs.mkdirSync('.cland',{recursive:true});fs.writeFileSync('.cland/started','yes');const t=setInterval(()=>{if(fs.existsSync('.cland/finish'))clearInterval(t)},25)"`;
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function caller(t: TestContext, f: Fixture, name: string) {
  const cwd = join(f.root, '.cland', name);
  await f.git('worktree', 'add', '-qb', name, cwd);
  assert.equal((await f.ui.request({ type: 'role.set', session: name, role: 'implementer' })).ok, true);
  const spoke = await spawnSpoke({ discover: true, assignRole: false, cwd: f.root, name, sessionId: `budget-${name}`, role: 'implementer' });
  onCleanup(t, () => spoke.close()); await spoke.waitForPresence([name]);
  const item = JSON.parse((await cland(f.root, 'task', 'create', '--size', 'M', name, '--assignee', name, '--json')).stdout).item.id as string;
  const topic = ((await f.ui.request({ type: 'topic.create', item, title: name })).value as { topic: { id: string } }).topic.id;
  const actor = { CLAND_SESSION_NAME: name, CLAND_SESSION_ID: `budget-${name}` };
  const submit = (executor?: 'local' | 'droplet') => clandWithEnv(cwd, { ...actor, CLAND_HUB_FILE: join(f.root, '.cland/hub.json') }, 'verify', '--fresh', ...(executor ? ['--executor', executor] : []), '--report', topic, '--to', name, '--json');
  const launch = async (executor?: 'local' | 'droplet') => {
    const r = await submit(executor);
    assert.equal(r.code, 0, r.stderr);
    const job = JSON.parse(r.stdout) as { id: string; pid: number | null };
    if (job.pid) ownProcess(t, job.pid);
    return job;
  };
  return { cwd, topic, launch, submit };
}
const queue = async (f: Fixture) => (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
async function started(cwd: string) {
  await eventually('candidate reached file barrier', async () => await readFile(join(cwd, '.cland/started'), 'utf8').catch(() => '') === 'yes' ? true : undefined, 20000);
}
async function finished(f: Fixture, topic: string, id: string) {
  return eventually('candidate result', async () => {
    const history = (await f.ui.request({ type: 'topic.history', topic })).value as { messages: { id: string; text: string }[] };
    return history.messages.find(m => m.id === `suite:${id}`);
  }, 20000);
}

test('finished remote runs free both budget slots despite failed spend settlement', async t => {
  const f = await fixture(t, { hub: projectHub, test: barrier, config: 'remote_budget=2\nlifetime="15m"\nrun_timeout="5m"' });
  const normal = await caller(t, f, 'normal');
  const failing = await caller(t, f, 'failing');
  const waiters = [await caller(t, f, 'waiting-a'), await caller(t, f, 'waiting-b')];
  const a = await normal.launch('droplet');
  const machine = await f.remote(a.id); await started(join(machine.home, 'cland'));
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  onCleanup(t, () => release.resolve());
  f.api.beforeCreate(async () => { entered.resolve(); await release.promise; });
  const b = await failing.launch('droplet');
  await entered.promise;
  const pending: Awaited<ReturnType<typeof normal.launch>>[] = [];
  for (const waiter of waiters) pending.push(await waiter.launch('droplet'));
  const full = await queue(f);
  assert.deepEqual(full.remote!.map(r => r.id).sort(), [a.id, b.id].sort());
  assert.deepEqual(full.waiters.map(w => w.id), pending.map(j => j.id));
  // Filesystem fault at the accounting boundary: deletion can be confirmed even
  // when the shared spend ledger cannot be settled. Keep it broken until both
  // receipts and waiter admissions have been observed, so retries cannot mask it.
  const ledger = join(f.root, '.cland/executor-state/spend.json');
  const saved = await readFile(ledger, 'utf8');
  try {
    await writeFile(ledger, '{"version":0,"entries":[]}');
    f.api.faults.create = 422;
    release.resolve();
    await writeFile(join(machine.home, 'cland/.cland/finish'), 'yes');
    await eventually('normal remote candidate exited', async () => (await readFile(join(machine.run, 'done'), 'utf8').catch(() => '')).trim() || undefined, 20000);
    for (const job of [a, b]) await eventually('terminal result written', async () => readFile(join(f.root, '.cland/run/suites', job.id, 'result.json'), 'utf8').catch(() => undefined), 20000);
    assert.match((await finished(f, normal.topic, a.id)).text, /exit 0/);
    assert.match((await finished(f, failing.topic, b.id)).text, /exit 1/);
    await eventually('both remote waiters admitted', async () => {
      await f.ui.request({ type: 'hub.status', flushLogs: true });
      const journal = (await readFile(join(f.root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
      return pending.every(job => journal.some(entry => entry.event === 'verification-admitted' && entry.id === job.id)) ? true : undefined;
    }, 20000);
    const q = await queue(f);
    assert.ok(q.remote!.every(r => r.id !== a.id && r.id !== b.id));
    assert.equal(q.waiters.length, 0);
    assert.equal(f.api.droplets.length, 0, 'confirmed deletions stay separate from accounting failure');
  } finally {
    release.resolve();
    await writeFile(ledger, saved);
  }
});

