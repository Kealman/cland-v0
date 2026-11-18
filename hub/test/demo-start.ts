import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { TestContext } from 'node:test';
import { readLeaseHistory, type DropletLease } from '../src/executor/droplet/lease.ts';
import { until, type FrameClient } from './harness.ts';
import { remoteWaitMs } from './remote-fixture.ts';

/** Successful demo setup has a durable delivery boundary before its frame reply.
 * Refusal tests still use request(), since they must never create a ready lease. */
export async function startDemo(t: TestContext, root: string, ui: FrameClient, frame: {
  epic: string; commit?: string; as?: { name: string; sessionId: string; shell: true };
}): ReturnType<FrameClient['request']> {
  const previous = new Set((await readLeaseHistory(root)).map(lease => lease.lease));
  const id = `demo-start-${randomUUID()}`;
  const wallBegan = Date.now();
  const began = performance.now();
  const observed: Record<string, number> = {};
  const result = () => ui.frames.find(f => f.type === 'result' && f.id === id);
  // Arm the durable observer before sending. In particular, an old ready lease
  // for this epic must not satisfy a second start after stop/restart.
  let lease: DropletLease | undefined;
  const ready = until(async () => {
    const reply = result();
    if (reply) {
      observed.reply ??= performance.now() - began;
      if (!reply.ok) return true;
    }
    lease = (await readLeaseHistory(root)).find(l => l.demo?.epic === frame.epic && !previous.has(l.lease));
    if (!lease) return false;
    observed.lease ??= performance.now() - began;
    if (lease.resource !== null) observed.provisioned ??= performance.now() - began;
    if (lease.execution?.delivered) observed.delivered ??= performance.now() - began;
    return lease.state === 'active' && lease.execution?.delivered === true && lease.demo?.ready === true;
  }, { what: `demo.start ${frame.epic}: new active, delivered, ready lease`, timeoutMs: remoteWaitMs() });
  ui.send({ type: 'demo.start', ...frame, id });
  try {
    await ready;
    const failed = result();
    if (failed) assert.equal(failed.ok, true, String(failed.error));
  } catch (error) {
    // Failure-only, bounded facts from the durable record; never dump credentials
    // or the lease's command plan. Release may already have changed its state.
    const latest = (await readLeaseHistory(root)).find(l => l.demo?.epic === frame.epic && !previous.has(l.lease));
    const stage = latest?.demo?.ready ? 'demo ready' : latest?.execution?.delivered ? 'delivery persisted'
      : latest?.snapshot ? 'snapshot persisted; image readiness unconfirmed'
      : latest?.resource !== null && latest?.resource !== undefined ? 'provider resource persisted'
      : latest ? 'lease persisted' : 'no lease persisted';
    t.diagnostic(`demo.start incomplete ${JSON.stringify({ epic: frame.epic, stage, state: latest?.state ?? null,
      observedMs: Object.fromEntries(Object.entries(observed).map(([key, value]) => [key, Math.round(value)])) })}`);
    throw error;
  }
  assert.ok(lease);
  observed.ready = performance.now() - began;
  // The client buffers result frames from connection time. Only reporting/reply
  // remains after the durable receipt; provisioning no longer spends this bound.
  const reply = await ui.waitFor(f => f.type === 'result' && f.id === id, remoteWaitMs(5_000));
  observed.reply ??= performance.now() - began;
  const started = reply as Awaited<ReturnType<FrameClient['request']>>;
  assert.equal(started.ok, true, started.error);
  assert.equal((started.value as { lease: string }).lease, lease.lease);
  assert.equal(lease.state, 'active');
  assert.equal(lease.execution?.delivered, true);
  assert.equal(lease.demo?.ready, true);
  if (process.env.CLAND_TEST_DEMO_START_TIMINGS) {
    t.diagnostic(`demo.start ${JSON.stringify({
      epic: frame.epic,
      // Observed boundaries are upper bounds sampled by the filesystem reader.
      observedMs: Object.fromEntries(Object.entries(observed).map(([key, value]) => [key, Math.round(value)])),
      // These timestamps come from the persisted lease, on the hub's clock.
      beforeLeaseMs: Date.parse(lease.created) >= wallBegan ? Date.parse(lease.created) - wallBegan : null,
      hostPreparationMs: lease.createStarted ? Date.parse(lease.createStarted) - Date.parse(lease.created) : null,
      providerCreateMs: lease.createStarted && lease.createFinished ? Date.parse(lease.createFinished) - Date.parse(lease.createStarted) : null,
    })}`);
  }
  return started;
}
