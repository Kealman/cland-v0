import { VERIFY_OCCASIONS, type VerifyOccasion } from './protocol.ts';
import type { SuiteSelection } from './suite-selection.ts';

/** The same admitted selection drives planning, executor transport and workers. */
export function occasionSelection(selection: SuiteSelection, occasion?: VerifyOccasion): SuiteSelection {
  return occasion ? { ...selection, soak: true, loadGate: true } : selection;
}

export function suiteTestEnv(selection?: SuiteSelection, base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env = { ...base };
  if (selection?.soak) env.CLAND_TEST_SOAK = '1';
  else delete env.CLAND_TEST_SOAK;
  return env;
}

/** CLI and MCP use the same role rule for integrated verification occasions. */
export function authorizeVerifyOccasion(role: string | null | undefined, occasion: VerifyOccasion): void {
  if (role !== 'coordinator' && !(role === 'qa' && occasion === VERIFY_OCCASIONS.epic)) {
    throw new Error('occasion requires the Coordinator, or QA with occasion epic');
  }
}
