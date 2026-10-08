// The tracker through its seams: `cland task …` run as its own process against a real hub daemon in a
// temporary project, the hub's Unix socket, and a spoke's MCP tools. Assertions read the item files, the
// index (through `task list` / `task view`) and the hub's log.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { PROTOCOL_VERSION } from '../src/protocol.ts';
import { cland, connectSocket, sleep, spawnSpoke, startDaemon, tempProject, type CliResult } from './harness.ts';

type Summary = { id: string; title: string; state: string; kind: string; labels: string[]; assignee: string | null; claim: { session: string; role: string | null } | null };
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
const itemFiles = async (root: string) => (await readdir(tasksDir(root))).filter((n) => n.endsWith('.md')).sort();
const frontmatter = (text: string): Record<string, unknown> => parseYaml(/^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? '') as Record<string, unknown>;
const hubLog = async (root: string) => (await readFile(join(root, '.cland', 'log', 'hub.log'), 'utf8')).split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l) as Record<string, unknown>);

async function project(t: TestContext): Promise<string> {
  const root = await tempProject(t);
  await startDaemon(t, root);
  return root;
}

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

test('task create writes an item file with the frontmatter and sequential ids', async (t) => {
  const root = await project(t);
  const first = ok(await cland(root, 'task', 'create', 'Add the login page', '--label', 'ui', '--label', 'slice-1', '--body', 'The page the human logs in on.'));
  assert.equal(first.stdout, 'created T-1  .cland/tasks/T-1-add-the-login-page.md\n');
  const second = await json<{ item: View }>(root, 'create', 'Write the spec', '--kind', 'spec', '--parent', 'T-1', '--assignee', 'alice');
  assert.equal(second.item.id, 'T-2');
  assert.deepEqual(await itemFiles(root), ['T-1-add-the-login-page.md', 'T-2-write-the-spec.md']);

  const text = await readFile(join(tasksDir(root), 'T-1-add-the-login-page.md'), 'utf8');
  const fm = frontmatter(text);
  assert.deepEqual(Object.keys(fm), ['id', 'kind', 'title', 'state', 'labels', 'assignee', 'parent', 'blocked_by', 'topic', 'branch', 'created', 'updated']);
  assert.equal(fm.id, 'T-1');
  assert.equal(fm.kind, 'task');
  assert.equal(fm.title, 'Add the login page');
  assert.equal(fm.state, 'open');
  assert.deepEqual(fm.labels, ['ui', 'slice-1']);
  assert.equal(fm.assignee, null);
  assert.deepEqual(fm.blocked_by, []);
  assert.match(String(fm.created), /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  assert.equal(fm.updated, fm.created);
  assert.match(text, /\n---\n\nThe page the human logs in on\.\n$/);

  const fm2 = frontmatter(await readFile(join(tasksDir(root), 'T-2-write-the-spec.md'), 'utf8'));
  assert.equal(fm2.kind, 'spec');
  assert.equal(fm2.parent, 'T-1');
  assert.equal(fm2.assignee, 'alice');

  // a file added by hand takes its number; the hub continues above it
  await writeFile(join(tasksDir(root), 'T-7-by-hand.md'), '---\nid: T-7\ntitle: By hand\n---\n');
  await eventually(1000, async () => assert.deepEqual((await json<{ items: Summary[] }>(root, 'list')).items.map((i) => i.id), ['T-1', 'T-2', 'T-7']));
  assert.equal((await json<{ item: View }>(root, 'create', 'Next')).item.id, 'T-8');
});

test('task list queries the index with state, label, kind, assignee filters', async (t) => {
  const root = await project(t);
  ok(await cland(root, 'task', 'create', 'One', '--label', 'x'));
  ok(await cland(root, 'task', 'create', 'Two', '--label', 'x', '--label', 'y', '--assignee', 'bob'));
  ok(await cland(root, 'task', 'create', 'Three', '--label', 'y', '--kind', 'question'));
  ok(await cland(root, 'task', 'close', 'T-2', '--comment', 'done'));

  const ids = async (...args: string[]) => (await json<{ items: Summary[] }>(root, 'list', ...args)).items.map((i) => i.id);
  assert.deepEqual(await ids(), ['T-1', 'T-2', 'T-3']);
  assert.deepEqual(await ids('--state', 'open', '--label', 'x'), ['T-1']);
  assert.deepEqual(await ids('--label', 'x', '--label', 'y'), ['T-2']);
  assert.deepEqual(await ids('--state', 'closed'), ['T-2']);
  assert.deepEqual(await ids('--kind', 'question'), ['T-3']);
  assert.deepEqual(await ids('--assignee', 'bob'), ['T-2']);

  const human = ok(await cland(root, 'task', 'list', '--state', 'open', '--label', 'y'));
  assert.match(human.stdout, /^T-3 +open +question +Three +\[y\]\n$/);
  const bad = await cland(root, 'task', 'list', '--state', 'nope');
  assert.equal(bad.code, 1);
  assert.match(bad.stderr, /unknown state "nope"/);
});

test('a hand edit of an item file is re-indexed within a second', async (t) => {
  const root = await project(t);
  ok(await cland(root, 'task', 'create', 'Original title', '--label', 'a'));
  const file = join(tasksDir(root), 'T-1-original-title.md');
  const text = await readFile(file, 'utf8');
  await writeFile(file, text.replace('title: Original title', 'title: Edited by hand').replace('state: open', 'state: closed').replace('  - a', '  - b'));

  const took = await eventually(1000, async () => {
    const items = (await json<{ items: Summary[] }>(root, 'list', '--state', 'closed', '--label', 'b')).items;
    assert.deepEqual(items.map((i) => [i.id, i.title]), [['T-1', 'Edited by hand']]);
  });
  assert.ok(took < 1000, `re-indexed after ${took} ms`);
  assert.deepEqual((await json<{ items: Summary[] }>(root, 'list', '--label', 'a')).items, []);
  const log = await hubLog(root);
  assert.ok(log.some((e) => e.event === 'task-reindexed' && e.id === 'T-1' && e.source === 'hand'), 'the re-index is logged');

  // a file removed by hand leaves the index
  await writeFile(join(tasksDir(root), 'T-2-second.md'), '---\nid: T-2\ntitle: Second\n---\n');
  await eventually(1000, async () => assert.equal((await json<{ items: Summary[] }>(root, 'list')).items.length, 2));
  const { rm } = await import('node:fs/promises');
  await rm(join(tasksDir(root), 'T-2-second.md'));
  await eventually(1000, async () => assert.deepEqual((await json<{ items: Summary[] }>(root, 'list')).items.map((i) => i.id), ['T-1']));
});

test('a hub write and a hand edit at the same time: the last writer wins and the hub logs it', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  ok(await cland(root, 'task', 'create', 'Contested'));
  const file = join(tasksDir(root), 'T-1-contested.md');

  // the hand edit lands right after the hub's write: the hand's content is the file and the index
  ok(await cland(root, 'task', 'comment', 'T-1', 'from the hub'));
  const handText = (await readFile(file, 'utf8')).replace('title: Contested', 'title: Hand wins');
  await writeFile(file, handText);
  await eventually(1000, async () => assert.equal((await json<{ items: Summary[] }>(root, 'list')).items[0]?.title, 'Hand wins'));
  assert.equal(await readFile(file, 'utf8'), handText);
  await eventually(1000, async () => assert.ok((await hubLog(root)).some((e) => e.event === 'task-conflict' && e.id === 'T-1' && e.winner === 'hand')));

  // the hub's write lands right after a hand edit (before the watcher saw it): the hub's write is the
  // file, made on top of what the hand wrote, and the index agrees
  // (over a socket already open: a CLI process takes longer to start than the watcher's debounce)
  await sleep(2100);
  const s = await connectSocket(discovery.socket);
  t.after(() => s.close());
  s.send({ type: 'hello', protocol: PROTOCOL_VERSION, secret: discovery.secret, client: 'test' });
  assert.equal((await s.next()).type, 'welcome');
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
  const conflicts = (await hubLog(root)).filter((e) => e.event === 'task-conflict' && e.id === 'T-1');
  assert.ok(conflicts.some((e) => e.winner === 'hub'), JSON.stringify(conflicts));
});

