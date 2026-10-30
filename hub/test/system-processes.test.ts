// T3: real native PID identity/listing controls and isolated termination probes.
// Portable OS listings, then the termination API against a deterministic OS boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseProcessTable } from '../src/process-table.ts';
import { processAlive } from '../src/adapters/processes.ts';
import { processIdentityAsync } from '../src/process-identity.ts';
import { tempProject } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { systemProcesses } from '../src/system-processes.ts';
import { processStarted, processStartedAsync } from '../src/hub/lock.ts';
import { captureProcess, ownProcess } from './process-cleanup.ts';
import { systemProcessProbe as probe } from './system-process-probe.ts';

test('recorded macOS and procps listings parse the same identities and complete commands', () => {
  const recorded = (dialect: string) => readFileSync(new URL(`./fixtures/process-listing/${dialect}.txt`, import.meta.url), 'utf8');
  const mac = parseProcessTable(recorded('macos'));
  const linux = parseProcessTable(recorded('procps'));
  assert.deepEqual(mac, linux);
  assert.equal(mac.length, 1, 'the recorded zombie is dropped');
  assert.deepEqual(parseProcessTable(recorded('procps').replace(/ Z /g, ' X ')), linux, 'Linux dead X rows are dropped too');
  assert.deepEqual(mac[0], {
    pid: 420100, parent: 420001, group: 420100, started: 'Mon Oct 5 12:00:00 2026', state: 'Ss',
    command: `/bin/sh -c sleep 600 & wait fixture with "double" and 'single' quotes ${'x'.repeat(4096)} final-argument`,
  });
});

for (const [platform, state] of [['linux', 'Z'], ['linux', 'X'], ['darwin', 'Z']] as const) {
  test(`${platform} native ${state} is absent for liveness and cleanup while a later live replacement still refuses`, async () => {
    await probe(`
const { processAlive } = await import(${JSON.stringify(new URL('../src/adapters/processes.ts', import.meta.url).href)});
rows = [row(420100, 1, 420100), row(420101, 420100, 420101), row(420102, 420100, 420102)];
const processRow = { pid: 420100, pidStarted: start, pidIdentity: nativeBirth(rows[0]) };
assert.equal(await processAlive(processRow), true);
assert.equal(await processAlive({ ...processRow, pidIdentity: null }), true);
onStat = async () => 'EACCES'; nativeFailure = 'missing';
assert.equal(await processAlive(processRow), true, 'unreadable native state remains conservatively live');
assert.equal(await processAlive({ ...processRow, pidIdentity: null }), true, 'legacy unreadable native state retains timestamp liveness');
onStat = async () => {}; nativeFailure = false;
rows[0].ticks = 90002; rows[0].micros = 200002;
assert.equal(await processAlive(processRow), false, 'a live different birth never matches the recorded process');
rows[0].ticks = 90001; rows[0].micros = 200001;
rows[0].nativeState = ${JSON.stringify(state)};
assert.doesNotThrow(() => process.kill(420100, 0), 'native dead state still has an unreaped PID');
assert.equal(await processAlive(processRow), false);
assert.equal(await processAlive({ ...processRow, pidIdentity: null }), false);
rows[0].nativeState = 'R';
let reads = 0;
onStat = async pid => { if (pid === 420101 && ++reads === 2) rows[1].nativeState = ${JSON.stringify(state)}; };
onNative = async () => { if (++reads === 2) rows[1].nativeState = ${JSON.stringify(state)}; };
assert.equal(await endProcess(processRow, () => {}, 0), true);
assert.ok(signals.every(s => s.pid !== 420101), 'native-confirmed dead descendant receives no signal');
assert.ok(signals.some(s => s.pid === 420102 && s.signal === 'SIGKILL'), 'unchanged managed child remains a positive signal control');
assert.deepEqual(rows.map(r => r.pid), [420101]);
rows = [row(420100, 1, 420100), row(420101, 420100, 420101)];
reads = 0; signals.length = 0;
const replace = () => {
 if (++reads === 1) rows[1].nativeState = ${JSON.stringify(state)};
 else { rows[1].nativeState = 'R'; rows[1].ticks = 90002; rows[1].micros = 200002; }
};
onStat = async pid => { if (pid === 420101) replace(); };
onNative = async () => replace();
assert.equal(await endProcess(processRow, () => {}, 0), false, 'an earlier dead receipt cannot settle a PID that is live at the final probe');
assert.deepEqual(signals, [], 'live replacement and its parent remain unsignalled');
`, platform);
  });
}

for (const [platform, state] of [['linux', 'Z'], ['linux', 'X'], ['darwin', 'Z']] as const) {
  for (const exiting of ['child', 'leader']) test(`${platform} native ${state} ${exiting} exit refuses a surviving listed grandchild`, async () => {
    await probe(`
rows = [row(420100, 1, 420100), row(420101, 420100, 420101), row(420102, 420101, 420102)];
const target = ${exiting == 'child' ? 420101 : 420100};
let reads = 0;
const exit = () => {
 rows.find(r => r.pid === target).nativeState = ${JSON.stringify(state)};
 rows.find(r => r.pid === 420102).parent = 1; // ps already recorded the older C -> G edge.
};
onStat = async pid => { if (pid === target && ++reads === 2) exit(); };
onNative = async () => { if (++reads === 2) exit(); };
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0), false, 'exited ancestry cannot hide the surviving writer');
assert.deepEqual(signals, [], 'the ambiguous branch and managed leader remain unsignalled');
assert.deepEqual(rows.map(r => r.pid), [420100, 420101, 420102]);
onStat = async () => {}; onNative = async () => {};
rows = rows.filter(r => r.pid !== 420102);
if (target === 420100) rows.find(r => r.pid === 420101).nativeState = ${JSON.stringify(state)};
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0), true, 'a fully exited branch can settle on the next observation');
assert.ok(signals.every(s => s.pid !== target), 'the exited ancestor never receives a signal');
if (target === 420101) assert.ok(signals.some(s => s.pid === 420100 && s.signal === 'SIGTERM'), 'the unchanged managed leader still receives its signal');
`, platform);
  });
}

