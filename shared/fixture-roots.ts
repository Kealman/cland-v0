import { isAbsolute, resolve } from 'node:path';

/** Written after all overlays by the sealed fixture builder, never from job data. */
export const FIXTURE_OWNED_ROOT = 'CLAND_TEST_OWNED_ROOT';

/** Older fixture environments grant only the project root. Never infer ownership
 * from HOME's parent or the machine's generic temporary directory. */
export function fixtureOwnedRoots(project: string, env: NodeJS.ProcessEnv): string[] {
  const scratch = env[FIXTURE_OWNED_ROOT];
  return [...new Set([resolve(project), ...(scratch && isAbsolute(scratch) && resolve(scratch) !== '/' ? [resolve(scratch)] : [])])];
}