test('task claim records a claim in the hub only; task view shows the assignee and the claim', async (t) => {
  const root = await project(t);
  ok(await cland(root, 'task', 'create', 'Claimable', '--assignee', 'alice'));
  const file = join(tasksDir(root), 'T-1-claimable.md');
  const before = await readFile(file, 'utf8');

  const claimed = ok(await cland(root, 'task', 'claim', 'T-1', '--as', 'impl-1', '--role', 'implementer'));
  assert.match(claimed.stdout, /^T-1 claimed by impl-1 \(implementer\) since \d{4}-/);
  assert.equal(await readFile(file, 'utf8'), before, 'the claim never touches the file');

  const view = await json<{ item: View }>(root, 'view', 'T-1');
  assert.equal(view.item.assignee, 'alice');
  assert.deepEqual({ session: view.item.claim?.session, role: view.item.claim?.role }, { session: 'impl-1', role: 'implementer' });
  const human = ok(await cland(root, 'task', 'view', '1'));
  assert.match(human.stdout, /^ {2}assignee {2}alice$/m);
  assert.match(human.stdout, /^ {2}claim {5}impl-1 \(implementer\) since /m);

  // another session is refused unless it forces; the holder releases
  const refused = await cland(root, 'task', 'claim', 'T-1', '--as', 'impl-2');
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /T-1 is claimed by impl-1 \(implementer\)/);
  assert.match(ok(await cland(root, 'task', 'claim', 'T-1', '--as', 'impl-1', '--release')).stdout, /^T-1 released\n$/);
  assert.equal((await json<{ item: View }>(root, 'view', 'T-1')).item.claim, null);

  // a claim survives a hub restart
  ok(await cland(root, 'task', 'claim', 'T-1', '--as', 'impl-2'));
  ok(await cland(root, 'hub', 'stop'));
  await startDaemon(t, root);
  assert.equal((await json<{ item: View }>(root, 'view', 'T-1')).item.claim?.session, 'impl-2');
  assert.equal(await readFile(file, 'utf8'), before);
});