test('a native exit receipt for another PID cannot settle the requested live process', async () => {
  await probe(`
const { processAlive } = await import(${JSON.stringify(new URL('../src/adapters/processes.ts', import.meta.url).href)});
rows = [row(420100, 1, 420100)];
const recorded = { pid: 420100, pidStarted: start, pidIdentity: nativeBirth(rows[0]) };
rows[0].nativeState = 'Z';
nativePid = () => 420199; // A wrong-selector kinfo reply is unknown for 420100.
assert.equal(await processAlive(recorded), true, 'another PID’s exit is no liveness receipt');
assert.equal(await endProcess(recorded, () => {}, 0), false);
assert.deepEqual(signals, []);
`);
});

test('a native-exited frozen descendant receives no recovery CONT while its PID awaits reaping', async () => {
  await probe(`
rows = [row(420100, 1, 420100), row(420101, 420100, 420101)];
onSignal = (pid, signal) => {
 if (signal === 'SIGTERM') return false;
 if (pid === 420101 && signal === 'SIGSTOP') { rows.find(r => r.pid === pid).nativeState = 'Z'; return false; }
};
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0), true);
assert.ok(signals.some(s => s.pid === 420100 && s.signal === 'SIGKILL'));
assert.ok(signals.some(s => s.pid === 420101 && s.signal === 'SIGSTOP'));
assert.ok(!signals.some(s => s.pid === 420101 && (s.signal === 'SIGCONT' || s.signal === 'SIGKILL')), 'native exit settles the captured stop even though kill(0) succeeds');
assert.deepEqual(rows.map(r => r.pid), [420101]);
`, 'linux');
});

test('native zombie observed immediately before a signal settles without sending it', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
onProbe = async () => { rows[0].nativeState = 'Z'; };
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0), true);
assert.deepEqual(signals, [], 'the final native read grants absence, never a signal');
assert.deepEqual(rows.map(r => r.pid), [420100], 'PID reaping belongs to the parent, not termination');
`);
});

test('default process liveness observes the real PID birth without an injected observer', async t => {
  const root = await tempProject(t);
  const env = fixtureEnvironment(root, process.env);
  const identity = await processIdentityAsync(process.pid, env);
  assert.ok(identity, 'native observer positively captures the test process birth');
  const row = { pid: process.pid, pidStarted: null, pidIdentity: identity };
  assert.equal(await processAlive(row, undefined, env), true);
  assert.equal(await processAlive({ ...row, pidIdentity: 'different-native-birth' }, undefined, env), false,
    'a real native observation rejects another identity; unavailable proof cannot satisfy this control');
});

test('real whole-table and selected listings match lock and cleanup start identities without truncation', async t => {
  const columns = process.env.COLUMNS;
  process.env.COLUMNS = '40';
  t.after(() => { if (columns === undefined) delete process.env.COLUMNS; else process.env.COLUMNS = columns; });
  const tail = `with spaces and "quotes" ${'x'.repeat(4096)} final-argument`;
  // cland-allow-child-env: OS process identity/termination boundary uses a pure bystander or fully mocked process rows; no account or Git operation
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', tail], { detached: true, stdio: 'ignore' });
  ownProcess(t, child.pid);
  assert.ok(child.pid);
  for (const rows of [await systemProcesses(), await systemProcesses(undefined, undefined, [child.pid])]) {
    for (const pid of [process.pid, child.pid]) {
      const row = rows.find(row => row.pid === pid);
      assert.ok(row, `listing contains pid ${pid}`);
      assert.ok(row.identity, 'native process birth identity must be available');
      assert.equal(row.identity, captureProcess(pid)?.identity);
      if (process.platform === 'darwin') assert.equal(Number(row.identity.split(':')[1]), Date.parse(processStarted(pid, 'UTC')! + ' UTC') / 1000, 'native ABI seconds agree independently with ps UTC');
      assert.equal(row.started, processStarted(pid));
      assert.equal(row.started, await processStartedAsync(pid));
      assert.equal(processStarted(pid, 'UTC'), captureProcess(pid)?.started);
    }
    const row = rows.find(row => row.pid === child.pid)!;
    assert.equal(row.parent, process.pid);
    assert.equal(row.group, child.pid);
    assert.ok(row.command.endsWith(tail), 'full command survives spaces, quotes and narrow terminal widths');
  }
});

test('held ownership probe never joins old ancestry to a recycled descendant birth', async () => {
  await probe(`
rows = [row(420543, 1, 420543), row(420544, 420543, 420544), row(420545, 420543, 420545)];
const entered = Promise.withResolvers(), release = Promise.withResolvers();
let held = false;
onNative = async () => { if (!held) { held = true; entered.resolve(); await release.promise; } };
const ending = endProcess({ pid: 420543, pidStarted: start }, () => {}, 0);
await bounded(entered.promise, 2000, 'native probe setup');
const replacement = rows.find(r => r.pid === 420544);
replacement.parent = 1; replacement.micros = 200002;
release.resolve();
assert.equal(await bounded(ending, 5000, 'stop completion'), true);
assert.ok(rows.some(r => r.pid === 420544), 'replacement survives the entire stop');
assert.ok(signals.every(s => s.pid !== 420544), 'stale ancestry never grants replacement ownership');
assert.ok(signals.some(s => s.pid === 420545 && s.signal === 'SIGKILL'), 'unchanged managed descendant is still signalled');
`);
});

test('termination ignores a descendant confirmed gone after the ownership snapshot', async () => {
  await probe(`
