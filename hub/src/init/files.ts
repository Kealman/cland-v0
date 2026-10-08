// What provisioning writes with: a file is written only when its bytes would change (so `cland init` run twice
// changes nothing, mtimes included), and every step reports what it did to one path.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';

/**
 * What one step did to one path: `created` and `updated` are cland's writes, `unchanged` a managed part already
 * current, `kept` something of the user's left alone (with the reason), `removed` a managed part cland no longer ships.
 */
export type Action = 'created' | 'updated' | 'unchanged' | 'kept' | 'removed';
export type Change = { path: string; action: Action; note?: string };

/** Collects the changes of one run, paths relative to the project root. */
export class Report {
  readonly root: string;
  readonly changes: Change[] = [];
  constructor(root: string) {
    this.root = root;
  }
  add(path: string, action: Action, note?: string): void {
    this.changes.push({ path: relative(this.root, path) || '.', action, ...(note ? { note } : {}) });
  }
}

export function readText(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/** Write `text` unless the file already holds exactly that; reports created, updated or unchanged. */
export function writeIfChanged(report: Report, path: string, text: string, current: string | null = readText(path)): void {
  if (current === text) {
    report.add(path, 'unchanged');
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  report.add(path, current === null ? 'created' : 'updated');
}

/** Whether a whole file is cland's: it carries the mark (in its first lines, where every managed file puts it). */
export const isManagedFile = (text: string): boolean => text.split('\n').slice(0, 3).some((l) => /managed by cland\b/.test(l));