test('a claim belongs to the session, not its name: a rename keeps it, and whoever takes the old name gets none of it', async (t) => {
  const root = await project(t);
  const alpha = await spawnSpoke({ discover: true, cwd: root, name: 'alpha', sessionId: 'sess-a', role: 'implementer' });
  t.after(() => alpha.close());
  const beta = await spawnSpoke({ discover: true, cwd: root, name: 'beta', sessionId: 'sess-b' });
  t.after(() => beta.close());
  await alpha.waitForPresence(['alpha', 'beta']);
  ok(await cland(root, 'task', 'create', 'Held'));
  assert.equal((await alpha.call<{ ok: boolean }>('task.claim', { id: 'T-1' })).ok, true);

  assert.deepEqual(await alpha.call('rename', { name: 'alpha-2' }), { ok: true, name: 'alpha-2' });
  assert.deepEqual(await beta.call('rename', { name: 'alpha' }), { ok: true, name: 'alpha' });
  // the session now called alpha is not the one that claimed under that name
  const taken = await beta.call<{ ok: boolean; error?: string }>('task.claim', { id: 'T-1' });
  assert.equal(taken.ok, false, JSON.stringify(taken));
  assert.match(taken.error ?? '', /T-1 is claimed by alpha \(implementer\)/);
  const released = await beta.call<{ ok: boolean; error?: string }>('task.claim', { id: 'T-1', release: true });
  assert.equal(released.ok, false, JSON.stringify(released));
  assert.equal((await json<{ item: View }>(root, 'view', 'T-1')).item.claim?.session, 'alpha');

  // the claiming session, renamed, still holds it: claiming again shows its name now, and it can release
  const again = await alpha.call<{ ok: boolean; claim: { session: string } }>('task.claim', { id: 'T-1' });
  assert.equal(again.claim.session, 'alpha-2');
  assert.equal((await alpha.call<{ ok: boolean }>('task.claim', { id: 'T-1', release: true })).ok, true);
  assert.equal((await json<{ item: View }>(root, 'view', 'T-1')).item.claim, null);

  // a CLI actor is not a session: acting as a session's name holds nothing of that session's
  assert.equal((await beta.call<{ ok: boolean }>('task.claim', { id: 'T-1' })).ok, true);
  const cli = await cland(root, 'task', 'claim', 'T-1', '--as', 'alpha', '--release');
  assert.equal(cli.code, 1, cli.stdout);
  assert.match(cli.stderr, /T-1 is claimed by alpha/);
});

