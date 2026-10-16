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

test('startup posts the persisted remote receipt before admitting its waiter', async t => {
  const f = await fixture(t, { hub: projectHub, config: 'remote_budget=1\nlifetime="15m"\nrun_timeout="5m"' });
  const run = await f.launch('--executor', 'droplet');
  await f.result(run.id);
  const result = JSON.parse(await readFile(join(f.root, '.cland/run/suites', run.id, 'result.json'), 'utf8'));
  assert.equal(result.code, 0);
  await f.stop();
  const store = new Store(join(f.root, '.cland/hub.db'));
  const jobs = JSON.parse(store.meta('suite-jobs')!) as SuiteJob[];
  const prior = jobs.find(job => job.id === run.id)!;
  // Crash window: result.json is durable, but the job row predates completion.
  // The machine has since been deleted; probing it cannot recover the receipt.
  prior.state = 'launching'; prior.outcome = null; prior.reported = false;
  delete prior.cleaned; delete prior.finished; delete prior.completedAt;
  prior.artifact = null; prior.nextPoll = Date.now() + 60000;
  const dir = join(f.root, '.cland/run/suites/restored-waiter');
  await mkdir(dir, { recursive: true }); await writeFile(join(dir, 'suite.log'), '');
  const waiter: SuiteJob = { ...prior, id: 'restored-waiter', actor: null, state: 'queued',
    queued: new Date().toISOString(), log: join(dir, 'suite.log'), result: join(dir, 'result.json'), gate: join(dir, 'ready') };
  delete waiter.lease; delete waiter.remoteAcquireAttempted; delete waiter.remoteLogStart; delete waiter.nextPoll;
  store.setMeta('suite-jobs', JSON.stringify([prior, waiter]));
  const reports: { id: string; outcome: SuiteJob['outcome']; finished: string | undefined; platform: SuiteJob['platform'] }[] = [];
  const suites = new Suites(store, f.root, async job => { reports.push({ id: job.id, outcome: job.outcome, finished: job.finished, platform: job.platform }); }, {
    remoteBudget: 1, env: { ...process.env, ...f.env, CLAND_EXECUTOR_STATE: join(f.root, '.cland/executor-state') },
  });
  try {
    const receipt = await eventually('persisted receipt posted after startup', () => reports.find(job => job.id === run.id), 20000);
    assert.deepEqual(receipt.outcome, { code: 0, cause: '' });
    assert.equal(receipt.finished, result.finished);
    assert.deepEqual(receipt.platform, result.platform);
    await eventually('restored waiter completes', () => reports.find(job => job.id === waiter.id), 20000);
    assert.deepEqual(reports.map(job => job.id), [run.id, waiter.id]);
    assert.equal(suites.snapshot().remote!.length, 0);
    assert.equal(suites.snapshot().waiters.length, 0);
    assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 2, 'only the original run and its waiter create machines');
  } finally { await suites.close(); store.close(); }
});

test('an unconfirmed release posts its receipt while the live lease still guards admission', async t => {
  const f = await fixture(t, { hub: projectHub, test: barrier, config: 'remote_budget=1\nlifetime="15m"\nrun_timeout="5m"' });
  const first = await caller(t, f, 'first'); const waiting = await caller(t, f, 'waiting');
  const a = await first.launch('droplet');
  const machine = await f.remote(a.id); await started(join(machine.home, 'cland'));
  const b = await waiting.launch('droplet');
  f.api.faults.deleteError = 403;
  try {
    await writeFile(join(machine.home, 'cland/.cland/finish'), 'yes');
    await eventually('candidate exited before failed deletion', async () => (await readFile(join(machine.run, 'done'), 'utf8').catch(() => '')).trim() || undefined, 20000);
    assert.match((await finished(f, first.topic, a.id)).text, /exit 0/);
    assert.equal(f.api.droplets.length, 1);
    assert.deepEqual((await queue(f)).waiters.map(w => w.id), [b.id], 'the durable lease still reserves provider capacity');
  } finally { f.api.faults.deleteError = 0; }
  const next = await f.remote(b.id); await started(join(next.home, 'cland'));
  await writeFile(join(next.home, 'cland/.cland/finish'), 'yes');
  await eventually('waiter candidate exited', async () => (await readFile(join(next.run, 'done'), 'utf8').catch(() => '')).trim() || undefined, 20000);
  await finished(f, waiting.topic, b.id);
  assert.deepEqual(f.api.droplets, []);
});

for (const remoteOnly of ['explicit droplet', 'local_fallback=false'] as const) test(`${remoteOnly} waits for remote capacity while later local requests proceed`, async t => {
  const f = await fixture(t, { hub: projectHub, test: barrier, config: `remote_budget=1\nlifetime="15m"\nrun_timeout="5m"${remoteOnly === 'local_fallback=false' ? '\nlocal_fallback=false' : ''}` });
  const first = await caller(t, f, 'first');
  const waiting = await caller(t, f, 'waiting');
  const local = await caller(t, f, 'local');
  const a = await first.launch('droplet');
  const machine = await f.remote(a.id); await started(join(machine.home, 'cland'));
  const b = await waiting.launch(remoteOnly === 'explicit droplet' ? 'droplet' : undefined);
  const q = JSON.parse((await cland(f.root, 'verify', 'queue', '--json')).stdout) as VerificationQueue;
  assert.equal(q.localFallback, remoteOnly !== 'local_fallback=false');
  assert.equal(q.holder, null, 'remote-only request must leave the free local slot alone');
  assert.equal(q.waiters[0]!.waitingFor, 'remote');
  assert.equal(q.waiters[0]!.etaMs, q.remote![0]!.etaMs, 'waiter ETA uses the occupied remote slot');
  assert.deepEqual(q.waiters.map(w => [w.id, w.executor, w.position]), [[b.id, 'droplet', 1]]);
  const text = (await cland(f.root, 'verify', 'queue')).stdout;
  assert.match(text, /1\. waiting .* · droplet .*waiting for remote/);
  assert.ok(text.includes(`local fallback: ${remoteOnly !== 'local_fallback=false'}`));
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
  await eventually('local worker completion receipt', () => readFile(join(f.root, '.cland/run/suites', c.id, 'result.json'), 'utf8').catch(() => undefined), 20000);
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

test('local_fallback defaults to true, validates booleans and survives rendering', () => {
  assert.equal(parseConfig('', 'test').verification.localFallback, true);
  for (const value of ['0', '"false"', '[]']) assert.throws(() => parseConfig(`[verification]\nlocal_fallback=${value}`, 'test'), /local_fallback.*boolean/);
  for (const value of [false, true]) {
    const c = parseConfig(`[verification]\nlocal_fallback=${value}`, 'test');
    assert.equal(c.verification.localFallback, value);
    assert.deepEqual(parseConfig(renderConfig(c), 'test'), c);
  }
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
  assert.equal(q.localFallback, true, 'default fallback policy remains enabled');
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
