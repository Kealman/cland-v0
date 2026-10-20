// T3: real worker delivery and host-receipt reuse, SSH interruption, provider loss, cancellation,
// watchdog reaping and hub-crash reconciliation require real process boundaries.
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { parseConfig, renderConfig } from '../src/init/config.ts';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { nativeProjectHub as projectHub, cland, clandWithEnv, connectUi, startDaemon, tempProject, pidAlive } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import type { HubStatus } from '../src/protocol.ts';
import { fixture, remoteEventually as eventually } from './remote-fixture.ts';

const exec = promisify(execFile);
const token = 'cland-test-remote-suite-token';

for (const dirty of ['tracker', 'source'] as const) test(`remote delivery ${dirty === 'tracker' ? 'bundles committed tracker state despite later tracker writes' : 'refuses and names source changes after submission'}`, async t => {
  const f = await fixture(t, { hub: projectHub });
  const view = JSON.parse((await cland(f.root, 'task', 'view', f.item, '--json')).stdout);
  const tracker = view.item.path as string;
  await f.git('add', '-f', tracker);
  await f.git('commit', '-qm', 'Committed tracker');
  const committed = await readFile(join(f.root, tracker), 'utf8');
  const head = await f.git('rev-parse', 'HEAD');
  const path = dirty === 'tracker' ? tracker : 'hub/src/tracker/change.ts';
  f.api.beforeCreate(async () => {
    await writeFile(join(f.root, path), 'uncommitted state\n');
    await f.git('add', '-f', path);
  });
  const job = await f.launch('--fresh');
  const result = await f.result(job.id);
  if (dirty === 'source') {
    assert.match(result.text, /dirty.*worktree cannot be bundled for droplet.*hub\/src\/tracker\/change\.ts/);
    assert.doesNotMatch(await readFile(join(f.root, '.cland/run/suites', job.id, 'suite.log'), 'utf8'), /\$ npm test/);
  } else {
    assert.match(result.text, /exit 0/);
    for (const directory of f.api.machineDirs.values()) {
      const cwd = join(directory, 'home/runner/cland');
      assert.equal((await exec('git', ['rev-parse', 'HEAD'], { cwd })).stdout.trim(), head);
      assert.equal(await readFile(join(cwd, tracker), 'utf8'), committed);
      const script = await readFile(join(directory, 'home/runner/runs', job.id, 'run.sh'), 'utf8');
      assert.ok(script.indexOf("echo '$ npm run typecheck'") < script.indexOf("echo '$ npm test'"));
      assert.ok(script.includes("/bin/sh -c 'npm run typecheck' || suite_command_exit=$?"));
      assert.ok(script.includes(`rmdir ${join(directory, 'home/runner/tmp/cland-suite.lock')}; trap - EXIT\necho '$ npm test'`));
      assert.ok(script.includes("/bin/sh -c 'npm test' || suite_command_exit=$?"));
      assert.equal((await exec('git', ['status', '--porcelain'], { cwd })).stdout, '');
      const delivery = await readFile(join(f.root, '.cland/run/suites', job.id, 'delivery.log'), 'utf8');
      assert.match(delivery, /dependencies match snapshot\nNeovim pin matches snapshot/);
    }
    assert.equal(await readFile(join(f.root, tracker), 'utf8'), 'uncommitted state\n');
  }
  assert.deepEqual(f.api.droplets, []);
});

