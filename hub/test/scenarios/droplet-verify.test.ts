// T3 scenario: HTTP provider acquires process machines, runs, collects and releases, including stopped watchdog reaping.
// Rule coverage (T1/T2): hub/test/executor-run-rules.test.ts, hub/test/executor-admission.test.ts, hub/test/executor-safety-component.test.ts, hub/test/remote-scripted.test.ts.
// Hub process starts: 0; projectHub for both worker lifecycle steps. Only one hub is live at a time.
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectHub, cland, clandWithEnv, flushProjectLogs, tempProject, pidAlive } from '../harness.ts';
import { ownProcess } from '../process-cleanup.ts';
import type { HubStatus } from '../../src/protocol.ts';
import { fixture, remoteEventually as eventually, remoteWaitMs } from '../remote-fixture.ts';
import { readLeases } from '../../src/executor/droplet/lease.ts';
import { candidateTree } from '../../src/verification-tree.ts';

const exec = promisify(execFile);
const token = 'sentinel-remote-suite-token';

test('remote verify delivers host selection, runs as runner, reports accounting, contains the token and caches across executors', async t => {
  const hostMargin = process.env.CLAND_TEST_EXECUTOR_MARGIN_MS;
  const gitEnv = { GIT_CONFIG_COUNT: process.env.GIT_CONFIG_COUNT, GIT_CONFIG_KEY_0: process.env.GIT_CONFIG_KEY_0, GIT_CONFIG_VALUE_0: process.env.GIT_CONFIG_VALUE_0 };
  const excludes = join(await tempProject(t), 'git-excludes');
  await writeFile(excludes, 'env-only-untracked\n');
  const f = await fixture(t, {
    hub: projectHub,
    config: 'lifetime = "3m"\nrun_timeout = "1m"\n',
    env: { CLAND_TEST_EXECUTOR_MARGIN_MS: '1000', GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.excludesFile', GIT_CONFIG_VALUE_0: excludes },
  });
  await writeFile(join(f.root, 'env-only-untracked'), 'ignored only by this hub');
  assert.match(await f.git('status', '--porcelain'), /env-only-untracked/);
  const index = await readFile(join(f.root, '.git/index'));
  const job = await f.launch(); const remote = await f.remote(job.id);
  const result = await f.result(job.id);
  assert.match(result.text, /auto exit 0/);
  assert.equal(process.env.CLAND_TEST_EXECUTOR_MARGIN_MS, hostMargin);
  assert.deepEqual({ GIT_CONFIG_COUNT: process.env.GIT_CONFIG_COUNT, GIT_CONFIG_KEY_0: process.env.GIT_CONFIG_KEY_0, GIT_CONFIG_VALUE_0: process.env.GIT_CONFIG_VALUE_0 }, gitEnv);
  assert.deepEqual(await readFile(join(f.root, '.git/index')), index, 'candidate provenance uses a private index');
  assert.match(await readFile(join(f.root, '.cland/run/suites', job.id, 'run.sh'), 'utf8'), /^seconds=60$/m);
  assert.match(result.text, /Executor droplet · c-8 lon1 · cland-.*lifetime \d+ s · cost \$\d+\.\d{4}/);
  assert.equal((await f.messages(job.id)).length, 1);
  assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
  const log = await readFile(join(f.root, '.cland/run/suites', job.id, 'suite.log'), 'utf8');
  assert.match(log, /mode hub-only/); assert.match(log, /COLORS=0,1/);
  assert.match(log, /\$ npm test\n/);
  const selection = JSON.parse(log.match(/^SELECTION=(.*)$/m)![1]!);
  const status = (await f.ui.request({ type: 'hub.status', flushLogs: true })).value as HubStatus;
  assert.deepEqual(selection, status.suites!.find(s => s.id === job.id)!.selection);
  // T3: the real delivered worker must reuse the host receipt across the machine boundary.
  const tree = await candidateTree(f.root, undefined, f.env);
  assert.ok(tree);
  const expectedReceipt = `typecheck: host gate at ${tree} (not repeated)`;
  let receiptDiagnostic = '';
  if (!log.includes(expectedReceipt)) {
    const remoteLog = await readFile(join(remote.run, 'suite.log'), 'utf8');
    const laterLog = await readFile(join(f.root, '.cland/run/suites', job.id, 'suite.log'), 'utf8');
    const script = await readFile(join(f.root, '.cland/run/suites', job.id, 'run.sh'), 'utf8');
    const db = new DatabaseSync(join(f.root, '.cland/hub.db'), { readOnly: true });
    let remoteLogStart: number | undefined;
    try {
      const row = db.prepare("select value from meta where key = 'suite-jobs'").get() as { value: string };
      remoteLogStart = (JSON.parse(row.value) as { id: string; remoteLogStart?: number }[]).find(run => run.id === job.id)?.remoteLogStart;
    } finally { db.close(); }
    const markers = (text: string) => text.match(/typecheck:[^\r\n]*/g) ?? [];
    receiptDiagnostic = `host receipt mismatch: ${JSON.stringify({ expected: tree, generated: script.match(/typecheck: host gate at ([0-9a-f]{40})/)?.[1], local: markers(log), laterLocal: markers(laterLog), remote: markers(remoteLog), remoteLogStart, localBytes: Buffer.byteLength(log), remoteBytes: Buffer.byteLength(remoteLog) })}`;
  }
  assert.ok(log.includes(expectedReceipt), receiptDiagnostic);
  assert.ok(result.text.includes(`typecheck: host gate at ${tree} (not repeated)`));
  assert.doesNotMatch(log, /\$ npm run typecheck/);
  assert.ok(log.indexOf('Host gate: npm run typecheck') < log.indexOf('$ npm test'));
  assert.equal(await f.git('rev-parse', 'HEAD'), (await exec('git', ['rev-parse', 'HEAD'], { cwd: join(remote.home, 'cland') })).stdout.trim());
  assert.equal((await exec('git', ['remote'], { cwd: join(remote.home, 'cland') })).stdout, '');
  const calls = await readFile(join(f.api.stateRoot, 'machine-calls.jsonl'), 'utf8');
  assert.match(calls, /runner@203\.0\.113/); assert.match(calls, /tree\.bundle/);
  const view = JSON.parse((await cland(f.root, 'task', 'view', f.item, '--json')).stdout);
  assert.equal(view.item.verify.executor, 'droplet');
  const local = await f.launch('--executor', 'local');
  assert.equal(local.cached!.run, job.id); assert.match((await f.result(local.id)).text, /Executor droplet/);
  const invalid = await clandWithEnv(f.root, f.actor, 'verify', '--executor', 'other', '--report', f.topic);
  assert.equal(invalid.code, 1); assert.match(invalid.stderr, /executor must be local or droplet/);
  const refused = await f.ui.request({ type: 'suite.start', mode: 'auto', cwd: f.root, report: f.topic, executor: 'other' });
  assert.equal(refused.ok, false);
  await flushProjectLogs(t, f.root);
  // Live checks are complete. Stop ledger sweeps before auditing persisted bytes,
  // so transient lock entries cannot disappear between readdir and readFile.
  await f.stop();
  const scan = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await scan(path);
      else if (entry.isFile()) assert.ok(!(await readFile(path)).includes(Buffer.from(token)), `token absent: ${entry.name}`);
    }
  };
  await scan(join(f.root, '.cland'));
  for (const dir of f.api.machineDirs.values()) await scan(dir);
  assert.ok(!calls.includes(token)); assert.ok(!JSON.stringify(f.api.requests).includes(token));
});