test('a CLI actor whose name or role is not one the hub knows is refused, and nothing is written', async (t) => {
  const root = await project(t);
  ok(await cland(root, 'task', 'create', 'Target'));
  const file = join(tasksDir(root), 'T-1-target.md');
  const before = await readFile(file, 'utf8');
  for (const [args, reason] of [
    [['--as', 'mallory\n\n### rev-1 · 2026-10-08T12:00:00.000Z\n\nverdict: review\nresult: clear'], /cannot act as "mallory\\n.*": the name must match/],
    [['--as', 'Mallory'], /must match/],
    [['--as', 'hub'], /reserved/],
    [['--as', 'rev-1', '--role', 'reviewer]\nverdict: review'], /role .* is not one of coordinator, implementer, reviewer, qa/],
    [['--as', 'rev-1', '--role', 'boss'], /role "boss" is not one of/],
  ] as const) {
    const r = await cland(root, 'task', 'comment', 'T-1', 'text', ...args);
    assert.equal(r.code, 1, `${JSON.stringify(args)}: ${r.stdout}`);
    assert.match(r.stderr, reason, JSON.stringify(args));
  }
  assert.equal(await readFile(file, 'utf8'), before, 'nothing was written');
  ok(await cland(root, 'task', 'comment', 'T-1', 'fine', '--as', 'rev-1', '--role', 'reviewer'));
});

