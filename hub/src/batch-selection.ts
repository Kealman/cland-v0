import { importingTests } from './suite-import-graph.ts';
import { readTierAssignments } from './suite-shards.ts';
import type { SuiteSelection } from './suite-selection.ts';

/** Conservative policy shared by admission and replay; T-1896 can shard its result. */
export const LIGHT_BATCH_POLICY = {
  fullAtWaiting: 3,
  baselineReceiptLimit: 32,
  baselineSummaryLimit: 256,
  productionPrefixes: ['hub/src/', 'hub/bin/', 'shared/'],
  verifierPrefixes: ['hub/test/', 'nvim/test/', 'web/test/', 'test-support/'],
  verifierFiles: ['package.json', 'package-lock.json', '.cland/config.toml', '.cland/roles.toml', '.cland/crew.toml'],
  packageConfig: /^(?:hub|nvim|web)\/package(?:-lock)?\.json$/,
} as const;

export function fullBatchReason(files: readonly string[], waiting: number): string | null {
  if (waiting >= LIGHT_BATCH_POLICY.fullAtWaiting) return 'at least three waiting members';
  const trigger = files.find(file => LIGHT_BATCH_POLICY.productionPrefixes.some(prefix => file.startsWith(prefix) && !file.endsWith('.test.ts'))
    || LIGHT_BATCH_POLICY.verifierPrefixes.some(prefix => file.startsWith(prefix) && !file.endsWith('.test.ts'))
    || LIGHT_BATCH_POLICY.verifierFiles.some(path => path === file) || LIGHT_BATCH_POLICY.packageConfig.test(file));
  return trigger ? `hub behaviour or verifier change: ${trigger}` : null;
}

export async function lightBatchSelection(cwd: string, selection: SuiteSelection, waiting: number, memberPaths: () => Promise<readonly string[]> = async () => []): Promise<SuiteSelection> {
  if (!selection.tiers?.includes('T3')) return selection;
  const full = fullBatchReason(selection.files, waiting) ?? (selection.fallback ? 'candidate delta unavailable' : null);
  if (full) return { ...selection, reason: `${selection.reason}; full T3: ${full}` };
  try {
    const changed = [...new Set([...selection.files, ...await memberPaths()])];
    const memberFull = fullBatchReason(changed, waiting);
    if (memberFull) return { ...selection, reason: `${selection.reason}; full T3: ${memberFull}` };
    const assignments = await readTierAssignments(cwd);
    if (!assignments) throw new Error('tier assignments unavailable');
    const uncertain: string[] = [];
    const files = await importingTests(cwd, changed, [...assignments].filter(([, tier]) => tier === 'T3').map(([file]) => file), file => uncertain.push(file));
    return { ...selection, batchTests: { ...selection.batchTests, T3: [...new Set([...files, ...uncertain])].sort() }, reason: `${selection.reason}; affected T3 importers (unknown graphs included)` };
  } catch (error) { return { ...selection, reason: `${selection.reason}; full T3 selection fallback: ${String(error)}` }; }
}
