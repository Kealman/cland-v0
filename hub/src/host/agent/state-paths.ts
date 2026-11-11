import { join, resolve } from 'node:path';

/** Host agent-owned Claude account root; resolve only the admitted host environments. */
export const hostClaudeConfigDirectory = (commandEnv: NodeJS.ProcessEnv, agentEnv: NodeJS.ProcessEnv): string =>
  resolve(commandEnv.CLAUDE_CONFIG_DIR || join(commandEnv.HOME || agentEnv.HOME || '', '.claude'));

/** Mounted login path only; never reads database contents. */
export const mountedOpenCodeDatabase = (mount: string) => join(mount, 'opencode.db');