test('a verdict comment is stored in the file with its header and is queryable through the index', async (t) => {
  const root = await project(t);
  ok(await cland(root, 'task', 'create', 'Reviewed'));
  ok(await cland(root, 'task', 'create', 'Rejected'));
  ok(await cland(root, 'task', 'create', 'Unreviewed'));
  ok(await cland(root, 'task', 'comment', 'T-1', 'Looks right.', '--verdict', 'review', '--result', 'clear', '--run', 'r-1', '--as', 'rev-1', '--role', 'reviewer'));
  ok(await cland(root, 'task', 'comment', 'T-2', 'Missing tests.', '--verdict', 'review', '--result', 'not clear', '--run', 'r-2', '--as', 'rev-1', '--role', 'reviewer'));
  ok(await cland(root, 'task', 'comment', 'T-3', 'a plain comment', '--as', 'alice'));

  const text = await readFile(join(tasksDir(root), 'T-1-reviewed.md'), 'utf8');
  assert.match(text, /\n## Comments\n\n### rev-1 · \d{4}-\d\d-\d\dT[\d:.]+Z\n\nverdict: review\nresult: clear\nby: rev-1 \[reviewer\]\nrun: r-1\n\nLooks right\.\n$/);
  assert.match(await readFile(join(tasksDir(root), 'T-3-unreviewed.md'), 'utf8'), /\n## Comments\n\n### alice · \S+\n\na plain comment\n$/);

  const ids = async (...args: string[]) => (await json<{ items: Summary[] }>(root, 'list', ...args)).items.map((i) => i.id);
  assert.deepEqual(await ids('--verdict', 'review=clear'), ['T-1']);
  assert.deepEqual(await ids('--verdict', 'review=not clear'), ['T-2']);
  assert.deepEqual(await ids('--verdict', 'qa=clear'), []);

  // a later verdict supersedes: the latest of its kind is what the filter reads
  ok(await cland(root, 'task', 'comment', 'T-2', '--verdict', 'review', '--result', 'clear', '--run', 'r-3', '--as', 'rev-1', '--role', 'reviewer'));
  assert.deepEqual(await ids('--verdict', 'review=clear'), ['T-1', 'T-2']);

  // a verdict written by hand is indexed like one the hub wrote
  const file3 = join(tasksDir(root), 'T-3-unreviewed.md');
  await writeFile(file3, `${await readFile(file3, 'utf8')}\n### qa-1 · 2026-10-08T12:00:00.000Z\n\nverdict: qa\nresult: clear\nby: qa-1 [qa]\nrun: q-9\n`);
  await eventually(1000, async () => assert.deepEqual(await ids('--verdict', 'qa=clear'), ['T-3']));
  const view = await json<{ item: View }>(root, 'view', 'T-3');
  assert.deepEqual(view.item.verdicts.map((v) => [v.verdict, v.result, v.by, v.run]), [['qa', 'clear', 'qa-1 [qa]', 'q-9']]);
  assert.deepEqual(view.item.comments.map((c) => c.author), ['alice', 'qa-1']);
});

test('edit, close and link change the file; bad references are refused', async (t) => {
  const root = await project(t);
  ok(await cland(root, 'task', 'create', 'Parent epic', '--kind', 'epic'));
  ok(await cland(root, 'task', 'create', 'Blocker'));
  ok(await cland(root, 'task', 'create', 'Child'));
  ok(await cland(root, 'task', 'link', 'T-3', '--parent', 'T-1', '--blocked-by', 'T-2', '--topic', 'login', '--branch', 't/3-child'));
  ok(await cland(root, 'task', 'edit', 'T-3', '--title', 'Child renamed', '--body', 'New body.', '--assignee', 'carol'));
  let fm = frontmatter(await readFile(join(tasksDir(root), 'T-3-child.md'), 'utf8'));
  assert.deepEqual([fm.title, fm.parent, fm.blocked_by, fm.topic, fm.branch, fm.assignee], ['Child renamed', 'T-1', ['T-2'], 'login', 't/3-child', 'carol']);
  ok(await cland(root, 'task', 'link', 'T-3', '--unblock', 'T-2', '--topic', 'none'));
  ok(await cland(root, 'task', 'close', 'T-3'));
  fm = frontmatter(await readFile(join(tasksDir(root), 'T-3-child.md'), 'utf8'));
  assert.deepEqual([fm.blocked_by, fm.topic, fm.state], [[], null, 'closed']);
  assert.notEqual(fm.updated, fm.created);

  const self = await cland(root, 'task', 'link', 'T-3', '--parent', 'T-3');
  assert.equal(self.code, 1);
  assert.match(self.stderr, /cannot reference itself/);
  const missing = await cland(root, 'task', 'view', 'T-99');
  assert.equal(missing.code, 1);
  assert.match(missing.stderr, /no item T-99/);
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

test('the task frames work over the Unix socket as the CLI sends them', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const s = await connectSocket(discovery.socket);
  t.after(() => s.close());
  s.send({ type: 'hello', protocol: PROTOCOL_VERSION, secret: discovery.secret, client: 'test' });
  assert.equal((await s.next()).type, 'welcome');
  s.send({ type: 'task.create', id: 'c1', title: 'Over the socket', labels: ['wire'], as: { name: 'ui', role: null } });
  const created = (await s.next()) as { id: string; ok: boolean; value: { item: View } };
  assert.equal(created.ok, true, JSON.stringify(created));
  assert.equal(created.value.item.id, 'T-1');
  s.send({ type: 'task.list', id: 'l1', labels: ['wire'] });
  assert.deepEqual(((await s.next()) as { value: { items: Summary[] } }).value.items.map((i) => i.id), ['T-1']);
  s.send({ type: 'task.view', id: 'v1', item: 'T-2' });
  assert.deepEqual(await s.next(), { type: 'result', id: 'v1', ok: false, error: 'no item T-2' });
});

test('the task.* tools work through a spoke over MCP, acting as the spoke\'s session', async (t) => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'impl-1', role: 'implementer' });
  t.after(() => spoke.close());
  await spoke.waitForPresence(['impl-1']);

  const created = await spoke.call<{ ok: boolean; item: View }>('task.create', { title: 'From a spoke', labels: ['mcp'], kind: 'task' });
  assert.equal(created.ok, true, JSON.stringify(created));
  assert.equal(created.item.id, 'T-1');
  assert.deepEqual(await itemFiles(root), ['T-1-from-a-spoke.md']);
  await spoke.call('task.comment', { id: 'T-1', text: 'Reviewed.', verdict: 'review', result: 'clear', run: 'r-7' });
  await spoke.call('task.edit', { id: 'T-1', add_labels: ['edited'] });
  await spoke.call('task.link', { id: 'T-1', branch: 't/1-from-a-spoke' });
  const claim = await spoke.call<{ ok: boolean; claim: { session: string; role: string } }>('task.claim', { id: 'T-1' });
  assert.deepEqual([claim.claim.session, claim.claim.role], ['impl-1', 'implementer']);
  const view = await spoke.call<{ ok: boolean; item: View }>('task.view', { id: 'T-1' });
  assert.deepEqual(view.item.verdicts.map((v) => [v.by, v.result, v.run]), [['impl-1 [implementer]', 'clear', 'r-7']]);
  assert.deepEqual(view.item.labels, ['mcp', 'edited']);
  assert.equal(view.item.branch, 't/1-from-a-spoke');
  const list = await spoke.call<{ ok: boolean; items: Summary[] }>('task.list', { verdict: 'review=clear', label: ['mcp'] });
  assert.deepEqual(list.items.map((i) => i.id), ['T-1']);
  const closed = await spoke.call<{ ok: boolean; item: View }>('task.close', { id: 'T-1', comment: 'Done.' });
  assert.equal(closed.item.state, 'closed');
  assert.equal(closed.item.claim, null, 'closing releases the claim');

  // the CLI sees what the spoke wrote
  assert.deepEqual((await json<{ items: Summary[] }>(root, 'list', '--state', 'closed')).items.map((i) => i.id), ['T-1']);
  const err = await spoke.client.callTool({ name: 'task.view', arguments: { id: 'T-5' } });
  assert.equal(err.isError, true);
});
