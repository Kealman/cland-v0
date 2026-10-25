// Startup admission shared by targeted tests and package runners; a refused
// authenticated session registers a hub-owned wake-up without reserving capacity.
import { askHubFrame, HubTimeout } from '../shared/socket-client.ts';
import { hubDiscovery, readDiscovery } from '../shared/project-discovery.ts';
import { realClock, type Clock } from '../shared/clock.ts';
import { availableParallelism, loadavg } from 'node:os';
import { AdmissionTimeout } from './admission-outcome.ts';

export async function assertTestAdmission(cwd = process.cwd(), env: NodeJS.ProcessEnv = process.env, options: { clock?: Clock; load?: number; parallelism?: number } = {}): Promise<void> {
  if (env.CLAND_TEST_IGNORE_COVER === '1') return;
  const discovery = readDiscovery(hubDiscovery(cwd, env));
  if (!discovery) return;
  // Send only identity, never the lease's filesystem paths or unrelated env.
  let lease: { pid: number; started: string; token: string } | undefined;
  try {
    const value = JSON.parse(env.CLAND_SUITE_LEASE ?? 'null');
    if (value && Number.isSafeInteger(value.pid) && value.pid > 0 && typeof value.started === 'string' && typeof value.token === 'string') lease = { pid: value.pid, started: value.started, token: value.token };
  } catch { /* A malformed lease is not an exemption. */ }
  // Give a busy hub at least 15 s, up to a bounded minute under CPU pressure.
  const pressure = (options.load ?? loadavg()[0]!) / Math.max(1, options.parallelism ?? availableParallelism());
  const timeoutMs = 15_000 * Math.max(1, Math.min(4, Math.ceil(pressure)));
  try {
    await askHubFrame(discovery, { type: 'suite.slot', check: true, ...(lease ? { lease } : {}) }, timeoutMs, env, options.clock ?? realClock);
  } catch (error) {
    if (error instanceof HubTimeout) throw new AdmissionTimeout(timeoutMs);
    if (!(error instanceof Error)) throw error;
    if (/^(?:forbidden: suite.slot|unknown request type "suite.slot")/.test(error.message)) {
      throw new Error(`test admission unavailable: the project hub lacks the read-only suite.slot/check capability; restart the hub with T-475 before running tests. ${error.message}`);
    }
    // An absent project hub permits standalone tests.
    // A connected hub must answer; silence or disconnect is unknown admission.
    const code = 'code' in error ? error.code : undefined;
    if (code === 'ENOENT' || code === 'ECONNREFUSED' || /^this hub serves no project for suites/.test(error.message)) return;
    throw error;
  }
}
