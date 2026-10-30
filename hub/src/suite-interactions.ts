import { importingTests } from './suite-import-graph.ts';
import { diagnosticTestFile, NVIM_SMOKE, type SuiteSelection } from './suite-selection.ts';
import { readTierAssignments } from './suite-shards.ts';

type Git = (...args: string[]) => Promise<string>;
const paths = (output: string) => output.split('\0').filter(Boolean);

export { importingTests, importingTestsFromSource } from './suite-import-graph.ts';

function add(selection: SuiteSelection, tests: string[], reason: string, tiers: ReadonlyMap<string, string>): SuiteSelection {
  if (!tests.length) return selection;
  const hub = tests.filter(file => file.startsWith('hub/'));
  const nvim = tests.filter(file => file.startsWith('nvim/'));
  return { ...selection, interactionTests: [...new Set([...selection.interactionTests ?? [], ...tests])].sort(),
    reason: `${selection.reason}; ${reason}: ${tests.join(', ')}`,
    files: [...new Set([...selection.files, ...tests])].sort(),
    ...(selection.mode === 'hub-selected' ? { tests: [...new Set([...selection.tests ?? [], ...hub])].sort() } : {}),
    ...(selection.nvimTests || nvim.length && selection.mode === 'hub-selected' && !selection.nvimFull ? { nvimTests: [...new Set([...selection.nvimTests ?? NVIM_SMOKE, ...nvim])].sort() } : {}),
    ...((selection.mode === 'nvim-only' && hub.length || selection.mode === 'web-only' && (hub.length || nvim.length)) ? { mode: 'full' as const } : {}),
    ...(tests.some(file => tiers.get(file) === 'Web') ? { web: 'all' as const } : {}),
    ...(selection.tiers && tests.some(file => tiers.get(file) === 'T2') ? { tiers: [...new Set([...selection.tiers, 'T2' as const])].sort() } : {}),
  };
}
function broad(selection: SuiteSelection, error: unknown): SuiteSelection {
  const { nvimTests: _nvimTests, tests: _tests, shard: _shard, durationCheck: _durationCheck, ...whole } = selection;
  return { ...whole, mode: 'full', nvimFull: true, web: 'all', tiers: ['T1', 'T2', 'T3', 'T4'], soak: true,
    reason: `${selection.reason}; interaction selection fallback: ${String(error)}` };
}

/** Compare the exact pinned member heads with the prepared candidate. Never subtract existing work. */
export async function batchInteractionSelection(cwd: string, selection: SuiteSelection, heads: readonly string[], git: Git, scan = importingTests, mode: 'report' | 'run' = 'report'): Promise<SuiteSelection> {
  const finish = (applied: SuiteSelection, files: string[] | null, phases: Array<'T2' | 'Web'>): SuiteSelection => {
    const batchInteraction = { mode, files, phases, reason: applied.reason };
    return mode === 'run' ? { ...applied, batchInteraction } : { ...selection, batchInteraction,
      reason: `${selection.reason}; batch interaction report only: ${applied.reason}` };
  };
  try {
    const changed = new Set<string>();
    for (const head of heads) for (const file of paths(await git('diff', '--name-only', '-z', '--no-renames', head, 'HEAD'))) changed.add(file);
    if (!changed.size) return finish(selection, [], []);
    const assignments = await readTierAssignments(cwd);
    if (!assignments) throw new Error('tier assignments unavailable');
    const tests: string[] = [];
    const reasons: string[] = [];
    const batchTests: NonNullable<SuiteSelection['batchTests']> = {};
    for (const tier of ['T2', 'Web'] as const) {
      const phase = [...assignments].filter(([, value]) => value === tier).map(([file]) => file);
      let selected: string[];
      let full = false;
      const uncertain: string[] = [];
      try {
        selected = await scan(cwd, [...changed], phase, (test, error) => {
          uncertain.push(test); reasons.push(`${test} fallback: ${String(error)}`);
        });
        selected = [...new Set([...selected, ...uncertain])].sort();
      } catch (error) { selected = phase; full = true; reasons.push(`${tier} phase fallback: ${String(error)}`); }
      tests.push(...selected);
      const alreadyFull = tier === 'T2' ? selection.tiers?.includes('T2') : selection.web === 'all';
      if (!full && !alreadyFull) batchTests[tier] = selected;
    }
    const added = tests.filter(file => assignments.get(file) === 'T2' ? !selection.tiers?.includes('T2') : selection.web !== 'all').sort();
    const applied = { ...add(selection, tests, `sibling-merge importers${reasons.length ? '; ' + reasons.join('; ') : ''}`, assignments), interactionTests: added, batchTests };
    const phases = (['T2', 'Web'] as const).filter(tier => added.some(file => assignments.get(file) === tier));
    return finish(applied, added, phases);

  } catch (error) {
    const { durationCheck: _durationCheck, shard: _shard, tests: _tests, nvimTests: _nvimTests, ...whole } = selection;
    return finish({ ...whole, mode: 'full', web: 'all', tiers: [...new Set([...selection.tiers ?? [], 'T2' as const])].sort(),
      reason: `${selection.reason}; T2/Web phase fallback: ${String(error)}` }, null, ['T2', 'Web']);
  }
}

/** First-parent merges retain landings hidden by the latest dev merge base. Bounded to 1000 merges. */
export async function taskInteractionSelection(cwd: string, selection: SuiteSelection, dev: string, git: Git): Promise<SuiteSelection> {
  try {
    const assignments = await readTierAssignments(cwd);
    if (!assignments) return selection;
    const merges = (await git('rev-list', '--first-parent', '--merges', '--max-count=1001', `${dev}..HEAD`)).trim().split('\n').filter(Boolean);
    if (merges.length > 1000) return broad(selection, 'more than 1000 task merges');
    const changed = new Set(selection.files);
    const landed = new Set<string>();
    for (const merge of merges) for (const file of paths(await git('diff', '--name-only', '-z', '--no-renames', `${merge}^1`, merge))) { changed.add(file); landed.add(file); }
    const tests = [...landed].filter(file => diagnosticTestFile(file) && assignments.has(file));
    if ([...changed].some(file => /(?:roles\.toml|roles\/|clauses|role-clause)/.test(file)) && assignments.has('hub/test/roles.test.ts')) tests.push('hub/test/roles.test.ts');
    if ([...changed].some(file => file.startsWith('web/src/areas/') || /web\/src\/.*[Aa]rea/.test(file)) && assignments.has('web/test/area-slots.test.ts')) tests.push('web/test/area-slots.test.ts');
    return add(selection, [...new Set(tests)].sort(), 'merged-landing tests and mapped guards', assignments);
  } catch (error) { return broad(selection, error); }
}
