import { withoutExecutorCredentials } from '../../shared/executor-credentials.ts';
import { VERIFY_OCCASIONS, type VerifyOccasion } from './protocol.ts';
import type { SuiteSelection } from './suite-selection.ts';

/** The same admitted selection drives planning, executor transport and workers. */
export function occasionSelection(selection: SuiteSelection, occasion?: VerifyOccasion, batchTiers: NonNullable<SuiteSelection['tiers']> = ['T1', 'T3']): SuiteSelection {
  if (occasion === 'batch') {
    const { tests: _tests, nvimTests: _nvimTests, shard: _shard, ...full } = selection;
    return { ...full, mode: 'full', web: 'none', tiers: [...batchTiers], soak: batchTiers.includes('T4'), loadGate: true };
  }
  if (occasion === 'dev-t3') {
    const { tests: _tests, nvimTests: _nvimTests, shard: _shard, ...full } = selection;
    return { ...full, mode: 'full', tiers: ['T2', 'T3'], soak: false, loadGate: false };
  }
  return occasion ? { ...selection, soak: true, loadGate: true } : selection;
}

export function suiteTestEnv(selection?: SuiteSelection, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env = withoutExecutorCredentials(base);
  if (selection?.soak) env.CLAND_TEST_SOAK = '1';
  else delete env.CLAND_TEST_SOAK;
  return env;
}

/** CLI and MCP use the same role rule for integrated verification occasions. */
export function authorizeVerifyOccasion(role: string | null | undefined, occasion: VerifyOccasion): void {
  if (occasion === 'batch' || occasion === 'dev-t3') throw new Error(`${occasion} occasion is hub-owned`);
  if (role !== 'coordinator' && !(role === 'qa' && occasion === VERIFY_OCCASIONS.epic)) {
    throw new Error('occasion requires the Coordinator, or QA with occasion epic');
  }
}
