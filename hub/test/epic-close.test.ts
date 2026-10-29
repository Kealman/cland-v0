// T2: epic QA/close rules with injected Git graph and path facts, real frames and in-process MCP.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, mkdtemp, realpath, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, eventually, inProcessSpoke, projectHub, flushProjectLogs, tempProject } from './harness.ts';
import { sessionCland as cland } from './session-credential-fixture.ts';
import type { ItemView } from '../src/tracker/tracker.ts';
import { FakeClock } from './fake-clock.ts';
import { planStageHub, PlanGit, writeBarrier } from './plan-stage-fixture.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { manualTips } from './freshness-harness.ts';
import { onCleanup, ownDirectory } from './process-cleanup.ts';
import { tmpdir } from 'node:os';
import { pacingOwner } from './telegram-pacing-fixture.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { dispatcherUi } from './harness.ts';

const repositories = new Map<string, PlanGit>();
const facts = (root: string) => repositories.get(root)!;

test('closed epic demo reads after restart do not rescan history', async t => {
  const root = await tempProject(t);
  const graph = new PlanGit();
  const old = graph.head;
  graph.commit(['surface.txt'], 'T-3');
  graph.branches.set('t/2', graph.head);
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  await writeFile(join(root, '.cland/tasks/E-1.md'), `---\nid: E-1\nkind: epic\ntitle: Closed demo\nstate: closed\n---\n\n## Definition of done\n- [x] C1. Demo\n  - verified: qa [qa] · run q1 · 2026-10-20T00:00:00Z · commit ${old}\n\n## Comments\n\n### qa · 2026-10-20T00:00:00.000Z\n\nverdict: qa\nresult: clear\nby: qa [qa]\nrun: q1\ncommit: ${old}\n\nDemo.\n`);
  await writeFile(join(root, '.cland/tasks/T-2.md'), `---\nid: T-2\nkind: task\ntitle: Foreground\nstate: open\nbranch: t/2\n---\n\n## Comments\n\n### rev · 2026-10-20T00:00:00.000Z\n\nverdict: review\nscope: full\nresult: clear\nby: rev [reviewer]\nrun: r1\ncommit: ${old}\n\nReviewed.\n`);
  let scans = 0;
  const tips = manualTips();
  const tracker = new Tracker({ root, db: join(root, '.cland/hub.db'), scheduleTips: tips.scheduleTips,
    git: async (...args) => { if (args[0][0] === 'log') scans++; return graph.read(...args); } });
  onCleanup(t, () => tracker.stop());
  tracker.start();
  await tips.refresh();
  tracker.list();
  const closed = tracker.view('E-1');
  assert.equal(closed.criteria[0]?.marks[0]?.kind, 'verified');
  tracker.listSummaries({ state: 'closed' });
  await eventually('foreground verdict settles after restart', () => tracker.view('T-2').verdicts.at(-1)?.current === true ? true : undefined);
  assert.equal(scans, 0, 'closed epic verdict and criterion reads leave demo scans unrequested');
  assert.equal(tracker.view('E-1').verdicts.at(-1)?.current, undefined, 'skipped currency is unknown');
  await tracker.edit({ id: 'human', name: 'human', role: null }, 'E-1', { state: 'open' });
  await eventually('reopened epic demo settles', () => tracker.view('E-1').verdicts.at(-1)?.current === true ? true : undefined);
  assert.ok(scans > 0, 'reopening resumes demo history checks');
});

