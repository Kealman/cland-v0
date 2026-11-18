// T3: cancellation terminates real suite workers and descendants; hub restart recovers worker death and reports once.
// Public CLI/socket tests use tiny package fixtures, never the live project's full-suite queue.
import { sessionUi as connectUi, sessionClandWithEnv as clandWithEnv } from './session-credential-fixture.ts';
import { verificationFixture } from './verification-fixture.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, stat, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, eventually, testWaitMs, startDaemon, spawnSpoke, tempProject, pidAlive, fakeCodex } from './harness.ts';
import { fixture, type ResultMessage } from './suite-fixture.ts';
import { suiteSummary } from '../src/hub/suites.ts';
import { DatabaseSync } from 'node:sqlite';
import { onCleanup, ownProcess } from './process-cleanup.ts';
import type { Artifact } from '../src/protocol.ts';
import type { VerificationQueue, HubStatus } from '../src/protocol.ts';
import type { ItemSummary, ItemView } from '../src/tracker/tracker.ts';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { defaultConfig, parseConfig, renderConfig } from '../src/init/config.ts';
import { cacheRepository, humanRunnerFixture } from './suite-support.ts';
import { systemProcessProbe } from './system-process-probe.ts';
import { waitTimeoutMs } from './until.ts';
import { processAlive } from '../src/adapters/processes.ts';
import { processIdentityAsync } from '../src/process-identity.ts';
import { fixtureEnvironment, scratchGitEnvironment } from './fixture-environment.ts';

for (const unreadableFirst of [false, true]) test(`cancel retry retains verified partial validation with unreadable sibling ${unreadableFirst ? 'first' : 'last'} before reparenting`, async () => {
  await systemProcessProbe(`
const { LocalExecutor } = await import(${JSON.stringify(new URL('../src/executor/local.ts', import.meta.url).href)});
rows = [row(420100, 1, 420100), row(420101, 420100, 420101), { ...row(420102, 420100, 420102), micros: null }];
if (${unreadableFirst}) [rows[1], rows[2]] = [rows[2], rows[1]];
const executor = new LocalExecutor([], () => {}, () => {});
const run = { id: 'partial-cancel', cwd: process.cwd(), head: 'a'.repeat(40), mode: 'auto', log: 'suite.log', result: 'result.json', gate: 'gate' };
const lease = executor.restore(run, { pid: 420100, started: start, identity: nativeBirth(rows[0]), outcome: null });
await assert.rejects(executor.cancel(lease, 'SIGTERM'), /suite cancellation could not verify the worker tree/);
assert.deepEqual(signals, [], 'incomplete validation grants no signal before the owner retains verified proof');
rows = rows.filter(r => r.pid !== 420100).map(r => ({ ...r, parent: 1 }));
await executor.cancel(lease, 'SIGTERM');
assert.deepEqual(rows.map(r => r.pid), [420102], 'verified partial capture drains after reparenting; unknown sibling stays untouched');
assert.ok(signals.some(s => s.pid === 420101 && s.signal === 'SIGTERM'));
assert.ok(signals.every(s => s.pid !== 420102), 'missing native identity never acquires signal authority');
`);
});

for (const unreadableFirst of [false, true]) test(`cancel retry retains grace discoveries with unreadable sibling ${unreadableFirst ? 'first' : 'last'} before reparenting`, async () => {
  await systemProcessProbe(`
const { LocalExecutor } = await import(${JSON.stringify(new URL('../src/executor/local.ts', import.meta.url).href)});
rows = [row(420100, 1, 420100)];
const executor = new LocalExecutor([], () => {}, () => {});
const run = { id: 'partial-grace', cwd: process.cwd(), head: 'a'.repeat(40), mode: 'auto', log: 'suite.log', result: 'result.json', gate: 'gate' };
const lease = executor.restore(run, { pid: 420100, started: start, identity: nativeBirth(rows[0]), outcome: null });
onSignal = (pid, signal) => {
  if (pid === 420100 && signal === 'SIGTERM') {
    const children = [row(420101, 420100, 420101), { ...row(420102, 420100, 420102), micros: null }];
    if (${unreadableFirst}) children.reverse();
    rows.push(...children);
    return false;
  }
};
await assert.rejects(executor.cancel(lease, 'SIGTERM'));
rows = rows.filter(r => r.pid !== 420100).map(r => ({ ...r, parent: 1 }));
onSignal = () => {};
await executor.cancel(lease, 'SIGTERM');
assert.deepEqual(rows.map(r => r.pid), [420102], 'verified grace discovery survives partial failure and reparenting');
assert.ok(signals.every(s => s.pid !== 420102), 'unreadable grace sibling never gains authority');
`);
});

