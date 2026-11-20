import type { SuiteSelection } from './suite-selection.ts';

/** Command completion does not establish whole-file coverage for a masked plan. */
export function wholeSuiteSelection(selection: SuiteSelection | undefined): selection is SuiteSelection {
  return Boolean(selection?.mode === 'full' && !selection.tests && !selection.nvimTests
    && !selection.shard && !selection.durationCheck && !Object.keys(selection.batchTests ?? {}).length);
}

export function tierTestMask(selection: SuiteSelection | undefined, tier: string): readonly string[] | undefined {
  return tier === 'T2' || tier === 'T3' || tier === 'Web' ? selection?.batchTests?.[tier] : undefined;
}
