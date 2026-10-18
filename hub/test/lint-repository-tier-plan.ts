// T0 static gate: inventory every test and source-scan all T1 files through packageShards.
// Small planner/lint permutations stay in suite-tiers.test.ts (T1).
import assert from 'node:assert/strict';
import { readFile, glob } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageShards, type TierManifest } from '../src/suite-shards.ts';
import { readDurationManifest } from '../src/suite-durations.ts';

async function lintRepositoryTierPlan(): Promise<void> {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const tiers = JSON.parse(await readFile(join(root, 'hub/test/tiers.json'), 'utf8')) as TierManifest;
  // This guard checks phase placement, not Git provenance (duration-legacy covers that).
  const durations = await readDurationManifest(root);
  const legacyKeys = new Set(Object.entries(durations!.allow).filter(([, entry]) => entry.legacy).map(([key]) => key));
  const paths = [];
  for await (const path of glob(['hub/src/**/*.test.ts', 'hub/test/**/*.test.ts', 'nvim/test/**/*.test.ts'], { cwd: root })) paths.push(path);
  assert.deepEqual(Object.keys(tiers.tests), paths.sort());
  // Retagged and added files follow today's manifest; removed files do not run.
  // T1 alone is hermetic; T2/T3/T4 retain the machine phase, and Neovim stays one package phase.
  const hub = Object.keys(tiers.tests).filter(path => path.startsWith('hub/'));
  const hermetic = (path: string) => { const value = tiers.tests[path]!; return (typeof value === 'string' ? value : value.tier) === 'T1'; };
  assert.deepEqual(await packageShards(root, 'full', undefined, undefined, { workers: 4, legacyKeys }), [
    { name: 'hub free', resource: 'free', workers: 1, targets: hub.filter(hermetic) },
    { name: 'hub machine', resource: 'machine', workers: 4, targets: hub.filter(path => !hermetic(path)) },
    { name: 'Neovim', resource: 'machine', workers: 4, targets: ['nvim/test/**/*.test.ts'] },
  ]);
}

await lintRepositoryTierPlan();
console.log('repository tier plan lint: current files match declared phases');