rows = [row(420543, 1, 420543), row(420544, 420543, 420544), row(420545, 420543, 420545)];
let probes = 0;
onNative = async () => { if (++probes === 2) rows = rows.filter(r => r.pid !== 420544); };
assert.equal(await endProcess({ pid: 420543, pidStarted: start }, () => {}, 0), true);
assert.deepEqual(rows, [], 'the managed leader and unchanged descendant still exit');
assert.ok(signals.every(s => s.pid !== 420544), 'the confirmed-gone child needs no signal');
assert.ok(signals.some(s => s.pid === 420545 && s.signal === 'SIGKILL'), 'the stable descendant is still killed');
`);
});

test('termination ignores a newly discovered child confirmed gone during grace', async () => {
  await probe(`
rows = [row(420543, 1, 420543), row(420545, 420543, 420545)];
let termed = false, probes = 0;
onSignal = (_pid, signal) => { if (signal === 'SIGTERM') { termed = true; rows.push(row(420544, 420543, 420544)); return false; } };
onNative = async () => { if (termed && ++probes === 2) rows = rows.filter(r => r.pid !== 420544); };
assert.equal(await endProcess({ pid: 420543, pidStarted: start }, () => {}, 0), true);
assert.deepEqual(rows, [], 'the managed leader and stable child still exit');
assert.ok(signals.every(s => s.pid !== 420544), 'the confirmed-gone child never receives a signal');
assert.ok(signals.some(s => s.pid === 420545 && s.signal === 'SIGKILL'));
`);
});

test('termination still refuses a live descendant whose native birth is unreadable', async () => {
  await probe(`
rows = [row(420543, 1, 420543), { ...row(420544, 420543, 420544), micros: null }];
assert.equal(await endProcess({ pid: 420543, pidStarted: start }, () => {}, 0), false);
assert.deepEqual(signals, [], 'absence must be positively observed, never inferred from missing birth');
assert.equal(rows.length, 2);
`);
});

test('a vanished unverified child cannot hide its surviving descendant from termination', async () => {
  await probe(`
rows = [row(420543, 1, 420543), row(420544, 420543, 420544), row(420546, 420544, 420546)];
let probes = 0;
onNative = async () => { if (++probes === 2) rows = rows.filter(r => r.pid !== 420544); };
assert.equal(await endProcess({ pid: 420543, pidStarted: start }, () => {}, 0), false, 'a surviving branch without coherent ancestry must keep termination incomplete');
assert.deepEqual(signals, [], 'the unknown branch grants no ownership or false completion');
assert.deepEqual(rows.map(r => r.pid), [420543, 420546]);
`);
});

test('an unexpected liveness error never proves an unverified descendant absent', async () => {
  await probe(`
rows = [row(420543, 1, 420543), { ...row(420544, 420543, 420544), micros: null }];
const kill = process.kill;
process.kill = (pid, signal) => { if (pid === 420544 && signal === 0) throw Object.assign(new Error('liveness unavailable'), { code: 'EIO' }); return kill(pid, signal); };
assert.equal(await endProcess({ pid: 420543, pidStarted: start }, () => {}, 0), false);
assert.deepEqual(signals, []);
assert.equal(rows.length, 2);
`);
});

test('missing or failed Perl returns unknown birth and refuses every destructive signal', async () => {
  await probe(`
for (const failure of ['missing', 'failed']) {
  rows = [row(420543, 1, 420543)]; nativeFailure = failure;
  assert.equal(await endProcess({ pid: 420543, pidStarted: start }), false);
  assert.deepEqual(signals, []);
  assert.equal(rows.length, 1);
}
`);
});

test('persistent recovery checkpoint failures never authorize unsaved child proof and recovery later completes', async () => {
  await probe(`
const fs = await import('node:fs/promises');
const { join } = await import('node:path');
const { createHubBase } = await import(${JSON.stringify(fileURLToPath(new URL('../src/hub/server.ts', import.meta.url)))});
const { Sessions } = await import(${JSON.stringify(fileURLToPath(new URL('../src/adapters/sessions.ts', import.meta.url)))});
const { ProcessTable } = await import(${JSON.stringify(fileURLToPath(new URL('../src/adapters/processes.ts', import.meta.url)))});
const { FakeClock } = await import(${JSON.stringify(fileURLToPath(new URL('./fake-clock.ts', import.meta.url)))});
const { fakeHarness } = await import(${JSON.stringify(fileURLToPath(new URL('./fakes/harness.ts', import.meta.url)))});
const { sqliteProbe } = await import(${JSON.stringify(fileURLToPath(new URL('./sqlite-probe.ts', import.meta.url)))});
const root = process.cwd(), ownedRoot = join(root, 'owned-child');
await fs.mkdir(join(root, '.cland')); await fs.mkdir(ownedRoot);
const payload = join(ownedRoot, 'writer-state'); await fs.writeFile(payload, 'owned');
rows = [row(420546, process.pid, 420546)];
const clock = new FakeClock(), database = sqliteProbe(), hooks = [];
const base = createHubBase({ clock, secret: 'test-secret' });
const table = new ProcessTable(join(root, '.cland', 'hub.db'), clock, database.open);
const child = { name: 'recovery-child', harness: 'codex', role: null, model: null, cwd: ownedRoot,
  pid: 420546, pidStarted: start, harnessId: null, sessionId: 'recovery-child-id', harnessSessionId: null,
  startedAt: '2026-10-05T12:00:00Z', status: 'stopped' };
