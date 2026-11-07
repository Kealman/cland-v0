/** Native observations used only for listener-census diagnostics. */
export type ListenerProbes = {
  identity(): Promise<string | null>;
  listeners(): Promise<string>;
  description(): Promise<{ parent: number; command: string } | null>;
};

export async function listenerFailure(pid: number, sources: string[], probes: ListenerProbes): Promise<string | null> {
  // A native birth brackets both the socket rows and the command snapshot. A
  // numeric PID alone cannot bind metadata after an exit and PID reuse.
  const before = await probes.identity();
  const listeners = await probes.listeners();
  if (!listeners) return null;
  const afterListeners = await probes.identity();
  let row: Awaited<ReturnType<ListenerProbes['description']>> = null;
  let descriptionError: string | undefined;
  try { row = await probes.description(); }
  catch (error) { descriptionError = ` (ps failed: ${(error as NodeJS.ErrnoException).code ?? 'unknown'})`; }
  const afterDescription = await probes.identity();
  const stable = before !== null && before === afterListeners && before === afterDescription;
  const nativeStart = stable ? before : 'unavailable (changed or unreadable native birth)';
  const description = stable && row ? `parent=${row.parent} command=${row.command}` : `parent=unavailable command=unavailable${stable ? descriptionError ?? ' (process metadata missing)' : ''}`;
  return `pid=${pid} source=${sources.join(', ')} nativeStart=${nativeStart} ${description}\n${listeners}`;
}


/** Read-only census scope; socket holders alone never establish fixture ownership.
 * Roots are live launches validated against their launch-written native birth.
 * The in-process fixture worker is added separately, without its unrelated children.
 */
export function fixtureTreePids(roots: readonly number[], rows: readonly {pid: number; parent: number}[]): Set<number> {
  const children = new Map<number, number[]>();
  const present = new Set(rows.map(row => row.pid));
  for (const row of rows) {
    const siblings = children.get(row.parent) ?? [];
    siblings.push(row.pid); children.set(row.parent, siblings);
  }
  const owned = new Set(roots.filter(pid => present.has(pid)));
  for (const pid of owned) for (const child of children.get(pid) ?? []) owned.add(child);
  return owned;
}
