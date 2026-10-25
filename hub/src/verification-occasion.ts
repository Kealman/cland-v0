import { withoutExecutorCredentials } from '../../shared/executor-credentials.ts';
import type { VerifyOccasion } from './verification-policy.ts';
export { authorizeVerifyOccasion, authorizeVerifyMode, VerifyAllReserved } from './verification-policy.ts';
import type { SuiteSelection } from './suite-selection.ts';

/** The same admitted selection drives planning, executor transport and workers. */
export function occasionSelection(selection: SuiteSelection, occasion?: VerifyOccasion, batchTiers: NonNullable<SuiteSelection['tiers']> = ['T1', 'T3']): SuiteSelection {
  if (occasion) {
    const { durationCheck: _durationCheck, ...whole } = selection;
    selection = whole;
  }
  if (occasion === 'batch') {
    const { tests: _tests, nvimTests: _nvimTests, shard: _shard, ...full } = selection;
    return { ...full, mode: 'full', web: selection.files.some(path => path.startsWith('web/')) ? 'all' : 'none', tiers: [...batchTiers], soak: batchTiers.includes('T4'), loadGate: true };
  }
  if (occasion === 'dev-t3') {
    const { tests: _tests, nvimTests: _nvimTests, shard: _shard, ...full } = selection;
    return { ...full, mode: 'full', tiers: ['T2', 'T3'], soak: false, loadGate: false };
  }
  return occasion ? { ...selection, soak: true, loadGate: true } : selection;
}

export function suiteTestEnv(selection?: SuiteSelection, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env = withoutExecutorCredentials(base);
  if (selection?.soak || selection?.durationCheck && selection.tiers?.includes('T4')) env.CLAND_TEST_SOAK = '1';
  else delete env.CLAND_TEST_SOAK;
  return env;
}