table.pendingStop({ process: child, files: { undo: [{ kind: 'directory', path: ownedRoot }, { kind: 'remove', path: payload }],
  children: [{ pid: 420546, pidStarted: start, graceMs: 0 }] }, error: 'legacy failed launch',
  stages: { stopped: false, rowRemoved: false, roleRolledBack: false } });
const events = [];
const sessions = new Sessions({ root, core: base.core, table, recoveryClock: clock, log: e => events.push(e) });
sessions.register(fakeHarness('codex', { clock })); base.dispatcher.useSessions(sessions);
let fail = true, attempts = 0;
database.before({ after: fn => hooks.push(fn) }, (sql, method) => {
  if (method === 'run' && sql.startsWith('insert or replace into harness_pending_stops')) {
    attempts++; if (fail) throw new Error('pending checkpoint deliberately failed');
  }
});
const durableSignals = [];
onSignal = () => {
  const reader = new ProcessTable(join(root, '.cland', 'hub.db'));
  try { durableSignals.push(reader.pendingStops()[0]?.files?.children[0]?.pidIdentity === nativeBirth(rows[0])); }
  finally { reader.close(); }
};
try {
  for (let retry = 0; retry < 2; retry++) {
    const before = attempts;
    await sessions.resumeAll();
    assert.ok(attempts >= before + 2, 'both preparation and upgrade writes were attempted');
    assert.deepEqual(signals, [], 'unsaved child proof never reaches a signal on repeated failure');
    assert.equal(rows.length, 1, 'the original managed child remains alive');
    assert.ok((await fs.stat(ownedRoot)).isDirectory());
    assert.equal(await fs.readFile(payload, 'utf8'), 'owned');
    assert.equal(table.pendingStops()[0].files.children[0].pidIdentity ?? null, null, 'durable receipt remains legacy');
  }
  fail = false;
  await sessions.resumeAll();
  assert.deepEqual(durableSignals, [true], 'the native signal observes a committed precise upgrade');
  assert.deepEqual(signals, [{ pid: 420546, signal: 'SIGTERM' }]);
  assert.deepEqual(rows, []);
  assert.deepEqual(table.pendingStops(), [], 'durable recovery receipt is settled');
  assert.equal(await fs.stat(ownedRoot).catch(() => null), null, 'owned directory is removed only after termination');
  assert.ok(events.some(e => e.event === 'launch-recovered'));
} finally {
  fail = false;
  for (const hook of hooks) hook();
  await sessions.close(); table.close(); await base.close();
}
`);
});

test('termination refuses a same-second recycled PID with a different native birth identity', async () => {
  await probe(`
rows = [row(420543, 1, 420543)];
assert.equal(await endProcess({ pid: 420543, pidStarted: start, pidIdentity: 'darwin:1791201600:100001' }), false);
assert.deepEqual(signals, [], 'equal lstart never authorizes a replacement process');
assert.equal(rows[0].started, start, 'the replacement is in the same ps second');
assert.equal(await endProcess({ pid: 420543, pidStarted: start, pidIdentity: nativeBirth(rows[0]) }), true);
assert.deepEqual(signals, [{ pid: 420543, signal: 'SIGTERM' }], 'matching native identity still authorizes the managed process');
`);
});

test('termination requires a persisted legacy upgrade and refuses unreadable birth', async () => {
  await probe(`
rows = [row(420543, 1, 420543)];
assert.equal(await nativeEndProcess({ pid: 420543, pidStarted: start }), false, 'legacy adapter shape needs its lifecycle owner to persist the upgrade');
rows[0].micros = null;
assert.equal(await endProcess({ pid: 420543, pidStarted: start, pidIdentity: 'darwin:1791201600:100001' }), false);
assert.deepEqual(signals, []);
`);
});

test('missing native identity after TERM is incomplete rather than a process-exit receipt', async () => {
  await probe(`
rows = [row(420543, 1, 420543)];
const entries = [];
onSignal = () => { rows[0].micros = null; return false; };
assert.equal(await endProcess({ pid: 420543, pidStarted: start }, e => entries.push(e), 0), false);
assert.deepEqual(signals, [{ pid: 420543, signal: 'SIGTERM' }]);
assert.ok(entries.some(e => e.event === 'harness-end-incomplete' && e.pids.includes(420543)));
`);
});

test('inspection refuses a successful listing whose own live identity cannot be parsed', async () => {
  await probe(`
for (const output of ['', 'not a process table', row(420100, 1, 420100).pid + ' 1 420100 ' + start + ' S node fixture',
  process.pid + ' 1 ' + process.pid + ' ' + start + ' Z node fixture']) {
  tableOutput = output;
  await assert.rejects(systemProcesses(), /cannot verify the OS process table format/);
  await assert.rejects(systemProcesses(undefined, undefined, [420100]), /cannot verify the OS process table format/);
}
assert.deepEqual(signals, []);
`);
});

test('termination preserves an unrelated process joining an owned group during identity probes', async () => {
  await probe(`
