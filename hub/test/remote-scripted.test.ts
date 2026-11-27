// T2: remote verification orchestration uses an in-process provider and scripted machine.
// Candidate, snapshot and process facts are injected; no hub, spoke, watchdog, ssh/scp or suite worker child.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fixture } from './remote-fixture.ts';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import { dirname, join } from 'node:path';
import type { Message } from '../src/protocol.ts';
import { readLeaseHistory } from '../src/executor/droplet/lease.ts';
import { appendFile, readFile, stat } from 'node:fs/promises';
import { drive } from './remote-clock.ts';
import { scriptedCase } from './remote-scripted-case.ts';
import { onCleanup } from './process-cleanup.ts';
import { acquireLockAsync } from '../src/hub/lock.ts';
import { spendPath } from '../src/executor/droplet/spend.ts';
import { eventually } from './harness.ts';
import { completeJournalLines } from './journal-lines.ts';

for (const cap of [12000, 768, 384]) test(`selection fallback is visible before summaries at the ${cap}-byte result cap`, async t => {
  const scope = scriptedCase(t);
  let holder: Awaited<ReturnType<typeof acquireLockAsync>> | undefined;
  scope.ownResource(() => holder?.release());
  return scope.run(async step => {
    const f = await step(() => scope.wait('fallback fixture setup', () => fixture(scope.fixtures, { machine: 'scripted', openDatabase: scope.openDatabase, config: `[hygiene]\nmax_text_bytes = ${cap}\n` })));
    scope.releaseOnClose(() => { void f.stop().catch(() => {}); });
    const operation = <T>(name: string, work: () => Promise<T>) => step(() => scope.wait(name, () => drive(f, work())));
    if (cap === 384) {
      await operation('initial executor sweep', () => eventually('initial executor sweep receipt', async () => {
        await f.ui.request({ type: 'hub.status', flushLogs: true });
        return completeJournalLines(await readFile(join(f.root, '.cland/journal.jsonl'), 'utf8')).some(line => JSON.parse(line).event === 'executor-sweep') || undefined;
      }));
      holder = await operation('held ledger acquisition', () => acquireLockAsync(`${spendPath(f.env)}.lock`, undefined, undefined, 'UTC', f.dependencies.processes));
    }
    f.candidate.selection = { mode: 'full', files: [], reason: 'fetch unavailable', fallback: 'selection fallback: full; fetch unavailable: fatal: cannot lock ref' };
    // Arm before submission, then release only after the owner requests its retry.
    const retry = cap === 384 ? f.waits.waiting() : undefined;
    const submitted = await step(() => scope.wait('fallback submission', () => f.launch()));
    if (retry) {
      await step(() => scope.wait('ledger retry requested', () => retry));
      await step(() => scope.wait('held ledger release', () => holder!.release()));
    }
    await operation('fallback machine start', () => f.machine.started(submitted.id));
    await f.clock.advance(1000);
    const report = await operation('fallback report', () => f.result(submitted.id));
    assert.equal(report.text.split('\n')[2], f.candidate.selection.fallback);
    assert.ok(Buffer.byteLength(report.text) <= cap);
    const cached = await operation('cached submission', () => f.launch());
    assert.equal(cached.cached?.run, submitted.id);
    const reused = await operation('cached report', () => f.result(cached.id));
    assert.equal(reused.text.split('\n')[2], f.candidate.selection.fallback);
    assert.ok(Buffer.byteLength(reused.text) <= cap);
  });
});