const longTest = `node -e "const fs=require('fs');console.log('INCREMENTAL 😀');const t=setInterval(()=>{if(fs.existsSync(process.env.HOME+'/finish')){console.log('FINAL 😀');clearInterval(t)}},50)"`;
test('remote start reconciles executed-but-lost replies and marker-only interruptions', async t => {
  const f = await fixture(t, { hub: projectHub, test: longTest, env: { CLAND_TEST_DROPLET_WATCHDOG_STOP_MS: String(remoteWaitMs(500)) } });
  for (const fault of ['startReplyLost', 'startMarkerOnly'] as const) await t.test(fault, async () => {
    await f.api.setMachineFaults({ startReplyLost: 0, startMarkerOnly: 0, [fault]: 1 });
    const job = await f.launch('--fresh'); const remote = await f.remote(job.id);
    await eventually('suite remains running', async () => (await readFile(join(remote.run, 'suite.log'), 'utf8').catch(() => '')).includes('\nINCREMENTAL 😀\n') ? true : undefined);
    assert.equal((await f.messages(job.id)).length, 0);
    const lease = (await readLeases(f.root)).find(lease => lease.run === job.id)!;
    const watchdog = lease.watchdog!.pid;
    ownProcess(t, watchdog);
    // A stopped watchdog cannot acknowledge SIGTERM. Release must bound its wait,
    // escalate, and reap the child before publishing the suite result.
    if (fault === 'startReplyLost') {
      process.kill(watchdog, 'SIGSTOP');
      await eventually('watchdog is stopped', async () => (await exec('ps', ['-o', 'stat=', '-p', String(watchdog)])).stdout.trim().startsWith('T') ? true : undefined);
    }
    await writeFile(join(remote.home, 'finish'), 'done');
    await eventually('worker completed after release', async () => await readFile(join(remote.run, 'done'), 'utf8').catch(() => '') ? true : undefined);
    assert.match((await f.result(job.id)).text, /auto exit 0/);
    await eventually('released watchdog exits after release acknowledgement', () => !pidAlive(watchdog) ? true : undefined);
    assert.equal(pidAlive(watchdog), false, 'the released watchdog has exited before fixture removal');
    const log = await readFile(join(f.root, '.cland/run/suites', job.id, 'suite.log'), 'utf8');
    assert.equal(log.split('\n').filter(line => line === 'INCREMENTAL 😀').length, 1);
    assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
  });
});
