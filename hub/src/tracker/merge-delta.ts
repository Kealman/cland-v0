// Advisory only: immutable Git facts never supply Reviewer provenance or freshness.
import { refusedOverridePaths } from '../merge-override.ts';
import { importingTestsFromSource } from '../suite-import-graph.ts';
import type { Git } from './verdict-git.ts';

export type MergeDelta = {
  reviewed: string; head: string; dev: string; mergeBase: string;
  patchIdCurrent?: boolean;
  mode: 'report'; rule: 'conservative-runtime-coupling-v1';
  result: 'disjoint' | 'overlapping';
  branchPaths: string[]; devPaths: string[]; overlap: string[];
  dependency: { status: 'known'; importers: string[] } | { status: 'unknown'; reason: string };
};

/** Only an exact two-parent merge of the reviewed head and an integration ancestor qualifies. */
export async function assessMergeDelta(git: Git, reviewed: string, head: string, baseTip: string): Promise<MergeDelta | null> {
  const parents = (await git(['show', '-s', '--format=%P', head]))?.split(' ');
  if (parents?.length !== 2 || parents[0] !== reviewed) return null;
  const dev = parents[1]!;
  if (await git(['merge-base', '--is-ancestor', dev, baseTip]) === null) return null;
  const mergeBase = await git(['merge-base', reviewed, dev]);
  if (!mergeBase) return null;
  const merged = await git(['merge-tree', '--write-tree', reviewed, dev]);
  const tree = await git(['rev-parse', `${head}^{tree}`]);
  if (!merged || merged !== tree) return null; // conflicts or edits made during resolution are not a clean delta
  const paths = async (tip: string) => {
    const out = await git(['diff', '--name-only', '--no-renames', '-z', mergeBase, tip, '--']);
    if (out === null) throw new Error('delta path census unavailable');
    const files = out.split('\0').filter(Boolean).sort();
    if (files.length > 2000 || Buffer.byteLength(out) > 128 * 1024) throw new Error('delta path census budget exceeded');
    return files;
  };
  const branchPaths = await paths(reviewed);
  const devPaths = await paths(dev);
  const overlap = branchPaths.filter(path => devPaths.includes(path));
  let dependency: MergeDelta['dependency'];
  try {
    let reads = 0, bytes = 0;
    const entries = branchPaths.filter(path => /\.[cm]?[jt]sx?$/.test(path));
    const importers = await importingTestsFromSource(devPaths, entries, async path => {
      if (++reads > 256) throw new Error('native object read budget exceeded');
      const source = await git(['show', `${head}:${path}`]);
      bytes += Buffer.byteLength(source ?? '');
      if (bytes > 8 * 1024 * 1024) throw new Error('native object byte budget exceeded');
      return source === null ? undefined : source;
    });
    dependency = { status: 'known', importers };
  } catch {
    // Native stderr/source content must never leak through an advisory record.
    dependency = { status: 'unknown', reason: 'import graph incomplete or budget exceeded' };
  }
  const coupled = refusedOverridePaths([...branchPaths, ...devPaths]).length > 0;
  return { reviewed, head, dev, mergeBase, mode: 'report', rule: 'conservative-runtime-coupling-v1',
    result: overlap.length || coupled || dependency.status === 'unknown' || dependency.importers.length ? 'overlapping' : 'disjoint',
    branchPaths, devPaths, overlap, dependency };
}

export const deltaComment = (delta: MergeDelta): string => `Merge-delta assessment (report-only)\n${JSON.stringify(delta)}\nReviewer merge-delta verdict remains required. Disjoint paths alone do not prove behavioral independence.`;
