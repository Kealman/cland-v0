// T2 client boundary: the documented headless client, recorded frames, no hub runtime.
import { createClient } from './client.ts';
export { nvimOrSkip, centreOf, clock, COLUMNS, LINES, INIT_LUA, type Client } from './client.ts';
export { tempProject, eventually, ownDirectory } from './fixture.ts';
export const startClient = (...args: Parameters<typeof createClient>) => createClient(...args);
