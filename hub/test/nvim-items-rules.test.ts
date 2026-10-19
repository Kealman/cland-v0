// T2: item indexing, Lead claims and verdict freshness through injected hub edges.
// Refresh client inputs: CLAND_RECORD_T902=1 node --test hub/test/nvim-items-rules.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, eventually, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
const AT = '2026-10-08T10:00:00.000Z';

/** An item file as the tracker writes it (spec 4.6): frontmatter, the body, the comments. */
function itemFile(id: string, title: string, fm: Record<string, string> = {}, rest = ''): string {
  const fields: Record<string, string> = { id, kind: 'task', title, state: 'open', labels: '[]', assignee: 'null', parent: 'null', blocked_by: '[]', topic: 'null', branch: 'null', created: AT, updated: AT, ...fm };
  return `---\n${Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n${rest ? `\n${rest}\n` : ''}`;
}

const verdictComment = (who: string, role: string, kind: string, result: string, run: string, min: number, text: string) =>
  `### ${who} · 2026-10-08T10:${String(min).padStart(2, '0')}:00.000Z\n\nverdict: ${kind}\nresult: ${result}\nby: ${who} [${role}]\nrun: ${run}\n\n${text}\n`;

const FIXTURE: Record<string, string> = {
  'T-1-workbench-shell.md': itemFile('T-1', 'Workbench shell', { kind: 'epic' }),
  'T-2-items-panel.md': itemFile('T-2', 'Items panel', { parent: 'T-1', branch: 't/2-items-panel' }),
  'T-3-board-view.md': itemFile(
    'T-3',
    'Board view',
    { parent: 'T-1', status: 'review' },
    `Six columns derived from the item.\n\n## Comments\n\n### impl-1 · 2026-10-08T10:02:00.000Z\n\nReady for review.\n\n${verdictComment('rev-1', 'reviewer', 'review', 'not clear', 'r-2', 5, 'The qa column is missing.')}`,
  ),
  'T-4-item-view.md': itemFile('T-4', 'Item view', { parent: 'T-1', state: 'closed' }, `## Comments\n\n${verdictComment('rev-1', 'reviewer', 'review', 'clear', 'r-3', 4, 'Fine.')}\n${verdictComment('qa-1', 'qa', 'qa', 'clear', 'q-1', 6, 'Checked.')}`),
  'T-5-slice-2-map.md': itemFile('T-5', 'Slice 2 map', { kind: 'map' }),
  'T-6-which-store.md': itemFile('T-6', 'Which store', { kind: 'question', parent: 'T-5', state: 'closed' }),
  'T-7-transport.md': itemFile('T-7', 'Transport', { kind: 'question', parent: 'T-5' }),
  'T-8-auth-scheme.md': itemFile('T-8', 'Auth scheme', { kind: 'question', parent: 'T-5', blocked_by: '[T-7]' }),
  'T-9-review-passed.md': itemFile('T-9', 'Review passed', {parent: 'T-1', status: 'qa'}, `## Comments\n\n${verdictComment('rev-1', 'reviewer', 'review', 'clear', 'r-4', 7, 'Good.')}`),
};


const clock = () => new FakeClock(Date.parse('2026-10-19T12:00:00Z'));
async function capture(root: string, ui: Awaited<ReturnType<typeof connectUi>>, name: string) {
  const tasks = await ui.request({ type: 'task.list' });
  assert.equal(tasks.ok, true, tasks.error);
  const summaries = (tasks.value as { items: Array<{ id: string }> }).items;
  const items: Array<Record<string, unknown>> = [];
  for (const summary of summaries) {
    const view = await ui.request({ type: 'task.view', item: summary.id });
    assert.equal(view.ok, true, view.error);
    const item = (view.value as { item: Record<string, unknown> }).item;
    items.push({ ...item, file: String(item.path).split('/').at(-1) });
  }
  const sessions = await ui.request({ type: 'session.list' });
  assert.equal(sessions.ok, true, sessions.error);
  const scenario = { items, processes: (sessions.value as { processes: unknown[] }).processes };
  const output = new URL(`../../nvim/test/fixtures/t902-${name}.json`, import.meta.url);
  if (process.env.CLAND_RECORD_T902) {
    await writeFile(output, JSON.stringify(scenario, null, 2).split(root).join('@root@') + '\n');
  } else {
    const expected = JSON.parse(await readFile(output, 'utf8'));
    const normalize = (value: unknown) => {
      const ids = new Map<string, string>();
      return JSON.stringify(value).split(root).join('@root@').replace(/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}/g, id => {
        if (!ids.has(id)) ids.set(id, `identity-${ids.size}`);
        return ids.get(id)!;
      });
    };
    assert.equal(normalize(scenario), normalize(expected), `client input ${name} drifted; refresh with CLAND_RECORD_T902=1`);
  }
  return items;
}
test('closed container and task state survives tracker projection', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[tracker]\nlevels = ["release", "epic"]\n');
  for (const [id, title, fields] of [
    ['T-1', 'Current release', { kind: 'release', version: '1.0.0' }],
    ['T-2', 'Closed container', { kind: 'epic', parent: 'T-1', state: 'closed' }],
    ['T-3', 'Closed task', { parent: 'T-2', state: 'closed' }],
  ] as const) await writeFile(join(root, `.cland/tasks/${id}-item.md`), itemFile(id, title, fields));
  const { discovery } = await projectHub(t, root, {}, { clock: clock() });
  const ui = await connectUi(t, discovery);
  await capture(root, ui, 'closed');
});

