import assert from 'node:assert/strict';
import type { fixture } from './remote-fixture.ts';
import { drive } from './remote-clock.ts';
import { readLeases } from '../src/executor/droplet/lease.ts';
import { eventually } from './harness.ts';
import type { HubStatus } from '../src/protocol.ts';

type RemoteFixture = Awaited<ReturnType<typeof fixture>>;
export type OwnedRemoteRun = { fixture: RemoteFixture; id: string };

/** Cancel before releasing admission barriers. A cancelled acquisition need never start. */
export async function cancelAndDrain(runs: OwnedRemoteRun[], release: () => void | Promise<void>) {
  const errors: unknown[] = [];
  const attempt = async (work: () => Promise<unknown>) => { try { await work(); } catch (error) { errors.push(error); } };
  for (const { fixture: f, id } of runs) {
    await attempt(async () => {
      if ((await f.messages(id)).length) return;
      const cancelled = await f.ui.request({ type: 'suite.cancel', suite: id });
      assert.ok(cancelled.ok || /suite already finished/.test(cancelled.error ?? ''), cancelled.error);
    });
  }
  await attempt(async () => { await release(); });
  const reports: Awaited<ReturnType<RemoteFixture['result']>>[] = [];
  for (const { fixture: f, id } of runs) await attempt(async () => {
    await drive(f, eventually('cancelled acquisition completed and released', async () => {
      const status = (await f.ui.request({ type: 'hub.status' })).value as HubStatus;
      if (status.suites?.find(job => job.id === id)?.state !== 'finished') return;
      return (await readLeases(f.root)).filter(lease => lease.run === id).every(lease => lease.state === 'released') ? true : undefined;
    }));
    // Completion/release and downstream reporting have separate bounded receipts.
    reports.push(await f.result(id));
  });
  for (const f of new Set(runs.map(run => run.fixture))) {
    await attempt(async () => {
      await drive(f, f.stop().then(() => {}));
      assert.equal(f.waits.pending.length, 0, 'no product wait survives hub shutdown');
      assert.ok((await readLeases(f.root)).every(lease => lease.state === 'released'), 'all owned acquisitions released');
    });
  }
  if (errors.length) throw new AggregateError(errors, 'remote fixture cleanup failed');
  return reports;
}
