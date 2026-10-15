import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture } from './remote-fixture.ts';
import { cland, clandWithEnv, connectUi, eventually, projectHub, spawnSpoke, tempProject } from './harness.ts';
import { Suites, type SuiteJob } from '../src/hub/suites.ts';
import { Store } from '../src/hub/store.ts';
import { LocalExecutor } from '../src/executor/local.ts';
import { onCleanup, ownProcess } from './process-cleanup.ts';
import { parseConfig, renderConfig } from '../src/init/config.ts';
import type { VerificationQueue } from '../src/protocol.ts';

const exec = promisify(execFile);

for (const alreadyAnnounced of [false, true]) test(`fallback notice and log occur once across 20 ticks and restart (already announced: ${alreadyAnnounced})`, async t => {
  const root = await tempProject(t, 'cland-fallback-ticks-');
  const database = join(root, 'hub.db');
  const job: SuiteJob = {
    id: 'fallback-run', executor: 'local', requestedExecutor: 'droplet', fallback: 'remote budget full',
    ...(alreadyAnnounced ? { fallbackLogged: true } : {}),
    mode: 'hub-only', cwd: root, topic: 'fallback-topic', to: ['impl'],
    actor: { name: 'impl', sessionId: 'fallback-caller', shell: true },
    head: 'candidate', branch: 'candidate', log: join(root, 'run.log'), result: join(root, 'result.json'), gate: join(root, 'gate'),
    pid: null, started: null, outcome: null, artifact: null, reported: false, error: null,
    state: 'queued', queued: new Date().toISOString(),
  };
  // Keep the fallback queued at the executor boundary; every timer inspection
  // still exercises the real scheduler without workers or compatibility probes.
  t.mock.method(LocalExecutor.prototype, 'reap', async () => {});
  t.mock.method(LocalExecutor.prototype, 'occupied', async () => true);
  t.mock.method(LocalExecutor.prototype, 'holder', async () => null);
  t.mock.timers.enable({ apis: ['setInterval'] });
  const notices: string[] = [], logs: string[] = [];
  let inspections = 0;
  let store = new Store(database);
  store.setMeta('suite-jobs', JSON.stringify([job]));
  const restore = () => new Suites(store, root, async () => { assert.fail('queued run must not report'); }, {
    requesterDead: () => { inspections++; return false; },
    onFallback: job => { notices.push(job.id); },
    log: entry => { if (entry.event === 'verification-executor-fallback') logs.push(String(entry.id)); },
  });
  let suites = restore();
  t.after(async () => { await suites.close(); store.close(); });
  const ticks = async () => {
    for (let tick = 0; tick < 20; tick++) {
      t.mock.timers.tick(1000);
      await new Promise<void>(resolve => setImmediate(resolve));
    }
  };
  await ticks();
  assert.equal(inspections, 20, 'each scheduler tick inspected the fallback run');
  const expected = alreadyAnnounced ? [] : [job.id];
  assert.deepEqual(notices, expected);
  assert.deepEqual(logs, expected);
  await suites.close(); store.close();
  store = new Store(database);
  suites = restore();
  await ticks();
  assert.equal(inspections, 40, 'restored scheduler inspected another 20 ticks');
  assert.deepEqual(notices, expected, 'restart must not repeat the fallback notice');
  assert.deepEqual(logs, expected, 'restart must not repeat the fallback log');
});
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

test('explicit droplet waits for remote capacity while later local requests proceed', async t => {
  const f = await fixture(t, { hub: projectHub, test: barrier, config: 'remote_budget=1\nlifetime="15m"\nrun_timeout="5m"' });
  const first = await caller(t, f, 'first');
  const waiting = await caller(t, f, 'waiting');
  const local = await caller(t, f, 'local');
  const a = await first.launch('droplet');
  const machine = await f.remote(a.id); await started(join(machine.home, 'cland'));
  const b = await waiting.launch('droplet');
  const q = await queue(f);
  assert.equal(q.holder, null, 'explicit droplet must leave the free local slot alone');
  assert.deepEqual(q.waiters.map(w => [w.id, w.executor, w.position]), [[b.id, 'droplet', 1]]);
  const text = (await cland(f.root, 'verify', 'queue')).stdout;
  assert.match(text, /1\. waiting .* · droplet .*waiting for remote/);
  const c = await local.launch('local'); await started(local.cwd);
  assert.equal((await queue(f)).holder?.id, c.id);
  assert.equal(f.api.droplets.length, 1, 'waiting request must not create over budget');
  await writeFile(join(machine.home, 'cland/.cland/finish'), 'yes');
  await eventually('first remote candidate exited', async () => (await readFile(join(machine.run, 'done'), 'utf8').catch(() => '')).trim() || undefined, 20000);
  await finished(f, first.topic, a.id);
  const next = await f.remote(b.id); await started(join(next.home, 'cland'));
  assert.equal((await queue(f)).holder?.id, c.id, 'remote waiter runs beside the occupied local slot');
  await writeFile(join(next.home, 'cland/.cland/finish'), 'yes');
  await eventually('waiting remote candidate exited', async () => (await readFile(join(next.run, 'done'), 'utf8').catch(() => '')).trim() || undefined, 20000);
  assert.match((await finished(f, waiting.topic, b.id)).text, /Executor droplet/);
  await writeFile(join(local.cwd, '.cland/finish'), 'yes');
  await finished(f, local.topic, c.id);
  assert.deepEqual(f.api.droplets, []);
});

