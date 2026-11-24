import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parseItem, serializeItem } from '../src/tracker/item.ts';
import { TrackerIndex } from '../src/tracker/index-db.ts';
import { seedTransaction } from './seed-transaction.ts';
import { ownedDatabases } from './owned-tracker.ts';
import { withCleanupFailure } from '../src/cleanup-failure.ts';
import type { Git } from '../src/tracker/verdict-git.ts';
import type { TipSchedule } from '../src/tracker/freshness.ts';

/** Synthetic only: fifty epic trees, 1,600 branches, and ten moving tips. */
export async function tipChurnFixture(root: string, owner: Parameters<typeof ownedDatabases>[0], open?: (path: string) => import('node:sqlite').DatabaseSync) {
  await mkdir(join(root, '.cland/tasks'), {recursive: true});
  const dev = 'a'.repeat(40);
  let generation = 1;
  let refresh: (() => Promise<void>) | undefined;
  const at = new Date().toISOString();
  // Seed the public durable index before startup. This case measures tip refresh,
  // not 1,600 independent status migrations and cold per-item announcements.
  const db = join(root, '.cland/hub.db');
  const connection = ownedDatabases(owner)(db, open);
  let index: TrackerIndex | undefined;
  try {
    const writer = index = new TrackerIndex(db, ['release', 'epic', 'task', 'question', 'spec', 'map', 'category'], () => connection);
    let writes: Promise<void>[] = [];
    await seedTransaction(connection, async () => {
      try {
        for (let n = 1; n <= 1650; n++) {
          const epic = n <= 50, id = `${epic ? 'E' : 'T'}-${n}`;
          const item = parseItem(`---\nid: ${id}\nkind: ${epic ? 'epic' : 'task'}\ntitle: Synthetic ${n}\n` +
            (epic ? '' : `status: backlog\nupdated: ${at}\nparent: E-${1 + (n - 51) % 50}\nbranch: t/fixture-${n - 51}\n`) +
            `---\n## Summary\n\nSynthetic tracker oracle.\n\n## ${epic ? 'Definition of done' : 'Acceptance criteria'}\n- [ ] C1. Fixture criterion\n` +
            (epic ? `  - verified: qa [qa] · run demo-${id} · ${at} · commit ${dev}\n` : ''));
          if (epic) item.comments.push({author: 'qa', at, text: 'Synthetic demo receipt.',
            verdict: {verdict: 'qa', result: 'clear', by: 'qa', run: `demo-${id}`, commit: dev}});
          const file = `${id}-fixture.md`, text = serializeItem(item);
          writer.put(item, {file, hash: createHash('sha256').update(text).digest('hex'), source: 'hand', indexedAt: Date.parse(at)});
          writes.push(writeFile(join(root, '.cland/tasks', file), text));
          if (writes.length === 16) { await Promise.all(writes); writes = []; }
        }
        await Promise.all(writes);
      } finally {
        // A rejected write still joins its other batch writers before root cleanup.
        await Promise.allSettled(writes);
      }
    });
  } catch (error) {
    // The constructor owns failure cleanup before an index is returned.
    try { index?.close(); }
    catch (cleanup) { throw withCleanupFailure(error, cleanup); }
    throw error;
  }
  index.close();
  const git: Git = async args => {
    // projectHub reads configuration provenance separately from branch tips.
    // This synthetic fixture has no committed configuration; other logs still refuse.
    const configCommit = ['log', '-1', '--format=%H', '--', '.cland/config.toml'];
    if (args.length === configCommit.length && configCommit.every((part, n) => args[n] === part)) return null;
    if (args[0] !== 'for-each-ref') throw new Error(`unexpected fake Git operation: ${args[0]}`);
    return `${dev} refs/heads/dev\n` + Array.from({length: 1600}, (_, n) =>
      `${(n < 10 ? generation : 1).toString(16).padStart(40, '0')} refs/heads/t/fixture-${n}`).join('\n');
  };
  const scheduleTips: TipSchedule = read => {
    refresh = read;
    return {poke() {}, stop() { refresh = undefined; }};
  };
  return {db, git, scheduleTips, readBase: async () => 'dev',
    refresh: async () => { if (!refresh) throw new Error('tip scheduler is not running'); await refresh(); },
    move: () => { generation++; },
  };
}
