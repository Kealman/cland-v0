// T3: external writer conflict, hub-unavailable CLI and watcher-fallback process regressions.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CONCURRENT_MS } from '../src/tracker/tracker.ts';
import { PROTOCOL_VERSION } from '../src/protocol.ts';
import { taskWriteGate } from './tracker-write-gate.ts';
import { reindexedAfter } from './tracker-reindex.ts';
import { cland, flushProjectLogs, connectSocket, sleep, nativeProjectHub as projectHub, tempProject, type CliResult } from './harness.ts';

type Summary = { id: string; title: string; state: string; status?: string; kind: string; labels: string[]; assignee: string | null; claim: { session: string; role: string | null } | null };
type View = Summary & {
  path: string;
  body: string;
  parent: string | null;
  blocked_by: string[];
  topic: string | null;
  branch: string | null;
  comments: Array<{ author: string; at: string; text: string; verdict?: { verdict: string; result: string; by: string; run: string } }>;
  verdicts: Array<{ verdict: string; result: string; by: string; run: string }>;
};

const ok = (r: CliResult): CliResult => {
  assert.equal(r.code, 0, `exit ${r.code}\nstdout: ${r.stdout}\nstderr: ${r.stderr}`);
  return r;
};
const json = async <T>(root: string, ...args: string[]): Promise<T> => JSON.parse(ok(await cland(root, 'task', ...args, '--json')).stdout) as T;
const tasksDir = (root: string) => join(root, '.cland', 'tasks');
const hubLog = async (t: TestContext, root: string) => {
  await flushProjectLogs(t, root);
  return (await readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8')).split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l) as Record<string, unknown>);
};

/** Poll until `check` stops throwing, or fail with its last error after `ms`. */
async function eventually(ms: number, check: () => Promise<void>): Promise<number> {
  const start = Date.now();
  let last: unknown;
  while (Date.now() - start < ms) {
    try {
      await check();
      return Date.now() - start;
    } catch (err) {
      last = err;
      await sleep(25);
    }
  }
  throw last;
}

// Native watcher completion belongs at T3; deterministic debounce coverage is in tracker-summary.test.ts.
test('a hand edit of an item file is re-indexed before its CLI projections are checked', async (t) => {
  const root = await tempProject(t);
  await projectHub(t, root);
  ok(await cland(root, 'task', 'create', '--size', 'M', 'Original title', '--label', 'a'));
  const file = join(tasksDir(root), 'T-1-original-title.md');
  const text = await readFile(file, 'utf8');
  await reindexedAfter(t, root, file, () => writeFile(file,
    text.replace('title: Original title', 'title: Edited by hand').replace('state: open', 'state: closed').replace('  - a', '  - b')));

  const items = (await json<{ items: Summary[] }>(root, 'list', '--state', 'closed', '--label', 'b')).items;
  assert.deepEqual(items.map((i) => [i.id, i.title]), [['T-1', 'Edited by hand']]);
  assert.deepEqual((await json<{ items: Summary[] }>(root, 'list', '--label', 'a')).items, []);

  // a file removed by hand leaves the index
  await writeFile(join(tasksDir(root), 'T-2-second.md'), '---\nid: T-2\ntitle: Second\n---\n');
  await eventually(10_000, async () => assert.equal((await json<{ items: Summary[] }>(root, 'list')).items.length, 2));
  await rm(join(tasksDir(root), 'T-2-second.md'));
  await eventually(10_000, async () => assert.deepEqual((await json<{ items: Summary[] }>(root, 'list')).items.map((i) => i.id), ['T-1']));
});

test('a hub write and a hand edit at the same time: the last writer wins and the hub logs it', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  ok(await cland(root, 'task', 'create', '--size', 'M', 'Contested'));
  const file = join(tasksDir(root), 'T-1-contested.md');

  // the hand edit lands right after the hub's write: the hand's content is the file and the index
  ok(await cland(root, 'task', 'comment', 'T-1', 'from the hub'));
  const handText = (await readFile(file, 'utf8')).replace('title: Contested', 'title: Hand wins');
  await writeFile(file, handText);
  await eventually(1000, async () => assert.equal((await json<{ items: Summary[] }>(root, 'list')).items[0]?.title, 'Hand wins'));
  assert.equal(await readFile(file, 'utf8'), handText);
  await eventually(1000, async () => assert.ok((await hubLog(t, root)).some((e) => e.event === 'task-conflict' && e.id === 'T-1' && e.winner === 'hand')));

  // the hub's write lands right after a hand edit (before the watcher saw it): the hub's write is the
  // file, made on top of what the hand wrote, and the index agrees
  // (over a socket already open: a CLI process takes longer to start than the watcher's debounce)
  await sleep(1.05 * CONCURRENT_MS); // Expiry: leave the previous write conflict window before staging the next race.
  const s = await connectSocket(discovery.socket);
  t.after(() => s.close());
  s.send({ type: 'hello', protocol: PROTOCOL_VERSION, secret: discovery.secret, client: 'test' });
  assert.equal((await s.next()).type, 'welcome');
  assert.equal((await s.next()).type, 'remote.state');
  await writeFile(file, (await readFile(file, 'utf8')).replace('title: Hand wins', 'title: Hand again'));
  s.send({ type: 'task.edit', id: 'e1', item: 'T-1', add_labels: ['hub-was-last'] });
  assert.equal((await s.next()).ok, true);
  const final = await readFile(file, 'utf8');
  assert.match(final, /title: Hand again/);
  assert.match(final, /- hub-was-last/);
  const view = await json<{ item: View }>(root, 'view', 'T-1');
  assert.equal(view.item.title, 'Hand again');
  assert.deepEqual(view.item.labels, ['hub-was-last']);
  await sleep(300);
  assert.equal(await readFile(file, 'utf8'), final, 'nothing rewrote the file after the hub');
  const conflicts = (await hubLog(t, root)).filter((e) => e.event === 'task-conflict' && e.id === 'T-1');
  assert.ok(conflicts.some((e) => e.winner === 'hub'), JSON.stringify(conflicts));
});

