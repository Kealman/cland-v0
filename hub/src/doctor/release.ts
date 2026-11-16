import { basename, join } from 'node:path';
import { readText } from '../init/files.ts';
import { defaultConfig, parseConfig } from '../init/config.ts';
import { hubDiscovery, readDiscovery, pidAlive } from '../project.ts';
import { askHubFrame } from '../cli/socket-client.ts';
import type { HubStatus } from '../protocol.ts';
import { missingReleaseTool, releaseToolFix } from '../release-tools.ts';
import { ok, warn, type Check } from './report.ts';

/** The caller's PATH cannot establish which tools the running release hub sees. */
export async function checkReleaseTools(root: string, env: NodeJS.ProcessEnv): Promise<Check[]> {
  let config;
  try {
    const text = readText(join(root, '.cland/config.toml'));
    config = text === null ? defaultConfig(basename(root)) : parseConfig(text, basename(root), env);
  } catch { return []; } // config.toml's existing check owns parse errors.
  if (!config.release.webBundle) return [];
  const name = 'release gh';
  const discovery = readDiscovery(hubDiscovery(root, env));
  if (!discovery || (!discovery.remote && !pidAlive(discovery.pid))) return [warn(name, 'hub PATH lookup unknown: hub not running', 'cland hub start with gh on PATH')];
  try {
    const result = await askHubFrame(discovery, { type: 'hub.status', releaseTools: true }, 3000, env) as HubStatus;
    if (result.releaseTools?.gh === true) return [ok(name, "gh resolves on the hub's own PATH (auth and network not checked)")];
    if (result.releaseTools?.gh === false) return [warn(name, missingReleaseTool('gh'), releaseToolFix('gh'))];
  } catch { /* Unavailable and legacy hubs must not borrow the caller's lookup. */ }
  return [warn(name, 'hub PATH lookup unknown: running hub did not report release tools', 'restart the hub with the current cland and gh on PATH')];
}
