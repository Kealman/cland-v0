// Rank migration rules; the executable supplies its CLI transport and report sink.
type Item = { id: string; rank: number; parent: string | null; labels: string[] };

export async function migrateHighRank(task: <T>(...args: string[]) => Promise<T>, report: (json: string) => void): Promise<void> {
  const { items } = await task<{ items: Item[] }>('list');
  const high = items.filter(item => item.labels.includes('high'));
  const groups = new Map<string | null, string[]>();
  for (const item of high) groups.set(item.parent, [...(groups.get(item.parent) ?? []), item.id]);
  const multiple = [...groups].filter(([, ids]) => ids.length > 1);
  if (multiple.length) throw new Error(`multiple high items under the same parent: ${multiple.map(([parent, ids]) => `${parent ?? 'no parent'}: ${ids.join(', ')}`).join('; ')}; nothing was changed`);
  const moved: Array<{ id: string; parent: string | null; from: number; to: number; changed: string[] }> = [];
  const retired: string[] = [];
  try {
    for (const old of high) {
      // Singleton groups have no order to lose. A failed label removal can safely retry from tracker state.
      if (items.find(item => item.parent === old.parent)?.id !== old.id) {
        const { item, changed } = await task<{ item: Item; changed: string[] }>('rank', old.id, '--top');
        if (changed.length) moved.push({ id: old.id, parent: item.parent, from: old.rank, to: item.rank, changed });
      }
      await task('edit', old.id, '--remove-label', 'high');
      retired.push(old.id);
    }
  } finally {
    // Preserve the committed-prefix report even when a later label removal fails.
    report(`${JSON.stringify({ moved, retired })}\n`);
  }
}