rows = [row(420100, 1, 420100), row(420101, 420100, 420101), row(420102, 420101, 420101)];
let joined = false;
onProbe = pid => {
  if (pid === 420101 && !joined) { joined = true; rows.push(row(420103, 1, 420101)); }
};
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0), true);
assert.equal(joined, true);
assert.ok(rows.some(p => p.pid === 420103), 'the late group joiner is not owned');
assert.ok(signals.every(p => p.pid > 0));
assert.deepEqual(signals.filter(p => p.signal === 'SIGTERM' || p.signal === 'SIGKILL'), [
  { pid: 420100, signal: 'SIGTERM' },
  { pid: 420101, signal: 'SIGKILL' },
  { pid: 420102, signal: 'SIGKILL' }
]);
`);
});

test('termination rechecks authority after the OS probe and before the harness stop', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
let allowed = true, harnessStopped = false;
onTable = () => { allowed = false; };
const refusal = new Error('Lead level: outside the subtree');
await assert.rejects(endProcess({ pid: 420100, pidStarted: start }, () => {}, 0,
  async () => { harnessStopped = true; }, { authorize: () => { if (!allowed) throw refusal; } }), error => error === refusal);
assert.equal(harnessStopped, false);
assert.deepEqual(signals, []);
`);
});

test('termination rechecks authority after each identity probe before signalling', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
let allowed = true;
onProbe = () => { allowed = false; };
const refusal = new Error('Lead level: outside the subtree');
await assert.rejects(endProcess({ pid: 420100, pidStarted: start }, () => {}, 0,
  undefined, { authorize: () => { if (!allowed) throw refusal; } }), error => error === refusal);
assert.deepEqual(signals, []);
`);
});

test('termination discovers and ends an owned child spawned between TERM and KILL', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
onSignal = (pid, signal) => {
  if (pid === 420100 && signal === 'SIGTERM') {
    rows.push(row(420101, 420100, 420100));
    return false; // the root survives TERM and spawns a child during its grace period
  }
};
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0), true);
assert.deepEqual(rows, []);
assert.deepEqual(signals.filter(p => p.signal === 'SIGTERM' || p.signal === 'SIGKILL'), [
  { pid: 420100, signal: 'SIGTERM' },
  { pid: 420100, signal: 'SIGKILL' },
  { pid: 420101, signal: 'SIGKILL' }
]);
`);
});

test('termination retains a child born during grace after its parent exits gracefully', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
let termed = false, born = false, graceTables = 0;
const fork = () => { if (termed && !born) { born = true; rows.push(row(420101, 420100, 420101), row(420102, 420101, 420102)); } };
onSignal = (pid, signal) => { if (pid === 420100 && signal === 'SIGTERM') { termed = true; return false; } };
onChildren = fork;
onTable = () => {
  if (!termed) return;
  fork();
  if (++graceTables === 3) rows = rows.filter(p => p.pid !== 420100).map(p => ({ ...p, parent: p.parent === 420100 ? 1 : p.parent }));
};
const entries = [];
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, entry => entries.push(entry), 100), true);
assert.equal(born, true);
assert.deepEqual(rows, [], 'the observed child survives its graceful parent exit only until forced cleanup');
assert.ok(entries.some(entry => entry.event === 'harness-ended' && entry.pids.includes(420101) && entry.pids.includes(420102)));
assert.deepEqual(signals.filter(p => p.signal === 'SIGKILL'), [{ pid: 420101, signal: 'SIGKILL' }, { pid: 420102, signal: 'SIGKILL' }]);
assert.ok(signals.every(p => p.pid > 0));
`);
});

test('grace descendant selection preserves children of a reused captured parent', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
onSignal = (pid, signal) => {
  if (signal === 'SIGTERM') {
    rows = [row(420100, 1, 420100, 'Tue Oct 6 12:00:00 2026'), row(420101, 420100, 420100)];
    return false;
  }
};
const captured = [];
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 50, undefined,
  { claim: identity => { captured.push(identity.pid); return true; } }), true);
assert.deepEqual(captured, [420100], 'replacement ancestry cannot establish child ownership');
assert.deepEqual(rows.map(p => p.pid), [420100, 420101]);
assert.deepEqual(signals, [{ pid: 420100, signal: 'SIGTERM' }]);
`);
});

test('a pid reused while the TERM identity probe is pending receives no signal', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
onProbe = pid => { rows.find(p => p.pid === pid).started = 'Tue Oct 6 12:00:00 2026'; };
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0), true);
assert.deepEqual(signals, []);
assert.equal(rows.length, 1);
`);
});

test('each KILL target gets a fresh identity probe after signalling the preceding target', async () => {
  await probe(`
rows = [row(420100, 1, 420100), row(420101, 420100, 420101), row(420102, 420101, 420101)];
onSignal = (pid, signal) => {
  if (pid === 420101 && signal === 'SIGKILL') Object.assign(rows.find(p => p.pid === 420102), { started: 'Tue Oct 6 12:00:00 2026', state: 'S' });
};
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0), false);
assert.ok(rows.some(p => p.pid === 420102), 'the reused second target survives');
assert.deepEqual(signals.filter(p => p.signal === 'SIGTERM' || p.signal === 'SIGKILL'), [{ pid: 420100, signal: 'SIGTERM' }, { pid: 420101, signal: 'SIGKILL' }]);
assert.equal(signals.some(p => p.pid === 420102 && p.signal === 'SIGCONT'), false, 'the stopped identity is confirmed gone, so its replacement is never resumed');
assert.equal(rows.find(p => p.pid === 420102).state, 'S');
`);
});

test('a reservation refusal at KILL preserves the process without a kill fallback', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
onSignal = (pid, signal) => signal === 'SIGTERM' ? false : undefined;
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0, undefined, {
  canSignal: current => !current.some(p => p.pid === 420100 && p.state === 'T')
}), false);
assert.deepEqual(signals, [{ pid: 420100, signal: 'SIGTERM' }, { pid: 420100, signal: 'SIGSTOP' }, { pid: 420100, signal: 'SIGCONT' }]);
assert.equal(rows.length, 1);
assert.equal(rows[0].state, 'S');
`);
});