test('host check failure creates no machine; remote typecheck stops tests and failed tests retain failures', async t => {
  const controls = join(await tempProject(t), 'failure-kind');
  await writeFile(controls, 'host');
  const hostHome = join(await tempProject(t), 'home/runner');
  await mkdir(hostHome, { recursive: true });
  const readKind = `require('fs').readFileSync(${JSON.stringify(controls)},'utf8')`;
  const f = await fixture(t, { hub: projectHub, env: { HOME: hostHome },
    typecheck: `node -e ${JSON.stringify(`const kind=${readKind};process.exit(kind==='host'?2:kind==='remote'&&!process.env.CLAND_TEST_FAKE_MACHINE_ROOT?3:0)`)}`,
    test: `node -e ${JSON.stringify(`if(${readKind}==='test'){console.log('not ok 1 - remote failure');process.exit(4)}console.log('# tests 1');console.log('# pass 1')`)}` });
  for (const kind of ['host', 'remote', 'test'] as const) await t.test(kind, async () => {
    await writeFile(controls, kind);
    // T3: plant a changed committed checkout before the real remote worker starts.
    await f.api.setMachineFaults({ checkoutDifference: kind === 'remote' });
    const job = await f.launch('--fresh');
    const report = await f.result(job.id);
    const hostLog = await readFile(join(f.root, '.cland/run/suites', job.id, 'suite.log'), 'utf8');
    assert.match(hostLog, /Host gate: npm run typecheck/);
    if (kind === 'host') {
      assert.match(report.text, /host check failed \(exit 2\); no droplet created/);
      assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 0);
      assert.equal(f.api.machineDirs.size, 0);
    }
    else {
      assert.match(report.text, new RegExp(`exit ${kind === 'remote' ? 3 : 4}`));
      const log = await readFile(join(f.root, '.cland/run/suites', job.id, 'suite.log'), 'utf8');
      if (kind === 'remote') {
        assert.doesNotMatch(log, /\$ npm test/);
        assert.match(log, /typecheck: droplet/);
        assert.match(log, /\$ npm run typecheck/);
        assert.doesNotMatch(log, /not repeated/);
      }
      else assert.match(report.text, /remote failure/);
    }
    assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
  });
});

const longTest = `node -e "const fs=require('fs');console.log('INCREMENTAL 😀');const t=setInterval(()=>{if(fs.existsSync(process.env.HOME+'/finish')){console.log('FINAL 😀');clearInterval(t)}},50)"`;
test('incremental byte logs survive SSH failure and hub restart and report once', async t => {
  const f = await fixture(t, { test: longTest });
  const job = await f.launch(); const remote = await f.remote(job.id);
  const localLog = join(f.root, '.cland/run/suites', job.id, 'suite.log');
  await eventually('incremental output', async () => (await readFile(localLog, 'utf8')).includes('INCREMENTAL 😀') ? true : undefined);
  await f.api.setMachineFaults({ sshFailures: 4 });
  await eventually('failed poll is retried', async () => {
    const calls = await readFile(join(f.api.stateRoot, 'machine-calls.jsonl'), 'utf8');
    return calls.trim().split('\n').map(line => JSON.parse(line)).filter(call => call.mode === 'ssh' && call.faults.sshFailures > 0).length >= 4 ? true : undefined;
  });
  assert.equal((await f.messages(job.id)).length, 0);
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  await f.api.setMachineFaults({ sshFailures: 0 });
  const restarted = await startDaemon(t, f.root, f.env, { syntheticProvider: f.syntheticProvider }); const ui = await connectUi(t, restarted.discovery);
  await eventually('reattached live run', async () => { const status = (await ui.request({ type: 'hub.status' })).value as HubStatus; return status.suites!.find(s => s.id === job.id)?.state === 'running' ? true : undefined; });
  assert.equal(f.api.droplets.length, 1); assert.equal((await f.messages(job.id, ui)).length, 0);
  await writeFile(join(remote.home, 'finish'), 'done');
  await eventually('released worker completed', async () => await readFile(join(remote.run, 'done'), 'utf8').catch(() => '') ? true : undefined);
  assert.match((await f.result(job.id, ui)).text, /auto exit 0/);
  const log = await readFile(localLog, 'utf8');
  assert.equal(log.split('\n').filter(line => line === 'INCREMENTAL 😀').length, 1); assert.equal(log.split('\n').filter(line => line === 'FINAL 😀').length, 1);
  assert.equal((await f.messages(job.id, ui)).length, 1);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 1);
  assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
});