test('cancel retry retains a detached native identity reparented before the next tree walk', async () => {
  await systemProcessProbe(`
const { LocalExecutor } = await import(${JSON.stringify(new URL('../src/executor/local.ts', import.meta.url).href)});
rows = [row(420100, 1, 420100), row(420101, 420100, 420101)];
const executor = new LocalExecutor([], () => {}, () => {});
const run = { id: 'reparented-cancel', cwd: process.cwd(), head: 'a'.repeat(40), mode: 'auto', log: 'suite.log', result: 'result.json', gate: 'gate' };
const lease = executor.restore(run, { pid: 420100, started: start, identity: nativeBirth(rows[0]), outcome: null });
onSignal = (pid, signal) => {
  if (pid === 420100 && signal === 'SIGTERM') nativeFailure = true;
};
await assert.rejects(executor.cancel(lease, 'SIGTERM'), /suite cancellation could not verify the worker tree/);
assert.deepEqual(rows.map(r => [r.pid, r.parent, r.group]), [[420101, 1, 420101]], 'the captured detached child reparents before retry');
nativeFailure = false;
onSignal = () => {};
await executor.cancel(lease, 'SIGTERM');
assert.deepEqual(rows, [], 'cancellation retry confirms death of the previously captured detached identity');
assert.ok(signals.some(s => s.pid === 420101 && s.signal !== 'SIGSTOP' && s.signal !== 'SIGCONT'), 'the detached survivor receives its own verified termination signal');
`);
});

for (const outcome of ['reused', 'zombie', 'unlisted', 'unreadable']) test(`cancel retained descendant requires a positive ${outcome} native receipt`, async () => {
  await systemProcessProbe(`
const { LocalExecutor } = await import(${JSON.stringify(new URL('../src/executor/local.ts', import.meta.url).href)});
rows = [row(420100, 1, 420100), row(420101, 420100, 420101)];
const executor = new LocalExecutor([], () => {}, () => {});
const run = { id: 'retained-proof', cwd: process.cwd(), head: 'a'.repeat(40), mode: 'auto', log: 'suite.log', result: 'result.json', gate: 'gate' };
const lease = executor.restore(run, { pid: 420100, started: start, identity: nativeBirth(rows[0]), outcome: null });
onSignal = (pid, signal) => { if (pid === 420100 && signal === 'SIGTERM') nativeFailure = true; };
await assert.rejects(executor.cancel(lease, 'SIGTERM'));
nativeFailure = false; onSignal = () => {}; signals.length = 0;
${outcome === 'reused' ? `rows[0].micros = 200002;
await executor.cancel(lease, 'SIGTERM');
assert.equal(rows.length, 1, 'replacement survives');
assert.deepEqual(signals, [], 'old capture grants no authority over the replacement birth');` : outcome === 'zombie' ? `rows[0].nativeState = 'Z';
await executor.cancel(lease, 'SIGTERM');
assert.equal(rows.length, 1, 'native-confirmed dead PID can await kernel retirement');
assert.deepEqual(signals, [], 'confirmed native exit requires no further signal');` : `tableOutput = process.pid + ' 1 ' + process.pid + ' ' + start + ' S node fixture';
const kill = process.kill;
${outcome === 'unreadable' ? `nativeFailure = true;
process.kill = (pid, signal) => {
  if (pid === 420101 && signal === 0) throw Object.assign(new Error('unreadable liveness'), { code: 'EIO' });
  return kill(pid, signal);
};` : ''}
await assert.rejects(executor.cancel(lease, 'SIGTERM'), /captured descendant exit receipt/);
assert.equal(rows.length, 1, 'missing ps row is not a death receipt');
nativeFailure = false; process.kill = kill;
tableOutput = undefined;
await executor.cancel(lease, 'SIGTERM');
assert.deepEqual(rows, [], 'the retained original birth is drained when observation recovers');`}
`);
});

