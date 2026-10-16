// Read-only startup admission shared by targeted tests and package runners.
import { askHubFrame } from './cli/socket-client.ts';
import { hubDiscovery, readDiscovery } from './project.ts';

export async function assertTestAdmission(cwd = process.cwd(), env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (env.CLAND_TEST_IGNORE_COVER === '1') return;
  const discovery = readDiscovery(hubDiscovery(cwd, env));
  if (!discovery) return;
  // Send only identity, never the lease's filesystem paths or unrelated env.
  let lease: { pid: number; started: string; token: string } | undefined;
  try {
    const value = JSON.parse(env.CLAND_SUITE_LEASE ?? 'null');
    if (value && Number.isSafeInteger(value.pid) && value.pid > 0 && typeof value.started === 'string' && typeof value.token === 'string') lease = { pid: value.pid, started: value.started, token: value.token };
  } catch { /* A malformed lease is not an exemption. */ }
  try {
    await askHubFrame(discovery, { type: 'suite.slot', check: true, ...(lease ? { lease } : {}) }, 3000, env);
  } catch (error) {
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
