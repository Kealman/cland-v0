import test from 'node:test';
import assert from 'node:assert/strict';
import { ProcessTable } from '../src/adapters/processes.ts';
import type { HarnessProcess } from '../src/adapters/contract.ts';
import { linuxIdentity, darwinIdentities } from '../src/process-identity.ts';

const boot = '11111111-2222-3333-4444-555555555555';
test('Linux stat field 22 follows the last comm parenthesis, including spaces and closing parentheses', () => {
  // Fields 4 through 22 are distinct literal values: ppid7, pgrp8, ... starttime987654321.
  const stat = '123 (fake Claude ) worker)) S 7 8 9 0 -1 4194304 1 2 3 4 5 6 7 8 20 0 4 0 987654321 123456 99 0\n';
  assert.equal(linuxIdentity(123, stat, boot), `linux:${boot}:987654321`);
});

test('Linux identity preserves start ticks within one ps second and rejects a different PID', () => {
  const stat = (ticks: string) => `123 (name with ) parentheses) S ${Array(18).fill('0').join(' ')} ${ticks} 0`;
  assert.equal(linuxIdentity(123, stat('90001'), boot), `linux:${boot}:90001`);
  assert.equal(linuxIdentity(123, stat('90002'), boot), `linux:${boot}:90002`);
  assert.equal(linuxIdentity(124, stat('90001'), boot), null);
  assert.equal(linuxIdentity(123, stat('oops'), boot), null);
});

test('Linux identity diagnostics name the failing validation step without exposing stat contents', () => {
  const failures: string[] = [];
  const report = (_pid: number, error: string) => failures.push(error);
  linuxIdentity(123, '123 (private name) S 1', boot, report);
  linuxIdentity(123, '123 (private name) S 1', 'bad boot id', report);
  assert.deepEqual(failures, ['Linux stat field 22: missing or invalid start ticks', 'Linux boot-id validation: invalid UUID']);
  assert.ok(failures.every(error => !error.includes('private name')));
});

test('macOS identity preserves microseconds and rejects truncated or malformed native records', () => {
  const bytes = Buffer.alloc(648);
  bytes.writeBigInt64LE(1791201600n, 0); bytes.writeInt32LE(100001, 8); bytes.writeInt32LE(123, 40);
  assert.equal(darwinIdentities(bytes).get(123), 'darwin:1791201600:100001');
  bytes.writeInt32LE(100002, 8);
  assert.equal(darwinIdentities(bytes).get(123), 'darwin:1791201600:100002');
  assert.equal(darwinIdentities(bytes.subarray(0, 647)).size, 0);
  bytes.writeInt32LE(1_000_000, 8);
  assert.equal(darwinIdentities(bytes).size, 0);
});

test('native exited receipts are separate from previous nullable birth APIs and invalid records', () => {
  const gone: number[] = [];
  const reportExited = (pid: number) => { gone.push(pid); };
  for (const state of ['Z', 'X']) {
    const stat = `123 (exited fixture) ${state} ${Array(18).fill('0').join(' ')} 90001 0`;
    assert.equal(linuxIdentity(123, stat, boot), null, 'previous caller never receives signal ownership');
    assert.equal(linuxIdentity(123, stat, boot, undefined, reportExited), null);
    assert.deepEqual(gone.splice(0), [123]);
    assert.equal(linuxIdentity(124, stat, boot, undefined, reportExited), null);
    assert.equal(linuxIdentity(123, stat.replace('90001', 'bad'), boot, undefined, reportExited), null);
    assert.deepEqual(gone, [], 'malformed or wrong-PID records provide no exit receipt');
  }
  const bytes = Buffer.alloc(648);
  bytes.writeBigInt64LE(1791201600n, 0); bytes.writeInt32LE(100001, 8); bytes.writeInt32LE(123, 40);
  bytes.writeUInt8(5, 36); // Darwin extern_proc.p_stat = SZOMB.
  assert.equal(darwinIdentities(bytes).size, 0, 'previous caller sees no birth for a zombie');
  assert.equal(darwinIdentities(bytes, reportExited).size, 0);
  assert.deepEqual(gone.splice(0), [123]);
  assert.equal(darwinIdentities(bytes.subarray(0, 647), reportExited).size, 0);
  bytes.writeInt32LE(1_000_000, 8);
  assert.equal(darwinIdentities(bytes, reportExited).size, 0);
  assert.deepEqual(gone, [], 'invalid native layout or timestamp cannot prove exit');
});

test('persisted process birth identity survives writes, updates and pending-stop recovery; old rows stay readable', () => {
  const table = new ProcessTable();
  try {
    const old: HarnessProcess = { name: 'legacy', harness: 'codex', role: null, model: null, cwd: '/fixture', pid: 123,
      harnessId: null, sessionId: 'legacy-session', harnessSessionId: null, startedAt: '2026-10-05T12:00:00Z', status: 'running', pidStarted: 'Mon Oct 5 12:00:00 2026' };
    table.put(old);
    assert.equal(table.get('legacy')?.pidIdentity ?? null, null, 'previous adapter shape remains readable');
    table.put({ ...old, pidIdentity: 'darwin:1791201600:100001' });
    assert.equal(table.get('legacy')?.pidIdentity, 'darwin:1791201600:100001');
    table.update('legacy', { pidIdentity: 'darwin:1791201600:100002' });
    const current = table.get('legacy')!;
    table.pendingStop({ process: current, error: 'fixture failure', stages: { stopped: false, rowRemoved: false, roleRolledBack: false } });
    assert.equal(table.pendingStops()[0]?.process.pidIdentity, 'darwin:1791201600:100002');
  } finally { table.close(); }
});
