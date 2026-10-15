// Safety at the cleanup boundary, with synthetic OS process tables and no real signals.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const modulePath = fileURLToPath(new URL('./process-cleanup.ts', import.meta.url));
function probe(body: string, initial = '') {
  const source = `
import cp from 'node:child_process'; import { syncBuiltinESMExports } from 'node:module';
import assert from 'node:assert/strict';
Object.defineProperty(process, 'platform', { value: 'darwin' });
process.env.TEST_SUITE_RUN_ID = 'owned-run';
let rows = []; let cwd = ''; const signals = [];
cp.execFileSync = (command, args) => {
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
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', source], { encoding: 'utf8', timeout: 10_000 });
  assert.equal(child.status, 0, child.stderr);
  return JSON.parse(child.stdout) as Array<{ pid: number; signal: string }>;
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

test('cleanup never treats a sibling path as a run-owned path', () => {
  assert.deepEqual(probe(`
rows = [{ pid: 420002, parent: 1, group: 420002, started: start, command: 'node ' + root + 'b/file.mjs', runId: 'owned-run' }];
cwd = 'p420002\\nn' + root + 'b\\n';
await cleanupProcesses(root);`), []);
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
 if (args.includes('-e') || args.includes('-axo') || command === 'lsof') throw new Error('teardown inspected the machine');
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
 if (args.includes('-e') || args.includes('-axo') || command === 'lsof' && !args.includes('-p')) throw new Error('global teardown probe');
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
    cwd, detached: true, env: { ...process.env, FIXTURE_SCRIPT: script, FIXTURE_DEPTH: String(depth) },
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
 if (command === 'lsof' || args.includes('-e') || args.includes('eww')) throw new Error('recorded cleanup inspected the machine');
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