for (const budget of [1, 2]) test(`explicit droplet refuses an uncovered reservation with remote budget ${budget}`, async t => {
  const f = await fixture(t, { hub: projectHub, test: barrier, config: `remote_budget=${budget}\nlifetime="15m"\nrun_timeout="5m"\ndaily_spend_usd=0.1` });
  const first = await caller(t, f, 'first');
  const next = await caller(t, f, 'next');
  const a = await first.launch('droplet');
  const machine = await f.remote(a.id); await started(join(machine.home, 'cland'));
  const refused = await next.submit('droplet');
  assert.notEqual(refused.code, 0, 'unaffordable explicit request must refuse at submission');
  assert.match(refused.stderr, /daily spend cap \$0\.1/);
  const q = await queue(f);
  assert.equal(q.holder, null);
  assert.deepEqual(q.waiters, [], 'cap refusal must not leave a remote waiter');
  assert.equal(f.api.droplets.length, 1);
  await writeFile(join(machine.home, 'cland/.cland/finish'), 'yes');
  await eventually('funded remote candidate exited', async () => (await readFile(join(machine.run, 'done'), 'utf8').catch(() => '')).trim() || undefined, 20000);
  await finished(f, first.topic, a.id);
});

test('remote_budget defaults to four, validates positive integers and survives rendering', () => {
  assert.equal(parseConfig('', 'test').verification.remoteBudget, 4);
  for (const value of ['0', '-1', '1.5', '"2"']) assert.throws(() => parseConfig(`[verification]\nremote_budget=${value}`, 'test'), /remote_budget.*positive integer/);
  const c = parseConfig('[verification]\nremote_budget=3', 'test');
  assert.equal(c.verification.remoteBudget, 3);
  assert.deepEqual(parseConfig(renderConfig(c), 'test'), c);
});

test('three remote callers run together beside the local slot, which a human takes next', async t => {
  const f = await fixture(t, { test: barrier, config: 'remote_budget=3\nlifetime="15m"\nrun_timeout="5m"' });
  const callers = [];
  for (const name of ['a', 'b', 'c', 'local']) callers.push(await caller(t, f, name));
  const jobs = await Promise.all(callers.slice(0, 3).map(c => c.launch()));
  const remotes = await Promise.all(jobs.map(j => f.remote(j.id)));
  await Promise.all(remotes.map(r => started(join(r.home, 'cland'))));
  assert.equal(f.api.droplets.length, 3);
  const q = await queue(f);
  assert.equal(q.holder, null);
  assert.equal(q.remote!.length, 3);
  assert.equal(q.remoteBudget, 3);
  assert.ok(q.remote!.every(r => r.executor === 'droplet' && r.machine?.name.startsWith('cland-') && r.machine.size === 'c-8' && r.machine.region === 'lon1'));
  const local = callers[3]!; const localJob = await local.launch('local'); await started(local.cwd);
  assert.equal((await queue(f)).holder?.id, localJob.id);
  const human = await connectUi(t, f.discovery, 'cli');
  const slot = await human.request({ type: 'suite.slot', mode: 'hub-only', cwd: f.root, head: 'hand-head', pid: process.pid, token: 'budget-human' });
  assert.equal(slot.ok, true);
  assert.equal((slot.value as { admitted: boolean }).admitted, false);
  await writeFile(join(local.cwd, '.cland/finish'), 'yes');
  assert.match((await finished(f, local.topic, localJob.id)).text, /exit 0/);
  await eventually('human takes local slot while remotes run', async () => (await queue(f)).holder?.session === 'human' ? true : undefined);
  assert.equal((await queue(f)).remote!.length, 3);
  human.close();
  for (const r of remotes) await writeFile(join(r.home, 'cland/.cland/finish'), 'yes');
  // Releasing the barriers does not mean the candidates have exited. Observe
  // their receipts before timing result collection for three concurrent runs.
  await Promise.all(remotes.map(r => eventually('remote candidate exited', async () =>
    (await readFile(join(r.run, 'done'), 'utf8').catch(() => '')).trim() || undefined, 20000)));
  for (let i = 0; i < jobs.length; i++) assert.match((await finished(f, callers[i]!.topic, jobs[i]!.id)).text, /Executor droplet/);
  assert.deepEqual(f.api.droplets, []);
});

