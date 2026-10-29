// Safety at the cleanup boundary, with synthetic OS process tables and no real signals.
import { fixtureEnvironment } from './fixture-environment.ts';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import test, { type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

const modulePath = fileURLToPath(new URL('./process-cleanup.ts', import.meta.url));
function probe(body: string, initial = '', platform = 'darwin') {
  const source = `
import cp from 'node:child_process'; import procFiles from 'node:fs'; import { syncBuiltinESMExports } from 'node:module';
import assert from 'node:assert/strict';
Object.defineProperty(process, 'platform', { value: ${JSON.stringify(platform)} });
process.env.TEST_SUITE_RUN_ID = 'owned-run';
let rows = []; let cwd = ''; const signals = []; const processCalls = []; let procReads = 0; let onStat = () => {};
if (process.platform === 'linux') {
 const read = procFiles.readFileSync;
 procFiles.readFileSync = (path, ...args) => {
  if (path === '/proc/sys/kernel/random/boot_id') { procReads++; return '11111111-2222-3333-4444-555555555555'; }
  const match = /^\\/proc\\/(\\d+)\\/stat$/.exec(String(path));
  if (!match) return read(path, ...args);
  procReads++; onStat(Number(match[1])); const r = rows.find(r => r.pid === Number(match[1]));
  if (!r) throw Object.assign(new Error('gone'), { code: 'ENOENT' });
  return r.pid + ' (' + r.command + ') ' + (r.nativeState ?? 'R') + ' ' + r.parent + ' ' + r.group + ' ' + Array(16).fill('0').join(' ') + ' ' + (r.ticks ?? 90001) + ' 0';
 };
}
cp.execFileSync = (command, args) => {
  processCalls.push(command);
  if (command === '/usr/bin/perl') {
    const selected = args.slice(args.indexOf('--') + 1).map(Number);
    return Buffer.concat(rows.filter(r => selected.includes(r.pid) && r.micros !== null).map(r => {
      const bytes = Buffer.alloc(648);
      bytes.writeBigInt64LE(BigInt(Math.floor(Date.parse(r.started + ' UTC') / 1000)), 0);
      bytes.writeInt32LE(r.micros ?? 200001, 8); bytes.writeInt32LE(r.pid, 40);
      bytes.writeUInt8(r.nativeState === 'Z' ? 5 : 2, 36);
      return bytes;
    }));
  }
  if (command === 'lsof') return cwd;
  if (command === 'pgrep') return rows.filter(r => args[1].split(',').includes(String(r.group))).map(r => r.pid).join('\\n');
  if (args.includes('eww')) return rows.map(r => r.pid + ' ' + r.command + ' ' + (r.environment ?? ('TEST_SUITE_RUN_ID=' + r.runId))).join('\\n');
  const selection = args.includes('-p') ? ['-p', args[args.indexOf('-p') + 1]] : ['-e'];
  assert.deepEqual(args, ['-ww', ...selection, '-o', 'pid=,ppid=,pgid=,lstart=,stat=,command=']);
  return rows.map(r => r.pid + ' ' + r.parent + ' ' + r.group + ' ' + r.started + ' R ' + r.command).join('\\n');
};
syncBuiltinESMExports();
process.kill = (pid, signal) => { if (signal === undefined || signal === 0) { if (rows.some(row => row.pid === pid)) return true; const e = new Error('gone'); e.code = 'ESRCH'; throw e; } signals.push({ pid, signal }); rows = rows.filter(row => pid < 0 ? row.group !== -pid : row.pid !== pid); return true; };
const start = 'Mon Oct 5 12:00:00 2026';
${initial}
const { cleanupProcesses, captureProcess } = await import(${JSON.stringify(modulePath)});
const root = '/tmp/cland-suite-a';
${body}
console.log(JSON.stringify(signals));`;
  const root = mkdtempSync(join(tmpdir(), 'cland-cleanup-identity-'));
  try {
    const child = spawnSync(process.execPath, ['--input-type=module', '-e', source], { encoding: 'utf8', timeout: 10_000, cwd: root, env: fixtureEnvironment(root, process.env) });
    assert.equal(child.status, 0, child.stderr);
    return JSON.parse(child.stdout) as Array<{ pid: number; signal: string }>;
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('Linux browser startup capture keeps the baseline ps count and spawns no Perl', () => {
  const counts = probe(`
rows = [{ pid: 420547, parent: process.pid, group: 420547, started: start, command: 'headless shell' }];
const { ownProcess } = await import(${JSON.stringify(modulePath)});
assert.equal(captureProcess(420547).pid, 420547);
ownProcess(undefined, 420547);
signals.push({ pid: processCalls.filter(command => command === 'ps').length, signal: 'startup ps' },
 { pid: processCalls.filter(command => command === '/usr/bin/perl').length, signal: 'startup perl' },
 { pid: procReads, signal: 'proc reads' });
`, '', 'linux');
  console.info('Linux startup probe counts', JSON.stringify(counts));
  assert.ok(counts[0]!.pid <= 2, 'registration never exceeds the two-ps startup baseline');
  assert.equal(counts[1]!.pid, 0, 'Linux identity never spawns Perl');
});

test('Linux empty browser teardown needs only the targeted group census', () => {
  const counts = probe(`
rows = [
 { pid: process.pid, parent: 420550, group: process.pid, started: start, command: 'worker' },
 { pid: 420550, parent: 1, group: 420550, started: start, command: 'parent' },
 { pid: 1, parent: 0, group: 1, started: start, command: 'init' },
 { pid: 420547, parent: process.pid, group: 420547, started: start, command: 'headless shell' }
];
const native = cp.execFileSync;
cp.execFileSync = (command, args, ...options) => {
 const output = native(command, args, ...options);
 if (command !== 'ps' || !args.includes('-p')) return output;
 const selected = args[args.indexOf('-p') + 1].split(',').map(Number);
 return String(output).split('\\n').filter(line => selected.includes(Number(line.trim().split(/\\s+/)[0]))).join('\\n');
};
syncBuiltinESMExports();
const { ownProcess } = await import(${JSON.stringify(modulePath)});
const cleanup = ownProcess(undefined, 420547);
rows = rows.filter(row => row.pid !== 420547);
processCalls.length = 0; procReads = 0;
await cleanup();
signals.push({ pid: processCalls.filter(command => command === 'ps').length, signal: 'teardown ps' },
 { pid: processCalls.filter(command => command === '/usr/bin/perl').length, signal: 'teardown perl' },
 { pid: processCalls.filter(command => command === 'pgrep').length, signal: 'group census' },
 { pid: procReads, signal: 'proc reads' });
`, '', 'linux');
  console.info('Linux empty teardown probe counts', JSON.stringify(counts));
  assert.deepEqual(counts, [{ pid: 0, signal: 'teardown ps' }, { pid: 0, signal: 'teardown perl' },
    { pid: 1, signal: 'group census' }, { pid: 0, signal: 'proc reads' }]);
});

test('ownership registration never reuses an observation beyond the current JavaScript turn', () => {
  assert.deepEqual(probe(`
rows = [{ pid: 420547, parent: process.pid, group: 420547, started: start, command: 'headless shell' }];
const { ownProcess, recordedProcess } = await import(${JSON.stringify(modulePath)});
assert.ok(captureProcess(420547).identity.endsWith(':90001'));
await Promise.resolve();
rows[0].ticks = 90002;
ownProcess(undefined, 420547);
assert.ok(recordedProcess(420547).identity.endsWith(':90002'), 'registration after a boundary observes the new native birth');
`, '', 'linux'), []);
});

for (const platform of ['linux', 'darwin']) test(`${platform} stale synchronous capture never authorizes a replacement signal`, () => {
  assert.deepEqual(probe(`
rows = [420543, 420544].map(pid => ({ pid, parent: process.pid, group: pid, started: start, command: 'node fixture' }));
const { ownProcess, recordedProcess } = await import(${JSON.stringify(modulePath)});
const captured = captureProcess(420543);
rows[0].ticks = 90002; rows[0].micros = 200002;
const cleanup = ownProcess(undefined, 420543);
assert.strictEqual(recordedProcess(420543), captured, 'registration consumes the synchronous cached birth, not the replacement');
const original = ownProcess(undefined, 420544);
await cleanup();
assert.deepEqual(signals, [], 'stale cached proof grants no destructive signal');
assert.deepEqual(rows.map(row => row.pid), [420543, 420544], 'replacement and unchanged control remain before control cleanup');
await original();
assert.deepEqual(rows.map(row => row.pid), [420543], 'replacement survives while the unchanged managed control exits');
`, '', platform), [{ pid: -420544, signal: 'SIGKILL' }]);
});

for (const [platform, state] of [['linux', 'Z'], ['linux', 'X'], ['darwin', 'Z']]) test(`${platform} ${state} cleanup settles a captured writer after its ps snapshot`, () => {
  assert.deepEqual(probe(`
rows = [420543, 420544].map(pid => ({ pid, parent: process.pid, group: pid, started: start, command: 'node fixture' }));
const { ownProcess } = await import(${JSON.stringify(modulePath)});
const cleanup = ownProcess(undefined, 420543);
const original = ownProcess(undefined, 420544);
let reads = 0;
const native = cp.execFileSync;
if (process.platform === 'linux') onStat = pid => { if (pid === 420543 && ++reads === 2) rows[0].nativeState = ${JSON.stringify(state)}; };
else {
 cp.execFileSync = (command, args, ...options) => {
  if (command === '/usr/bin/perl' && ++reads === 2) rows[0].nativeState = ${JSON.stringify(state)};
  return native(command, args, ...options);
 };
 syncBuiltinESMExports();
} // Final native read has exited while authoritative ps still says running.
assert.doesNotThrow(() => process.kill(420543, 0), 'a zombie still has a PID');
await cleanup();
assert.deepEqual(signals, [], 'a zombie needs neither a signal nor fresh ownership');
assert.deepEqual(rows.map(row => row.pid), [420543, 420544]);
await original();
assert.deepEqual(rows.map(row => row.pid), [420543], 'the unchanged managed writer is still signalled');
`, '', platform), [{ pid: -420544, signal: 'SIGKILL' }]);
});

for (const [platform, state] of [['linux', 'Z'], ['linux', 'X'], ['darwin', 'Z']]) {
  for (const exiting of ['child', 'leader']) test(`${platform} ${state} ${exiting} exit preserves the root of a surviving listed writer`, () => {
    assert.deepEqual(probe(`
const { ownProcess, ownDirectory } = await import(${JSON.stringify(modulePath)});
const fs = await import('node:fs/promises');
const dir = await fs.mkdtemp(process.cwd() + '/surviving-branch-');
await cleanupProcesses(undefined, []); // Complete invoking-worker discovery before arming the after-ps exit.
rows = [
 { pid: 420543, parent: process.pid, group: 420543, started: start, command: 'managed leader' },
 { pid: 420544, parent: 420543, group: 420544, started: start, command: 'exiting parent' },
 { pid: 420545, parent: 420544, group: 420545, started: start, command: 'surviving writer' }
];
const stop = ownProcess(undefined, 420543);
const remove = ownDirectory(undefined, dir, { beforeRemove: stop });
const target = ${exiting == 'child' ? 420544 : 420543};
let reads = 0;
const exit = () => {
 rows.find(r => r.pid === target).nativeState = ${JSON.stringify(state)};
 rows.find(r => r.pid === 420545).parent = 1;
};
const native = cp.execFileSync;
if (process.platform === 'linux') onStat = pid => { if (pid === target && ++reads === 2) exit(); };
else {
 cp.execFileSync = (command, args, ...options) => {
  if (command === '/usr/bin/perl' && ++reads === 2) exit();
  return native(command, args, ...options);
 };
 syncBuiltinESMExports();
}
await assert.rejects(remove(), /native process identity/, 'root removal waits for its captured writer branch');
assert.ok(await fs.stat(dir), 'the surviving writer root remains until its branch is settled');
assert.deepEqual(rows.map(r => r.pid), [420543, 420544, 420545]);
assert.deepEqual(signals, [], 'no ambiguous ancestry is signalled or silently settled');
onStat = () => {}; cp.execFileSync = native; syncBuiltinESMExports();
rows = rows.filter(r => r.pid === 420543 && r.nativeState === undefined); // Simulate confirmed branch reaping before fixture removal.
await remove();
await assert.rejects(fs.stat(dir), { code: 'ENOENT' });
`, '', platform), exiting === 'child' ? [{ pid: -420543, signal: 'SIGKILL' }] : []);
  });
}

for (const platform of ['linux', 'darwin']) {
  for (const outcome of ['gone', 'replaced', 'live', 'unreadable', 'EIO', 'EPERM']) test(`${platform} exited parent confirms its captured descendant ${outcome} before cleanup`, () => {
    assert.deepEqual(probe(`
rows = [
 { pid: 420543, parent: process.pid, group: 420543, started: start, command: 'parent' },
 { pid: 420544, parent: 420543, group: 420543, started: start, command: 'child' }
];
const seed = captureProcess(420543);
const kill = process.kill;
process.kill = (pid, signal) => {
 if (signal === undefined || signal === 0) return kill(pid, signal);
 signals.push({ pid, signal });
 rows[0].nativeState = 'Z';
 if (${JSON.stringify(outcome)} === 'EIO' || ${JSON.stringify(outcome)} === 'EPERM') {
  rows[1].micros = null; rows[1].ticks = 'invalid';
  process.kill = (checkedPid, checkedSignal) => {
   if (checkedPid === 420544 && (checkedSignal === undefined || checkedSignal === 0)) {
    throw Object.assign(new Error('injected liveness ' + ${JSON.stringify(outcome)}), { code: ${JSON.stringify(outcome)} });
   }
   return kill(checkedPid, checkedSignal);
  };
 }
 let reads = 0;
 const finish = () => {
  if (${JSON.stringify(outcome)} === 'gone') rows = rows.filter(r => r.pid !== 420544);
  if (${JSON.stringify(outcome)} === 'replaced') { rows[1].ticks = 90002; rows[1].micros = 200002; }
  if (${JSON.stringify(outcome)} === 'unreadable') { rows[1].micros = null; rows[1].ticks = 'invalid'; }
 };
 if (process.platform === 'linux') onStat = pid => { if (pid === 420544 && ++reads === 3) finish(); };
 else {
  const native = cp.execFileSync;
  cp.execFileSync = (command, args, ...options) => {
   if (command === '/usr/bin/perl' && ++reads === 3) finish();
   return native(command, args, ...options);
  };
  syncBuiltinESMExports();
 }
 return true;
};
const cleanup = cleanupProcesses(undefined, [seed], undefined, 'owned-run', []);
if (['live', 'unreadable', 'EIO', 'EPERM'].includes(${JSON.stringify(outcome)})) {
 await assert.rejects(cleanup, /native process identity|injected liveness EIO/, 'surviving or unproven child keeps the fixture');
 assert.ok(rows.some(r => r.pid === 420544));
} else {
 await cleanup;
 assert.equal(rows.some(r => r.pid === 420544), ${JSON.stringify(outcome)} === 'replaced');
}
`, '', platform), [{ pid: -420543, signal: 'SIGKILL' }]);
  });
}

test('cleanup refuses a remembered PID reused by a different process', () => {
  assert.deepEqual(probe(`
rows = [
 { pid: 420100, parent: 1, group: 420100, started: start, command: 'runner', runId: 'other-run' },
 { pid: 420001, parent: 420100, group: 420001, started: start, command: 'node', runId: 'owned-run' }
];
const runner = captureProcess(420100); const original = captureProcess(420001);
rows[1].started = 'Tue Oct 6 12:00:00 2026';
await cleanupProcesses(undefined, original ? [original] : [], () => {}, 'owned-run', runner ? [runner] : []);`), []);
});

test('cleanup never binds stale descendant ancestry to a birth read after PID recycling', () => {
  assert.deepEqual(probe(`
rows = [
 { pid: 420543, parent: process.pid, group: 420543, started: start, command: 'runner' },
 { pid: 420544, parent: 420543, group: 420544, started: start, command: 'replacement' },
 { pid: 420545, parent: 420543, group: 420545, started: start, command: 'owned child' }
];
const runner = captureProcess(420543);
const native = cp.execFileSync; let recycled = false;
cp.execFileSync = (command, args, ...options) => {
 if (command === '/usr/bin/perl' && !recycled) {
  recycled = true; rows[1].parent = 1; rows[1].micros = 200002;
 }
 return native(command, args, ...options);
};
syncBuiltinESMExports();
await cleanupProcesses(undefined, [runner], () => {}, 'owned-run', [runner]);
assert.equal(recycled, true, 'replacement is staged at the native acquisition boundary');
assert.deepEqual(rows.map(r => r.pid), [420544], 'replacement survives and original descendants exit');
`), [{ pid: -420543, signal: 'SIGKILL' }, { pid: 420545, signal: 'SIGKILL' }]);
});

test('cleanup preserves a same-second reused PID and still signals the original native identity', () => {
  assert.deepEqual(probe(`
rows = [420543, 420544].map(pid => ({ pid, parent: process.pid, group: pid, started: start, command: 'node fixture' }));
const { ownProcess } = await import(${JSON.stringify(modulePath)});
const cleanup = ownProcess(undefined, 420543);
const original = ownProcess(undefined, 420544);
rows[0].micros = 200002;
await cleanup();
if (rows.length !== 2) throw new Error('same-second replacement was signalled');
await original();
if (rows.length !== 1 || rows[0].pid !== 420543) throw new Error('original native identity was not signalled');
`), [{ pid: -420544, signal: 'SIGKILL' }]);
});

test('unreadable native birth preserves the fixture directory while its writer is live', () => {
  assert.deepEqual(probe(`
const { ownProcess, ownDirectory } = await import(${JSON.stringify(modulePath)});
const fs = await import('node:fs/promises');
const dir = await fs.mkdtemp('/tmp/cland-unreadable-birth-');
const hooks = []; const t = { after: fn => hooks.push(fn) };
const remove = ownDirectory(t, dir);
rows = [{ pid: 420545, parent: process.pid, group: 420545, started: start, command: 'node fixture' }];
ownProcess(t, 420545);
rows[0].micros = null;
await assert.rejects(hooks[0](), e => e instanceof AggregateError && e.errors.every(error => /native process identity/.test(String(error))));
assert.ok(await fs.stat(dir), 'live writer root is preserved');
assert.deepEqual(signals, []);
rows[0].micros = 200001;
await remove();
`), [{ pid: -420545, signal: 'SIGKILL' }]);
});

test('cleanup never treats a sibling path as a run-owned path', () => {
  assert.deepEqual(probe(`
rows = [{ pid: 420002, parent: 1, group: 420002, started: start, command: 'node ' + root + 'b/file.mjs', runId: 'owned-run' }];
cwd = 'p420002\\nn' + root + 'b\\n';
await cleanupProcesses(root);`), []);
});

test('scratch-root cleanup preserves a historical PID reused outside the fixture and stops its current writers', () => {
  assert.deepEqual(probe(`
// The logged vendor and hub have already exited: their old PID numbers grant no authority.
await cleanupProcesses(root);
rows = [
 { pid: 420080, parent: 1, group: 420080, started: 'Tue Oct 6 12:00:00 2026', command: 'other-app' },
 { pid: 420081, parent: 1, group: 420081, started: start, command: 'node fixture writer' }
];
cwd = 'p420080\\nn/tmp/another-project\\np420081\\nn' + root + '\\n';
await cleanupProcesses(root);
if (rows.length !== 1 || rows[0].pid !== 420080) throw new Error('replacement was signalled or fixture writer survived');
`), [{ pid: -420081, signal: 'SIGKILL' }]);
});

test('cleanup signals individual owned processes when their group has an unrelated member', () => {
  assert.deepEqual(probe(`
rows = [
 { pid: 420003, parent: 1, group: 420003, started: start, command: 'node ' + root + '/owned.mjs', runId: 'owned-run' },
 { pid: 420004, parent: 1, group: 420003, started: start, command: 'other-app', runId: 'other-run' }
];
cwd = 'p420003\\nn' + root + '\\n';
await cleanupProcesses(root);`), [{ pid: 420003, signal: 'SIGKILL' }]);
});

test('an argv assignment is not proof of run environment ownership', () => {
  assert.deepEqual(probe(`
rows = [{ pid: 420005, parent: 1, group: 420005, started: start, command: 'node TEST_SUITE_RUN_ID=owned-run ' + root + '/config', runId: 'other-run' }];
await cleanupProcesses(root);`), []);
});

test('marker text inside another environment variable never proves ownership', () => {
  assert.deepEqual(probe(`
rows = [{ pid: 420006, parent: 1, group: 420006, started: start, command: 'node ' + root + '/config', environment: 'OTHER_VAR=archived TEST_SUITE_RUN_ID=owned-run' }];
const report = [];
await cleanupProcesses(root, [], line => report.push(line));
if (!report.some(line => /ambiguous ownership/.test(line))) throw new Error('ambiguous candidate must be reported');
`), []);
});

test('a current parent chain to an original runner proves ownership without an environment marker', () => {
  assert.deepEqual(probe(`
rows = [
 { pid: 420007, parent: 1, group: 420007, started: start, command: 'node --test', runId: 'other-run' },
 { pid: 420008, parent: 420007, group: 420008, started: start, command: 'test worker', runId: 'other-run' }
];
const runner = captureProcess(420007); const child = captureProcess(420008);
await cleanupProcesses(undefined, child ? [child] : [], () => {}, 'owned-run', runner ? [runner] : []);`), [{ pid: -420008, signal: 'SIGKILL' }]);
});

test('a reused ancestor PID never proves run ownership', () => {
  assert.deepEqual(probe(`
rows = [
 { pid: 420009, parent: 1, group: 420009, started: start, command: 'node --test', runId: 'owned-run' },
 { pid: 420010, parent: 420009, group: 420010, started: start, command: 'test worker', runId: 'owned-run' }
];
const runner = captureProcess(420009); const child = captureProcess(420010);
rows[0].started = 'Tue Oct 6 12:00:00 2026';
await cleanupProcesses(undefined, child ? [child] : [], () => {}, 'owned-run', runner ? [runner] : []);`), []);
});

test('cleanup tolerates EPERM only after the signalled identity is confirmed gone', () => {
  assert.deepEqual(probe(`
rows = [{ pid: 420011, parent: 1, group: 420011, started: start, command: 'node ' + root + '/owned.mjs', runId: 'owned-run' }];
cwd = 'p420011\\nn' + root + '\\n';
process.kill = (pid, signal) => { signals.push({ pid, signal }); rows = []; const e = new Error('reaped'); e.code = 'EPERM'; throw e; };
await cleanupProcesses(root);`), [{ pid: -420011, signal: 'SIGKILL' }]);
});

test('cleanup does not swallow EPERM for an owned identity that remains live', () => {
  assert.deepEqual(probe(`
rows = [{ pid: 420012, parent: 1, group: 420012, started: start, command: 'node ' + root + '/owned.mjs', runId: 'owned-run' }];
cwd = 'p420012\\nn' + root + '\\n';
process.kill = () => { const e = new Error('live permission error'); e.code = 'EPERM'; throw e; };
let refused = false;
try { await cleanupProcesses(root); } catch (e) { refused = e.code === 'EPERM'; }
if (!refused) throw new Error('a live owned identity must fail cleanup');`), []);
});

test('cleanup preserves a replacement identity after EPERM', () => {
  assert.deepEqual(probe(`
rows = [{ pid: 420013, parent: 1, group: 420013, started: start, command: 'node ' + root + '/owned.mjs', runId: 'owned-run' }];
cwd = 'p420013\\nn' + root + '\\n';
process.kill = (pid, signal) => { signals.push({ pid, signal }); rows[0].started = 'Tue Oct 6 12:00:00 2026'; const e = new Error('reused'); e.code = 'EPERM'; throw e; };
await cleanupProcesses(root);`), [{ pid: -420013, signal: 'SIGKILL' }]);
});

test('cleanup settles an EPERM group before visiting its other captured members', () => {
  assert.deepEqual(probe(`
rows = [
 { pid: 420014, parent: 1, group: 420014, started: start, command: 'node ' + root + '/owned.mjs', runId: 'owned-run' },
 { pid: 420015, parent: 420014, group: 420014, started: start, command: 'child', runId: 'owned-run' }
];
cwd = 'p420014\\nn' + root + '\\np420015\\nn' + root + '\\n';
process.kill = (pid, signal) => {
 signals.push({ pid, signal });
 for (const row of rows) row.started = 'Tue Oct 6 12:00:00 2026';
 const e = new Error('group replaced'); e.code = 'EPERM'; throw e;
};
await cleanupProcesses(root);
if (rows.length !== 2) throw new Error('replacement members must be preserved');`), [{ pid: -420014, signal: 'SIGKILL' }]);
});

test('an owned teardown uses only targeted probes, including directory removal', () => {
  assert.deepEqual(probe(`
const { ownProcess, ownDirectory } = await import(${JSON.stringify(modulePath)});
const fs = await import('node:fs/promises');
const dir = await fs.mkdtemp('/tmp/cland-owned-');
const hooks = []; const t = { after: fn => hooks.push(fn) };
ownDirectory(t, dir);
rows = [{ pid: 420020, parent: process.pid, group: 420020, started: start, command: 'node fixture' }];
const cleanup = ownProcess(t, 420020);
const exec = cp.execFileSync;
cp.execFileSync = (command, args) => {
 if (command === 'ps' && (args.includes('-e') || args.includes('-axo')) || command === 'lsof') throw new Error('teardown inspected the machine');
 return exec(command, args);
};
syncBuiltinESMExports();
for (const hook of hooks) await hook();
await cleanup();
if (await fs.stat(dir).catch(() => null)) throw new Error('directory retained');
`), [{ pid: -420020, signal: 'SIGKILL' }]);
});

test('owned teardown stops a live tracker before removing its project', () => {
  assert.deepEqual(probe(`
const { ownDirectory, onCleanup } = await import(${JSON.stringify(modulePath)});
const { Tracker } = await import(${JSON.stringify(new URL('../src/tracker/tracker.ts', import.meta.url).href)});
const fs = (await import('node:fs/promises')).default;
const path = (await import('node:path')).join;
const dir = await fs.mkdtemp('/tmp/cland-cleanup-order-');
const hooks = []; const t = { after: fn => hooks.push(fn) };
ownDirectory(t, dir);
const tracker = new Tracker({ root: dir, db: path(dir, '.cland', 'hub.db') });
tracker.start();
let stopped = false;
onCleanup(t, async () => { assert.ok(await fs.stat(dir)); await tracker.stop(); stopped = true; });
const remove = fs.rm;
fs.rm = async (...args) => { assert.equal(stopped, true, 'tracker stops before rm'); return remove(...args); };
syncBuiltinESMExports();
for (const hook of hooks) await hook();
assert.equal(await fs.stat(dir).catch(() => null), null);
`), []);
});

test('owned teardown preserves failures while disposing every resource and directory', () => {
  assert.deepEqual(probe(`
const { ownDirectory, onCleanup } = await import(${JSON.stringify(modulePath)});
const fs = (await import('node:fs/promises')).default;
const first = await fs.realpath(await fs.mkdtemp('/tmp/cland-cleanup-failed-'));
const second = await fs.realpath(await fs.mkdtemp('/tmp/cland-cleanup-next-'));
const hooks = []; const t = { after: fn => hooks.push(fn) };
const cleanFirst = ownDirectory(t, first); ownDirectory(t, second);
const disposeError = new Error('resource disposal failed');
const removeError = Object.assign(new Error('directory not empty'), { code: 'ENOTEMPTY', path: first });
let stopped = false;
onCleanup(t, () => { throw disposeError; });
onCleanup(t, () => { stopped = true; });
const remove = fs.rm;
fs.rm = async (...args) => { assert.equal(stopped, true); if (args[0] === first) throw removeError; return remove(...args); };
syncBuiltinESMExports();
assert.equal(hooks.length, 1);
await assert.rejects(hooks[0](), error => error instanceof AggregateError && error.errors[0] === disposeError && error.errors[1] === removeError);
assert.equal(stopped, true);
assert.equal(await fs.stat(second).catch(() => null), null, 'later directory is removed after ENOTEMPTY');
fs.rm = remove; syncBuiltinESMExports(); await cleanFirst();
`), []);
});

test('owned teardown preserves an unrelated member joining its captured group', () => {
  assert.deepEqual(probe(`
const { ownProcess } = await import(${JSON.stringify(modulePath)});
rows = [{ pid: 420021, parent: process.pid, group: 420021, started: start, command: 'node fixture' }];
const cleanup = ownProcess(undefined, 420021);
rows.push({ pid: 420022, parent: 1, group: 420021, started: start, command: 'node fixture' });
await cleanup();
if (rows.length !== 1 || rows[0].pid !== 420022) throw new Error('unrelated group joiner was killed');
`), [{ pid: 420021, signal: 'SIGKILL' }]);
});

test('owned teardown preserves a reused group leader', () => {
  assert.deepEqual(probe(`
const { ownProcess } = await import(${JSON.stringify(modulePath)});
rows = [{ pid: 420023, parent: process.pid, group: 420023, started: start, command: 'node fixture' }];
const cleanup = ownProcess(undefined, 420023);
rows[0].started = 'Tue Oct 6 12:00:00 2026';
await cleanup();
`), []);
});

test('dead-leader teardown verifies selected member identities and cwd without a machine scan', () => {
  assert.deepEqual(probe(`
const { ownProcess, ownDirectory } = await import(${JSON.stringify(modulePath)});
const fs = await import('node:fs/promises');
const dir = await fs.realpath(await fs.mkdtemp('/tmp/cland-dead-group-'));
const remove = ownDirectory(undefined, dir);
rows = [{ pid: 420024, parent: process.pid, group: 420024, started: start, command: 'node fixture' }];
const cleanup = ownProcess(undefined, 420024);
rows = [
 { pid: 420025, parent: 1, group: 420024, started: start, command: 'node fixture' },
 { pid: 420026, parent: 1, group: 420024, started: start, command: 'node fixture' }
];
cwd = 'p420025\\nn' + dir + '\\np420026\\nn/outside\\n';
const exec = cp.execFileSync;
cp.execFileSync = (command, args) => {
 if (command === 'ps' && (args.includes('-e') || args.includes('-axo')) || command === 'lsof' && !args.includes('-p')) throw new Error('global teardown probe');
 return exec(command, args);
};
syncBuiltinESMExports();
await cleanup();
if (rows.length !== 1 || rows[0].pid !== 420026) throw new Error('unrelated member was not preserved');
await remove();
`), [{ pid: 420025, signal: 'SIGKILL' }]);
});

test('a replaced registered leader cannot authorize fixture-contained members of its replacement group', () => {
  assert.deepEqual(probe(`
const { ownProcess, ownDirectory } = await import(${JSON.stringify(modulePath)});
const fs = await import('node:fs/promises');
const dir = await fs.realpath(await fs.mkdtemp('/tmp/cland-reused-group-'));
const remove = ownDirectory(undefined, dir);
rows = [{ pid: 420027, parent: process.pid, group: 420027, started: start, command: 'node fixture' }];
const cleanup = ownProcess(undefined, 420027);
rows = [
 { pid: 420027, parent: 1, group: 420027, started: 'Tue Oct 6 12:00:00 2026', command: 'node replacement' },
 { pid: 420028, parent: 420027, group: 420027, started: 'Tue Oct 6 12:00:00 2026', command: 'node replacement child' }
];
cwd = 'p420027\\nn' + dir + '\\np420028\\nn' + dir + '\\n';
await cleanup();
if (rows.length !== 2) throw new Error('replacement group was signalled');
await remove();
`), []);
});

test('owned teardown kills its group including a grandchild and preserves the same command in another group', async t => {
  const { spawn } = await import('node:child_process');
  const { captureProcess, ownProcess } = await import('./process-cleanup.ts');
  const script = `const { spawn } = require('node:child_process');
const depth = Number(process.env.FIXTURE_DEPTH);
if (depth) {
 const child = spawn(process.execPath, ['-e', ${JSON.stringify('SCRIPT')}], { env: { ...process.env, FIXTURE_DEPTH: String(depth - 1) }, stdio: ['ignore', 'ignore', 'inherit', 'ipc'] });
 child.on('message', pids => process.send([process.pid, ...pids]));
} else process.send([process.pid]);
setInterval(() => {}, 1000);`;
  // The exact same command is used by both groups and by every descendant.
  const code = script.replace(JSON.stringify('SCRIPT'), 'process.env.FIXTURE_SCRIPT');
  const start = (depth: number) => {
    // cland-allow-child-env: OS-only process-group bystanders propagate their synthetic depth and script; no account or Git operation
    const child = spawn(process.execPath, ['-e', code], { detached: true, env: { ...process.env, FIXTURE_SCRIPT: code, FIXTURE_DEPTH: String(depth) }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    const cleanup = ownProcess(undefined, child.pid);
    t.after(cleanup);
    return { child, cleanup, ready: new Promise<number[]>((resolve, reject) => { child.once('message', pids => resolve(pids as number[])); child.once('error', reject); }) };
  };
  const owned = start(2);
  const other = start(0);
  const pids = await owned.ready;
  await other.ready;
  assert.equal(pids.length, 3);
  await owned.cleanup();
  for (const pid of pids) assert.equal(captureProcess(pid), null, `owned pid ${pid}`);
  assert.ok(captureProcess(other.child.pid), 'same command in the other group stays alive');
});

test('the phase sweep captures an owned group member born after discovery without a second machine listing', () => {
  assert.deepEqual(probe(`
rows = [{ pid: 420030, parent: 1, group: 420030, started: start, command: 'node ' + root + '/owned.mjs' }];
cwd = 'p420030\\nn' + root + '\\n';
const exec = cp.execFileSync; let discovered = false;
cp.execFileSync = (command, args) => {
 if (command === 'ps' && args.includes('-e')) {
  if (discovered) throw new Error('second discovery listing');
  discovered = true;
 }
 if (command === 'pgrep' && rows.length === 1) {
  rows.push({ pid: 420031, parent: 420030, group: 420030, started: start, command: 'node ' + root + '/late.mjs' });
  cwd += 'p420031\\nn' + root + '\\n';
 }
 return exec(command, args);
};
syncBuiltinESMExports();
await cleanupProcesses(root);
if (rows.length) throw new Error('late child survived the phase sweep');
`), [{ pid: -420030, signal: 'SIGKILL' }]);
});

test('directory teardown ends surviving children and grandchild after their registered group leader exits', async t => {
  const { spawn } = await import('node:child_process');
  const fs = await import('node:fs/promises');
  const { captureProcess, cleanupOwnedProcesses, ownDirectory, ownProcess } = await import('./process-cleanup.ts');
  const dir = await fs.mkdtemp('/tmp/cland-dead-leader-');
  const remove = ownDirectory(t, dir);
  const script = `const { spawn } = require('node:child_process');
const depth = Number(process.env.FIXTURE_DEPTH);
if (depth) {
 const child = spawn(process.execPath, ['-e', process.env.FIXTURE_SCRIPT], { env: { ...process.env, FIXTURE_DEPTH: String(depth - 1) }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
 child.on('message', pids => process.send([process.pid, ...pids]));
} else process.send([process.pid]);
process.on('message', () => process.exit(0));
setInterval(() => {}, 1000);`;
  const start = (depth: number, cwd: string) => spawn(process.execPath, ['-e', script], {
    cwd, detached: true, env: fixtureEnvironment(cwd, process.env, { FIXTURE_SCRIPT: script, FIXTURE_DEPTH: String(depth) }),
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  const leader = start(2, dir);
  ownProcess(t, leader.pid);
  const leaderReady = once(leader, 'message');
  const other = start(0, process.cwd());
  const otherReady = once(other, 'message');
  t.after(ownProcess(undefined, other.pid));
  const [pids] = await leaderReady as [number[]];
  await otherReady;
  assert.equal(pids.length, 3);
  const survivors = pids.slice(1).map(pid => captureProcess(pid)!);
  t.after(() => cleanupOwnedProcesses(survivors)); // also reap the regression fixture on a red run
  const exit = once(leader, 'exit');
  leader.send('exit');
  await exit;
  assert.equal(captureProcess(leader.pid), null);
  assert.ok(survivors.every(identity => captureProcess(identity.pid)), 'children survive their leader');
  await remove();
  assert.ok(survivors.every(identity => captureProcess(identity.pid) === null), 'owned group is gone before directory teardown returns');
  assert.equal(await fs.stat(dir).catch(() => null), null);
  assert.ok(captureProcess(other.pid), 'same command in another group survives');
});


test('owned teardown preserves a process older than the worker that registers it', () => {
  assert.deepEqual(probe(`
const { ownProcess } = await import(${JSON.stringify(modulePath)});
rows.push({ pid: 420040, parent: 1, group: 420040, started: 'Sun Oct 4 12:00:00 2026', command: 'other application' });
const cleanup = ownProcess(undefined, 420040);
await cleanup();
if (!rows.some(row => row.pid === 420040)) throw new Error('earlier process was killed');
`, `rows = [{ pid: process.pid, parent: 1, group: process.pid, started: start, command: 'worker' }];`), []);
});


test('an already-exited registered non-leader needs no teardown spawn', () => {
  assert.deepEqual(probe(`
const { ownProcess } = await import(${JSON.stringify(modulePath)});
rows = [{ pid: 420050, parent: process.pid, group: 420049, started: start, command: 'node fixture' }];
const cleanup = ownProcess(undefined, 420050);
rows = [];
cp.execFileSync = () => { throw new Error('an absent process needs no probe spawn'); };
syncBuiltinESMExports();
await cleanup();
`), []);
});


test('recorded cleanup verifies seeds and descendants without machine-wide inspection', () => {
  assert.deepEqual(probe(`
rows = [
 { pid: 420050, parent: 1, group: 420050, started: start, command: 'fixture' },
 { pid: 420051, parent: 420050, group: 420050, started: start, command: 'fixture child' },
 { pid: 420052, parent: 1, group: 420050, started: start, command: 'unrelated' }
];
const seed = captureProcess(420050);
const exec = cp.execFileSync; const probes = [];
cp.execFileSync = (command, args) => {
 if (command === 'lsof' || command === 'ps' && (args.includes('-e') || args.includes('eww'))) throw new Error('recorded cleanup inspected the machine');
 probes.push({ command, args });
 return exec(command, args);
};
syncBuiltinESMExports();
assert.equal(await cleanupProcesses(undefined, [seed], () => {}, 'owned-run', []), 2);
assert.equal(probes.filter(probe => probe.command === 'pgrep').length, 1);
assert.equal(rows.length, 1);
assert.equal(rows[0].pid, 420052);
`), [{ pid: 420050, signal: 'SIGKILL' }, { pid: 420051, signal: 'SIGKILL' }]);
});

test('a recorded seed that fails identity verification falls back to discovery and stays unsignalled', () => {
  assert.deepEqual(probe(`
rows = [{ pid: 420053, parent: 1, group: 420053, started: start, command: 'fixture' }];
const seed = captureProcess(420053);
rows[0].started = 'Tue Oct 6 12:00:00 2026';
const exec = cp.execFileSync; let discovered = false;
cp.execFileSync = (command, args) => { if (command === 'ps' && args.includes('-e')) discovered = true; return exec(command, args); };
syncBuiltinESMExports();
assert.equal(await cleanupProcesses(undefined, [seed], () => {}, 'owned-run', []), 0);
assert.equal(discovered, true);
`), []);
});


test('fallback discovery preserves a replaced seed and its replacement children even inside the fixture root', () => {
  assert.deepEqual(probe(`
rows = [{ pid: 420054, parent: 1, group: 420054, started: start, command: 'fixture' }];
const seed = captureProcess(420054);
rows = [
 { pid: 420054, parent: 1, group: 420054, started: 'Tue Oct 6 12:00:00 2026', command: 'replacement' },
 { pid: 420055, parent: 420054, group: 420054, started: 'Tue Oct 6 12:00:00 2026', command: 'replacement child' }
];
cwd = 'p420054\\nn' + root + '\\np420055\\nn' + root + '\\n';
assert.equal(await cleanupProcesses(root, [seed], () => {}, 'owned-run', []), 0);
`), []);
});

test('fallback protects the invoking worker ancestors even when a stale seed reuses the worker PID', () => {
  assert.deepEqual(probe(`
const seed = { pid: process.pid, group: process.pid, started: 'Thu Jan 1 00:00:00 1970' };
cwd = 'p420061\\nn' + root + '\\n';
await cleanupProcesses(root, [seed], () => {}, 'owned-run', []);
`, `rows = [
 { pid: process.pid, parent: 420061, group: process.pid, started: start, command: 'cleanup worker' },
 { pid: 420061, parent: 1, group: 420061, started: start, command: 'invoking shell', runId: 'owned-run' }
];`), []);
});

// T3: isolate the worker's real signal handler; the OS rows and signals themselves are synthetic.
test('signal recovery preserves replacement identities while reaping unrecorded fixture writers', () => {
  assert.deepEqual(probe(`
const fs = await import('node:fs');
const { ownDirectory, ownProcess } = await import(${JSON.stringify(modulePath)});
const dir = fs.realpathSync(fs.mkdtempSync('/tmp/cland-signal-control-'));
ownDirectory(undefined, dir);
rows = [
 { pid: 420070, parent: process.pid, group: 420070, started: start, command: 'original' },
 { pid: 420073, parent: process.pid, group: 420073, started: start, command: 'original leader' }
];
ownProcess(undefined, 420070);
ownProcess(undefined, 420073);
rows = [
 { pid: 420070, parent: process.pid, group: 420070, started: 'Tue Oct 6 12:00:00 2026', command: 'replacement' },
 { pid: 420071, parent: 420070, group: 420070, started: 'Tue Oct 6 12:00:00 2026', command: 'replacement child' },
 { pid: 420072, parent: 1, group: 420072, started: start, command: 'unrecorded hub' },
 { pid: 420074, parent: 1, group: 420073, started: start, command: 'dead leader child' }
];
cwd = rows.map(row => 'p' + row.pid + '\\nn' + dir + '\\n').join('');
let exited;
const exit = new Promise(resolve => { exited = resolve; });
process.exit = code => { exited(code); };
process.emit('SIGTERM');
assert.equal(await exit, 143);
assert.deepEqual(rows.map(row => row.pid), [420070, 420071]);
assert.equal(fs.existsSync(dir), false);
`), [{ pid: -420072, signal: 'SIGKILL' }, { pid: 420074, signal: 'SIGKILL' }]);
});


async function frameOwnershipChild(t: TestContext) {
  const { spawn } = await import('node:child_process');
  const fs = await import('node:fs/promises');
  const { ownDirectory, onCleanup } = await import('./process-cleanup.ts');
  const dir = await fs.mkdtemp(join(tmpdir(), 'cland-frame-ownership-'));
  let stop = async () => {};
  const remove = ownDirectory(t, dir, { beforeRemove: () => stop() });
  const child = spawn(process.execPath, ['-e', "process.on('message', command => { if (command === 'ready') process.send(process.pid); });"], {
    cwd: dir, detached: true, env: fixtureEnvironment(dir, process.env), stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  let nativeError: string | undefined;
  child.on('error', error => { nativeError = error.message; });
  // This observer never expires, including after a setup or disposal deadline.
  const closed = new Promise<{ code: number | null; signal: NodeJS.Signals | null; rootPresent: boolean }>(resolve => {
    child.once('close', (code, signal) => resolve({ code, signal, rootPresent: existsSync(dir) }));
  });
  const spawned = once(child, 'spawn');
  const bounded = async <T>(work: Promise<T>, boundary: string): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([work, new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`incomplete ${boundary}: native error ${nativeError ?? 'none'}; exit ${child.exitCode}; signal ${child.signalCode}; root retained`)), 5000); // lint-allow-wall-clock: separate bounded native receipt wait; persistent observer survives timeout
      })]);
    } finally { clearTimeout(timer); }
  };
  const waitClosed = () => bounded(closed, 'native close');
  stop = async () => { child.kill('SIGKILL'); await waitClosed(); };
  onCleanup(t, stop);
  const ready = async (signal?: AbortSignal, acknowledge = true) => {
    const receipt = once(child, 'message', { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000) });
    child.send(acknowledge ? 'ready' : 'hold');
    return receipt;
  };
  return { child, dir, remove, ready, waitClosed, spawned: bounded(spawned, 'spawn') };
}

test('default FrameClient accounts a real child and cleanup reaps it before removing its root', async t => {
  const fs = await import('node:fs/promises');
  const { frameClient } = await import('./harness.ts');
  const { recordedProcess, cleanupOwnedProcesses, captureProcess } = await import('./process-cleanup.ts');
  const owner = await frameOwnershipChild(t);
  await owner.spawned;
  const [reportedPid] = await owner.ready();
  const pid = owner.child.pid;
  assert.ok(pid);
  assert.equal(reportedPid, pid);
  assert.equal(recordedProcess(pid), undefined, 'frame receipt is the first ownership registration');
  let receive = (_chunk: string) => {};
  const ui = frameClient(line => {
    const request = JSON.parse(line);
    receive(JSON.stringify({ type: 'result', id: request.id, ok: true, value: { process: { pid, cwd: owner.dir } } }) + '\n');
  }, fn => { receive = fn; }, () => {}, owner.dir);
  const result = await ui.request({ type: 'session.launch' });
  assert.equal(result.ok, true);
  const identity = recordedProcess(pid);
  assert.ok(identity?.identity, 'default result observer captures native birth identity');
  await cleanupOwnedProcesses([identity]);
  const exit = await owner.waitClosed();
  assert.equal(exit.signal, 'SIGKILL');
  assert.equal(exit.rootPresent, true, 'root is retained through native close');
  assert.equal(captureProcess(pid), null, 'native close and absent identity precede directory removal');
  await owner.remove();
  assert.equal(await fs.stat(owner.dir).catch(() => null), null);
});

for (const setup of ['omitted', 'aborted'] as const) test(`FrameClient native control cleanup joins close with ${setup} readiness`, async t => {
  const fs = await import('node:fs/promises');
  const { captureProcess } = await import('./process-cleanup.ts');
  const owner = await frameOwnershipChild(t);
  await owner.spawned;
  if (setup === 'aborted') {
    const abort = new AbortController();
    const readiness = owner.ready(abort.signal, false);
    const rejected = assert.rejects(readiness, { name: 'AbortError' });
    abort.abort();
    await rejected;
  }
  assert.ok(captureProcess(owner.child.pid), 'the unready native child is still live');
  await owner.remove();
  const exit = await owner.waitClosed();
  assert.equal(exit.signal, 'SIGKILL');
  assert.equal(exit.rootPresent, true, 'directory fence joins close before removal');
  assert.equal(captureProcess(owner.child.pid), null);
  assert.equal(await fs.stat(owner.dir).catch(() => null), null);
});