test('termination captures a child spawned during the parent’s final identity await', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
onSignal = (pid, signal) => signal === 'SIGTERM' ? false : undefined;
let parentProbes = 0;
onProbe = pid => {
  if (pid === 420100 && ++parentProbes === 2) rows.push(row(420101, 420100, 420100));
};
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0), true);
assert.deepEqual(rows, [], 'the child must be captured before killing its parent');
assert.ok(signals.every(p => p.pid > 0));
`);
});

test('termination re-walks and freezes descendants that appear after their parent is frozen', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
onSignal = (pid, signal) => {
  if (signal === 'SIGTERM') return false;
  if (signal === 'SIGSTOP' && pid < 420102) rows.push(row(pid + 1, pid, 420100));
};
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0), true);
assert.deepEqual(rows, []);
assert.deepEqual(signals.filter(p => p.signal === 'SIGSTOP').map(p => p.pid), [420100, 420101, 420102]);
const firstKill = signals.findIndex(p => p.signal === 'SIGKILL');
assert.equal(signals.slice(firstKill).some(p => p.signal === 'SIGSTOP'), false, 'the entire captured tree is frozen before any kill');
`);
});

test('a frozen process with an unavailable KILL identity probe is resumed and reported', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
onSignal = (pid, signal) => signal === 'SIGTERM' ? false : undefined;
let probes = 0;
onProbe = pid => ++probes === 3 ? false : undefined;
const entries = [];
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, entry => entries.push(entry), 0), false);
assert.equal(rows[0].state, 'S');
assert.deepEqual(signals, [{ pid: 420100, signal: 'SIGTERM' }, { pid: 420100, signal: 'SIGSTOP' }, { pid: 420100, signal: 'SIGCONT' }]);
assert.ok(entries.some(p => p.event === 'harness-end-incomplete' && p.pids.includes(420100)));
assert.equal(entries.some(p => p.event === 'harness-ended'), false);
`);
});

test('a captured stopped pid is resumed even when every later process inspection fails', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
onSignal = (pid, signal) => signal === 'SIGTERM' ? false : undefined;
let probes = 0;
onProbe = pid => {
  if (++probes === 3) { onTable = () => false; return false; }
};
const entries = [];
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, entry => entries.push(entry), 0), false);
assert.equal(rows[0].state, 'S', 'failed inspection must not leave our stopped process frozen');
assert.ok(signals.some(p => p.pid === 420100 && p.signal === 'SIGCONT'));
assert.equal(signals.some(p => p.signal === 'SIGKILL'), false);
assert.ok(entries.some(p => p.event === 'harness-end-incomplete' && p.confirmed === false));
assert.equal(entries.some(p => p.event === 'harness-ended'), false);
`);
});

test('a stopped identity confirmed dead receives no later CONT when its pid is reused', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
onSignal = (pid, signal) => {
  if (signal === 'SIGTERM') return false;
  if (signal === 'SIGKILL') {
    queueMicrotask(() => { if (rows.length === 0) rows.push(row(420100, 1, 420100, 'Tue Oct 6 12:00:00 2026')); });
  }
};
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0), true);
assert.equal(rows.length, 1);
assert.equal(rows[0].started, 'Tue Oct 6 12:00:00 2026');
assert.equal(rows[0].state, 'S');
assert.equal(signals.some(p => p.signal === 'SIGCONT'), false, 'the dead stopped identity was removed before finally');
`);
});

test('confirmed reuse during the KILL probe removes the stopped pid before later inspection failure', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
onSignal = (pid, signal) => signal === 'SIGTERM' ? false : undefined;
let probes = 0;
onProbe = pid => {
  if (++probes === 3) {
    Object.assign(rows[0], { started: 'Tue Oct 6 12:00:00 2026', state: 'S' });
    onTable = () => false;
  }
};
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0), false);
assert.equal(rows[0].started, 'Tue Oct 6 12:00:00 2026');
assert.equal(signals.some(p => p.signal === 'SIGCONT' || p.signal === 'SIGKILL'), false,
  'the final probe already confirmed the stopped identity gone');
`);
});

