import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { HostLaunchLayout, HostLaunchLayoutInput } from './host.ts';

/** Installed Claude plugin; local launches retain the historical path verbatim. */
export const LOCAL_MOD_DIR = fileURLToPath(new URL('../../mod/cland', import.meta.url));

export function localHostLayout(input: HostLaunchLayoutInput): HostLaunchLayout {
  return Object.freeze({...input, modDir: LOCAL_MOD_DIR,
    runDirectory: join(dirname(input.discoveryFile), 'run'),
    logDirectory: join(dirname(input.discoveryFile), 'log')});
}
