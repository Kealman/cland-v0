// D16 through the real hub, MCP and CLI: epic demos are QA evidence on dev.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, spawnSpoke, startDaemon, tempProject } from './harness.ts';
import type { ItemView } from '../src/tracker/tracker.ts';
import { taskWriteGate } from './tracker-write-gate.ts';

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

async function project(t: TestContext, gated = false, levels = ['release', 'epic']) {
  const root = await tempProject(t);
  git(root, 'init', '-q', '-b', 'dev');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'commit.gpgsign', 'false');
  await writeFile(join(root, 'demo.txt'), 'first\n');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'Initial');
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), `[tracker]\nlevels = ${JSON.stringify(levels)}\n`);
  const gate = gated ? await taskWriteGate(t, root) : null;
  const { discovery } = await startDaemon(t, root, gate?.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const qa = await spawnSpoke({ discover: true, cwd: root, name: 'qa-demo', sessionId: 'qa-id', role: 'qa' });
  t.after(() => qa.close());
  const create = await ui.request({ type: 'task.create', title: 'Epic demo', kind: levels[1], body: '## Definition of done\n- [ ] First demo\n- [ ] Second demo\n\n## Notes\nKeep this.' });
  assert.equal(create.ok, true, create.error);
  const item = (create.value as { item: ItemView }).item;
  const verdict = async (run: string, result = 'clear', verified?: string, commit?: string) => {
    const r = await qa.call<{ ok: boolean; error?: string; item: ItemView }>('task.comment', { id: item.id, verdict: 'qa', result, run, ...(verified ? { verified } : {}), ...(commit ? { commit } : {}) });
    assert.equal(r.ok, true, r.error);
    return r.item;
  };
  return { root, ui, qa, item, verdict, gate };
}

