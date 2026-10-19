import { VERSION } from '../version.ts';
import { Cancelled } from './prompter.ts';
import { project } from './steps/project.ts';
import { harnesses } from './steps/harnesses.ts';
import { logins } from './steps/logins.ts';
import { favourite } from './steps/favourite.ts';
import { trust } from './steps/trust.ts';
import { hub } from './steps/hub.ts';
import { aide } from './steps/aide.ts';
import type { SetupLine, SetupOptions, SetupStep, SetupVerdict } from './types.ts';

// Accounts joins before favourite; workbench hand-over follows this report.
const STEPS: readonly SetupStep[] = [project, harnesses, logins, favourite, trust, hub, aide];
export type SetupReport = {
  root: string;
  version: string;
  interactive: boolean;
  steps: SetupLine[];
  summary: Record<SetupVerdict, number>;
  next: 'cland setup' | 'cland';
};

/** Steps detect before offering an action; future action steps must re-detect to decide their result. */
export async function setup(options: SetupOptions): Promise<{ report: SetupReport; code: number }> {
  const lines: SetupLine[] = [];
  let cancelled = false;
  try {
    for (const step of STEPS) {
      const result = await step(options);
      lines.push(...result);
      if (step === project && result.some(line => line.verdict === 'fail')) break;
    }
  } catch (err) {
    if (!(err instanceof Cancelled)) throw err;
    cancelled = true;
  }
  const summary: SetupReport['summary'] = { ok: 0, done: 0, skip: 0, open: 0, fail: 0 };
  for (const line of lines) summary[line.verdict]++;
  const incomplete = cancelled || summary.open > 0 || summary.fail > 0;
  return { report: { root: options.root, version: VERSION, interactive: options.interactive, steps: lines, summary, next: incomplete ? 'cland setup' : 'cland' }, code: cancelled ? 130 : incomplete ? 1 : 0 };
}
