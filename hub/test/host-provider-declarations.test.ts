// T1: pure provider declaration and billing policy; no I/O or native processes.
import test, { type TestContext } from 'node:test';
import { hostProviderContract } from './host-provider-contract.ts';
import type { HostProvider } from '../src/host/provider/provider.ts';
import assert from 'node:assert/strict';
import { declareHostProvider, earliestStop, validateHostProviderDeclarations, type HostProviderDeclarationInput } from '../src/host/provider/declarations.ts';

const input = (): HostProviderDeclarationInput => ({
  prices: { small: { livePerHour: 0.1, idleComputePerHour: 0.02 } },
  stoppedBills: false, billingGranularityMs: 1000, billingMinimumMs: 60_000,
  tokenConfinement: 'account', apiRequestsPerMinute: 17, machineLimit: 5,
  architectures: ['x86_64', 'arm64'], extraAddressPerHour: 0.01,
});
test('declarations reject missing fields, negative prices and misaligned minimums', () => {
  const good = declareHostProvider(input());
  assert.doesNotThrow(() => validateHostProviderDeclarations(good));
  for (const key of Object.keys(good)) {
    const bad = { ...good } as Record<string, unknown>; delete bad[key];
    assert.throws(() => validateHostProviderDeclarations(bad), /invalid host provider declaration/);
  }
  for (const patch of [
    { prices: {} }, { prices: { small: { livePerHour: -1, idleComputePerHour: 0 } } },
    { prices: { small: { livePerHour: 1, idleComputePerHour: -1 } } },
    { billingMinimumMs: 60_001 }, { billingGranularityMs: 0 },
    { apiRequestsPerMinute: 0 }, { machineLimit: 1.5 }, { architectures: [] },
    { architectures: ['mips'] }, { tokenConfinement: 'unknown' },
    { tokenConfinement: ['account'] }, { stoppedBills: 'true' }, { extraAddressPerHour: -1 },
    { extraAddressPerHour: Infinity },
  ]) assert.throws(() => declareHostProvider({ ...input(), ...patch } as HostProviderDeclarationInput), /invalid host provider declaration/);
});

test('earliestStop respects both the created billing minimum and idle duration', () => {
  const declarations = declareHostProvider(input());
  assert.equal(earliestStop({ created: 100_000, idleSince: 110_000, idleStopMs: 1000, declarations }), 160_000);
  assert.equal(earliestStop({ created: 100_000, idleSince: 155_000, idleStopMs: 20_000, declarations }), 175_000);
  assert.equal(earliestStop({ created: 100_000, idleSince: 160_000, idleStopMs: 0, declarations }), 160_000);
  assert.throws(() => earliestStop({ created: NaN, idleSince: 0, idleStopMs: 0, declarations }));
  assert.throws(() => earliestStop({ created: 100, idleSince: 0, idleStopMs: 0, declarations }));
  assert.throws(() => earliestStop({ created: 0, idleSince: 0, idleStopMs: -1, declarations }));
});

test('reusable contract rejects providers missing each declaration and invalid billing', async t => {
  const good = declareHostProvider(input());
  const candidates: unknown[] = [undefined, { ...good, billingMinimumMs: 1001 },
    { ...good, prices: { small: { livePerHour: -1, idleComputePerHour: 0, idlePerHour: 0.01 } } }];
  for (const key of Object.keys(good)) {
    const bad = { ...good } as Record<string, unknown>; delete bad[key]; candidates.push(bad);
  }
  // Run the actual registered declaration case; lifecycle cases retain their
  // normal fake-provider coverage in host-provider-fake.test.ts.
  async function check(declarations: unknown) {
    let declarationCase: ((t: TestContext) => Promise<void>) | undefined;
    hostProviderContract('candidate', async () => ({
      provider: { declarations } as HostProvider, ready: async () => {},
    }), (name, run) => { if (name.includes('declares sane')) declarationCase = run; });
    assert.ok(declarationCase);
    await declarationCase(t);
  }
  await check(good);
  for (const bad of candidates) await assert.rejects(check(bad), /invalid host provider declaration/);
});
