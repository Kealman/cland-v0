// Batch pid-identity reads at the native process boundary; no result survives its callers.
import test from 'node:test';
import assert from 'node:assert/strict';
import cp, { type SpawnOptions } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { processStartedAsync } from '../src/hub/lock.ts';

test('concurrent identity reads share one targeted ps and later reads detect changed identities', async t => {
  const spawn = cp.spawn;
  const probes: Array<{ args: readonly string[]; env: NodeJS.ProcessEnv | undefined }> = [];
  let started = 'Mon Oct 5 12:00:00 2026';
  Object.assign(cp, { spawn: (command: string, args: readonly string[] = [], options: SpawnOptions = {}) => {
    // cland-allow-child-env: native process-identity spy forwards options unchanged; the replacement only prints synthetic ps rows
    if (command !== 'ps') return spawn(command, args, options);
    probes.push({ args: [...args ?? []], env: options?.env });
    const pids = String(args?.[(args?.indexOf('-p') ?? -1) + 1]).split(',');
    const output = args?.includes('pid=,lstart=')
      ? pids.filter(pid => pid !== '999999').map(pid => `${pid} ${started}`).join('\n')
      : started;
    // cland-allow-child-env: native process-identity spy forwards options unchanged; the replacement only prints synthetic ps rows
    return spawn(process.execPath, ['-e', `setTimeout(() => { console.log(${JSON.stringify(output)}); process.exit(${pids.includes('999999') ? 1 : 0}); }, 30)`], options);
  } });
  syncBuiltinESMExports();
  t.after(() => { cp.spawn = spawn; syncBuiltinESMExports(); });
  let resumed = 0;
  const resume = <T>(work: () => T) => { resumed++; return work(); };
  const reads = [
    processStartedAsync(101, 3000, resume), processStartedAsync(101, 3000, resume),
    processStartedAsync(102, 3000, resume), processStartedAsync(999999, 3000, resume),
  ];
  await new Promise<void>(resolve => setImmediate(resolve));
  reads.push(processStartedAsync(101, 3000, resume)); // Same PID joins the already running ps.
  const values = await Promise.all(reads);
  assert.deepEqual(values, [started, started, started, null, started]);
  assert.equal(resumed, 5, 'every caller resumes in its own request scope');
  assert.equal(probes.length, 1);
  assert.deepEqual(probes[0]?.args, ['-o', 'pid=,lstart=', '-p', '101,102,999999']);
  started = 'Tue Oct 6 12:00:00 2026';
  assert.equal(await processStartedAsync(101), started, 'a resolved result is never cached');
  assert.equal(probes.length, 2);
});

test('identity batches keep timezone and deadline contracts separate', async t => {
  const spawn = cp.spawn;
  const probes: Array<{ locale: string | undefined; timezone: string | undefined }> = [];
  Object.assign(cp, { spawn: (command: string, args: readonly string[] = [], options: SpawnOptions = {}) => {
    // cland-allow-child-env: native process-identity spy forwards options unchanged; the replacement only prints synthetic ps rows
    if (command !== 'ps') return spawn(command, args, options);
    probes.push({ locale: options?.env?.LC_ALL, timezone: options?.env?.TZ });
    // cland-allow-child-env: native process-identity spy forwards options unchanged; the replacement only prints synthetic ps rows
    return spawn(process.execPath, ['-e', `console.log('101 Mon Oct 5 12:00:00 2026')`], options);
  } });
  syncBuiltinESMExports();
  t.after(() => { cp.spawn = spawn; syncBuiltinESMExports(); });
  await Promise.all([processStartedAsync(101), processStartedAsync(101, 2000), processStartedAsync(101, 3000, undefined, 'UTC')]);
  assert.equal(probes.length, 3);
  assert.equal(probes.filter(probe => probe.timezone === 'UTC' && probe.locale === 'C').length, 1);
});

test('a failed identity batch provides no proof and the next read retries', async t => {
  const spawn = cp.spawn;
  let probes = 0;
  Object.assign(cp, { spawn: (command: string, args: readonly string[] = [], options: SpawnOptions = {}) => {
    // cland-allow-child-env: native process-identity spy forwards options unchanged; the replacement only prints synthetic ps rows
    if (command !== 'ps') return spawn(command, args, options);
    probes++;
    // cland-allow-child-env: native process-identity spy forwards options unchanged; the replacement only prints synthetic ps rows
    return spawn(process.execPath, ['-e', probes === 1
      ? "console.log('101 Mon Oct 5 12:00:00 2026'); process.exit(2)"
      : "console.log('101 Tue Oct 6 12:00:00 2026')"], options);
  } });
  syncBuiltinESMExports();
  t.after(() => { cp.spawn = spawn; syncBuiltinESMExports(); });
  assert.deepEqual(await Promise.all([processStartedAsync(101), processStartedAsync(101)]), [null, null]);
  assert.equal(probes, 1);
  assert.equal(await processStartedAsync(101), 'Tue Oct 6 12:00:00 2026');
  assert.equal(probes, 2);
  assert.equal(await processStartedAsync(-1), null, 'invalid selectors cannot inspect an unintended process set');
  assert.equal(probes, 2);
});

test('simultaneous identity reads keep each project environment', async t => {
  const spawn = cp.spawn;
  Object.assign(cp, { spawn: (command: string, args: readonly string[] = [], options: SpawnOptions = {}) => {
    // cland-allow-child-env: native process-identity spy forwards options unchanged; the replacement only prints synthetic ps rows
    if (command !== 'ps') return spawn(command, args, options);
    const started = options.env?.TZ === 'UTC' ? 'Mon Oct 5 12:00:00 2026' : 'Mon Oct 5 15:00:00 2026';
    // cland-allow-child-env: native process-identity spy forwards options unchanged; the replacement only prints synthetic ps rows
    return spawn(process.execPath, ['-e', `console.log('101 ${started}')`], options);
  } });
  syncBuiltinESMExports();
  t.after(() => { cp.spawn = spawn; syncBuiltinESMExports(); });
  const values = await Promise.all([
    processStartedAsync(101, undefined, undefined, undefined, { ...process.env, TZ: 'UTC' }),
    processStartedAsync(101, undefined, undefined, undefined, { ...process.env, TZ: 'Europe/Moscow' }),
  ]);
  assert.deepEqual(values, ['Mon Oct 5 12:00:00 2026', 'Mon Oct 5 15:00:00 2026']);
});
