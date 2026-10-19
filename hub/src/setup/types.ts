import type { HarnessId } from '../doctor/ranges.ts';
import type { HarnessProbe } from '../doctor/toolchain.ts';
import type { Prompter } from './prompter.ts';

export type SetupVerdict = 'ok' | 'done' | 'skip' | 'open' | 'fail';
export type SetupLine = { name: string; verdict: SetupVerdict; detail: string; fix?: string };
export type SetupMachine = {
  projectExists(): Promise<boolean>;
  harness(id: HarnessId): Promise<HarnessProbe>;
  onPath(id: HarnessId): Promise<boolean>;
};

/** Every step receives the same policy. yes accepts harmless defaults only;
 * interactive=false forbids questions, writes, installs, sign-ins and launches.
 */
export type SetupOptions = {
  root: string;
  env: NodeJS.ProcessEnv;
  interactive: boolean;
  yes: boolean;
  prompter: Prompter;
  machine: SetupMachine;
};
export type SetupStep = (options: SetupOptions) => Promise<SetupLine[]>;
