import type { SuiteSelection } from './suite-selection.ts';

/** The suite's shell lines, shared by local, host-gate and droplet execution. */
export function verificationCommands(job: { mode: string; selection?: SuiteSelection }, check = 'npm run typecheck'): { check: string; test: string } {
  return { check, test: job.selection?.mode === 'full' ? 'npm test' : job.mode === 'hub' ? 'npm test --workspace hub' : job.mode === 'nvim' ? 'npm run test:nvim' : 'npm test' };
}