test('copied cancellation metadata cannot inherit a live owner retained tree', async () => {
  await systemProcessProbe(`
const { LocalExecutor } = await import(${JSON.stringify(new URL('../src/executor/local.ts', import.meta.url).href)});
rows = [row(420100, 1, 420100), row(420101, 420100, 420101)];
const executor = new LocalExecutor([], () => {}, () => {});
const run = { id: 'copied-cancel', cwd: process.cwd(), head: 'a'.repeat(40), mode: 'auto', log: 'suite.log', result: 'result.json', gate: 'gate' };
const worker = { pid: 420100, started: start, identity: nativeBirth(rows[0]), outcome: null };
const lease = executor.restore(run, worker);
onSignal = (pid, signal) => { if (pid === 420100 && signal === 'SIGTERM') nativeFailure = true; };
await assert.rejects(executor.cancel(lease, 'SIGTERM'));
nativeFailure = false; onSignal = () => {}; signals.length = 0;
const copy = JSON.parse(JSON.stringify(lease));
copy.resource.captured = [{ pid: 420101, pidStarted: start, pidIdentity: nativeBirth(rows[0]) }];
const recovered = new LocalExecutor([], () => {}, () => {});
await recovered.cancel(recovered.restore(run, worker, copy), 'SIGTERM');
assert.equal(rows.length, 1, 'copied capture metadata supplies no live launch authority');
assert.deepEqual(signals, []);
await executor.cancel(lease, 'SIGTERM');
assert.deepEqual(rows, [], 'the original live owner still drains its captured identity');
`);
});

test('detached descendant native death precedes delayed kernel PID retirement', async () => {
  await systemProcessProbe(`
rows = [row(420100, 1, 420100), row(420101, 420100, 420101)];
const { processAlive } = await import(${JSON.stringify(new URL('../src/adapters/processes.ts', import.meta.url).href)});
const detached = { pid: 420101, pidStarted: start, pidIdentity: nativeBirth(rows[1]) };
assert.equal(await processAlive(detached), true, 'removal observer detects the live detached writer');
onSignal = (pid, signal) => {
  if (pid === 420101 && signal === 'SIGKILL') {
    rows.find(r => r.pid === pid).nativeState = 'Z';
    return false; // Native death is confirmed, but the kernel has not retired the PID.
  }
};
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0), true);
assert.ok(signals.some(s => s.pid === 420101 && s.signal === 'SIGKILL'));
const { pidAlive } = await import(${JSON.stringify(new URL('../src/project.ts', import.meta.url).href)});
assert.equal(pidAlive(420101), true, 'confirmed native death can precede kernel PID retirement');
assert.equal(await processAlive(detached), false, 'removal observer accepts structured native death while PID remains');
const { eventually } = await import(${JSON.stringify(new URL('./until.ts', import.meta.url).href)});
const observed = Promise.withResolvers();
let settled = false;
let reapReceipt = false;
const retirement = eventually('detached descendant kernel PID retirement', () => {
  const alive = pidAlive(420101);
  observed.resolve();
  return alive ? undefined : true;
}, { timeoutMs: 5000, behaviour: 'kernel retires the confirmed-dead detached descendant' }).then(() => {
  assert.equal(reapReceipt, true, 'observer settlement follows the independent reap receipt');
  settled = true;
});
const outcome = retirement.then(() => ({ ok: true }), error => ({ ok: false, error }));
let result;
try {
  await observed.promise;
  // Drain the first observation's complete async chain before injecting reap.
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(settled, false, 'the observer cannot treat a zombie PID as retired');
} finally {
  rows = []; // Explicit injected reap receipt, independent of elapsed time.
  reapReceipt = true;
  result = await outcome;
}
if (!result.ok) throw result.error;
assert.equal(settled, true);
assert.equal(pidAlive(420101), false, 'detached descendant is reaped after the retirement receipt');
`);
});

