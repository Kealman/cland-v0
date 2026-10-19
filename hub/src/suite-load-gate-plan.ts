import type { SuiteSelection } from './suite-selection.ts';

/** Occasion receipts pin known identities; task runs retain the duration baseline. */
export function loadGateRepetitions(identity: string, selection: SuiteSelection | undefined, durationTests: Record<string, number>): 0 | 5 {
  if (selection?.loadGateFiles && !selection.loadGateFiles.includes(identity.split('::')[0]!)) return 0;
  const known = selection?.loadGateBaseline;
  return (known ? known.tests.includes(identity) : Object.hasOwn(durationTests, identity)) ? 0 : 5;
}
