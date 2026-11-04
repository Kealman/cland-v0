import { homedir } from 'node:os';
import { join } from 'node:path';

export { hostClaudeConfigDirectory } from './host/agent/state-paths.ts';

/** Shared per-user state; retain the executor override's historical semantics. */
export const userHome = (env: NodeJS.ProcessEnv = process.env): string => env.HOME ?? homedir();
export const userStateDirectory = (env: NodeJS.ProcessEnv = process.env): string =>
  env.CLAND_EXECUTOR_STATE ?? join(env.XDG_STATE_HOME || join(userHome(env), '.local/state'), 'cland');
/** Compatibility location only: never create new state under .cland in HOME. */
export const legacySpendPath = (env: NodeJS.ProcessEnv = process.env): string | null =>
  env.CLAND_EXECUTOR_STATE !== undefined ? null : join(userHome(env), '.cland/executor/spend.json');