for (const recreate of [true, false]) test(`verify cancel reaps a detached fake child ${recreate ? 'that recreates the root after runner death' : 'before removing the phase root'}, then admits the next run`, async t => {
  const f = await fixture(t, 'node detached.mjs');
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const environment = fileURLToPath(new URL('./fixture-environment.ts', import.meta.url));
  const processes = new URL('../src/adapters/processes.ts', import.meta.url).href;
  const identities = new URL('../src/process-identity.ts', import.meta.url).href;
  const locks = [join(f.root, 'suite.lock'), join(f.root, 'suite.lock-nvim')];
  const marker = join(f.root, 'fake-child.json');
  const recreated = join(f.root, 'fake-recreated.json');
  const earlyRemoval = join(f.root, 'removed-with-live-child');
  await writeFile(join(f.root, 'detached.mjs'), `import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
const { processAlive } = await import(${JSON.stringify(processes)});
const remove = fs.rm;
fs.rm = async (path, options) => {
  const fake = await fs.readFile(${JSON.stringify(marker)}, 'utf8').then(JSON.parse, () => null);
  if (fake && (path === fake.root || path === fake.raw)) {
    if (await processAlive({ pid: fake.pid, pidStarted: null, pidIdentity: fake.identity }))
      await fs.writeFile(${JSON.stringify(earlyRemoval)}, 'root removal while descendant is alive');
  }
  return remove(path, options);
};
syncBuiltinESMExports();
const { runSuite } = await import(${JSON.stringify(runner)});
const [id] = await fs.readdir(${JSON.stringify(join(f.root, '.cland/run/suites'))});
process.env.CLAND_COVERAGE_OUTPUT = ${JSON.stringify(join(f.root, '.cland/run/suites'))} + '/' + id + '/coverage-map.json';
process.exitCode = await runSuite([['--test', 'hub/test/detached.test.ts']], { ...${JSON.stringify({ cwd: f.root, lockDirs: locks })}, selection: { mode: 'full', files: [], reason: 'borrowed interruption coverage', recordCoverage: { head: 'a'.repeat(40), tree: 'b'.repeat(40), run: id } } });`);
  await writeFile(join(f.root, 'hub/test/detached.test.ts'), `import test from 'node:test';
import { spawn } from 'node:child_process';
import { fixtureEnvironment } from ${JSON.stringify(environment)};
import { dirname } from 'node:path';
test('detached fake harness', async () => {
  const child = spawn(process.execPath, ['fake.mjs', String(process.ppid), process.env.TMPDIR, dirname(process.env.NODE_V8_COVERAGE)], {
    cwd: ${JSON.stringify(f.root)}, env: fixtureEnvironment(process.env.TMPDIR, process.env), detached: true, stdio: 'ignore'
  });
  child.unref();
  await new Promise(resolve => setTimeout(resolve, 30000)); // Artificial hold, ended by cancellation.
});`);
  await writeFile(join(f.root, 'fake.mjs'), `import { existsSync, readFileSync, renameSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
const { processIdentityAsync } = await import(${JSON.stringify(identities)});
const parent = Number(process.argv[2]), root = process.argv[3], raw = process.argv[4];
const owner = JSON.parse(readFileSync(${JSON.stringify(`${locks[0]}.owner`)}, 'utf8'));
process.on('SIGTERM', () => {});
const identity = await processIdentityAsync(process.pid);
if (!identity) throw new Error('detached fake native birth unavailable');
mkdirSync(raw, { recursive: true });
writeFileSync(raw + '/detached-writer', 'live');
writeFileSync(${JSON.stringify(marker)}, JSON.stringify({ pid: process.pid, parent: process.ppid, runner: parent, identity, root, raw, device: owner.device, inode: owner.inode }));
const poll = setInterval(() => {
  mkdirSync(raw, { recursive: true }); writeFileSync(raw + '/detached-writer', 'live');
  try { process.kill(parent, 0); return; } catch (error) { if (error.code !== 'ESRCH') throw error; }
  clearInterval(poll);
  if (!${recreate}) { setInterval(() => {}, 1000); return; }
  if (existsSync(root)) renameSync(root, root + '.original');
  mkdirSync(root, { mode: 0o700 });
  writeFileSync(root + '/preserved', 'fake recreated after kill');
  const info = statSync(root);
  writeFileSync(${JSON.stringify(recreated)}, JSON.stringify({ device: info.dev, inode: info.ino }));
  setInterval(() => {}, 1000); // Cancellation must reap this detached survivor.
}, 10);`);
  const job = await f.launch();
  const fake = await eventually('detached fake child ready', async () => readFile(marker, 'utf8').then(JSON.parse, () => undefined), testWaitMs(45_000));
  const diagnostics = process.env.CLAND_TEST_PID_DIAGNOSTICS === '1';
  const samples: Array<Record<string, unknown>> = [];
  let cancelledReceipt: string | null = null;
  const diagnosticEnv = scratchGitEnvironment(f.root, fixtureEnvironment(f.root, process.env), { excludesFile: join(f.root, 'diagnostic-gitignore') });
  let diagnosticTail = Promise.resolve();
  const sample = (phase: string, final = false) => {
    if (!diagnostics || samples.length >= (final ? 33 : 32)) return diagnosticTail;
    diagnosticTail = diagnosticTail.then(async () => {
      const started = Date.now();
      try {
        let nativeExited = false;
        const identity = await processIdentityAsync(fake.pid, diagnosticEnv, undefined, () => { nativeExited = true; });
        const alive = await processAlive({ pid: fake.pid, pidStarted: null, pidIdentity: fake.identity }, undefined, diagnosticEnv);
        // cland-allow-child-env: PID-only ps uses fixtureEnvironment then scratchGitEnvironment; no account, provider or Git operation
        const listing = await promisify(execFile)('ps', ['-p', String(fake.pid), '-o', 'pid=,ppid=,stat='],
          { cwd: f.root, env: scratchGitEnvironment(f.root, fixtureEnvironment(f.root, process.env), { excludesFile: join(f.root, 'diagnostic-gitignore') }), timeout: 1500, maxBuffer: 4096 }).then(result => ({ code: 0 as number | string | null, signal: null as string | null, text: result.stdout }),
          (error: NodeJS.ErrnoException & { signal?: string; stdout?: string }) => ({ code: error.code ?? null, signal: error.signal ?? null, text: error.stdout ?? '' }));
        const row = /^\s*(\d+)\s+(\d+)\s+(\S+)\s*$/.exec(listing.text);
        samples.push({ phase, started, finished: Date.now(), pid: fake.pid, capturedIdentity: fake.identity,
          initialParent: fake.parent, initialRunner: fake.runner, observer: process.pid, cancelledReceipt,
          kill0Alive: pidAlive(fake.pid), nativeExited, identity, processAlive: alive,
          parent: row ? Number(row[2]) : null, state: row?.[3] ?? null,
          psCode: listing.code, psSignal: listing.signal });
      } catch (error) {
        samples.push({ phase, started, finished: Date.now(), pid: fake.pid, incomplete: true,
          code: (error as NodeJS.ErrnoException).code ?? null });
      }
    });
    return diagnosticTail;
  };
  const stopFake = ownProcess(t, fake.pid);
  onCleanup(t, async () => {
    await stopFake();
    await rm(fake.root, { recursive: true, force: true });
    await rm(`${fake.root}.original`, { recursive: true, force: true });
    const after = await readFile(recreated, 'utf8').then(JSON.parse, () => null);
    if (after) await rm(`${fake.root}.quarantine-${after.device}-${after.inode}`, { recursive: true, force: true });
  });
  await sample('before-cancel');
  try {
    const cancelled = await clandWithEnv(f.root, f.env, 'verify', 'cancel', job.id);
    assert.equal(cancelled.code, 0, cancelled.stderr);
    const report = await eventually('cancelled result after complete tree cleanup', async () => {
      await sample('cancel-result-wait');
      return (await f.results()).find(m => m.id === `suite:${job.id}`);
    });
    cancelledReceipt = report.id;
    // Cancellation confirms native death; the kernel may still expose a zombie PID.
    await eventually('detached descendant kernel PID retirement after cancellation', async () => {
      await sample('retirement-wait');
      return !pidAlive(fake.pid) ? true : undefined;
    }, { timeoutMs: waitTimeoutMs(testWaitMs(5_000)), loadFactor: 1 });
  } finally {
    await diagnosticTail;
    await sample('cancel-or-retirement-final', true);
    if (diagnostics) t.diagnostic(JSON.stringify({ kind: 'detached-pid-receipts', samples }));
  }
  assert.equal(pidAlive(fake.pid), false, 'detached descendant PID is retired after cancellation');
  await assert.rejects(stat(fake.raw), { code: 'ENOENT' }, 'raw deletion follows delegated detached-writer cleanup');
  await assert.rejects(stat(earlyRemoval), { code: 'ENOENT' }, 'suite root is never removed with a live detached descendant');
  if (recreate) {
    const after = JSON.parse(await readFile(recreated, 'utf8'));
    assert.notEqual(after.inode, fake.inode, 'fake recreated the root after the runner died');
  }
  await writeFile(join(f.root, 'detached.mjs'), 'console.log("next run admitted");');
  const next = await f.launch('auto', '--fresh');
  const result = await eventually('next local run after cancelled recreated root', async () => (await f.results()).find(m => m.id === `suite:${next.id}`), 7000);
  assert.match(result.text, /auto exit 0/);
  for (const lock of locks) await assert.rejects(stat(lock), { code: 'ENOENT' });
});


