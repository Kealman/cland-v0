import type { TestContext } from 'node:test';
import { join } from 'node:path';
import { Tracker, type TrackerFiles } from '../src/tracker/tracker.ts';
import { territoryGitAsync } from '../src/territory.ts';
import { fixedRoles } from '../src/roles/config.ts';
import { connectWsUi, startHub, tempProject } from './harness.ts';
import { copyPreparedProject } from './prepared-project.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { onCleanup } from './process-cleanup.ts';
import { ownedTracker } from './owned-tracker.ts';

type Owner = { adoptRoot(root: string): void; requireClose(close: () => Promise<void>): void };
type Options = { prepare?: typeof copyPreparedProject; openDatabase?: ConstructorParameters<typeof Tracker>[0]['openDatabase'] };

export async function territoryHub(t: TestContext, log?: (entry: Record<string, unknown>) => void, files?: TrackerFiles, owner?: Owner, options: Options = {}) {
  let tracker: Tracker | undefined, hub: Awaited<ReturnType<typeof startHub>> | undefined;
  owner?.requireClose(async () => { await hub?.close(); await tracker?.stop(); });
  const root = await tempProject(t, 'cland-territory-native-');
  owner?.adoptRoot(root);
  const env = fixtureEnvironment(root, process.env);
  const git = (...args: string[]) => territoryGitAsync(root, args, false, undefined, env);
  await (options.prepare ?? copyPreparedProject)(root, 'native-territory');
  const trackerOptions = { root, db: join(root, '.cland', 'hub.db'), env, ...(files ? { files } : {}), ...(options.openDatabase ? { openDatabase: options.openDatabase } : {}) };
  tracker = owner ? ownedTracker(owner, trackerOptions) : new Tracker(trackerOptions);
  hub = await startHub({ tracker, env, roles: fixedRoles(), ...(log ? { log } : {}) });
  onCleanup(t, () => hub!.close());
  onCleanup(t, () => tracker!.stop());
  const ui = await connectWsUi(t, hub);
  return { root, tracker, ui, git, hub, env };
}