test('unconfirmed death reports captured survivors and resumes them when the deadline expires', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
onSignal = (pid, signal) => signal === 'SIGTERM' || signal === 'SIGKILL' ? false : undefined;
const entries = [];
await assert.rejects(endProcess({ pid: 420100, pidStarted: start }, entry => entries.push(entry), 0, undefined,
  { deadline: Date.now() + 100 }), /deadline|surviving/);
assert.equal(rows[0].state, 'S');
assert.ok(signals.some(p => p.signal === 'SIGCONT'));
assert.ok(entries.some(p => p.event === 'harness-end-incomplete' && p.pids.includes(420100)));
assert.equal(entries.some(p => p.event === 'harness-ended'), false);
`);
});

async function sweepProbe(body: string) {
  await probe(`
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
Object.defineProperty(process, 'platform', { value: 'darwin' }); // use the deterministic lsof boundary
const root = mkdtempSync(join(tmpdir(), 'cland-owner-'));
try {
  mkdirSync(join(root, '.cland'));
  const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
  db.exec('create table harness_processes(name text, pid integer, pid_started text, status text, cwd text)');
  db.prepare('insert into harness_processes values (?, ?, ?, ?, ?)').run('impl', 420100, start, 'offline', root);
  db.close();
  rows = [row(420100, 1, 420100), row(420101, 420110, 420100), row(420110, 420100, 420100)];
  rows[1].command = 'codex app-server --listen unix://' + root + '/.cland/run/cx-fixture.sock';
  cwdOf = pid => pid === 420100 ? root : '/outside';
  onSignal = (pid, signal) => {
    if (signal === 'SIGTERM') return false;
    if (signal === 'SIGCONT' && pid === 420101) rows.push(row(420102, 420101, 420100));
  };
  const { sweepOrphans } = await import(${JSON.stringify(fileURLToPath(new URL('../src/orphans.ts', import.meta.url)))});
  ${body}
} finally { rmSync(root, { recursive: true, force: true }); }
`);
}

test('an orphan sweep gives a wrapper and its server descendant one termination owner', async () => {
  await sweepProbe(`  const ended = await sweepOrphans(root, () => {});
  assert.deepEqual(rows, [], 'no child may escape an overlapping thaw');
  assert.deepEqual(signals.filter(p => p.pid === 420101 && p.signal === 'SIGSTOP'), [{ pid: 420101, signal: 'SIGSTOP' }]);
  assert.deepEqual(ended.map(p => p.process.pid), [420100], 'the root worker owns the entire tree');
  // An unowned ancestor cannot take responsibility for an independently owned child.
  rows = [row(420100, 1, 420100), row(420101, 420100, 420100)];
  rows[1].command = 'codex app-server --listen unix://' + root + '/.cland/run/cx-fixture.sock';
  cwdOf = pid => pid === 420101 ? root : '/outside';
  signals.length = 0;
  const childEnded = await sweepOrphans(root, () => {});
  assert.deepEqual(rows.map(p => p.pid), [420100]);
  assert.deepEqual(childEnded.map(p => p.process.pid), [420101]);
  assert.ok(signals.every(p => p.pid === 420101));
`);
});

test('a concurrent public sweep reports busy instead of sharing a frozen tree', async () => {
  await sweepProbe(`
const entered = Promise.withResolvers(), proceed = Promise.withResolvers();
let blocked = false;
onProbe = async pid => {
  if (pid === 420100 && !blocked) { blocked = true; entered.resolve(); await proceed.promise; }
};
const first = sweepOrphans(root, () => {});
await entered.promise;
const before = signals.length;
await assert.rejects(sweepOrphans(root, () => {}), /sweep busy/);
assert.equal(signals.length, before, 'the contending sweep sends no signals');
proceed.resolve();
assert.deepEqual((await first).map(p => p.process.pid), [420100]);
assert.deepEqual(rows, []);
assert.deepEqual(await sweepOrphans(root, () => {}), [], 'the project lock is released after completion');
`);
});

test('a sweep reassesses an independently owned child when its ancestor exits before capture', async () => {
  await sweepProbe(`
rows = rows.filter(p => p.pid !== 420110).map(p => ({ ...p, parent: p.pid === 420101 ? 420100 : p.parent }));
cwdOf = () => root;
let tables = 0;
onTable = () => {
  if (++tables === 3) rows = rows.filter(p => p.pid !== 420100).map(p => ({ ...p, parent: p.parent === 420100 ? 1 : p.parent }));
};
const ended = await sweepOrphans(root, () => {});
assert.deepEqual(rows, [], 'the surviving child is not discarded with its ancestor');
assert.deepEqual(ended.map(p => p.process.pid), [420101]);
`);
});

test('a failed CONT and throwing logger cannot skip later stopped survivors', async () => {
  await probe(`
rows = [row(420100, 1, 420100), row(420101, 420100, 420100)];
onSignal = (pid, signal) => {
  if (signal === 'SIGTERM') return false;
  if (pid === 420100 && signal === 'SIGCONT') throw Object.assign(new Error('CONT denied'), { code: 'EPERM' });
};
const log = () => { throw new Error('logger unavailable'); };
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, log, 0, undefined, {
  canSignal: current => !current.every(p => p.pid === process.pid || p.state === 'T')
}), false);
assert.ok(signals.some(p => p.pid === 420101 && p.signal === 'SIGCONT'));
assert.equal(rows.find(p => p.pid === 420101).state, 'S');
assert.equal(signals.some(p => p.signal === 'SIGKILL'), false);
`);
});

test('a transient reservation release failure cannot block a later stop in the live caller', async () => {
  await probe(`
import fs from 'node:fs/promises';
const rm = fs.rm;
const reservation = '/tmp/cland-termination-' + process.getuid() + '/420100';
let failedReleases = 0;
fs.rm = async (path, options) => {
  if (String(path) === reservation && ++failedReleases <= 2) throw new Error('transient reservation unlink failure');
  return rm(path, options);
};
rows = [row(420100, 1, 420100)];
onSignal = (pid, signal) => signal === 'SIGTERM' ? false : undefined;
try {
  await assert.rejects(endProcess({ pid: 420100, pidStarted: start }, () => {}, 0, undefined, {
    canSignal: current => !current.some(p => p.pid === 420100 && p.state === 'T')
  }), /transient reservation unlink failure/);
  assert.equal(rows[0].state, 'S', 'release failure cannot skip recovery thaw');
  // The first operation is gone, but its process is still alive. Recovery must retain
  // the nonce-owned reservation and retry after another transient failure.
  assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0, undefined, {
    deadline: Date.now() + 2000
  }), true);
  assert.deepEqual(rows, []);
  assert.ok(failedReleases >= 3, 'failed release is retried after the local call returns');
} finally { fs.rm = rm; await rm(reservation, { force: true }); }
`);
});

test('a failed tree acquisition retains and releases earlier reservations without hiding the primary failure', async () => {
  await probe(`