test('suite cancel defaults to the caller’s active run, stops its child and posts one cancelled result', async t => {
  // Artificial hold: this test kills or cancels the worker before the 30-second failure ceiling.
  const f = await fixture(t, 'node -e "require(\'fs\').writeFileSync(\'child-pid\',String(process.pid));setTimeout(()=>{},30000)"', undefined, undefined, undefined, undefined, undefined, startDaemon);
  const job = await f.launch();
  const child = await eventually('package child started', async () => readFile(join(f.root, 'child-pid'), 'utf8').then(Number, () => undefined));
  ownProcess(t, child);
  const cancelled = await clandWithEnv(f.root, f.env, 'suite', 'cancel', '--json');
  assert.equal(cancelled.code, 0, cancelled.stderr);
  assert.equal(JSON.parse(cancelled.stdout).id, job.id);
  const result = await eventually('cancelled result', async () => (await f.results())[0]);
  assert.equal(result.id, `suite:${job.id}`);
  assert.match(result.text, /exit 143; cancelled/);
  assert.equal(result.from, 'impl');
  assert.deepEqual(result.to.sort(), ['impl', 'rev']);
  await eventually('cancelled processes stopped', () => !pidAlive(job.pid!) && !pidAlive(child) ? true : undefined);
  const receipt = JSON.parse(await readFile(join(f.root, '.cland', 'run', 'suites', job.id, 'result.json'), 'utf8'));
  assert.equal(receipt.code, 143);
  assert.match(receipt.cause, /SIGTERM/);
  assert.equal((await f.results()).length, 1);
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  const history = await ui.request({ type: 'topic.history', topic: f.topic });
  assert.equal((history.value as { messages: ResultMessage[] }).messages.filter(m => m.id === `suite:${job.id}`).length, 1);
});

