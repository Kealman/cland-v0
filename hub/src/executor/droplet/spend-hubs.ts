import { join } from 'node:path';
import { readDiscovery } from '../../project.ts';
import { askHubFrame } from '../../cli/socket-client.ts';

/** A live authenticated response is the compatibility receipt, never a stale
 * discovery version or the existence of a project's directory. */
export type SpendHubStatus = { path: string; legacyRetirement?: number };

export async function registeredHubSpendStatus(project: string): Promise<SpendHubStatus> {
  const discovery = readDiscovery(join(project, '.cland/hub.json'));
  if (!discovery || discovery.root !== project) throw new Error('registered hub is absent or discovery does not match its project');
  // This is the hub's authenticated cross-project check, not the initiating
  // session's shell identity (which belongs only to its own project).
  const result = await askHubFrame(discovery, { type: 'executor.status' }, 3000, {}) as { spend?: { path?: unknown; legacyRetirement?: unknown } };
  if (typeof result.spend?.path !== 'string') throw new Error('registered hub did not report a spend path');
  return { path: result.spend.path, ...(typeof result.spend.legacyRetirement === 'number' ? { legacyRetirement: result.spend.legacyRetirement } : {}) };
}
