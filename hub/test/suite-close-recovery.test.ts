// T3: provider loss, cancellation and hub restart reconcile two live remote shard processes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { integrated } from './close-run-fixture.ts';
import { clandWithEnv, connectUi, eventually, killDaemon, projectHub, startDaemon } from './harness.ts';
import type { VerificationQueue } from '../src/protocol.ts';

const barrier = `node -e "const fs=require('fs');fs.mkdirSync('.cland',{recursive:true});fs.writeFileSync('.cland/started','yes');const timer=setInterval(()=>{if(fs.existsSync('.cland/finish')){clearInterval(timer);console.log('# tests 1');console.log('# pass 1')}},25)"`;

for (const action of ['lost', 'restart', 'cancel'] as const) test(`a sharded close handles ${action} with one result and confirmed cleanup`, async t => {
  const f = await integrated(t, '', 2, barrier, { hub: action === 'restart' ? startDaemon : projectHub });
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const submitted = await clandWithEnv(f.root, f.actor, 'verify', 'all', '--fresh', '--occasion', 'stage', '--report', f.topic, '--json');
  assert.equal(submitted.code, 0, submitted.stderr);
  const job = JSON.parse(submitted.stdout);
  const machines: Awaited<ReturnType<typeof f.remote>>[] = [];
  for (const n of [1, 2]) machines.push(await f.remote(`${job.id}-shard-${n}`));
  for (const machine of machines) await eventually('shard reached package barrier', async () => await readFile(join(machine.home, 'cland/.cland/started'), 'utf8').catch(() => '') === 'yes' ? true : undefined);
  const q = (await f.ui.request({ type: 'suite.queue' })).value as VerificationQueue;
  assert.equal(q.holder, null);
  assert.deepEqual(q.remote!.map(r => [r.shard, r.occasion]).sort(), [['shard-1', 'stage'], ['shard-2', 'stage']]);
  let ui = f.ui;
  if (action === 'lost') {
    // The fake provider reports 404 for exactly the first machine.
    const lost = f.api.droplets.findIndex(d => f.api.machineDirs.get(d.id) === machines[0]!.home.slice(0, -'/home/runner'.length));
    assert.notEqual(lost, -1);
    f.api.droplets.splice(lost, 1);
  } else if (action === 'restart') {
    await killDaemon(f.discovery.pid);
    const restarted = await startDaemon(t, f.root, f.env);
    ui = await connectUi(t, restarted.discovery);
  } else {
    assert.equal((await ui.request({ type: 'suite.cancel', suite: q.remote![0]!.id! })).ok, true);
  }
  // A status poll may already have seen the provider's 200 before the loss.
  // Keep shard 1 at its observed worker gate so that poll cannot collect a pass
  // before the next poll sees the 404. Release it only after the loss report.
  const finishing = action === 'lost' ? machines.slice(1) : action === 'restart' ? machines : [];
  for (const machine of finishing) await writeFile(join(machine.home, 'cland/.cland/finish'), 'yes');
  for (const machine of finishing) await eventually('released shard completed', async () => await readFile(join(machine.run, 'done'), 'utf8').catch(() => '') ? true : undefined);
  const result = await f.result(job.id, ui);
  assert.match(result.text, action === 'restart' ? /exit 0/ : action === 'cancel' ? /cancelled/ : /shard-1: remote machine lost/);
  if (action === 'lost') {
    await writeFile(join(machines[0]!.home, 'cland/.cland/finish'), 'yes');
    await eventually('lost shard worker finished before fixture removal', async () => await readFile(join(machines[0]!.run, 'done'), 'utf8').catch(() => '') ? true : undefined);
  }
  const messages = await f.messages(job.id, ui);
  assert.equal(messages.length, 1);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 2);
  await eventually('all sharded remote slots released', async () => {
    const q = (await ui.request({ type: 'suite.queue' })).value as VerificationQueue;
    return q.remote!.length === 0 ? true : undefined;
  });
  assert.deepEqual(f.api.droplets, []);
});