test('suite cancel refuses another session’s run while the human can cancel it by id', async t => {
  // Artificial hold: this test kills or cancels the worker before the 30-second failure ceiling.
  const f = await fixture(t, 'node -e "require(\'fs\').writeFileSync(\'ready-pid\',String(process.pid));setTimeout(()=>{},30000)"', undefined, '[hygiene]\nmax_text_bytes = 384\n');
  const rev = await spawnSpoke({ discover: true, cwd: f.root, name: 'rev', sessionId: 'suite-reviewer', role: 'reviewer' });
  onCleanup(t, () => rev.close());
  await rev.waitForPresence(['rev']);
  // Force the old failure: a submission snapshot can precede native admission.
  await mkdir(join(f.root, 'suite.lock'));
  const submitted = await f.launch();
  assert.equal(submitted.pid, null);
  await rm(join(f.root, 'suite.lock'), { recursive: true });
  const job = { ...submitted, pid: await f.workerPid(submitted.id) };
  const child = await eventually('fake body ready before refused cancellation', async () => readFile(join(f.root, 'ready-pid'), 'utf8').then(Number, () => undefined));
  ownProcess(t, child);
  const signals: Array<{ pid: number; signal: NodeJS.Signals | number | undefined }> = [];
  const kill = process.kill.bind(process);
  // projectHub runs the production LocalExecutor in this process. Observe native
  // sends without suppressing them; human cancellation below is the positive control.
  t.mock.method(process, 'kill', (pid: number, signal?: NodeJS.Signals | number) => {
    if (signal !== 0) signals.push({ pid, signal });
    return kill(pid, signal);
  });
  const refused = await clandWithEnv(f.root, { CLAND_SESSION_NAME: 'rev', CLAND_SESSION_ID: 'suite-reviewer' }, 'suite', 'cancel', job.id);
  assert.notEqual(refused.code, 0);
  assert.match(refused.stderr, /cannot cancel another session’s suite/);
  const status = await f.ui.request({ type: 'hub.status', history: true });
  const recorded = (status.value as HubStatus).suites?.find(run => run.id === job.id);
  const dir = join(f.root, '.cland', 'run', 'suites', job.id);
  const receipt = await readFile(join(dir, 'result.json'), 'utf8').catch(() => 'no native exit receipt');
  const tail = (await readFile(join(dir, 'suite.log'), 'utf8').catch(() => '')).slice(-2000);
  assert.equal(signals.length, 0, 'refused cancellation sends no native signal, including group signals');
  assert.equal(recorded?.state, 'running');
  assert.equal(recorded?.pid, job.pid);
  assert.equal(recorded?.outcome, null);
  assert.equal(pidAlive(job.pid!), true, JSON.stringify({ launch: job, recorded, receipt, tail }));
  assert.equal(pidAlive(child), true);
  assert.equal((await f.results()).length, 0);
  const cancelled = await cland(f.root, 'suite', 'cancel', job.id, '--json');
  assert.equal(cancelled.code, 0, cancelled.stderr);
  const result = await eventually('human cancellation report', async () => (await f.results())[0]);
  assert.equal(result.from, 'impl');
  assert.deepEqual(result.to.sort(), ['impl', 'rev']);
  assert.match(result.text, /exit 143; cancelled/);
  assert.ok(signals.some(send => send.pid === job.pid && send.signal === 'SIGTERM'), 'observer sees the human cancellation signal to this worker');
  assert.ok(Buffer.byteLength(result.text, 'utf8') <= 384);
  const repeated = await cland(f.root, 'suite', 'cancel', job.id);
  assert.equal(repeated.code, 0, repeated.stderr);
  assert.equal((await f.results()).length, 1);
  const missing = await clandWithEnv(f.root, f.env, 'suite', 'cancel');
  assert.notEqual(missing.code, 0);
  assert.match(missing.stderr, /no suite queued or running/);
});

