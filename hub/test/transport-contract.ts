// Shared carrier contract: no SSH-specific assertions belong here.
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Transport } from '../src/transport/transport.ts';
import { parseTransportKind } from '../src/host/transport-kind.ts';
import { eventually } from './harness.ts';

export const TRANSPORT_ENDPOINTS = ['hub.sock', 'spoke.sock', 'git.sock', 'agent.sock'] as const;
export type TransportEndpoint = typeof TRANSPORT_ENDPOINTS[number];
export type ContractFixture = {
  transport: Transport;
  run: string;
  exchange(endpoint: TransportEndpoint): Promise<void>;
  drop(): Promise<void>;
  assertNoTcp(): Promise<void>;
};
export async function transportContract(t: TestContext, fixture: (t: TestContext) => Promise<ContractFixture>): Promise<void> {
  assert.deepEqual(TRANSPORT_ENDPOINTS, ['hub.sock', 'spoke.sock', 'git.sock', 'agent.sock']);
  const f = await fixture(t);
  assert.equal(parseTransportKind(f.transport.kind), f.transport.kind);
  const answers = async () => {
    for (const endpoint of TRANSPORT_ENDPOINTS) await f.exchange(endpoint);
  };
  await f.transport.start();
  await eventually('all four endpoints answer initially', async () => {
    if (f.transport.status().state !== 'up') return undefined;
    try { await answers(); return true; } catch { return undefined; }
  }, 8000);
  assert.equal((await lstat(f.run)).mode & 0o777, 0o700, 'agent-owned run directory is private');
  for (const endpoint of TRANSPORT_ENDPOINTS) {
    const path = join(f.run, endpoint);
    assert.ok(Buffer.byteLength(path) + 1 < 104, path);
    assert.equal((await lstat(path)).isSocket(), true, endpoint);
  }
  await f.assertNoTcp();
  await f.drop();
  await eventually('replacement carrier and all four endpoints answer', async () => {
    if (f.transport.status().reconnects < 1 || f.transport.status().state !== 'up') return undefined;
    try { await answers(); return true; } catch { return undefined; }
  }, 8000);
  await answers(); // Retain the final round-trip assertions after readiness.
  await f.assertNoTcp();
}
