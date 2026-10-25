// Shared T2 case and receipt driver; T4 repeats the same assertions under load.
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture } from './remote-fixture.ts';
import { eventually, tempProject } from './harness.ts';
import { drive } from './remote-clock.ts';
import { readLeases, type DropletLease } from '../src/executor/droplet/lease.ts';

export async function lease(root: string): Promise<{ value: DropletLease; path: string }> {
  const dir = join(root, '.cland/run/executor/leases');
  const ids = await readdir(dir);
  const records = await Promise.all(ids.map(async id => { const path = join(dir, id, 'lease.json'); return { path, value: JSON.parse(await readFile(path, 'utf8')) as DropletLease }; }));
  return records.sort((a, b) => a.value.created.localeCompare(b.value.created)).at(-1)!;
}
// Bound native receipts independently of downstream report publication.
export async function receipt<T>(what: string, work: Promise<T>): Promise<T> {
  let done = false;
  const completed = work.finally(() => { done = true; });
  void completed.catch(() => {});
  await eventually(what, () => done ? true : undefined);
  return completed;
}
export async function finish(f: Awaited<ReturnType<typeof fixture>>, id: string) {
  await receipt('remote start persisted', f.machine.started(id));
  await receipt('remote admission settled', f.verificationSettled());
  // Complete the scripted worker explicitly, then observe its done receipt.
  // A scheduler tick is permission to collect that receipt, not worker completion.
  f.machine.finish(id);
  const record = (await readLeases(f.root)).find(lease => lease.run === id)!;
  const completed = await receipt('remote worker completion', f.dependencies.run!.status(record));
  assert.equal(completed.state, 'done');
  // Join each admitted operation before another scheduler step; a retry can
  // request product time after the first tick or need a later collection poll.
  return receipt('remote completion collected', scriptedResult(f, id));
}

// Each step follows the previous scheduler/sweep completion receipt. Topic reads
// alone cannot admit time: persistence may still be pending on either shared hub.
export async function scriptedResult(f: Awaited<ReturnType<typeof fixture>>, id: string, peers = [f]) {
  const settled = async () => {
    let before: number;
    do {
      before = f.clock.now().getTime();
      for (const peer of peers) await drive(peer, peer.verificationSettled());
      // A product-requested delay on a later peer can admit work on an earlier one.
    } while (f.clock.now().getTime() !== before);
  };
  return eventually('scripted suite report', async () => {
    await settled();
    const prior = (await f.messages(id))[0];
    if (prior) return prior;
    await f.clock.advance(1000);
    await settled();
    return (await f.messages(id))[0];
  });
}

export async function foreignLeaseCase(t: TestContext) {
  const state = await tempProject(t, 'foreign-lifetime-');
  const short = await fixture(t, { machine: 'scripted', env: { CLAND_EXECUTOR_STATE: state } });
  const long = await fixture(t, { machine: 'scripted', api: short.api, config: 'lifetime="110m"\nrun_timeout="75m"', env: { CLAND_EXECUTOR_STATE: state } });
  const run = await long.launch(); await drive(long, long.machine.started(run.id));
  const record = await lease(long.root);
  const droplet = short.api.droplets.find(d => d.id === record.value.resource)!;
  droplet.created_at = new Date(short.clock.now().getTime() - 30 * 60000).toISOString();
  assert.equal((await short.ui.request({ type: 'executor.reap' })).ok, true);
  assert.ok(short.api.droplets.some(d => d.id === droplet.id));
  assert.ok(!short.api.requests.some(r => r.method === 'DELETE' && r.path === `/v2/droplets/${droplet.id}`));
  const report = await finish(long, run.id);
  assert.equal(report.id, `suite:${run.id}`);
  assert.match(report.text, /exit 0/);
  assert.equal((await lease(long.root)).value.state, 'released');
  assert.deepEqual(short.api.droplets, []);
  assert.deepEqual(short.api.keys, []);
}