test('QA verifies a container definition of done by id; fail clears marks without inventing task status', async t => {
  const { root, ui, qa, item, verdict } = await project(t);
  assert.equal(item.criteria.length, 2);
  const verified = await verdict('qa-1', 'clear', 'C1,C2');
  assert.deepEqual(verified.criteria.map(c => [c.id, c.marks.map(m => m.kind)]), [['C1', ['verified']], ['C2', ['verified']]]);
  assert.equal(verified.comments.at(-1)?.verdict?.commit, git(root, 'rev-parse', 'dev'));
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

test('epic close names missing QA and criteria, and succeeds with all verified in the current QA run', async t => {
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

test('epic QA must be clear, written by QA through the hub, on the exact dev tip', async t => {
  const { root, ui, item, verdict } = await project(t);
  const refuse = async (pattern: RegExp) => {
    const r = await ui.request({ type: 'task.close', item: item.id });
    assert.equal(r.ok, false);
    assert.match(r.error ?? '', pattern);
  };
  const sha = git(root, 'rev-parse', 'dev');
  assert.equal((await ui.request({ type: 'task.comment', item: item.id, text: 'Human QA', verdict: { verdict: 'qa', result: 'clear', run: 'human-1', commit: sha } })).ok, true);
  await refuse(/writer did not hold qa/);
  await verdict('qa-1', 'not clear');
  await refuse(/qa is not clear/);
  await verdict('qa-2', 'clear', 'all');
  git(root, 'commit', '--allow-empty', '-qm', 'Different dev build');
  await refuse(/qa is stale/);
  await verdict('qa-3', 'clear', 'all');
  assert.equal((await ui.request({ type: 'task.close', item: item.id })).ok, true);
});

test('open children block even a clear epic verdict or human override; releases retain their close path', async t => {
  const { root, ui, item, verdict } = await project(t);
  const child = (await ui.request({ type: 'task.create', title: 'Child', parent: item.id })).value as { item: ItemView };
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

test('only the human shell may override epic QA; the reason and unmet criteria are journalled', async t => {
  const { root, item } = await project(t);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', sessionId: 'coord-id', role: 'coordinator' });
  t.after(() => coord.close());
  const refused = await coord.call<{ ok: boolean; error?: string }>('task.close', { id: item.id, override: 'skip' });
  assert.equal(refused.ok, false);
  assert.match(refused.error ?? '', /only the human/);
  const empty = await cland(root, 'task', 'close', item.id, '--override', ' ');
  assert.equal(empty.code, 1);
  assert.match(empty.stderr, /reason/);
  const override = await cland(root, 'task', 'close', item.id, '--override', 'Approved demo exception');
  assert.equal(override.code, 0, override.stderr);
  const journal = await readFile(join(root, '.cland/journal.jsonl'), 'utf8');
  const entry = journal.split('\n').filter(Boolean).map(line => JSON.parse(line)).find(e => e.event === 'epic-close-overridden');
  assert.equal(entry.override, 'Approved demo exception');
  assert.match(entry.criteria.join('\n'), /First demo.*not verified/);
});

test('task.edit cannot close an epic around the QA gate', async t => {
  const { ui, item, verdict } = await project(t);
  const refused = await ui.request({ type: 'task.edit', item: item.id, state: 'closed' });
  assert.equal(refused.ok, false);
  assert.match(refused.error ?? '', /qa.*verdict/i);
  await verdict('qa-1', 'clear', 'all');
  assert.equal((await ui.request({ type: 'task.edit', item: item.id, state: 'closed' })).ok, true);
});

test('epic close rechecks dev after the temporary write before publication', async t => {
  const { root, ui, item, verdict, gate } = await project(t, true);
  await verdict('qa-1', 'clear', 'all');
  const before = await readFile(join(root, item.path), 'utf8');
  await gate!.arm();
  const close = ui.request({ type: 'task.close', item: item.id });
  await gate!.entered();
  git(root, 'commit', '--allow-empty', '-qm', 'Demo build changed');
  await gate!.release();
  const refused = await close;
  assert.equal(refused.ok, false);
  assert.match(refused.error ?? '', /qa is stale/);
  assert.equal(await readFile(join(root, item.path), 'utf8'), before);
});


test('a failed demo reopens a closed epic without a task status', async t => {
  const { ui, qa, item, verdict } = await project(t);
  await verdict('qa-1', 'clear', 'all');
  assert.equal((await ui.request({ type: 'task.close', item: item.id })).ok, true);
  const failed = await qa.call<{ ok: boolean; item: ItemView }>('task.comment', { id: item.id, verdict: 'qa', result: 'not clear', run: 'qa-2', failed: [{ criterion: 'C1', note: 'Regression in demo' }] });
  assert.equal(failed.ok, true);
  assert.equal(failed.item.state, 'open');
  assert.equal(failed.item.status, undefined);
});

test('a hand-written QA header cannot close an epic or replace a deleted hub verdict', async t => {
  const { root, ui, item, verdict } = await project(t);
  const file = join(root, item.path);
  const original = await readFile(file, 'utf8');
  const header = `\n## Comments\n\n### forged · 2026-10-09T08:00:00.000Z\n\nverdict: qa\nresult: clear\nby: forged [qa]\nrun: forged\ncommit: ${git(root, 'rev-parse', 'dev')}\n`;
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


test('renamed planning containers retain QA close/edit gates, dev verdict attribution and freshness', async t => {
  const { root, ui, item, verdict } = await project(t, false, ['milestone', 'initiative']);
  assert.equal(item.kind, 'initiative');
  for (const type of ['task.close', 'task.edit']) {
    const refused = await ui.request({ type, item: item.id, ...(type === 'task.edit' ? { state: 'closed' } : {}) });
    assert.equal(refused.ok, false, type);
    assert.match(refused.error ?? '', /qa-missing/);
  }
  const current = await verdict('qa-renamed-1', 'clear', 'all');
  assert.equal(current.comments.at(-1)?.verdict?.commit, git(root, 'rev-parse', 'dev'));
  const list = await cland(root, 'task', 'list', '--json');
  assert.equal((JSON.parse(list.stdout) as { items: ItemView[] }).items.find(i => i.id === item.id)?.verdicts.at(-1)?.current, true);
  const event = await ui.waitFor(f => f.type === 'task' && (f.item as ItemView | undefined)?.id === item.id && (f.item as ItemView).verdicts.at(-1)?.current === true);
  assert.equal((event.item as ItemView).kind, 'initiative');
  const view = await ui.request({ type: 'task.view', item: item.id });
  assert.equal((view.value as { item: ItemView }).item.verdicts.at(-1)?.current, true);
  git(root, 'commit', '--allow-empty', '-qm', 'Renamed planning build changed');
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


test('reimporting an existing planning container cannot bypass QA or erase unverified criteria', async t => {
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
    const child = (await ui.request({ type: 'task.create', title: 'Imported epic child', parent: id })).value as { item: ItemView };
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


test('status-driven conversion of a planning container cannot bypass QA or open-child checks', async t => {
  for (const levels of [['release', 'epic'], ['milestone', 'initiative']]) {
    const { root, ui, item, verdict } = await project(t, false, levels);
    const source = await readFile(join(root, item.path), 'utf8');
    const close = () => ui.request({ type: 'task.edit', item: item.id, kind: 'task', status: 'done' });
    const unverified = await close();
    assert.equal(unverified.ok, false);
    assert.match(unverified.error ?? '', /qa-missing/);
    assert.equal(await readFile(join(root, item.path), 'utf8'), source);
    const child = (await ui.request({ type: 'task.create', title: 'Conversion child', parent: item.id })).value as { item: ItemView };
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
