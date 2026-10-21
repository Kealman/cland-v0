// T2 support: tracker and merge policy use explicit Git facts; no repository or worker process.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { Tracker, type ItemView } from '../src/tracker/tracker.ts';
import { TaskMerges } from '../src/hub/merge.ts';
import type { TaskWorktrees } from '../src/hub/worktrees.ts';
import type { Git } from '../src/tracker/verdict-git.ts';
import { Store } from '../src/hub/store.ts';
import { fixedRoles } from '../src/roles/config.ts';
import { squashTask, territoryGitAsync, TerritoryGitError } from '../src/territory.ts';
import { connectWsUi, inProcessSpoke, startHub, tempProject } from './harness.ts';
import { manualTips } from './freshness-harness.ts';
import { FakeClock } from './fake-clock.ts';
import { beforeDirectories, onCleanup } from './process-cleanup.ts';

export const human = { id: 'human', name: 'human', role: null, human: true };
export const resumed = <T>(work: () => T): T => work();
const sha = (n: number) => n.toString(16).padStart(40, '0');

export class MergeFacts {
  readonly heads = new Map([['dev', sha(1)]]);
  readonly files = new Map<string, string>();
  readonly landings: Array<{ commit: string; parent: string; message: string; files: string[] }> = [];
  readonly worktrees = new Set<string>();
  cleanupFailure: string | undefined;
  beforeSurface: (() => Promise<void>) | undefined;
  readonly git: Git = async args => {
    if (args[0] === 'for-each-ref') return [...this.heads].map(([b, h]) => `${h} refs/heads/${b}`).join('\n');
    if (args[0] === 'rev-parse' && args[1] === '--is-bare-repository') return 'false';
    if (args[0] === 'rev-parse') {
      const ref = args.at(-1)!.replace(/\^\{commit\}$/, '').replace(/^refs\/heads\//, '');
      return this.heads.get(ref) ?? this.landings.find(l => `${l.commit}^` === ref)?.parent ?? (/^[a-f0-9]{40}$/.test(ref) ? ref : null);
    }
    if (args[0] === 'show-ref') return '';
    if (args[0] === 'merge-base') return args.includes('--is-ancestor') ? '' : sha(1);
    if (args[0] === 'diff') return 'task patch';
    if (args[0] === 'patch-id') return 'stable-patch';
    if (args[0] === 'symbolic-ref') return 'dev';
    if (args[0] === 'show') return this.landings.find(l => l.commit === args.at(-1))?.message ?? null;
    if (args[0] === 'log') {
      if (args.includes('--raw')) return this.landings.map(l => `${l.commit}\0${l.message.split('\n').filter(line => line.startsWith('Item: ')).map(line => line.slice(6)).join('\n')}\0\0${l.files.map(file => `\n:100644 100644 ${'a'.repeat(40)} ${'b'.repeat(40)} M\0${file}\0`).join('')}`).join('\0');
      return this.landings.map(l => `${l.commit}\0${l.message.split('\n').filter(line => line.startsWith('Item: ')).map(line => line.slice(6)).join('\n')}\0`).join('\n');
    }
    if (args[0] === 'diff-tree') {
      const landing = this.landings.find(l => args.includes(l.commit));
      assert.ok(landing, `unknown surface commit ${args}`);
      return `${landing.commit}\0${landing.files.join('\0')}\0`;
    }
    throw new Error(`unexpected injected Git read: ${args.join(' ')}`);
  };
  readonly territory: typeof territoryGitAsync = async (_cwd, args) => {
    if (args[0] === 'log') await this.beforeSurface?.();
    const value = await this.git(args);
    if (value === null) throw new TerritoryGitError('missing fixture fact', '', 1);
    return value;
  };
  readonly squash: typeof squashTask = async (_root, branch, message, _resumed, prepared) => {
    const tip = this.heads.get(branch)!;
    const parent = this.heads.get('dev')!;
    const files = [this.files.get(branch)!];
    const text = await message(tip, 'dev', parent, files);
    // squashTask checks the message once before and once after commit preparation.
    const latest = await message(tip, 'dev', parent, files);
    assert.equal(latest, text);
    const commit = sha(100 + this.landings.length);
    prepared?.({ commit, base: 'dev', tip });
    this.landings.push({ commit, parent, message: text, files });
    this.heads.set('dev', commit);
    return { commit, base: 'dev' };
  };
}

export async function componentProject(t: TestContext, options: { start?: typeof startHub; facts?: MergeFacts; git?: (git: Git) => Git; sink?: (record: Record<string, unknown>) => void } = {}) {
  const root = await tempProject(t, 'cland-merge-component-');
  const facts = options.facts ?? new MergeFacts(), clock = new FakeClock(), tips = manualTips();
  const db = join(root, '.cland/hub.db');
  const databases: DatabaseSync[] = [];
  const openDatabase = (path: string) => { const database = new DatabaseSync(path); databases.push(database); return database; };
  let ownedTracker: Tracker | undefined, ownedMerges: TaskMerges | undefined;
  let opening: ReturnType<typeof startHub> | undefined;
  let hubClosed = false, stopping: Promise<void> | undefined;
  const stop = (): Promise<void> => stopping ??= (async () => {
    const errors: unknown[] = [];
    const attempt = async (work: () => unknown) => { try { await work(); } catch (error) { errors.push(error); } };
    // A cancelled test can reach teardown while startup still owns a pending socket acquisition.
    const hub = await opening?.catch(() => undefined);
    await attempt(() => ownedMerges?.stop());
    if (hub && !hubClosed) await attempt(async () => { await hub.close(); hubClosed = true; });
    await attempt(() => ownedTracker?.stop());
    // Also own handles acquired by a constructor that threw before returning its object.
    for (const database of [...databases].reverse()) await attempt(() => { if (database.isOpen) database.close(); });
    if (errors.length === 1) throw errors[0];
    if (errors.length) throw new AggregateError(errors, 'component fixture cleanup failed');
  })().catch(error => { stopping = undefined; throw error; });
  beforeDirectories(t, stop);
  try {
    const tracker = ownedTracker = new Tracker({ root, db, clock, openDatabase, git: options.git?.(facts.git) ?? facts.git, readBase: async () => 'dev', scheduleTips: tips.scheduleTips });
    tracker.start();
    const records: Array<Record<string, unknown>> = [];
    const log = (record: Record<string, unknown>) => { options.sink?.(record); records.push(record); };
    const store = new Store(db, openDatabase), storeDatabase = databases.at(-1)!;
    const closeStore = store.close.bind(store);
    // Hub close owns this same handle. A failed close can be retried after fallback drainage.
    store.close = () => { if (storeDatabase.isOpen) closeStore(); };
    opening = (options.start ?? startHub)({ tracker, clock, store, roles: fixedRoles(), log, git: facts.git, hasTerritory: async () => false });
    const hub = await opening;
    if (t.signal.aborted) throw t.signal.reason;
    const worktrees: Pick<TaskWorktrees, 'serial' | 'prune' | 'pruneMerged'> = {
      serial: (() => { let tail: Promise<unknown> = Promise.resolve(); return <T>(run: () => Promise<T>) => { const result = tail.then(run); tail = result.catch(() => {}); return result; }; })(),
      prune: async () => ({ removed: [], failed: [] }),
      pruneMerged: async id => {
        if (facts.cleanupFailure) return { removed: [], failed: [{ item: id, error: facts.cleanupFailure }] };
        facts.worktrees.delete(id);
        const branch = tracker.view(id).branch;
        if (branch) facts.heads.delete(branch);
        return { removed: [], failed: [] };
      },
    };
    const merges = ownedMerges = new TaskMerges(tracker, worktrees, log, undefined, undefined, async (_root, run) => run(), undefined, facts.squash, facts.territory);
    const ui = await connectWsUi(t, hub);
    const rev = await inProcessSpoke(t, { hub, cwd: root, name: 'rev', sessionId: 'component-rev', role: 'reviewer' });
    onCleanup(t, () => rev.close());
    assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'reviewer' })).ok, true);
    async function ticket(parent?: string, file = 'README.md', title = `Change ${file}`): Promise<ItemView> {
      const branch = `t/${facts.files.size + 1}`;
      facts.heads.set(branch, sha(10 + facts.files.size)); facts.files.set(branch, file);
      const item = await tracker.create(human, { title, branch, ...(parent ? { parent } : {}) });
      await tracker.claim(human, item.id);
      facts.worktrees.add(item.id);
      await tips.refresh();
      return tracker.view(item.id);
    }
    const merge = (item: ItemView, override: string | undefined = 'fixture: exercise lane hold independently of verdict gate') => merges.merge(item.id, human, resumed, override);
    return { root, tracker, facts, clock, tips, hub, ui, rev, ticket, merge, merges, records, stop };
  } catch (error) {
    try { await stop(); }
    catch (cleanup) { throw new AggregateError([error, cleanup], 'component fixture startup failed'); }
    throw error;
  }
}