import fs from 'node:fs/promises';
const rm = fs.rm, writeFile = fs.writeFile;
const directory = '/tmp/cland-termination-' + process.getuid() + '/';
let failedReleases = 0;
fs.rm = async (path, options) => {
  if (String(path) === directory + '420100' && ++failedReleases <= 2) throw new Error('temporary release failure');
  return rm(path, options);
};
fs.writeFile = async (path, ...args) => {
  if (String(path).startsWith(directory + '420101.')) throw new Error('initial tree acquisition failure');
  return writeFile(path, ...args);
};
rows = [row(420100, 1, 420100), row(420101, 420100, 420100)];
try {
  await assert.rejects(endProcess({ pid: 420100, pidStarted: start }, () => {}, 0),
    /initial tree acquisition failure; cleanup failed: temporary release failure/);
  assert.deepEqual(signals, [], 'no signal before the whole initial tree is reserved');
  fs.writeFile = writeFile;
  assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0, undefined, {
    deadline: Date.now() + 2000
  }), true);
  assert.deepEqual(rows, []);
} finally { fs.rm = rm; fs.writeFile = writeFile; await rm(directory + '420100', { force: true }); }
`);
});


test('termination waits for captured pids with targeted probes before the full-tree freeze', async () => {
  await probe(`
rows = [row(420100, 1, 420100), row(420101, 420100, 420100)];
let termAt = -1, stopAt = -1, freezeAt = -1;
onTable = () => { if (termAt >= 0 && freezeAt < 0 && listings.at(-1).includes('-e')) freezeAt = listings.length - 1; };
onSignal = (pid, signal) => {
 if (signal === 'SIGTERM') { termAt = listings.length; return false; }
 if (signal === 'SIGSTOP' && stopAt < 0) stopAt = listings.length;
};
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 75), true);
assert.ok(freezeAt >= termAt && stopAt > freezeAt, 'the freeze discovery follows the grace exit probes');
const polls = listings.slice(termAt, freezeAt);
assert.ok(polls.length >= 2, 'grace period includes repeated exit checks');
assert.ok(polls.every(args => args.includes('-p') && !args.includes('-e')), 'exit checks never enumerate the machine');
assert.deepEqual(rows, []);
`);
});

test('termination settles confirmed absent captured pids without another spawn', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
let termAt = -1;
onSignal = (pid, signal) => { if (signal === 'SIGTERM') termAt = listings.length; };
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 50), true);
assert.deepEqual(rows, []);
assert.equal(listings.length, termAt, 'kill(pid, 0) already confirms every captured PID absent');
`);
});

test('optional owner scope sees the captured descendants before TERM while previous options retain termination', async () => {
  await probe(`
rows = [row(420100, 1, 420100), row(420101, 420100, 420100)];
const scopes = [];
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0, undefined, {
  canSignalTargets: async (targets, snapshot) => {
    scopes.push(targets.map(row => row.pid));
    assert.ok(snapshot.some(row => row.pid === process.pid));
    return false;
  }
}), false);
assert.deepEqual(scopes, [[420100, 420101]]);
assert.deepEqual(signals, [], 'scope refusal precedes the leader TERM and any forwarded group effect');
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0), true);
assert.ok(signals.some(signal => signal.pid === 420100 && signal.signal === 'SIGTERM'));
assert.equal(rows.length, 0, 'previous options shape still settles the captured tree');
`);
});

for (const failure of ['reuse', 'unavailable', 'outside-scope'] as const) {
  test(`isolated recovery thaw refuses ${failure} frozen targets without CONT`, async () => {
    await probe(`
rows = [row(420100, 1, 420100)];
onSignal = (_pid, signal) => signal === 'SIGTERM' ? false : undefined;
const options = { canSignalTargets: async () => {
  if (!rows.some(row => row.state === 'T')) return true;
  if (${JSON.stringify(failure)} === 'reuse') { rows[0].micros = 900002; tableOutput = 'unavailable snapshot'; }
  if (${JSON.stringify(failure)} === 'unavailable') nativeFailure = 'missing';
  return false;
} };
${failure === 'reuse' ? "assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0, undefined, options), false);" : "await assert.rejects(endProcess({ pid: 420100, pidStarted: start }, () => {}, 0, undefined, options), /thaw.*incomplete/);"}
assert.ok(signals.some(signal => signal.signal === 'SIGSTOP'));
assert.equal(signals.some(signal => signal.signal === 'SIGCONT'), false);
assert.equal(signals.some(signal => signal.signal === 'SIGKILL'), false);
assert.equal(rows[0].state, 'T', 'unknown or outside target remains retained rather than signalled');
`);
  });
}

test('isolated recovery thaw resumes a matching in-scope frozen target', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
onSignal = (_pid, signal) => signal === 'SIGTERM' ? false : undefined;
assert.equal(await endProcess({ pid: 420100, pidStarted: start }, () => {}, 0, undefined, {
  canSignalTargets: async () => true,
  canSignal: current => !current.some(row => row.pid === 420100 && row.state === 'T')
}), false);
assert.deepEqual(signals.map(signal => signal.signal), ['SIGTERM', 'SIGSTOP', 'SIGCONT']);
assert.equal(rows[0].state, 'S');
`);
});

test('isolated thaw rechecks synchronous ownership after awaited scope and birth probes', async () => {
  await probe(`
rows = [row(420100, 1, 420100)];
onSignal = (_pid, signal) => signal === 'SIGTERM' ? false : undefined;
await assert.rejects(endProcess({ pid: 420100, pidStarted: start }, () => {}, 0, undefined, {
  canSignalTargets: async () => true,
  canSignal: current => !current.some(row => row.pid === 420100 && row.state === 'T'),
  authorize: () => { if (rows.some(row => row.state === 'T')) throw new Error('ownership revoked during cleanup'); }
}), /thaw.*incomplete/);
assert.deepEqual(signals.map(signal => signal.signal), ['SIGTERM', 'SIGSTOP']);
assert.equal(rows[0].state, 'T', 'revoked ownership retains the captured stopped process');
`);
});