async function project(t: TestContext, gated = false, levels = ['release', 'epic']) {
  const root = await tempProject(t);
  repositories.set(root, new PlanGit());
  t.after(() => repositories.delete(root));
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), `[tracker]\nlevels = ${JSON.stringify(levels)}\n`);
  const gate = gated ? writeBarrier(t) : null;
  const component = gate ? await planStageHub(t, root, facts(root), { levels, gate }) : {
    ...await projectHub(t, root, {}, { git: facts(root).read, readBase: async () => 'dev', clock: new FakeClock(),
      scheduleTips: read => { void read(); return { poke: () => { void read(); }, stop() {} }; },
    }),
    flush: () => flushProjectLogs(t, root),
  };
  const { discovery } = component;
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const qa = await inProcessSpoke(t, { discover: true, cwd: root, name: 'qa-demo', sessionId: 'qa-id', role: 'qa' });
  t.after(() => qa.close());
  const create = await ui.request({ ...((levels[1]) === 'task' ? { size: 'M' } : {}), type: 'task.create', title: 'Epic demo', kind: levels[1], body: '## Definition of done\n- [ ] First demo\n- [ ] Second demo\n\n## Notes\nKeep this.' });
  assert.equal(create.ok, true, create.error);
  const item = (create.value as { item: ItemView }).item;
  const verdict = async (run: string, result = 'clear', verified?: string, commit?: string) => {
    const r = await qa.call<{ ok: boolean; error?: string; item: ItemView }>('task.comment', { id: item.id, verdict: 'qa', result, run, ...(verified ? { verified } : {}), ...(commit ? { commit } : {}) });
    assert.equal(r.ok, true, r.error);
    return r.item;
  };
  return { root, ui, qa, item, verdict, gate, component };
}

async function landSurface(root: string, ui: Awaited<ReturnType<typeof connectUi>>, epic: string) {
  const made = await ui.request({ type: 'task.create', size: 'S', title: 'Landed demo surface', parent: epic });
  const child = (made.value as { item: ItemView }).item;
  await writeFile(join(root, 'demo.txt'), 'landed surface\n');
  facts(root).commit(['demo.txt'], child.id);
  await ui.request({ type: 'task.close', item: child.id });
}
async function changeSurface(root: string, title: string) {
  await writeFile(join(root, 'demo.txt'), `${title}\n`);
  facts(root).commit(['demo.txt']);
}

