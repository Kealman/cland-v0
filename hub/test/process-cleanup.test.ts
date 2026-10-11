// Safety at the cleanup boundary, with synthetic OS process tables and no real signals.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const modulePath = fileURLToPath(new URL('./process-cleanup.ts', import.meta.url));
function probe(body: string) {
  const source = `
import cp from 'node:child_process'; import { syncBuiltinESMExports } from 'node:module';
Object.defineProperty(process, 'platform', { value: 'darwin' });
process.env.TEST_SUITE_RUN_ID = 'owned-run';
let rows = []; let cwd = ''; const signals = [];
cp.execFileSync = (command, args) => {
  if (command === 'lsof') return cwd;
  if (args.includes('eww')) return rows.map(r => r.pid + ' ' + r.command + ' ' + (r.environment ?? ('TEST_SUITE_RUN_ID=' + r.runId))).join('\\n');
  return rows.map(r => r.pid + ' ' + r.parent + ' ' + r.group + ' ' + r.started + ' R ' + r.command).join('\\n');
};
syncBuiltinESMExports();
process.kill = (pid, signal) => { if (signal === undefined || signal === 0) { const e = new Error('gone'); e.code = 'ESRCH'; throw e; } signals.push({ pid, signal }); rows = rows.filter(row => pid < 0 ? row.group !== -pid : row.pid !== pid); return true; };
const { cleanupProcesses, captureProcess } = await import(${JSON.stringify(modulePath)});
const start = 'Mon Oct 5 12:00:00 2026';
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
