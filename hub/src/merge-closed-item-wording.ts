import { normalizeId } from './tracker/item.ts';
import { closedItemFindings, isWordingDocument } from './closed-item-wording.ts';
import { MergeError, MergeLintReadError } from './merge.ts';

/** Supplement T0's existing closed set with projected members. Read one document
 * at a time, retaining no tracker history and never rewriting the candidate. */
export async function requireMergeClosedItemWording(tree: string, closing: string[], git: (args: string[]) => Promise<string>): Promise<void> {
  let failures: string[];
  try {
    const paths = (await git(['ls-tree', '-r', '--name-only', '-z', tree])).split('\0').filter(Boolean);
    const closed = new Set(closing.map(id => normalizeId(id)));
    failures = [];
    for (const path of paths) {
      if (!isWordingDocument(path)) continue;
      failures.push(...closedItemFindings([{ path, text: await git(['show', `${tree}:${path}`]) }], closed));
    }
  } catch (error) {
    throw new MergeLintReadError(`closed-item wording read failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (failures.length) throw new MergeError('merge-test-lint', failures.join('\n'));
}