test('verify cancel removes a pid-null queued job while an unrelated submission is held, preserving the holder’s lock', async t => {
  const bin = await tempProject(t, 'cland-suite-held-git-');
  // cland-allow-child-env: read-only which lookup for ps/Git wrappers; no account or Git operation
  const git = (await promisify(execFile)('which', ['git'])).stdout.trim();
  await writeFile(join(bin, 'git'), `#!${process.execPath}
import { existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
if (existsSync('hold-git')) { writeFileSync('git-held', 'held'); while (!existsSync('release-git')) await pause(25); }
const result = spawnSync(${JSON.stringify(git)}, process.argv.slice(2), { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
`, { mode: 0o700 });
  const f = await fixture(t, 'node queued.mjs', undefined, '', { PATH: `${bin}:${process.env.PATH ?? ''}` });
  const lock = join(f.root, 'suite.lock');
  await mkdir(lock);
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  await writeFile(join(f.root, 'queued.mjs'), `import { runSuite } from ${JSON.stringify(runner)}; process.exitCode = await runSuite([['-e', "require('fs').writeFileSync('admitted','yes')"]], { lockDir: ${JSON.stringify(lock)}, cwd: ${JSON.stringify(f.root)} });`);
  const job = await f.launch();
  assert.equal(job.pid, null);
  const other = join(f.root, 'other');
  await mkdir(other);
  await writeFile(join(other, 'hold-git'), 'hold');
  // This package inherits the root's verification commands and hub discovery.
  await verificationFixture(other);
  const submission = f.ui.request({ type: 'suite.start', mode: 'all', cwd: other, report: f.topic, to: ['impl', 'rev'] }, 15000);
  await eventually('unrelated submission held in git', async () => stat(join(other, 'git-held')).then(() => true, () => undefined));
  const cancellation = clandWithEnv(f.root, f.env, 'verify', 'cancel', job.id);
  let cancelled;
  try {
    await eventually('queued cancellation reported before unrelated submission resumes', async () => (await f.results()).find(m => m.id === `suite:${job.id}`), 5000);
    cancelled = await cancellation;
  } finally {
    await writeFile(join(other, 'release-git'), 'release');
    const submitted = await submission;
    assert.equal(submitted.ok, true, submitted.error);
    const pid = (submitted.value as { pid: number | null }).pid;
    if (pid) ownProcess(t, pid);
    await cancellation;
  }
  assert.equal(cancelled.code, 0, cancelled.stderr);
  const status = await f.ui.request({ type: 'hub.status', history: true });
  const queued = (status.value as { suites: Array<{ id: string; pid: number | null; state: string }> }).suites.find(s => s.id === job.id)!;
  assert.equal(queued.pid, null);
  assert.equal(queued.state, 'finished');
  const result = await eventually('queued cancellation result', async () => (await f.results()).find(m => m.id === `suite:${job.id}`));
  assert.match(result.text, /exit 143; cancelled/);
  assert.equal((await stat(lock)).isDirectory(), true, 'manual holder lock remains intact');
  await assert.rejects(stat(join(f.root, 'admitted')), { code: 'ENOENT' });
  await assert.rejects(stat(join(f.root, '.cland', 'run', 'suites', job.id, 'result.json')), { code: 'ENOENT' });
  assert.equal((await f.results()).filter(m => m.id === `suite:${job.id}`).length, 1);
});