test('an injected Lead launch claims its epic', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[tracker]\nlevels = ["epic"]\n');
  const { discovery } = await projectHub(t, root, {}, { clock: clock() });
  const ui = await connectUi(t, discovery);
  const created = await cland(root, 'task', 'create', 'Led epic', '--kind', 'epic');
  assert.equal(created.code, 0, created.stderr);
  const launched = await ui.request({ type: 'session.launch', name: 'lead-1', role: 'lead', item: 'T-1', harness: 'claude-code' });
  assert.equal(launched.ok, true, launched.error);
  const items = await capture(root, ui, 'lead');
  assert.equal((items[0]!.claim as { role: string }).role, 'lead');
});

test('configured kinds receive canonical ids in tracker snapshots', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[tracker]\nlevels = ["initiative", "feature"]\n');
  for (const [id, kind] of [['T-1', 'initiative'], ['T-2', 'feature'], ['T-3', 'task'], ['T-4', 'question'], ['T-5', 'spec'], ['T-6', 'map']]) {
    await writeFile(join(root, `.cland/tasks/${id}-${kind}.md`), itemFile(id!, kind!, { kind: kind!, ...(['task', 'question', 'spec'].includes(kind!) ? {parent: 'T-1'} : {}) }));
  }
  const { discovery } = await projectHub(t, root, {}, { clock: clock() });
  const ui = await connectUi(t, discovery);
  await capture(root, ui, 'containers');
});

test('the tracker indexes hand-written files and saved titles within one second', async (t) => {
  const root = await tempProject(t);
  const tasks = join(root, '.cland', 'tasks');
  await mkdir(tasks, { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[tracker]\nlevels = ["epic"]\n');
  for (const [name, text] of Object.entries(FIXTURE)) await writeFile(join(tasks, name), text);
  const { discovery } = await projectHub(t, root, {}, { clock: clock() });
  const ui = await connectUi(t, discovery);
  const claimed = await cland(root, 'task', 'claim', 'T-2', '--as', 'impl-1', '--role', 'implementer');
  assert.equal(claimed.code, 0, claimed.stderr);

  await capture(root, ui, 'tree');
  await writeFile(join(tasks, 'T-10-born-by-hand.md'), itemFile('T-10', 'Born by hand', { parent: 'T-5', kind: 'question' }));
  await eventually('hand-written item re-indexed within one second', async () => {
    const r = await ui.request({ type: 'task.view', item: 'Q-10' });
    return r.ok ? true : undefined;
  }, 1000);
  await capture(root, ui, 'added');
  await writeFile(join(tasks, 'T-7-transport.md'), itemFile('T-7', 'Transport over QUIC', { parent: 'T-5', kind: 'question' }));
  await eventually('saved title re-indexed within one second', async () => {
    const r = await ui.request({ type: 'task.view', item: 'Q-7' });
    return r.ok && (r.value as { item: { title: string } }).item.title === 'Transport over QUIC' ? true : undefined;
  }, 1000);
  const list = JSON.parse((await cland(root, 'task', 'list', '--json')).stdout) as { items: Array<{ id: string; title: string }> };
  assert.equal(list.items.find(i => i.id === 'Q-7')?.title, 'Transport over QUIC', 'the hub re-indexed the save');
  await capture(root, ui, 'saved');
});

test('changed Git facts stale hub verdicts while retaining file provenance', async (t) => {
  const root = await tempProject(t);
  const sha = 'a'.repeat(40);
  let head = sha;
  const git = async (args: string[], input?: string) => {
    if (args[0] === 'for-each-ref') return `${'b'.repeat(40)} refs/heads/main\n${head} refs/heads/t/test`;
    if (args[0] === 'rev-parse') { const ref = args.at(-1)!.replace(/\^\{commit\}$/, ''); return /^[a-f0-9]{40}$/.test(ref) ? ref : head; }
    if (args[0] === 'merge-base') return 'b'.repeat(40);
    if (args[0] === 'diff') return args.at(-2)!;
    if (args[0] === 'patch-id') return `${input?.trim()} 0`;
    return null;
  };
  let refreshTips: (() => Promise<void>) | undefined;
  const { discovery } = await projectHub(t, root, {}, { clock: clock(), git, readBase: async () => 'main',
    scheduleTips: read => { refreshTips = read; return { poke: () => { void read(); }, stop: () => {} }; },
  });
  const ui = await connectUi(t, discovery);
  const created = await cland(root, 'task', 'create', '--size', 'M', 'Reviewed', '--branch', 't/test', '--json');
  assert.equal(created.code, 0, created.stderr);
  const item = JSON.parse(created.stdout).item as { path: string };
  const recorded = await cland(root, 'task', 'comment', 'T-1', 'Checked.', '--verdict', 'review', '--scope', 'full', '--result', 'clear', '--run', 'r-1');
  assert.equal(recorded.code, 0, recorded.stderr);
  const file = join(root, item.path);
  await writeFile(file, (await readFile(file, 'utf8')) + '\n' + verdictComment('qa-1', 'qa', 'qa', 'clear', 'q-1', 6, 'Imported.'));
  head = 'c'.repeat(40);
  await refreshTips!();
  await eventually('both verdicts are stale', async () => {
    const r = await ui.request({ type: 'task.view', item: 'T-1' });
    const verdicts = (r.value as { item: { verdicts: Array<{ current: boolean }> } }).item.verdicts;
    assert.equal(verdicts.length, 2, JSON.stringify(verdicts));
    assert.ok(verdicts.every(v => v.current === false), JSON.stringify(verdicts));
    return true;
  });
  const items = await capture(root, ui, 'verdicts');
  const verdicts = items[0]!.verdicts as Array<{ commit: string | null; source: string }>;
  assert.equal(verdicts[0]!.commit, sha);
  assert.deepEqual(verdicts.map(v => v.source), ['hub', 'file']);
});
