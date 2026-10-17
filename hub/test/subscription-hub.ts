import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { ProcessTable } from '../src/adapters/processes.ts';
import { FAKE_FLAVOURS, fakeHarness, type FakeFlavour, type FakeHarness } from './fakes/harness.ts';
// T2 subscription fixtures retain their clock across explicit stop/serve on the same root.
import type { TestContext } from 'node:test';
import { FakeClock } from './fake-clock.ts';
import { projectHub } from './harness.ts';

const clocks = new Map<string, FakeClock>();
const running = new Map<string, Awaited<ReturnType<typeof projectHub>>>();
export async function componentHub(t: TestContext, root: string, env: Record<string, string> = {}, options: Omit<NonNullable<Parameters<typeof projectHub>[3]>, 'clock'> & { clock?: FakeClock } = {}) {
  let clock = clocks.get(root);
  if (!clock) {
    clock = options.clock ?? new FakeClock();
    clocks.set(root, clock);
    t.after(() => { clocks.delete(root); running.delete(root); });
  }
  // The simulated external harness survives a hub stop, just as a native conversation does.
  // Seed only persisted running identities; terminal rows still exercise real reconciliation.
  await mkdir(join(root, '.cland'), { recursive: true });
  const table = new ProcessTable(join(root, '.cland', 'hub.db'));
  const survivors = table.all().filter(p => p.status === 'running');
  table.close();
  const fakes: Partial<Record<FakeFlavour, FakeHarness>> = {};
  const adapters = FAKE_FLAVOURS.map(flavour => (host: import('../src/adapters/contract.ts').AdapterHost, clock: import('../src/hub/clock.ts').Clock) => {
    const fake = fakeHarness(flavour, { host, clock });
    for (const process of survivors.filter(p => p.harness === flavour)) fake.watch(process);
    fakes[flavour] = fake;
    return fake;
  });
  const served = await projectHub(t, root, env, { probes: 'fake', clock, adapters, ...options });
  const hub = { ...served, fakes };
  running.set(root, hub);
  return { ...hub, clock };
}
export async function stopComponentHub(root: string): Promise<void> {
  const hub = running.get(root);
  if (!hub) throw new Error('no component hub to stop');
  await hub.stop();
  running.delete(root);
}

/** Give a simulated harness its real protocol peer; state remains explicitly test-driven. */
export async function launchedSpoke(t: TestContext, root: string, process: { name: string; sessionId: string; role?: string | null }) {
  const { inProcessSpoke } = await import('./harness.ts');
  const peer = await inProcessSpoke(t, { discover: true, cwd: root, name: process.name, sessionId: process.sessionId, assignRole: false, ...(process.role ? { role: process.role } : {}) });
  await peer.waitForPresence([process.name]);
  return peer;
}
