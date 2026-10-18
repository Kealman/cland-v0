// Native lifecycle ownership is available only to real-hub/T3 callers.
import { isolateVerification } from '../../hub/test/harness.ts';
import { ownProcess, ownDirectory, beforeDirectories } from '../../hub/test/process-cleanup.ts';
import { ensureAccountFixture } from '../../hub/test/account-fixture-env.ts';
import { createClient } from './client.ts';
export { nvimOrSkip, centreOf, clock, COLUMNS, LINES, INIT_LUA, type Client } from './client.ts';
export const startClient = async (...args: Parameters<typeof createClient>) => {
  await ensureAccountFixture();
  return createClient(args[0], args[1], args[2], args[3], args[4], { isolateVerification, ownProcess, ownDirectory, beforeDirectories });
};
