// T0 static gate: inventory every test and source-scan all T1 files through packageShards.
// Small planner/lint permutations stay in suite-tiers.test.ts (T1).
import assert from 'node:assert/strict';
import { readFile, glob } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageShards, type TierManifest } from '../src/suite-shards.ts';
import { taskSuiteSelection, tierSuiteSelection } from '../src/suite-selection.ts';
import { readDurationManifest } from '../src/suite-durations.ts';

async function lintRepositoryTierPlan(): Promise<void> {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const tiers = JSON.parse(await readFile(join(root, 'hub/test/tiers.json'), 'utf8')) as TierManifest;
  // This guard checks phase placement, not Git provenance (duration-legacy covers that).
  const durations = await readDurationManifest(root);
  const legacyKeys = new Set(Object.entries(durations!.allow).filter(([, entry]) => entry.legacy).map(([key]) => key));
  const paths = [];
  for await (const path of glob(['hub/src/**/*.test.ts', 'hub/test/**/*.test.ts', 'nvim/test/**/*.test.ts', 'web/test/**/*.test.ts'], { cwd: root })) paths.push(path);
  assert.deepEqual(Object.keys(tiers.tests), paths.sort());
  // Retagged and added files follow today's manifest; removed files do not run.
  // T1 alone is hermetic; T2/T3/T4 retain the machine phase, and Neovim stays one package phase.
  const hub = Object.keys(tiers.tests).filter(path => path.startsWith('hub/'));
  const hermetic = (path: string) => { const value = tiers.tests[path]!; return (typeof value === 'string' ? value : value.tier) === 'T1'; };
  assert.deepEqual(await packageShards(root, 'full', undefined, { mode: 'full', files: [], reason: 'occasion inventory', soak: true }, { workers: 4, legacyKeys }), [
    { name: 'hub free', resource: 'free', workers: 1, targets: hub.filter(hermetic) },
    { name: 'hub machine', resource: 'machine', workers: 4, targets: hub.filter(path => !hermetic(path)) },
    ...(Object.keys(tiers.tests).some(path => path.startsWith('web/')) ? [{ name: 'Web', resource: 'machine', workers: 2, targets: Object.keys(tiers.tests).filter(path => path.startsWith('web/')) }] : []),
    { name: 'Neovim', resource: 'machine', workers: 4, targets: ['nvim/test/**/*.test.ts'] },
  ]);
  // Whole-repository command equivalence belongs to this T0 inventory guard;
  // T1 proves flag/selection/lock permutations against a small literal fixture.
  const task = taskSuiteSelection({ mode: 'full', files: [], reason: 'task fallback inventory' }, 't/T-717', 'auto', true);
  const before = await packageShards(root, task.mode, undefined, task, { workers: 4, legacyKeys });
  const after = [];
  for (const tier of ['T1', 'T2', 'Web'] as const) {
    const selection = tierSuiteSelection(task, tier);
    after.push(...await packageShards(root, selection.mode, undefined, selection, { workers: 4, legacyKeys }));
  }
  const membership = (phases: typeof before) => phases.flatMap(phase => phase.targets.map(file => [file, phase.resource, phase.workers] as const)).sort(([a], [b]) => a.localeCompare(b));
  assert.deepEqual(membership(after), membership(before), 'tier commands retain repository task files, resources and workers');

}

await lintRepositoryTierPlan();
console.log('repository tier plan lint: current files match declared phases');