test('scripted remote verification acquires, delivers, starts, collects and releases on the hub clock', async t => {
  const scope = scriptedCase(t);
  return scope.run(async step => {
    const f = await step(() => scope.wait('orchestration fixture setup', () => fixture(scope.fixtures, { machine: 'scripted', openDatabase: scope.openDatabase })));
    scope.releaseOnClose(() => { void f.stop().catch(() => {}); });
    const operation = <T>(name: string, work: () => Promise<T>) => step(() => scope.wait(name, () => drive(f, work())));
    const transport = f.dependencies.run!;
    const deliver = transport.deliver.bind(transport);
    let logPath = '';
    scope.patch(transport, 'deliver', async (...args: Parameters<typeof transport.deliver>) => {
      logPath = args[1].log;
      await appendFile(args[1].log, `delivery upload tree.bundle attempt 1: succeeded; elapsed 250 ms; timeout 318000 ms\n`);
      await deliver(...args);
    });
    assert.equal((await f.ui.request({ type: 'subscribe' })).ok, true);
    const waitFor = f.ui.waitFor.bind(f.ui);
    scope.patch(f.ui, 'waitFor', (...args: Parameters<typeof f.ui.waitFor>) => {
      assert.equal(args[1], undefined, 'orchestration frame receipts must inherit load-scaled setup headroom');
      return waitFor(...args);
    });
    const submitted = await operation('orchestration submission', () => f.launch('--executor', 'droplet'));
    assert.equal(typeof submitted.id, 'string', JSON.stringify(submitted));
    const reported = f.ui.waitFor(frame => frame.type === 'message' && (frame.message as Message).id === `suite:${submitted.id}`).then(frame => frame.message as Message);
    // Observe the durable start receipt before advancing the execution deadline.
    await operation('orchestration machine start', () => Promise.race([f.machine.started(submitted.id), reported.then(report => { throw new Error(`remote run finished before its start receipt: ${report.text}`); })]));
    await f.ui.waitFor(frame => frame.type === 'verification.queue' && (frame.queue as { remote?: Array<{ id?: string }> }).remote?.some(run => run.id === submitted.id) === true);
    await f.clock.advance(1000);
    const report = await operation('orchestration report', () => reported);
    assert.match(report.text, /exit 0/);
    assert.match(report.text, /linux/);
    assert.match(report.text, /tests 1; pass 1/);
    const log = await readFile(logPath, 'utf8');
    assert.match(log, /delivery upload tree.bundle attempt 1/);
    assert.match(log, /# tests 1\n# pass 1/);
    const steps = f.machine.calls.filter(call => call.run === submitted.id).map(call => call.step);
    for (const step of ['ready', 'deliver', 'start', 'status', 'log', 'release']) assert.ok(steps.includes(step), `${step} crossed its boundary`);
    assert.ok(steps.indexOf('deliver') < steps.indexOf('start'));
    assert.ok(steps.indexOf('log') < steps.indexOf('release'));
    assert.deepEqual(f.api.droplets, []);
    assert.deepEqual(f.api.keys, []);
    const [lease] = await readLeaseHistory(f.root);
    assert.equal(lease?.state, 'released');
    assert.equal(lease?.watchdog?.pid, 0, 'the host fake never armed a detached child');
    assert.equal(f.spoke.pid, 0);
    assert.equal(f.guard.pid, 0, 'the scripted fixture needs no reaper process');
    await operation('scripted guard has no pending native exit', () => f.guard.exited);
    assert.equal(f.api.url, '', 'the provider has no HTTP listener');
  });
});

test('scripted machines report red, lost and slow runs without a worker', async t => {
  let executor: DropletExecutor | undefined;
  const scope = scriptedCase(t);
  scope.ownResource(() => executor?.close());
  return scope.run(async step => {
    const f = await step(() => scope.wait('scripted fixture setup', () => fixture(scope.fixtures, { machine: 'scripted', openDatabase: scope.openDatabase })));
    const owner = executor = new DropletExecutor(f.root, undefined, undefined, f.env, undefined, f.dependencies);
    const operation = <T>(name: string, work: () => Promise<T>) => step(() => scope.wait(name, () => drive(f, f.waits.track(work))));
    for (const outcome of ['red', 'lost', 'slow'] as const) {
      // The fixture hub's sweep can own the ledger lock when this executor arrives.
      // Drive its requested retry; native I/O alone must not advance product time.
      const lease = await operation(`${outcome}: acquire`, () => owner.acquire({ id: outcome }, new Date(f.clock.now().getTime() + 100000).toISOString()));
      f.machine.script({ outcome, afterMs: 50, failures: ['scripted failure: Ω'] });
      const ref = { id: outcome, cwd: f.root, head: 'candidate', mode: 'hub-only', log: join(f.root, 'log'), result: join(f.root, 'result'), gate: join(f.root, 'gate') };
      await operation(`${outcome}: deliver`, () => owner.deliver(lease, ref));
      assert.equal((await owner.status(lease)).state, 'pending');
      await operation(`${outcome}: start`, () => owner.start(lease, ref));
      if (outcome === 'lost') assert.deepEqual(await owner.status(lease), { state: 'lost', code: 1, cause: 'remote machine lost' });
      else {
        assert.equal((await owner.status(lease)).state, 'running');
        await f.clock.advance(51);
        if (outcome === 'red') {
          assert.equal((await owner.status(lease)).code, 1);
          const log = await owner.log(lease, 0);
          assert.match(log.text, /scripted failure: Ω/);
          assert.equal(log.next, Buffer.byteLength(log.text));
          assert.equal((await owner.log(lease, log.next)).text, '');
        } else {
          assert.equal((await owner.status(lease)).state, 'running');
          await operation(`${outcome}: cancel`, () => owner.cancel(lease, 'SIGTERM'));
          assert.equal((await owner.status(lease)).code, 1);
        }
      }
      await operation(`${outcome}: release`, () => owner.release(lease));
      assert.equal(lease.state, 'released');
    }
    assert.deepEqual(f.api.droplets, []);
    assert.deepEqual(f.api.keys, []);
  });
});

test('scripted fixture retains roots and native guard until registered cleanup repairs', async t => {
  let refuse = true;
  let scope: ReturnType<typeof scriptedCase> | undefined;
  // The control also repairs through the registered owner if an assertion fails.
  t.after(async () => { refuse = false; await scope?.close(); await scope?.restore(); });
  scope = scriptedCase(t);
  const owner = scope;
  let f: Awaited<ReturnType<typeof fixture>> | undefined;
  let installed: unknown;
  await owner.run(async step => {
    installed = owner.nativeBoundary();
    f = await step(() => owner.wait('cleanup control setup', () => fixture(owner.fixtures, { machine: 'scripted', openDatabase: owner.openDatabase })));
    onCleanup(owner.fixtures, () => { if (refuse) throw new Error('controlled registered cleanup rejection'); });
  });
  await assert.rejects(owner.close(), /controlled registered cleanup rejection/);
  await assert.rejects(owner.restore(), /resource close unconfirmed/);
  assert.equal(owner.nativeBoundary(), installed, 'native guard survives rejected registered cleanup');
  for (const root of [f!.root, f!.territory, f!.api.stateRoot]) assert.ok((await stat(root)).isDirectory());
  refuse = false;
  await owner.close();
  assert.ok(owner.databases.length > 0);
  assert.ok(owner.databases.every(db => !db.isOpen));
  for (const root of [f!.root, f!.territory, f!.api.stateRoot]) await assert.rejects(stat(root), { code: 'ENOENT' });
  await owner.restore();
  assert.notEqual(owner.nativeBoundary(), installed, 'native guard restores only after successful registered cleanup');
});

for (const resource of ['executor', 'ledger'] as const) test(`scripted ${resource} closure keeps roots and seams through a held rejection and repair`, async t => {
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  let refuse = true, closed = false;
  let scope: ReturnType<typeof scriptedCase> | undefined;
  t.after(async () => { refuse = false; release.resolve(); await scope?.close(); await scope?.restore(); });
  scope = scriptedCase(t);
  const owner = scope;
  let closeResource: (() => Promise<void>) | undefined;
  owner.ownResource(() => closeResource?.());
  let f: Awaited<ReturnType<typeof fixture>> | undefined;
  let installed: unknown;
  await owner.run(async step => {
    installed = owner.nativeBoundary();
    f = await step(() => owner.wait('owned resource fixture setup', () => fixture(owner.fixtures, { machine: 'scripted', openDatabase: owner.openDatabase })));
    let nativeClose: () => Promise<void>;
    if (resource === 'executor') {
      const executor = new DropletExecutor(f.root, undefined, undefined, f.env, undefined, f.dependencies);
      nativeClose = () => executor.close();
    } else {
      await step(() => owner.wait('initial sweep receipt', () => eventually('initial executor sweep receipt', async () => {
        await f!.ui.request({ type: 'hub.status', flushLogs: true });
        return completeJournalLines(await readFile(join(f!.root, '.cland/journal.jsonl'), 'utf8')).some(line => JSON.parse(line).event === 'executor-sweep') || undefined;
      })));
      const ledger = await step(() => owner.wait('controlled ledger acquired', () => acquireLockAsync(`${spendPath(f!.env)}.lock`, undefined, undefined, 'UTC', f!.dependencies.processes)));
      nativeClose = () => ledger.release();
    }
    closeResource = async () => {
      entered.resolve();
      await release.promise;
      if (refuse) throw new Error(`controlled ${resource} close rejection`);
      await nativeClose();
      closed = true;
    };
  });
  const disposal = owner.close();
  void disposal.catch(() => {});
  await owner.wait('early close entered', () => entered.promise);
  assert.equal(closed, false, 'early abort started closure without claiming completion');
  assert.equal(owner.nativeBoundary(), installed);
  release.resolve();
  await assert.rejects(disposal, new RegExp(`controlled ${resource} close rejection`));
  await assert.rejects(owner.restore(), /resource close unconfirmed/);
  for (const root of [f!.root, f!.territory, f!.api.stateRoot]) assert.ok((await stat(root)).isDirectory(), 'registered cleanup retains roots after caller close rejection');
  assert.equal(owner.nativeBoundary(), installed, 'same native guard survives the failed close');
  refuse = false;
  await owner.close();
  assert.equal(closed, true, 'same registered owner joins native close on repair');
  for (const root of [f!.root, f!.territory, f!.api.stateRoot]) await assert.rejects(stat(root), { code: 'ENOENT' });
  await owner.restore();
  assert.notEqual(owner.nativeBoundary(), installed);
});

for (const constructor of ['Tracker', 'Store'] as const) test(`scripted fixture owns a database before ${constructor} constructor rejection and retries its close`, async t => {
  let refuse = true;
  let scope: ReturnType<typeof scriptedCase> | undefined;
  t.after(async () => { refuse = false; await scope?.close(); await scope?.restore(); });
  scope = scriptedCase(t);
  const owner = scope;
  const failure = new Error(`controlled ${constructor} schema rejection`);
  let root = '', installed: unknown;
  await owner.run(async step => {
    installed = owner.nativeBoundary();
    await assert.rejects(step(() => owner.wait('constructor control setup', () => fixture(owner.fixtures, {
      machine: 'scripted', openDatabase: path => {
        const db = owner.openDatabase(path);
        root = dirname(dirname(path));
        if (owner.databases.length === (constructor === 'Tracker' ? 1 : 2)) {
          const exec = db.exec.bind(db), close = db.close.bind(db);
          owner.patch(db, 'exec', (sql: string) => {
            // Fail after the common opener has returned the captured handle.
            if (sql !== 'pragma busy_timeout = 5000;') throw failure;
            return exec(sql);
          });
          owner.patch(db, 'close', () => { if (refuse) throw new Error('controlled native database close rejection'); close(); });
        }
        return db;
      },
    }))), error => error === failure);
    assert.ok(owner.databases.at(-1)?.isOpen, 'constructor rejection leaves a captured native owner');
  });
  await assert.rejects(owner.close(), /controlled native database close rejection/);
  await assert.rejects(owner.restore(), /resource close unconfirmed/);
  assert.equal(owner.nativeBoundary(), installed);
  assert.ok((await stat(root)).isDirectory(), 'actual registered removal retains the root on rejected DB close');
  assert.ok(owner.databases.at(-1)?.isOpen);
  refuse = false;
  await owner.close();
  assert.ok(owner.databases.every(db => !db.isOpen), 'same registered owner closes every captured database');
  await assert.rejects(stat(root), { code: 'ENOENT' });
  await owner.restore();
  assert.notEqual(owner.nativeBoundary(), installed);
});
