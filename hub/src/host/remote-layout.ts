import { dirname, join } from 'node:path';
import { VERSION } from '../version.ts';
import type { HostLaunchLayout } from './host.ts';
export const REMOTE_HOST_DIRECTORY = '.cland-host';
/** The ready step delivers this version directory; values may be supplied by host configuration. */
export function remoteHostLayout(home: string, overrides: Partial<HostLaunchLayout> = {}): HostLaunchLayout {
  const directory = join(home,REMOTE_HOST_DIRECTORY), code = join(directory,'code',VERSION), run = join(directory,'run');
  return Object.freeze({modDir:join(code,'hub/mod/cland'),node:'node',cli:join(code,'hub/bin/cland.ts'),spoke:join(code,'hub/bin/cland-spoke.ts'),discoveryFile:join(run,'hub.json'),runDirectory:run,logDirectory:join(directory,'log'),...overrides});
}

/** CLI is <code>/hub/bin/cland.ts; custom layouts retain that installed-tree convention. */
export function remoteCodeDirectory(layout: HostLaunchLayout): string { return dirname(dirname(dirname(layout.cli))); }
export function remoteSupervisor(layout: HostLaunchLayout): string { return join(remoteCodeDirectory(layout), 'hub/src/host/agent/supervisor.sh'); }