test('suite cancel cleans a running lock runner’s children and temporary root before publishing', async t => {
  const f = await fixture(t, 'node running.mjs');
  const lock = join(f.root, 'suite.lock');
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  await writeFile(join(f.root, 'running.mjs'), `import { runSuite } from ${JSON.stringify(runner)}; process.exitCode = await runSuite([['--test', 'holding.mjs']], { lockDirs: ${JSON.stringify([lock, `${lock}-nvim`])}, cwd: ${JSON.stringify(f.root)} });`);
  // Artificial hold: cancellation ends this child; the 30-second timer is a failure ceiling.
  await writeFile(join(f.root, 'holding.mjs'), `import test from 'node:test'; import { writeFile } from 'node:fs/promises'; test('holding', async () => { await writeFile(${JSON.stringify(join(f.root, 'holder.json'))}, JSON.stringify({ pid: process.pid, root: process.env.TMPDIR })); await new Promise(r => setTimeout(r, 30000)); });`);
  const job = await f.launch();
  const holder = await eventually('runner child started', async () => readFile(join(f.root, 'holder.json'), 'utf8').then(text => JSON.parse(text) as { pid: number; root: string }, () => undefined), testWaitMs(45_000));
  ownProcess(t, holder.pid);
  const cancelled = await clandWithEnv(f.root, f.env, 'suite', 'cancel', job.id);
  assert.equal(cancelled.code, 0, cancelled.stderr);
  const result = await eventually('running runner cancellation result', async () => (await f.results())[0]);
  assert.match(result.text, /exit 143; cancelled/);
  assert.equal(pidAlive(holder.pid), false);
  await assert.rejects(stat(lock), { code: 'ENOENT' });
  await assert.rejects(stat(holder.root), { code: 'ENOENT' });
  assert.deepEqual(await readdir(`${lock}.queue`), []);
  assert.equal((await f.results()).length, 1);
});

test('cancelled results held by reporting permissions survive restart and publish once', async t => {
  // Artificial hold: this test kills or cancels the worker before the 30-second failure ceiling.
  const f = await fixture(t, 'node -e "setTimeout(()=>{},30000)"', undefined, undefined, undefined, undefined, undefined, startDaemon);
  const job = await f.launch();
  await eventually('worker test started', async () => (await readFile(join(f.root, '.cland', 'run', 'suites', job.id, 'suite.log'), 'utf8')).includes('$ npm test') ? true : undefined);
  assert.equal((await f.ui.request({ type: 'role.clear', session: 'impl' })).ok, true);
  const cancelled = await clandWithEnv(f.root, f.env, 'suite', 'cancel', job.id);
  assert.equal(cancelled.code, 0, cancelled.stderr);
  await eventually('cancellation report held', async () => {
    const status = await f.ui.request({ type: 'hub.status', history: true });
    return (status.value as { suites: Array<{ error: string | null }> }).suites[0]?.error?.includes('forbidden') ? true : undefined;
  });
  assert.equal((await f.results()).length, 0);
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  const result = await eventually('cancelled result after restart', async () => {
    const history = await ui.request({ type: 'topic.history', topic: f.topic });
    return (history.value as { messages: ResultMessage[] }).messages.find(m => m.id === `suite:${job.id}`);
  });
  assert.match(result.text, /exit 143; cancelled/);
  assert.deepEqual(result.to.sort(), ['impl', 'rev']);
  const repeated = await cland(f.root, 'suite', 'cancel', job.id);
  assert.equal(repeated.code, 0, repeated.stderr);
  const history = await ui.request({ type: 'topic.history', topic: f.topic });
  assert.equal((history.value as { messages: ResultMessage[] }).messages.filter(m => m.id === `suite:${job.id}`).length, 1);
});

test('a worker killed while the hub is down is reported after restart and its package children are cleaned', async t => {
  // T3: killing a worker while the hub is stopped proves restart crash recovery.
  // Artificial hold: this test kills or cancels the worker before the 30-second failure ceiling.
  const f = await fixture(t, 'node -e "require(\'fs\').writeFileSync(\'child-pid\',String(process.pid));setTimeout(()=>{},30000)"', undefined, undefined, undefined, undefined, undefined, startDaemon);
  const job = await f.launch();
  const child = await eventually('package child identity', async () => readFile(join(f.root, 'child-pid'), 'utf8').then(Number, () => undefined));
  ownProcess(t, child);
  const pid = await f.workerPid(job.id);
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  process.kill(pid, 'SIGKILL');
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  const result = await eventually('recovered crash report', async () => {
    const r = await ui.request({ type: 'topic.history', topic: f.topic });
    return (r.value as { messages: ResultMessage[] }).messages.find(m => m.id === `suite:${job.id}`);
  });
  assert.match(result.text, /worker disappeared \(killed or crashed without an exit receipt\)/);
  await eventually('package child stopped', () => !pidAlive(child) ? true : undefined);
});
