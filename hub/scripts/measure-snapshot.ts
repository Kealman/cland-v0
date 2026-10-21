// Read-only source copy, then all hub/tracker work occurs in a disposable root.
// node hub/scripts/measure-snapshot.ts /path/to/project/.cland/tasks
import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fixtureEnvironment } from '../../test-support/fixture-environment.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { createHubBase } from '../src/hub/server.ts';
import { composeSnapshot, snapshotFrames } from '../src/hub/snapshot.ts';
import { SNAPSHOT_LIMITS } from '../src/protocol.ts';
import { FakeClock } from '../test/fake-clock.ts';

if (process.argv.length !== 3) throw new Error('usage: node hub/scripts/measure-snapshot.ts <source-tasks-directory>');
const source = resolve(process.argv[2]!);
const root = await mkdtemp(join(tmpdir(), 'cland-snapshot-measure-'));
const env = fixtureEnvironment(root, process.env);
let tracker: Tracker | undefined;
let hub: ReturnType<typeof createHubBase> | undefined;
try {
  await mkdir(join(root, '.cland'), { recursive: true });
  await cp(source, join(root, '.cland/tasks'), { recursive: true, filter: path => !/\.(?:db|db-wal|db-shm)$/.test(path) });
  const clock = new FakeClock();
  tracker = new Tracker({ root, db: ':memory:', env, clock, git: async () => null, readBase: async () => null });
  tracker.rescan();
  hub = createHubBase({ secret: 'disposable-measurement', tracker, env, clock });
  const samples: Array<{ composeMs: number; framedMs: number }> = [];
  let values: ReturnType<typeof composeSnapshot>;
  let framed: ReturnType<typeof snapshotFrames>;
  for (let n = 0; n < 5; n++) {
    const started = performance.now();
    values = composeSnapshot({ core: hub.core, tracker, sessions: null, verification: null,
      registry: { registry: join(env.XDG_CONFIG_HOME!, 'cland/accounts.toml'), accounts: [] }, events: { rows: [], before: null, more: false } });
    const composed = performance.now();
    framed = snapshotFrames(values, 'measurement-epoch-00000000000000000000', 1);
    samples.push({ composeMs: composed - started, framedMs: performance.now() - started });
  }
  const domains = Object.entries(values!).map(([domain, value]) => {
    const bytes = Buffer.byteLength(JSON.stringify({ type: 'snapshot', epoch: 'measurement-epoch-00000000000000000000', seq: 1, domain, value }));
    const limit = SNAPSHOT_LIMITS[domain as keyof typeof SNAPSHOT_LIMITS];
    return { domain, bytes, limit, percent: Number((bytes / limit * 100).toFixed(2)) };
  });
  console.log(JSON.stringify({ platform: `${process.platform}/${process.arch}`, source, items: values!.items.items.length,
    note: 'Copied live tracker only; other domains are empty/default disposable hub state, not live-session measurements. Five warm-process samples; setup/copy and transport excluded.',
    totalBytes: domains.reduce((sum, d) => sum + d.bytes, 0), domains, samples, framed: 'frames' in framed! ? { frameCount: framed!.frames.length } : framed! }, null, 2));
} finally {
  await hub?.close();
  await tracker?.stop();
  await rm(root, { recursive: true, force: true });
}
