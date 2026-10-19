// Injected facts and storage seams shared by the plan/stage component migrations.
import type { TestContext } from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { Tracker, type Actor } from '../src/tracker/tracker.ts';
import { parseItem, serializeItem } from '../src/tracker/item.ts';
import { TaskMerges } from '../src/hub/merge.ts';
import { fixedRoles } from '../src/roles/config.ts';
import { Store } from '../src/hub/store.ts';
import { Journal } from '../src/hub/journal.ts';
import { createSocketEdge } from '../src/hub/socket.ts';
import { FakeClock } from './fake-clock.ts';
import { startHub, TEST_SECRET, until } from './harness.ts';
import { onCleanup, beforeDirectories } from './process-cleanup.ts';
import type { Git } from '../src/tracker/verdict-git.ts';
import type { SuiteJob } from '../src/hub/suites.ts';
import type { QaPolicy } from '../src/tracker/plan.ts';

export const human: Actor = { id: 'human', name: 'human', role: null };

/** Explicit graph/path facts; Git's native implementation is covered by its contracts. */
export class PlanGit {
  head = 'a'.repeat(40);
  readonly commits = new Map<string, { parent: string | null; files: string[]; item: string }>([[this.head, { parent: null, files: [], item: '' }]]);
  readonly branches = new Map<string, string>();
  #next = 1;
  commit(files: string[], item = '', onDev = true): string {
    const head = (++this.#next).toString(16).padStart(40, '0');
    this.commits.set(head, { parent: this.head, files, item });
    if (onDev) this.head = head;
    return head;
  }
  chain(head: string): string[] {
    const chain: string[] = [];
    for (let current: string | null = head; current; current = this.commits.get(current)?.parent ?? null) chain.push(current);
    return chain;
  }
  read: Git = async args => {
    const op = args[0];
    if (op === 'for-each-ref') return [`${this.head} refs/heads/dev`, ...[...this.branches].map(([branch, sha]) => `${sha} refs/heads/${branch}`)].join('\n');
    if (op === 'rev-parse') {
      const ref = args.at(-1)!.replace(/\^\{commit\}$/, '').replace(/^refs\/heads\//, '');
      return ref === 'dev' ? this.head : this.branches.get(ref) ?? (this.commits.has(ref) ? ref : null);
    }
    if (op === 'merge-base') return args[1] === '--is-ancestor' ? (this.chain(args[3]!).includes(args[2]!) ? '' : null) : this.head;
    if (op === 'diff') return '';
    if (op === 'log') return this.chain(this.head).map(sha => `${sha}\0${this.commits.get(sha)!.item}\0`).join('\n');
    if (op === 'rev-list') {
      const [base, tip] = args[2]!.split('..');
      const chain = this.chain(tip!);
      return chain.slice(0, chain.indexOf(base!)).reverse().join('\n');
    }
    if (op === 'diff-tree') {
      const sha = args.at(-2)!;
      return `${sha}\0${this.commits.get(sha)!.files.join('\0')}\0`;
    }
    throw new Error(`unexpected Git fact: ${args.join(' ')}`);
  };
}

export function writeBarrier(t: TestContext) {
  let armed = false, hasEntered = false, released = Promise.withResolvers<void>();
  onCleanup(t, () => released.resolve());
  return {
    arm: async () => { armed = true; hasEntered = false; released = Promise.withResolvers<void>(); },
    entered: () => until(() => hasEntered, { what: 'tracker temporary write entered injected barrier' }),
    release: async () => released.resolve(),
    wait: async () => { if (armed) { armed = false; hasEntered = true; await released.promise; } },
  };
}

/** The Tracker-only seams (stageTree and writeGate) are not exposed by projectHub.
 * Compose the same store, dispatcher and socket edges here rather than use a daemon. */
export async function planStageHub(t: TestContext, root: string, facts = new PlanGit(), options: {
  memory?: boolean; locks?: string[]; watch?: ConstructorParameters<typeof Tracker>[0]['watch']; approval?: boolean; levels?: string[] | undefined; qaDefault?: QaPolicy; gate?: ReturnType<typeof writeBarrier> | undefined; settleBeforeHub?: (tracker: Tracker, signal: AbortSignal) => Promise<void>;
} = {}) {
  const owners: Array<() => unknown> = [];
  const startupFinished = Promise.withResolvers<void>();
  let closing = false, stopped: Promise<void> | undefined;
  const checkStarting = () => { if (closing) throw new Error('plan fixture startup cancelled'); };
  const stop = () => {
    closing = true;
    return stopped ??= (async () => {
      // Allocating awaits must finish and register ownership before directories can go.
      await startupFinished.promise;
      const errors: unknown[] = [];
      for (const close of owners.reverse()) {
        try { await close(); } catch (error) { errors.push(error); }
      }
      if (errors.length) throw new AggregateError(errors, 'plan fixture cleanup failed');
    })();
  };
  beforeDirectories(t, stop);
  const aborted = () => { void stop().catch(() => {}); };
  t.signal.addEventListener('abort', aborted, { once: true });
  owners.push(() => t.signal.removeEventListener('abort', aborted));
  if (t.signal.aborted) aborted();
  try {
    const db = options.memory ? ':memory:' : join(root, '.cland/hub.db');
    await mkdir(join(root, '.cland'), { recursive: true });
    checkStarting();
    const clock = new FakeClock();
    const journal = new Journal(join(root, '.cland/journal.jsonl'));
    owners.push(() => journal.close());
    const tracker = new Tracker({ root, db, clock, openDatabase: path => {
      const database = new DatabaseSync(path);
      owners.push(() => { if (database.isOpen) database.close(); });
      return database;
    }, ...(options.watch ? { watch: options.watch } : {}), planApproval: options.approval ? 'human' : 'none', git: facts.read, readBase: async () => 'dev', stageTree: async () => 'f'.repeat(40),
      ...(options.levels ? { levels: options.levels } : {}), ...(options.qaDefault ? { qaDefault: options.qaDefault } : {}),
      ...(options.gate ? { writeGate: options.gate.wait } : {}),
      log: entry => journal.write({ ...entry, event: String(entry.event) }),
      scheduleTips: read => { void read(); return { poke: () => { void read(); }, stop() {} }; },
    });
    owners.push(() => tracker.stop());
    tracker.start();
    // The callback may still write to the tracker or root after cancellation.
    // Its completion, not permission to finish, precedes every resource drain.
    await options.settleBeforeHub?.(tracker, t.signal);
    checkStarting();
    const storeDatabase = new DatabaseSync(db);
    owners.push(() => { if (storeDatabase.isOpen) storeDatabase.close(); });
    const store = new Store(db, () => storeDatabase);
    const hub = await startHub({ tracker, store, clock, journal, root, verification: { compatibility: { holder: async () => null, occupied: async () => false }, ...(options.locks ? { locks: options.locks } : {}) }, roles: fixedRoles(), hasTerritory: async () => false,
      git: facts.read, log: entry => journal.write({ ...entry, event: String(entry.event) }),
      control: { status: () => ({ root, pid: process.pid, port: 0, socket: '', version: 'test', startedAt: '', uptimeMs: 0 }), stop() {} },
    });
    owners.push(() => hub.close());
    checkStarting();
    const socket = join(root, 'plan-stage.sock');
    const edge = await createSocketEdge({ path: socket, dispatcher: hub.dispatcher });
    owners.push(() => edge.close());
    checkStarting();
    const discovery = { root, socket, port: hub.port, secret: TEST_SECRET, pid: process.pid, version: 'test' };
    await writeFile(join(root, '.cland/hub.json'), JSON.stringify(discovery));
    checkStarting();
    // Exercise the production merge policy; inject only territory publication and cleanup.
    const merges = new TaskMerges(tracker, {
      serial: async work => work(),
      prune: async () => ({ removed: [], failed: [] }),
      pruneMerged: async () => ({ removed: [], failed: [] }),
    }, entry => journal.write({ ...entry, event: String(entry.event) }), undefined, {},
    async (_root, work) => work(), undefined,
    async (_root, branch, message, _resumed, prepared, authorize) => {
      const tip = facts.branches.get(branch)!;
      await message(tip, 'dev', facts.head, []);
      authorize?.();
      const commit = facts.commit([]);
      prepared?.({ commit, base: 'dev', tip });
      return { commit, base: 'dev' };
    });
    owners.push(() => merges.stop());
    const merge = async (id: string) => {
      try {
        const result = await merges.merge(id, human, work => work());
        if ('followUp' in result) throw new Error(JSON.stringify(result.followUp));
        return { ok: true, error: undefined, code: undefined };
      } catch (error) {
        return { ok: false, error: (error as Error).message, code: (error as { code?: string }).code };
      }
    };
    const branch = async (id: string) => {
      const name = `t/${id}`;
      facts.branches.set(name, facts.head);
      const view = await tracker.viewAsync(id);
      const path = join(root, view.path);
      const item = parseItem(await readFile(path, 'utf8'), view.file);
      item.fm.branch = name;
      await writeFile(path, serializeItem(item));
      await tracker.viewAsync(id);
      await tracker.refreshFreshness();
    };
    return { discovery, tracker, hub, facts, branch, merge, stop, clock, flush: () => journal.flush() };
  } catch (error) {
    startupFinished.resolve();
    try { await stop(); }
    catch (cleanup) { throw new AggregateError([error, cleanup], 'plan fixture startup and cleanup failed'); }
    throw error;
  } finally { startupFinished.resolve(); }
}

export async function seedPlanStageCover(root: string, head: string) {
  const store = new Store(join(root, '.cland/hub.db'));
  const base: SuiteJob = { id: `mac-${head}`, mode: 'all', cwd: root, topic: 'general', to: [], actor: null, head, tree: 'f'.repeat(40), branch: 'dev', integrated: true,
    executor: 'local', occasion: 'stage', selection: { mode: 'full', reason: 'historical stage cover', files: [], soak: true, loadGate: true },
    log: '', result: '', gate: '', pid: null, started: null, outcome: { code: 0, cause: '' }, artifact: null, reported: true, error: null,
    state: 'finished', finished: '2026-10-16T12:00:00Z', platform: { os: 'darwin', arch: 'arm64', release: 'fixture', node: process.version, nvim: 'fixture' } };
  const linux: SuiteJob = { ...base, id: `linux-${head}`, executor: 'droplet', platform: { ...base.platform!, os: 'linux' } };
  linux.shards = [1, 2].map(index => ({ ...linux, id: `${linux.id}-${index}`, parentRun: linux.id }));
  try { store.setMeta('suite-jobs', JSON.stringify([base, linux])); }
  finally { store.close(); }
}