test('QA verifies a container definition of done by id; fail clears marks without inventing task status (in-process)', async t => {
  const { root, ui, qa, item, verdict } = await project(t);
  assert.equal(item.criteria.length, 2);
  const verified = await verdict('qa-1', 'clear', 'C1,C2');
  assert.deepEqual(verified.criteria.map(c => [c.id, c.marks.map(m => m.kind)]), [['C1', ['verified']], ['C2', ['verified']]]);
  assert.equal(verified.comments.at(-1)?.verdict?.commit, facts(root).head);
  assert.match(verified.body, /## Notes\nKeep this\./);
  const list = await cland(root, 'task', 'list', '--json');
  assert.equal(list.code, 0, list.stderr);
  assert.equal((JSON.parse(list.stdout) as { items: ItemView[] }).items.find(i => i.id === item.id)?.verdicts.at(-1)?.current, true);
  const event = await ui.waitFor(f => f.type === 'task' && (f.item as ItemView | undefined)?.id === item.id && (f.item as ItemView).verdicts.at(-1)?.current === true);
  assert.equal((event.item as ItemView).verdicts.at(-1)?.current, true);
  const failed = await qa.call<{ ok: boolean; item: ItemView }>('task.comment', { id: item.id, verdict: 'qa', result: 'not clear', run: 'qa-2', failed: [{ criterion: 'C1', note: 'Demo failed' }] });
  assert.equal(failed.ok, true);
  assert.deepEqual(failed.item.criteria[0]?.marks.map(m => m.kind), ['failed']);
  assert.equal(failed.item.status, undefined);
  const release = await ui.request({ type: 'task.create', title: 'Release', kind: 'release', body: '## Acceptance criteria\n- [ ] Release check' });
  const id = (release.value as { item: ItemView }).item.id;
  assert.equal((await cland(root, 'task', 'criterion', id, 'done', 'C1')).code, 0);
  const mark = await qa.call<{ ok: boolean; item: ItemView }>('task.criterion', { id, op: 'verify', criterion: 'C1', run: 'release-1' });
  assert.equal(mark.ok, true);
  assert.deepEqual(mark.item.criteria[0]?.marks.map(m => m.kind), ['done', 'verified']);
});

test('epic close names missing QA and criteria, and succeeds with all verified in the current QA run (in-process)', async t => {
  const { root, ui, item, verdict } = await project(t);
  const missing = await cland(root, 'task', 'close', item.id);
  assert.equal(missing.code, 1);
  assert.match(missing.stderr, /qa.*verdict/i);
  await verdict('qa-1', 'clear', 'C1');
  const partial = await cland(root, 'task', 'close', item.id);
  assert.equal(partial.code, 1);
  assert.match(partial.stderr, /C2.*Second demo.*not verified/);
  await verdict('qa-2', 'clear', 'C2');
  const oldMarks = await ui.request({ type: 'task.close', item: item.id });
  assert.equal(oldMarks.ok, false);
  assert.match(oldMarks.error ?? '', /C1.*not verified/);
  const cliVerdict = await cland(root, 'task', 'comment', item.id, 'Demo passed', '--as', 'qa-demo', '--verdict', 'qa', '--result', 'clear', '--run', 'qa-3', '--verified', 'all');
  assert.equal(cliVerdict.code, 0, cliVerdict.stderr);
  assert.match(cliVerdict.stdout, /branch tip dev/);
  const closed = await cland(root, 'task', 'close', item.id, '--json');
  assert.equal(closed.code, 0, closed.stderr);
  assert.equal((JSON.parse(closed.stdout) as { item: ItemView }).item.state, 'closed');
});

test('epic QA must be clear, written by QA through the hub, and fresh on its surfaces (in-process)', async t => {
  const { root, ui, item, verdict } = await project(t);
  const refuse = async (pattern: RegExp) => {
    const r = await ui.request({ type: 'task.close', item: item.id });
    assert.equal(r.ok, false);
    assert.match(r.error ?? '', pattern);
  };
  await landSurface(root, ui, item.id);
  const sha = facts(root).head;
  assert.equal((await ui.request({ type: 'task.comment', item: item.id, text: 'Human QA', verdict: { verdict: 'qa', result: 'clear', run: 'human-1', commit: sha } })).ok, true);
  await refuse(/writer did not hold qa/);
  await verdict('qa-1', 'not clear');
  await refuse(/qa is not clear/);
  await verdict('qa-2', 'clear', 'all');
  await changeSurface(root, 'Different dev build');
  await refuse(/qa-stale/);
  await verdict('qa-3', 'clear', 'all');
  assert.equal((await ui.request({ type: 'task.close', item: item.id })).ok, true);
});

test('open children block even a clear epic verdict or human override; releases retain their close path (in-process)', async t => {
  const { root, ui, item, verdict } = await project(t);
  const child = (await ui.request({ size: 'M', type: 'task.create', title: 'Child', parent: item.id })).value as { item: ItemView };
  await verdict('qa-1', 'clear', 'all');
  for (const args of [[], ['--override', 'human exception']]) {
    const refused = await cland(root, 'task', 'close', item.id, ...args);
    assert.equal(refused.code, 1);
    assert.match(refused.stderr, /open children.*Child/);
  }
  assert.equal((await ui.request({ type: 'task.close', item: child.item.id })).ok, true);
  assert.equal((await ui.request({ type: 'task.close', item: item.id })).ok, true);
  const release = (await ui.request({ type: 'task.create', title: 'Release', kind: 'release' })).value as { item: ItemView };
  assert.equal((await ui.request({ type: 'task.close', item: release.item.id })).ok, true);
});

test('only the human shell may override epic QA; the reason and unmet criteria are journalled (in-process)', async t => {
  const { root, item, component } = await project(t);
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', sessionId: 'coord-id', role: 'coordinator' });
  t.after(() => coord.close());
  const refused = await coord.call<{ ok: boolean; error?: string }>('task.close', { id: item.id, override: 'skip' });
  assert.equal(refused.ok, false);
  assert.match(refused.error ?? '', /only the human/);
  const empty = await cland(root, 'task', 'close', item.id, '--override', ' ');
  assert.equal(empty.code, 1);
  assert.match(empty.stderr, /reason/);
  const override = await cland(root, 'task', 'close', item.id, '--override', 'Approved demo exception');
  assert.equal(override.code, 0, override.stderr);
  await component.flush();
  const journal = await readFile(join(root, '.cland/journal.jsonl'), 'utf8');
  const entry = journal.split('\n').filter(Boolean).map(line => JSON.parse(line)).find(e => e.event === 'epic-close-overridden');
  assert.equal(entry.override, 'Approved demo exception');
  assert.match(entry.criteria.join('\n'), /First demo.*not verified/);
});

test('task.edit cannot close an epic around the QA gate (in-process)', async t => {
  const { ui, item, verdict } = await project(t);
  const refused = await ui.request({ type: 'task.edit', item: item.id, state: 'closed' });
  assert.equal(refused.ok, false);
  assert.match(refused.error ?? '', /qa.*verdict/i);
  await verdict('qa-1', 'clear', 'all');
  assert.equal((await ui.request({ type: 'task.edit', item: item.id, state: 'closed' })).ok, true);
});

test('epic close rechecks dev after the temporary write before publication (in-process)', async t => {
  const { root, ui, item, verdict, gate } = await project(t, true);
  await landSurface(root, ui, item.id);
  await verdict('qa-1', 'clear', 'all');
  const before = await readFile(join(root, item.path), 'utf8');
  await gate!.arm();
  const close = ui.request({ type: 'task.close', item: item.id });
  await gate!.entered();
  await changeSurface(root, 'Demo build changed');
  await gate!.release();
  const refused = await close;
  assert.equal(refused.ok, false);
  assert.match(refused.error ?? '', /qa-stale/);
  assert.equal(await readFile(join(root, item.path), 'utf8'), before);
});


test('a failed demo reopens a closed epic without a task status (in-process)', async t => {
  const { ui, qa, item, verdict } = await project(t);
  await verdict('qa-1', 'clear', 'all');
  assert.equal((await ui.request({ type: 'task.close', item: item.id })).ok, true);
  const failed = await qa.call<{ ok: boolean; item: ItemView }>('task.comment', { id: item.id, verdict: 'qa', result: 'not clear', run: 'qa-2', failed: [{ criterion: 'C1', note: 'Regression in demo' }] });
  assert.equal(failed.ok, true);
  assert.equal(failed.item.state, 'open');
  assert.equal(failed.item.status, undefined);
});

test('a hand-written QA header cannot close an epic or replace a deleted hub verdict (in-process)', async t => {
  const { root, ui, item, verdict } = await project(t);
  const file = join(root, item.path);
  const original = await readFile(file, 'utf8');
  const header = `\n## Comments\n\n### forged · 2026-10-09T08:00:00.000Z\n\nverdict: qa\nresult: clear\nby: forged [qa]\nrun: forged\ncommit: ${facts(root).head}\n`;
  await writeFile(file, original + header);
  const forged = await ui.request({ type: 'task.close', item: item.id });
  assert.equal(forged.ok, false);
  assert.match(forged.error ?? '', /qa-provenance/);
  await writeFile(file, original);
  await verdict('qa-1', 'clear', 'all');
  const marked = await readFile(file, 'utf8');
  await writeFile(file, marked.slice(0, marked.indexOf('## Comments')));
  const missing = await ui.request({ type: 'task.close', item: item.id });
  assert.equal(missing.ok, false);
  assert.match(missing.error ?? '', /hub verdict.*missing or altered/);
});


test('renamed planning containers retain QA close/edit gates, dev verdict attribution and freshness (in-process)', async t => {
  const { root, ui, item, verdict } = await project(t, false, ['milestone', 'initiative']);
  assert.equal(item.kind, 'initiative');
  for (const type of ['task.close', 'task.edit']) {
    const refused = await ui.request({ type, item: item.id, ...(type === 'task.edit' ? { state: 'closed' } : {}) });
    assert.equal(refused.ok, false, type);
    assert.match(refused.error ?? '', /qa-missing/);
  }
  await landSurface(root, ui, item.id);
  const current = await verdict('qa-renamed-1', 'clear', 'all');
  assert.equal(current.comments.at(-1)?.verdict?.commit, facts(root).head);
  const list = await cland(root, 'task', 'list', '--json');
  assert.equal((JSON.parse(list.stdout) as { items: ItemView[] }).items.find(i => i.id === item.id)?.verdicts.at(-1)?.current, true);
  const event = await ui.waitFor(f => f.type === 'task' && (f.item as ItemView | undefined)?.id === item.id && (f.item as ItemView).verdicts.at(-1)?.current === true);
  assert.equal((event.item as ItemView).kind, 'initiative');
  const view = await ui.request({ type: 'task.view', item: item.id });
  assert.equal((view.value as { item: ItemView }).item.verdicts.at(-1)?.current, true);
  await changeSurface(root, 'Renamed planning build changed');
  for (const type of ['task.close', 'task.edit']) {
    const refused = await ui.request({ type, item: item.id, ...(type === 'task.edit' ? { state: 'closed' } : {}) });
    assert.equal(refused.ok, false, type);
    assert.match(refused.error ?? '', /qa-stale/);
  }
  const cliVerdict = await cland(root, 'task', 'comment', item.id, 'Renamed demo passed', '--as', 'qa-demo', '--verdict', 'qa', '--result', 'clear', '--run', 'qa-renamed-2', '--verified', 'all');
  assert.equal(cliVerdict.code, 0, cliVerdict.stderr);
  assert.match(cliVerdict.stdout, /branch tip dev/);
  assert.equal((await ui.request({ type: 'task.edit', item: item.id, state: 'closed' })).ok, true);
  assert.equal((await ui.request({ type: 'task.edit', item: item.id, state: 'open' })).ok, true);
  assert.equal((await ui.request({ type: 'task.close', item: item.id })).ok, true);
});


test('reimporting an existing planning container cannot bypass QA or erase unverified criteria (in-process)', async t => {
  for (const levels of [['release', 'epic'], ['milestone', 'initiative']]) {
    const { root, ui, qa } = await project(t, false, levels);
    const issue = { number: 1, url: 'https://example.com/1', title: 'Imported demo', body: '## Definition of done\n- [ ] Demo', labels: [levels[1]], state: 'open', assignee: null, parent: null, blocked_by: [], comments: [], created: '2026-01-01T00:00:00.000Z' };
    const initial = await ui.request({ type: 'task.import', repo: 'test/project', issues: [issue] });
    assert.equal(initial.ok, true, initial.error);
    const id = (initial.value as { results: { id: string }[] }).results[0]!.id;
    const before = (await ui.request({ type: 'task.view', item: id })).value as { item: ItemView };
    const source = await readFile(join(root, before.item.path), 'utf8');
    for (const body of [issue.body, 'Removed demo criteria']) {
      const refused = await ui.request({ type: 'task.import', repo: 'test/project', issues: [{ ...issue, body, state: 'closed' }] });
      assert.equal(refused.ok, false, levels.join(','));
      assert.match(refused.error ?? '', /qa-missing/);
      assert.equal(await readFile(join(root, before.item.path), 'utf8'), source);
    }
    assert.equal((await qa.call<{ ok: boolean }>('task.comment', { id, verdict: 'qa', result: 'clear', run: 'import-qa-1' })).ok, true);
    const unverified = await ui.request({ type: 'task.import', repo: 'test/project', issues: [{ ...issue, body: '', state: 'closed' }] });
    assert.equal(unverified.ok, false);
    assert.match(unverified.error ?? '', /not verified/);
    const verified = await qa.call<{ ok: boolean; item: ItemView }>('task.comment', { id, verdict: 'qa', result: 'clear', run: 'import-qa-2', verified: 'all' });
    assert.equal(verified.ok, true);
    const newCriteria = await ui.request({ type: 'task.import', repo: 'test/project', issues: [{ ...issue, body: verified.item.body + '\n- [ ] C2. New unchecked demo', state: 'closed' }] });
    assert.equal(newCriteria.ok, false);
    assert.match(newCriteria.error ?? '', /C2.*not verified/);
    const child = (await ui.request({ size: 'M', type: 'task.create', title: 'Imported epic child', parent: id })).value as { item: ItemView };
    const openChildren = await ui.request({ type: 'task.import', repo: 'test/project', issues: [{ ...issue, body: verified.item.body, state: 'closed' }] });
    assert.equal(openChildren.ok, false);
    assert.match(openChildren.error ?? '', /open children.*Imported epic child/);
    assert.equal((await ui.request({ type: 'task.close', item: child.item.id })).ok, true);
    const closed = await ui.request({ type: 'task.import', repo: 'test/project', issues: [{ ...issue, body: verified.item.body, state: 'closed' }] });
    assert.equal(closed.ok, true, closed.error);
    const after = (await ui.request({ type: 'task.view', item: id })).value as { item: ItemView };
    assert.equal(after.item.state, 'closed');
  }
});


test('status-driven conversion of a planning container cannot bypass QA or open-child checks (in-process)', async t => {
  for (const levels of [['release', 'epic'], ['milestone', 'initiative']]) {
    const { root, ui, item, verdict } = await project(t, false, levels);
    const source = await readFile(join(root, item.path), 'utf8');
    const close = () => ui.request({ type: 'task.edit', item: item.id, kind: 'task', status: 'done' });
    const unverified = await close();
    assert.equal(unverified.ok, false);
    assert.match(unverified.error ?? '', /qa-missing/);
    assert.equal(await readFile(join(root, item.path), 'utf8'), source);
    const child = (await ui.request({ size: 'M', type: 'task.create', title: 'Conversion child', parent: item.id })).value as { item: ItemView };
    const openChildren = await close();
    assert.equal(openChildren.ok, false);
    assert.match(openChildren.error ?? '', /open children.*Conversion child/);
    assert.equal(await readFile(join(root, item.path), 'utf8'), source);
    assert.equal((await ui.request({ type: 'task.link', item: child.item.id, parent: null })).ok, true);
    await verdict('qa-conversion-1', 'clear', 'all');
    const changed = await close();
    assert.equal(changed.ok, true, changed.error);
    assert.deepEqual([(changed.value as { item: ItemView }).item.kind, (changed.value as { item: ItemView }).item.state, (changed.value as { item: ItemView }).item.status], ['task', 'closed', 'done']);
  }
});

test('epic QA at a named ancestor survives unrelated dev moves and refuses surface edits (in-process)', async t => {
  const { root, ui, qa, item, verdict } = await project(t);
  const made = await ui.request({ type: 'task.create', size: 'S', title: 'Epic surface', parent: item.id });
  const child = (made.value as { item: ItemView }).item;
  await writeFile(join(root, 'surface.txt'), 'landed\n');
  facts(root).commit(['surface.txt'], child.id);
  await ui.request({ type: 'task.close', item: child.id });
  const build = facts(root).head;
  await writeFile(join(root, 'other.txt'), 'unrelated\n');
  facts(root).commit(['other.txt']);
  await verdict('ancestor-demo', 'clear', 'all', build);
  await eventually('ancestor verdict and criteria become current in cached views', async () => {
    const shown = await ui.request({ type: 'task.view', item: item.id });
    const view = (shown.value as { item: ItemView }).item;
    return view.verdicts.at(-1)?.current === true && view.criteriaCounts.verified === 2 ? true : undefined;
  });
  await eventually('the list settles freshness after dev tip refresh', async () => {
    const listing = JSON.parse((await cland(root, 'task', 'list', '--json')).stdout);
    const listed = listing.items.find((row: { id: string }) => row.id === item.id);
    return listed.criteria.verified === 2 && listed.verdicts.at(-1)?.current === true ? true : undefined;
  });
  const closed = await ui.request({ type: 'task.close', item: item.id });
  assert.equal(closed.ok, true, closed.error);
  await writeFile(join(root, 'surface.txt'), 'changed again\n');
  facts(root).commit(['surface.txt']);
  const overlap = facts(root).head;
  const refused = await qa.call<{ ok: boolean; error?: string }>('task.comment', { id: item.id, verdict: 'qa', result: 'clear', run: 'stale-demo', commit: build, verified: 'all' });
  assert.equal(refused.ok, false);
  assert.match(refused.error ?? '', new RegExp(`${overlap}.*surface.txt`));
});

test('epic demo freshness retains intervening rename/revert conflicts and rejects commits off dev (in-process)', async t => {
  const { root, ui, qa, item } = await project(t);
  await landSurface(root, ui, item.id);
  const build = facts(root).head;
  facts(root).commit(['demo.txt', 'renamed.txt']);
  const renamed = facts(root).head;
  facts(root).commit(['demo.txt', 'renamed.txt']);
  const recorded = await qa.call<{ ok: boolean; error?: string }>('task.comment', { id: item.id, verdict: 'qa', result: 'clear', run: 'rename-demo', commit: build });
  assert.equal(recorded.ok, false); assert.match(recorded.error ?? '', new RegExp(`${renamed}.*demo.txt`));
  const side = facts(root).commit(['off-dev.txt'], '', false);
  const offDev = await qa.call<{ ok: boolean; error?: string }>('task.comment', { id: item.id, verdict: 'qa', result: 'clear', run: 'off-dev-demo', commit: side });
  assert.equal(offDev.ok, false); assert.match(offDev.error ?? '', /not on dev/);
});


// New close cases pre-own acquisition and use socket-free production frames.
async function durationFixture(t: TestContext) {
  const owner = pacingOwner(t);
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cland-duration-close-')));
  const remove = ownDirectory(t, root, { beforeRemove: owner.dispose });
  const clock = new FakeClock();
  const graph = new PlanGit();
  await mkdir(join(root, '.cland'), { recursive: true });
  const start = (setup: { receipt?: Promise<void>; signal?: AbortSignal; clock?: FakeClock } = {}) => owner.start(root, {}, clock, {
    ...setup, hubOptions: { git: graph.read, readBase: async () => 'dev',
      scheduleTips: read => { void read(); return { poke: () => { void read(); }, stop() {} }; } },
  });
  const ready = async () => {
    try {
      const hub = await start();
      const ui = await within(owner.observe(async signal => {
        const ui = await dispatcherUi(t, hub.dispatcher, root);
        owner.close(() => ui.close());
        signal.throwIfAborted();
        return ui;
      }), 1_000);
      const qa = await within(owner.observe(async signal => {
        const qa = await inProcessSpoke(t, { discover: true, cwd: root, name: 'duration-qa', sessionId: 'duration-qa-id', role: 'qa' });
        owner.close(() => qa.close());
        signal.throwIfAborted();
        return qa;
      }), 1_000);
      const created = await ui.request({ type: 'task.create', title: 'Duration owner', kind: 'epic', body: '## Definition of done\n- [ ] C1. Demo' });
      assert.equal(created.ok, true, created.error);
      const item = (created.value as { item: ItemView }).item;
      const verdict = async (run: string, result: string, verified: string) => {
        const response = await qa.call<{ ok: boolean; error?: string }>('task.comment', { id: item.id, verdict: 'qa', result, run, verified });
        assert.equal(response.ok, true, response.error);
      };
      return { root, ui, item, verdict };
    } catch (error) { await owner.dispose(); throw error; }
  };
  return { root, owner, clock, remove, start, ready };
}

test('epic close refuses every owned duration allowance until re-owned (in-process)', async t => {
  const { root, ui, item, verdict } = await (await durationFixture(t)).ready();
  await verdict('duration-qa', 'clear', 'all');
  const path = join(root, 'hub/test/durations.json');
  await mkdir(join(root, 'hub/test'), { recursive: true });
  const allowance = { seconds: 12, owner: item.id, added: '2026-10-29', expires: '2026-11-05', reason: 'Native lifecycle receipt' };
  const allow = { 'hub/test/example.test.ts::slow': { ...allowance }, 'hub/test/example.test.ts': { ...allowance, file: true } };
  await writeFile(path, JSON.stringify({ allow }));
  const original = await readFile(join(root, item.path), 'utf8');
  for (const request of [
    { type: 'task.close', item: item.id },
    { type: 'task.close', item: item.id, override: 'QA exception' },
    { type: 'task.edit', item: item.id, state: 'closed' },
  ]) {
    const refused = await ui.request(request);
    assert.equal(refused.ok, false);
    assert.match(refused.error ?? '', /duration allowance/);
    for (const key of Object.keys(allow)) assert.ok(refused.error?.includes(key), key);
    assert.match(refused.error ?? '', /re-own.*owner.*open.*container/i);
    assert.equal(await readFile(join(root, item.path), 'utf8'), original, 'refusal leaves tracker bytes unchanged');
  }
  const release = await ui.request({ type: 'task.create', title: 'Allowance owner', kind: 'release' });
  const owner = (release.value as { item: ItemView }).item.id;
  for (const entry of Object.values(allow)) entry.owner = owner;
  await writeFile(path, JSON.stringify({ allow }));
  const closed = await ui.request({ type: 'task.close', item: item.id });
  assert.equal(closed.ok, true, closed.error);
  assert.equal((closed.value as { item: ItemView }).item.state, 'closed');
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), { allow }, 'close does not rewrite allowances or dates');
});