test('provider loss and verify cancel each report once and release the machine and key', async t => {
  const f = await fixture(t, { hub: projectHub, test: longTest });
  for (const kind of ['lost', 'cancel'] as const) await t.test(kind, async () => {
    const job = await f.launch('--fresh'); const remote = await f.remote(job.id);
    await eventually('remote suite started', async () => (await readFile(join(remote.run, 'suite.log'), 'utf8').catch(() => '')).includes('INCREMENTAL') ? true : undefined);
    if (kind === 'lost') f.api.droplets.splice(0);
    else assert.equal((await clandWithEnv(f.root, f.actor, 'verify', 'cancel', job.id)).code, 0);
    const report = await f.result(job.id);
    assert.match(report.text, kind === 'lost' ? /remote machine lost/ : /exit 143; cancelled/);
    assert.equal((await f.messages(job.id)).length, 1);
    assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
    if (kind === 'cancel') assert.equal((await readFile(join(remote.run, 'exit'), 'utf8')).trim(), '143');
  });
});

test('restart reloads the lease after admission and never redelivers or cleans the live checkout', async t => {
  const f = await fixture(t, { test: longTest });
  const job = await f.launch(); const remote = await f.remote(job.id);
  await eventually('local poll collected first bytes', async () => (await readFile(join(f.root, '.cland/run/suites', job.id, 'suite.log'), 'utf8')).includes('\nINCREMENTAL 😀\n') ? true : undefined);
  const pgid = await readFile(join(remote.run, 'pgid'), 'utf8');
  await writeFile(join(remote.home, 'cland/live-checkout-evidence'), 'must survive restart');
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  // Simulate a crash after lease.json recorded admission but before hub.db's save.
  const db = new DatabaseSync(join(f.root, '.cland/hub.db'));
  try {
    const row = db.prepare("select value from meta where key = 'suite-jobs'").get() as { value: string };
    const jobs = JSON.parse(row.value);
    const stale = jobs.find((run: { id: string }) => run.id === job.id);
    stale.state = 'launching'; delete stale.lease.execution;
    db.prepare("update meta set value = ? where key = 'suite-jobs'").run(JSON.stringify(jobs));
  } finally { db.close(); }
  const restart = await startDaemon(t, f.root, f.env, { syntheticProvider: f.syntheticProvider }); const ui = await connectUi(t, restart.discovery);
  await eventually('restored job running', async () => ((await ui.request({ type: 'hub.status' })).value as HubStatus).suites!.find(run => run.id === job.id)?.state === 'running' ? true : undefined);
  assert.equal(await readFile(join(remote.home, 'cland/live-checkout-evidence'), 'utf8'), 'must survive restart');
  assert.equal(await readFile(join(remote.run, 'pgid'), 'utf8'), pgid);
  await writeFile(join(remote.home, 'finish'), 'done');
  await eventually('released worker completed', async () => await readFile(join(remote.run, 'done'), 'utf8').catch(() => '') ? true : undefined);
  assert.match((await f.result(job.id, ui)).text, /auto exit 0/);
  const calls = (await readFile(join(f.api.stateRoot, 'machine-calls.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(calls.filter(call => call.mode === 'ssh' && call.args.at(-1).includes('git checkout --detach')).length, 1);
  assert.equal((await f.messages(job.id, ui)).length, 1);
});

test('a restored launching suite reuses only an existing ref at the same head', async t => {
  const f = await fixture(t, { test: longTest });
  let discovery = f.discovery;
  let creates = 0;
  for (const kind of ['same head', 'different head'] as const) await t.test(kind, async () => {
    const gate = join(f.api.stateRoot, `delivery-${kind.replace(' ', '-')}`);
    onCleanup(t, () => writeFile(gate, 'released'));
    await f.api.setMachineFaults({ blockFile: gate, blockCommand: 'mkdir -p' });
    const submitted = await clandWithEnv(f.root, f.actor, 'verify', '--fresh', '--report', f.topic, '--to', 'impl', '--json');
    assert.equal(submitted.code, 0, submitted.stderr);
    const job = JSON.parse(submitted.stdout) as { id: string };
    await eventually('acquired lease reached delivery', async () => {
      const calls = await readFile(join(f.api.stateRoot, 'machine-calls.jsonl'), 'utf8').catch(() => '');
      return calls.split('\n').some(line => line.includes(job.id) && line.includes('mkdir -p')) ? true : undefined;
    });
    process.kill(discovery.pid, 'SIGKILL');
    await eventually('crashed hub PID is gone', () => !pidAlive(discovery.pid) ? true : undefined);
    assert.equal(pidAlive(discovery.pid), false);
    // A crash during bundling can leave this ref behind before delivery starts.
    const ref = `refs/cland/suites/${job.id}`;
    const head = await f.git('rev-parse', 'HEAD');
    const existing = kind === 'same head' ? head : await f.git('rev-parse', 'HEAD^');
    await f.git('update-ref', ref, existing);
    await writeFile(gate, 'released');
    await f.api.setMachineFaults({ blockCommand: '' });
    const restart = await startDaemon(t, f.root, f.env, { syntheticProvider: f.syntheticProvider }); discovery = restart.discovery; const ui = await connectUi(t, discovery);
    if (kind === 'same head') {
      const remote = await f.remote(job.id, ui);
      await writeFile(join(remote.home, 'finish'), 'done');
      await eventually('restored worker completed', async () => await readFile(join(remote.run, 'done'), 'utf8').catch(() => '') ? true : undefined);
      assert.match((await f.result(job.id, ui)).text, /auto exit 0/);
      assert.equal(await f.git('for-each-ref', '--format=%(refname)', ref), '');
    } else {
      const result = await f.result(job.id, ui);
      assert.match(result.text, /auto exit 1/);
      assert.ok(result.text.includes(`suite ref ${ref} points at ${existing}; expected ${head}`), result.text);
      assert.equal(await f.git('rev-parse', ref), existing);
    }
    assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, ++creates);
    assert.equal((await f.messages(job.id, ui)).length, 1);
    assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
  });
});


test('droplet delivery uses recorded shell lines after the project config changes', async t => {
  const f = await fixture(t, { hub: projectHub, test: 'exit 91', typecheck: 'exit 92' });
  const path = join(f.root, '.cland/config.toml');
  const config = parseConfig(await readFile(path, 'utf8'), 'recorded commands');
  const testLine = 'printf recorded-component; printf "\\n$ echo preparing\\n"; exit 7';
  Object.assign(config.verification, { prepare: 'printf recorded-prepare', check: 'printf recorded-check', test: 'exit 96', test_unit: 'printf recorded-test', test_component: testLine, test_integration: 'printf must-not-run' });
  await writeFile(path, renderConfig(config));
  f.api.beforeCreate(async () => {
    Object.assign(config.verification, { prepare: 'exit 93', check: 'exit 94', test: 'exit 95', test_unit: 'exit 98' });
    await writeFile(path, renderConfig(config));
  });
  const job = await f.launch('--fresh');
  const result = await f.result(job.id);
  assert.match(result.text, /exit 7/, result.text);
  const log = await readFile(join(f.root, '.cland/run/suites', job.id, 'suite.log'), 'utf8');
  assert.match(log, /Commands: check printf recorded-check · test exit 96/);
  assert.match(log, /Host gate: printf recorded-check/);
  assert.match(log, /recorded-prepare/);
  assert.doesNotMatch(log, /prepare failed/);
  assert.match(result.text, /tier T1: exit 0; duration \d+ s; output tail: recorded-test/);
  assert.match(result.text, /tier T2: exit 7; duration \d+ s; output tail: recorded-component/);
  assert.ok(result.text.includes(`T2 exited 7: ${testLine}`), result.text);
  assert.match(result.text, /Failures:\nrecorded-component\n\$ echo preparing/);
  assert.doesNotMatch(log, /\$ printf must-not-run|\$ exit 98/);
  assert.equal(f.api.machineDirs.size, 1);
  for (const directory of f.api.machineDirs.values()) {
    const script = await readFile(join(directory, 'home/runner/runs', job.id, 'run.sh'), 'utf8');
    assert.match(script, /\/bin\/sh -c 'printf recorded-check' \|\| suite_command_exit=\$\?/);
    assert.match(script, /tier T1: exit %s/);
    assert.match(script, /tier T2: exit %s/);
    assert.doesNotMatch(script, /exit 9[1-5]/);
  }
  assert.deepEqual(f.api.droplets, []);
});

// T3: native shell preparation/delivery is the remote transport contract; policy fakes cannot execute it.
for (const failing of [false, true]) test(`shell project ${failing ? 'reports a planted test failure' : 'prepares its snapshot before rebuilding ignored outputs'}`, async t => {
  const f = await fixture(t, { hub: projectHub, stack: 'other', prepare: 'echo prepared; echo prepared > .prepared', check: 'sh -n test.sh', test: 'sh test.sh' });
  await writeFile(join(f.root, '.gitignore'), '.cland/\nnode_modules/\n.prepared\n');
  await writeFile(join(f.root, 'test.sh'), `test -f .prepared || exit 2\n${failing ? 'echo planted-shell-failure\nexit 7' : 'echo shell-green'}\n`);
  await f.git('add', '.'); await f.git('commit', '-qm', failing ? 'Planted failure' : 'Shell project');
  if (!failing) {
    await f.git('push', '-q', 'origin', 'HEAD:dev');
    assert.equal((await f.ui.request({ type: 'executor.prepare' })).ok, true);
    await eventually('shell snapshot prepared', async () => {
      const value = (await f.ui.request({ type: 'executor.status' })).value as { prepare?: { state: string; error?: string } };
      if (!value.prepare || value.prepare.state === 'running') return undefined;
      assert.equal(value.prepare.state, 'done', value.prepare.error);
      return true;
    });
  }
  // Invalidate the host receipt so the native log includes the remote check command.
  await f.api.setMachineFaults({ checkoutDifference: true });
  const submitted = await f.ui.request({ type: 'suite.start', cwd: f.root, mode: 'auto', fresh: true, report: f.topic, to: ['impl'], as: { name: 'impl', sessionId: 'remote-impl', shell: true } });
  assert.equal(submitted.ok, true, submitted.error);
  const job = submitted.value as { id: string };
  const result = await f.result(job.id);
  assert.match(result.text, failing ? /exit 7/ : /exit 0/);
  if (failing) assert.match(result.text, /planted-shell-failure/);
  const log = await readFile(join(f.root, '.cland/run/suites', job.id, 'suite.log'), 'utf8');
  assert.match(log, /\nprepared\n/);
  assert.ok(log.indexOf('\nprepared\n') < log.indexOf('\n$ sh -n test.sh'), log);
  assert.match(log, /\$ sh test.sh/);
});

for (const dirty of [false, true]) test(`delivery prepare ${dirty ? 'rejects unignored outputs' : 'retains failed command output'} before remote checks`, async t => {
  const f = await fixture(t, { hub: projectHub, stack: 'other', prepare: dirty ? 'echo dirty > unexpected' : 'echo prepare-output; echo prepare-stderr >&2; exit 17', check: 'echo CHECK-RAN', test: 'echo TEST-RAN' });
  const submitted = await f.ui.request({ type: 'suite.start', cwd: f.root, mode: 'auto', fresh: true, report: f.topic, to: ['impl'], as: { name: 'impl', sessionId: 'remote-impl', shell: true } });
  assert.equal(submitted.ok, true, submitted.error);
  const job = submitted.value as { id: string };
  const result = await f.result(job.id);
  assert.match(result.text, /exit 1/);
  assert.match(result.text, dirty ? /prepare left the checkout dirty:.*unexpected/ : /prepare failed \(exit 17\)/);
  const log = await readFile(join(f.root, '.cland/run/suites', job.id, 'suite.log'), 'utf8');
  if (!dirty) {
    assert.match(result.text, /prepare-output[\s\S]*prepare-stderr/);
    assert.match(log, /prepare-output[\s\S]*prepare-stderr/);
  }
  assert.doesNotMatch(log, /\$ echo CHECK-RAN|\$ echo TEST-RAN/);
  assert.equal((await readFile(join(f.api.stateRoot, 'machine-calls.jsonl'), 'utf8')).includes('setsid nohup bash'), false);
});
