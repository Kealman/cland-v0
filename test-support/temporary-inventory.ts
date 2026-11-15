import { readdir, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';

/** Full name sets by default. Prefix-filtered inventories are explicitly scoped
 * evidence and cannot establish unrestricted preservation. Retain both snapshots. */
export async function temporaryInventory(roots = ['/tmp', tmpdir()], options: { prefixes?: readonly string[] } = {}): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};
  for (const root of roots) {
    const path = await realpath(root);
    result[path] = (await readdir(path)).filter(name => !options.prefixes || options.prefixes.some(prefix => name.startsWith(prefix))).sort();
  }
  return result;
}

export function inventoryDelta(before: Record<string,string[]>, after: Record<string,string[]>) {
  return Object.fromEntries([...new Set([...Object.keys(before), ...Object.keys(after)])].sort().map(root => {
    const previous = new Set(before[root] ?? []), current = new Set(after[root] ?? []);
    return [root, { added: [...current].filter(name => !previous.has(name)), removed: [...previous].filter(name => !current.has(name)) }];
  }));
}