test('a hand edit landing while the hub is writing the same item is overwritten, and the hub logs the conflict', async (t) => {
  const root = await tempProject(t);
  const gate = await taskWriteGate(t, root);
  await projectHub(t, root, gate.env);
  ok(await cland(root, 'task', 'create', '--size', 'M', 'Overlapped'));
  const file = join(tasksDir(root), 'T-1-overlapped.md');

  await gate.arm();
  const writing = cland(root, 'task', 'comment', 'T-1', 'from the hub');
  // the hub has read the file and written its new version aside: the hand edit lands now, before the rename
  await gate.entered();
  await writeFile(file, (await readFile(file, 'utf8')).replace('title: Overlapped', 'title: Hand in between'));
  await gate.release();
  ok(await writing);

  const final = await readFile(file, 'utf8');
  assert.match(final, /title: Overlapped/, 'the hub wrote last');
  assert.match(final, /from the hub/);
  const conflicts = (await hubLog(t, root)).filter((e) => e.event === 'task-conflict' && e.id === 'T-1');
  assert.ok(
    conflicts.some((e) => e.winner === 'hub' && e.op === 'comment' && /overwr/.test(String(e.note))),
    JSON.stringify(conflicts),
  );
});

test('task commands with no hub running fail with a clear error and do not start one', async (t) => {
  const root = await tempProject(t);
  const r = await cland(root, 'task', 'list');
  assert.equal(r.code, 1);
  assert.equal(r.stderr, `cland: no hub running for ${root} — start it with \`cland hub start\`\n`);
  const usage = await cland(root, 'task', 'frobnicate');
  assert.equal(usage.code, 2);
  assert.match(usage.stderr, /unknown task command "frobnicate"/);
});

// T-48: a sandboxed session's `npm test` starts hubs where FSEvents is refused (Codex's seatbelt): the watch fails
// after it started, and the hub must go on and still see what was edited by hand.
test('where the folder cannot be watched the hub polls: a hand edit of an item and of roles.toml are still picked up', async (t) => {
  const root = await tempProject(t);
  await projectHub(t, root, { CLAND_TEST_WATCH_REFUSED: '1' });
  const fellBack = (await hubLog(t, root)).filter((e) => typeof e.polling === 'number').map((e) => e.event);
  assert.deepEqual(fellBack, ['task-watch-error'], 'only the tracker falls back: roles always use async polling');

  ok(await cland(root, 'task', 'create', '--size', 'M', 'Original title'));
  const file = join(tasksDir(root), 'T-1-original-title.md');
  await writeFile(file, (await readFile(file, 'utf8')).replace('title: Original title', 'title: Edited by hand'));
  await eventually(10_000, async () => assert.deepEqual((await json<{ items: Summary[] }>(root, 'list')).items.map((i) => i.title), ['Edited by hand']));
  await writeFile(join(tasksDir(root), 'T-2-second.md'), '---\nid: T-2\ntitle: Second\n---\n');
  await eventually(10_000, async () => assert.equal((await json<{ items: Summary[] }>(root, 'list')).items.length, 2));
  await rm(join(tasksDir(root), 'T-2-second.md'));
  await eventually(10_000, async () => assert.deepEqual((await json<{ items: Summary[] }>(root, 'list')).items.map((i) => i.id), ['T-1']));

  // roles.toml: re-read with no call asking for it
  const roles = join(root, '.cland', 'roles.toml');
  const loaded = async () => (await hubLog(t, root)).filter((e) => e.event === 'roles-loaded').length;
  const before = await loaded();
  await writeFile(roles, (await readFile(roles, 'utf8')).replace('model = "gpt-6-astra"', 'model = "gpt-fake-edited"'));
  await eventually(10_000, async () => assert.equal(await loaded(), before + 1));
});
