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
  if (args.includes('eww')) return rows.map(r => r.pid + ' node TEST_SUITE_RUN_ID=' + r.runId).join('\\n');
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
rows = [{ pid: 420001, parent: 1, group: 420001, started: start, command: 'node', runId: 'owned-run' }];
const original = captureProcess(420001);
rows[0].started = 'Tue Oct 6 12:00:00 2026';
await cleanupProcesses(root, original ? [original] : []);`), []);
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