for (const frees of ['remote', 'local'] as const) test(`a full remote budget falls back once; a waiting request takes the first ${frees} slot to free`, async t => {
  const f = await fixture(t, { test: barrier, config: 'remote_budget=2\nlifetime="15m"\nrun_timeout="5m"' });
  const callers = [];
  for (const name of ['a', 'b', 'fallback', 'waiting']) callers.push(await caller(t, f, name));
  const jobs = await Promise.all(callers.slice(0, 2).map(c => c.launch()));
  const remotes = await Promise.all(jobs.map(j => f.remote(j.id)));
  await Promise.all(remotes.map(r => started(join(r.home, 'cland'))));
  const fallback = callers[2]!; const localJob = await fallback.launch(); await started(fallback.cwd);
  const waiting = callers[3]!; const waitingJob = await waiting.launch();
  const q = JSON.parse((await cland(f.root, 'verify', 'queue', '--json')).stdout) as VerificationQueue;
  assert.equal(q.holder?.id, localJob.id);
  assert.equal(q.holder.executor, 'local');
  assert.deepEqual(q.remote!.map(r => r.id).sort(), jobs.map(j => j.id).sort());
  assert.deepEqual(q.waiters.map(w => [w.id, w.executor]), [[waitingJob.id, 'droplet']]);
  const text = (await cland(f.root, 'verify', 'queue')).stdout;
  assert.match(text, /^local: fallback/);
  for (const r of q.remote!) assert.ok(text.includes(`droplet ${r.machine!.name} c-8 lon1`));
  assert.match(text, /remote 2\/2:/);
  assert.match(text, /1\. waiting .* · droplet · hub-only · wait/);
  const history = (await f.ui.request({ type: 'topic.history', topic: fallback.topic })).value as { messages: { text: string; severity?: string }[] };
  const notices = history.messages.filter(m => m.text.startsWith(`verify ${localJob.id}:`));
  assert.equal(notices.length, 1);
  assert.equal(notices[0]!.severity, 'warn');
  assert.equal(notices[0]!.text, `verify ${localJob.id}: remote budget 2/2 full; running locally`);
  assert.equal((await f.ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const journal = (await readFile(join(f.root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(journal.filter(r => r.event === 'verification-executor-fallback' && r.id === localJob.id).map(r => r.cause), ['remote budget full']);
  assert.deepEqual(journal.filter(r => r.event === 'verification-admitted').map(r => [r.remoteActive, r.remoteBudget]), [[1, 2], [2, 2]]);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 2);
  if (frees === 'remote') {
    await writeFile(join(remotes[0]!.home, 'cland/.cland/finish'), 'yes');
    assert.match((await finished(f, callers[0]!.topic, jobs[0]!.id)).text, /exit 0/);
    const next = await f.remote(waitingJob.id); await started(join(next.home, 'cland'));
    assert.equal(f.api.droplets.length, 2);
    assert.equal((await queue(f)).holder?.id, localJob.id);
    await writeFile(join(next.home, 'cland/.cland/finish'), 'yes');
  } else {
    await writeFile(join(fallback.cwd, '.cland/finish'), 'yes');
    assert.match((await finished(f, fallback.topic, localJob.id)).text, /exit 0/);
    await started(waiting.cwd);
    assert.equal((await queue(f)).holder?.id, waitingJob.id);
    assert.equal(f.api.droplets.length, 2);
    await writeFile(join(waiting.cwd, '.cland/finish'), 'yes');
  }
  for (const r of remotes) await writeFile(join(r.home, 'cland/.cland/finish'), 'yes');
  await writeFile(join(fallback.cwd, '.cland/finish'), 'yes');
  assert.match((await finished(f, waiting.topic, waitingJob.id)).text, /exit 0/);
  for (let i = 0; i < jobs.length; i++) await finished(f, callers[i]!.topic, jobs[i]!.id);
  await finished(f, fallback.topic, localJob.id);
  assert.deepEqual(f.api.droplets, []);
});

test('a hand holder and an earlier local waiter do not block a remote caller', async t => {
  const f = await fixture(t, { test: barrier, config: 'remote_budget=2\nlifetime="15m"\nrun_timeout="5m"' });
  const local = await caller(t, f, 'local'); const remote = await caller(t, f, 'remote');
  const human = await connectUi(t, f.discovery, 'cli');
  const slot = await human.request({ type: 'suite.slot', mode: 'hub-only', cwd: f.root, head: 'hand-head', pid: process.pid, token: 'held-human' });
  assert.equal(slot.ok, true);
  await eventually('human local admission', async () => (await queue(f)).holder?.session === 'human' ? true : undefined);
  const localJob = await local.launch('local'); const remoteJob = await remote.launch();
  const machine = await f.remote(remoteJob.id); await started(join(machine.home, 'cland'));
  const q = await queue(f);
  assert.equal(q.holder?.session, 'human');
  assert.deepEqual(q.waiters.map(w => [w.id, w.executor]), [[localJob.id, 'local']]);
  assert.equal(q.remote![0]!.id, remoteJob.id);
  human.close(); await started(local.cwd);
  await writeFile(join(local.cwd, '.cland/finish'), 'yes');
  await writeFile(join(machine.home, 'cland/.cland/finish'), 'yes');
  await finished(f, local.topic, localJob.id); await finished(f, remote.topic, remoteJob.id);
});

test('parallel acquires each reserve shared spend; cap refusals stay local without holding remote slots', async t => {
  const f = await fixture(t, { test: barrier, config: 'remote_budget=3\nlifetime="15m"\nrun_timeout="5m"\ndaily_spend_usd=0.1' });
  const callers = [];
  for (const name of ['a', 'b', 'c']) callers.push(await caller(t, f, name));
  await mkdir(join(f.root, '.cland/host.lock'));
  f.api.beforeCreate(async () => {
    const ledger = JSON.parse(await readFile(join(f.root, '.cland/executor-state/spend.json'), 'utf8')) as { entries: { run: string; reservation: number; cost: number | null }[] };
    assert.equal(ledger.entries.filter(e => e.cost === null).length, 1);
    assert.equal(ledger.entries.filter(e => e.cost === null)[0]!.reservation, 0.0625);
  });
  const jobs = await Promise.all(callers.map(c => c.launch()));
  const q = await eventually('one machine and two cap fallbacks', async () => {
    const q = await queue(f);
    return q.remote?.length === 1 && q.remote[0]!.machine && q.waiters.length === 2 && q.waiters.every(w => w.executor === 'droplet') ? q : undefined;
  }, 20000);
  const active = q.remote![0]!;
  const machine = await f.remote(active.id!); await started(join(machine.home, 'cland'));
  assert.equal(f.api.droplets.length, 1);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 1);
  for (let i = 0; i < jobs.length; i++) {
    if (jobs[i]!.id === active.id) continue;
    const history = (await f.ui.request({ type: 'topic.history', topic: callers[i]!.topic })).value as { messages: { text: string; severity?: string }[] };
    assert.ok(history.messages.some(m => m.severity === 'warn' && m.text.includes('daily spend cap $0.1 reached')));
  }
  await writeFile(join(machine.home, 'cland/.cland/finish'), 'yes');
  const index = jobs.findIndex(j => j.id === active.id);
  await finished(f, callers[index]!.topic, active.id!);
  assert.equal((await queue(f)).remote!.length, 0);
  // A subsequent caller can acquire; the refused candidates do not reserve slots.
  const later = await caller(t, f, 'later'); const laterJob = await later.launch();
  const next = await f.remote(laterJob.id); await started(join(next.home, 'cland'));
  await writeFile(join(next.home, 'cland/.cland/finish'), 'yes'); await finished(f, later.topic, laterJob.id);
  for (const j of jobs) if (j.id !== active.id) assert.equal((await f.ui.request({ type: 'suite.cancel', suite: j.id })).ok, true);
  for (let i = 0; i < jobs.length; i++) await finished(f, callers[i]!.topic, jobs[i]!.id);
  assert.deepEqual(f.api.droplets, []);
});

test('an unconfirmed acquire cleanup keeps its durable remote budget reservation', async t => {
  const f = await fixture(t, { test: barrier, config: 'remote_budget=1\nlifetime="15m"\nrun_timeout="5m"' });
  const first = await caller(t, f, 'first'); const next = await caller(t, f, 'next');
  await mkdir(join(f.root, '.cland/host.lock'));
  f.api.faults.deleteError = 503;
  await f.api.setMachineFaults({ ssh: true });
  const a = await first.launch();
  // Queue membership also includes requests that have not attempted acquisition.
  // Wait for the actual fallback notice before testing the durable reservation.
  await eventually('failed acquire falls back behind host holder', async () => {
    const history = (await f.ui.request({ type: 'topic.history', topic: first.topic })).value as { messages: { id: string }[] };
    return history.messages.some(m => m.id === `executor-fallback:${a.id}`) ? true : undefined;
  }, 20000);
  assert.equal(f.api.droplets.length, 1);
  const b = await next.launch();
  const notice = await eventually('second acquire refused behind durable lease', async () => {
    const history = (await f.ui.request({ type: 'topic.history', topic: next.topic })).value as { messages: { id: string; text: string }[] };
    return history.messages.find(m => m.id === `executor-fallback:${b.id}`);
  }, 20000);
  assert.equal(f.api.droplets.length, 1);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 1);
  assert.equal(notice.text, `verify ${b.id}: remote budget 1/1 full; running locally`);
  f.api.faults.deleteError = 0;
  await eventually('sweep confirms failed acquire cleanup', async () => f.api.droplets.length === 0 ? true : undefined, 20000);
  for (const j of [a, b]) assert.equal((await f.ui.request({ type: 'suite.cancel', suite: j.id })).ok, true);
  await finished(f, first.topic, a.id); await finished(f, next.topic, b.id);
});

test('local ETA uses local history while remote ETA includes its own acquisition time', async t => {
  const f = await fixture(t, { test: barrier, config: 'remote_budget=1\nlifetime="15m"\nrun_timeout="5m"' });
  const remote = await caller(t, f, 'remote'); const local = await caller(t, f, 'local');
  const first = await remote.launch(); const machine = await f.remote(first.id); await started(join(machine.home, 'cland'));
  const createdAt = Date.parse(f.api.droplets[0]!.created_at);
  const startedAt = Math.floor((await stat(join(machine.home, 'cland/.cland/started'))).mtimeMs);
  await writeFile(join(machine.home, 'cland/.cland/finish'), 'yes'); await finished(f, remote.topic, first.id);
  const second = await local.launch('local'); await started(local.cwd);
  await writeFile(join(local.cwd, '.cland/finish'), 'yes'); await finished(f, local.topic, second.id);
  const status = (await f.ui.request({ type: 'hub.status' })).value as { suites: { id: string; admittedAt: string; finished: string; runMs: number }[] };
  const remoteRun = status.suites.find(j => j.id === first.id)!;
  const remoteMs = remoteRun.runMs;
  const localMs = status.suites.find(j => j.id === second.id)!.runMs;
  const admittedAt = Date.parse(remoteRun.admittedAt), finishedAt = Date.parse(remoteRun.finished);
  assert.ok(admittedAt <= createdAt && createdAt <= startedAt, 'remote timing starts before provider creation and machine execution');
  // The shell's done marker reports whole seconds, while admission and file
  // timestamps retain milliseconds. Compare their execution order at that precision.
  assert.ok(Math.floor(startedAt / 1000) <= finishedAt / 1000, 'remote finish follows the machine file barrier');
  assert.equal(remoteMs, finishedAt - admittedAt, 'remote duration starts before acquire, not at machine execution');
  assert.ok(remoteMs >= finishedAt - createdAt, 'acquisition time is included in remote history');
  const running = await remote.launch(); const next = await f.remote(running.id); await started(join(next.home, 'cland'));
  await mkdir(join(f.root, '.cland/host.lock'));
  await writeFile(join(f.root, '.cland/host.lock.owner'), JSON.stringify({ pid: process.pid, started: null, token: 'eta-human', worktree: f.root, since: new Date().toISOString() }));
  const waitA = await caller(t, f, 'wait-a'); const waitB = await caller(t, f, 'wait-b');
  const a = await waitA.launch('local'); const b = await waitB.launch('local');
  const q = await queue(f);
  assert.deepEqual(q.waiters.map(w => w.id), [a.id, b.id]);
  assert.deepEqual(q.waiters.map(w => w.expectedRunMs), [localMs, localMs]);
  assert.equal(q.waiters[0]!.etaMs, q.holder!.etaMs);
  assert.equal(q.waiters[1]!.etaMs! - q.waiters[0]!.etaMs!, localMs);
  assert.equal(q.remote![0]!.etaMs, Math.max(0, remoteMs - q.remote![0]!.runMs!));
  for (const job of [a, b]) assert.equal((await f.ui.request({ type: 'suite.cancel', suite: job.id })).ok, true);
  await finished(f, waitA.topic, a.id); await finished(f, waitB.topic, b.id);
  await writeFile(join(next.home, 'cland/.cland/finish'), 'yes'); await finished(f, remote.topic, running.id);
});
