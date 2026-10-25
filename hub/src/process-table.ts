// One ps dialect boundary for production inspection and test process cleanup.
export type SystemProcess = { pid: number; parent: number; group: number; started: string; identity?: string | null; identityError?: string; state: string; command: string };

/** POSIX selection/output options; repeated -w preserves the entire final command column. */
export function processTableArgs(pids?: number[]): string[] {
  return ['-ww', ...(pids ? ['-p', pids.join(',')] : ['-e']), '-o', 'pid=,ppid=,pgid=,lstart=,stat=,command='];
}

/** Both dialects print lstart in this shape; normalize it exactly as lock.parseStarted does. */
export function parseProcessTable(stdout: string): SystemProcess[] {
  return stdout.split('\n').flatMap(line => {
    const m = /^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+\s+\S+\s+\d+\s+\S+\s+\d+)\s+(\S+)\s+(.+)$/.exec(line);
    return m && !/^[ZX]/.test(m[5]!) ? [{ pid: Number(m[1]), parent: Number(m[2]), group: Number(m[3]), started: m[4]!.replace(/\s+/g, ' '), state: m[5]!, command: m[6]! }] : [];
  });
}

/** Keep an exited ancestor when dropping it would hide a listed surviving branch.
 * The retained row grants no birth proof; callers must refuse unknown ancestry.
 */
export function retainProcessAncestry(rows: SystemProcess[], exited: ReadonlySet<number>): SystemProcess[] {
  const parents = new Map(rows.map(row => [row.pid, row.parent]));
  const retained = new Set(rows.filter(row => !exited.has(row.pid)).map(row => row.pid));
  // Set iteration also visits newly added ancestors, at most once per PID.
  for (const pid of retained) {
    const parent = parents.get(pid);
    if (parent !== undefined && parents.has(parent)) retained.add(parent);
  }
  return rows.filter(row => retained.has(row.pid));
}

/** ps flattens argv: accept only the unambiguous CLI shape emitted by the mod.
 * Whitespace/quotes in paths or unknown options cannot authorize a doctor's signal.
 */
export function bridgeHubFile(command: string): string | null {
  const match = /^(?:\S*\/)?node\s+(?:\S*\/)?cland\.ts\s+hook\s+bridge\s+--session\s+[^\s'"`]+(?:\s+--launch\s+[^\s'"`]+)?\s+--hub-file\s+(\/[^\s'"`]+\/\.cland\/hub\.json)$/.exec(command);
  return match?.[1] ?? null;
}