test('epic closes normally without a project duration manifest (in-process)', async t => {
  const { ui, item, verdict } = await (await durationFixture(t)).ready();
  await verdict('no-manifest-qa', 'clear', 'all');
  const closed = await ui.request({ type: 'task.close', item: item.id });
  assert.equal(closed.ok, true, closed.error);
  assert.equal((closed.value as { item: ItemView }).item.state, 'closed');
});


for (const failure of ['omitted', 'aborted'] as const) {
  test(`duration close fixture drains ${failure} startup before root removal`, async t => {
    const fixture = await durationFixture(t);
    const setupClock = new FakeClock();
    const controller = new AbortController();
    const starting = fixture.start({ receipt: new Promise<void>(() => {}), signal: controller.signal, clock: setupClock });
    const rejected = assert.rejects(starting, failure === 'omitted' ? /setup receipt deadline/ : /setup cancelled/);
    const hub = await within(fixture.owner.serving, 1_000);
    if (failure === 'omitted') await setupClock.advance(1_000);
    else controller.abort(new Error('setup cancelled'));
    await rejected;
    await fixture.owner.dispose();
    await within(hub.stopped, 1_000);
    assert.equal(fixture.owner.observations(), 0);
    assert.equal(fixture.clock.pending, 0);
    assert.equal(setupClock.pending, 0);
    await fixture.remove();
    await assert.rejects(stat(fixture.root), { code: 'ENOENT' });
  });
}
