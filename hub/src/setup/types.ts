import type { SetupHub } from './hub.ts';
import type { projectKind } from './project-kind.ts';
import type { HarnessId } from '../doctor/ranges.ts';
import type { HarnessProbe } from '../doctor/toolchain.ts';
import type { Prompter } from './prompter.ts';
import type { TerminalOutput } from './terminal.ts';

export type SetupVerdict = 'ok' | 'done' | 'skip' | 'open' | 'fail';
export type SetupLine = { name: string; verdict: SetupVerdict; detail: string; fix?: string };
export type SetupMachine = {
  projectExists(): Promise<boolean>;
  requiredHarnesses(): Promise<readonly string[]>;
  harness(id: HarnessId, fresh?: boolean): Promise<HarnessProbe>;
  onPath(id: HarnessId): Promise<boolean>;
  run(command: string, output?: TerminalOutput): Promise<number>;
  read(path: 'config.toml' | 'roles.toml'): Promise<string | null>;
  write(path: 'config.toml' | 'roles.toml', text: string, expected: string): Promise<void>;
};

/** Every step receives the same policy. yes accepts harmless defaults only;
 * Without a terminal, installers need --install, trust needs --yes, and favourite needs --harness or --yes.
 */
export type SetupOptions = {
  root: string;
  /** The absolute spelling passed to the CLI, retained for Codex remote attach trust. */
  rootSpelling?: string;
  env: NodeJS.ProcessEnv;
  interactive: boolean;
  yes: boolean;
  harness?: HarnessId;
  prompter: Prompter;
  machine: SetupMachine;
  install?: HarnessId;
  noAide?: boolean;
  hub?: SetupHub;
  kind?: typeof projectKind;
  narrate?: (text: string) => void;
  json?: boolean;
};
export type SetupStep = (options: SetupOptions) => Promise<SetupLine[]>;
