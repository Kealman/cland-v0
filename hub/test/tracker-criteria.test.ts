// Acceptance criteria through the frame protocol, real MCP spoke and CLI; files stay the truth.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, spawnSpoke, nativeProjectHub as projectHub, startDaemon, tempProject } from './harness.ts';

type View = { id: string; path: string; body: string; criteria: unknown[]; criteriaWarnings: unknown[] };

test('CLI and MCP views expose structured criteria and marks without writing the section', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const body = `## Acceptance criteria

- [x] C1. The clause arrives again on reconnect
  - done: impl-57 · 2026-10-09T10:00Z
  - verified: qa-12 [QA] · run q-0117 · 2026-10-09T11:00Z
- [ ] C2. The failure has a note
  - failed: rev-3 [Reviewer] · 2026-10-09T12:00Z · note Reconnect lost the clause

## Other
- [ ] This is outside the criteria section`;
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'Criteria', body });
  assert.equal(made.ok, true, made.error);
  const item = (made.value as { item: View }).item;
  const before = await readFile(join(root, item.path), 'utf8');
  const expected = [
    { id: 'C1', text: 'The clause arrives again on reconnect', checked: true, marks: [
      { kind: 'done', by: 'impl-57', at: '2026-10-09T10:00Z' },
      { kind: 'verified', current: false, by: 'qa-12 [QA]', run: 'q-0117', at: '2026-10-09T11:00Z' },
    ], malformedMarks: [] },
    { id: 'C2', text: 'The failure has a note', checked: false, marks: [
      { kind: 'failed', by: 'rev-3 [Reviewer]', at: '2026-10-09T12:00Z', note: 'Reconnect lost the clause' },
    ], malformedMarks: [] },
  ];
  const cli = await cland(root, 'task', 'view', item.id, '--json');
  assert.equal(cli.code, 0, cli.stderr);
  assert.deepEqual((JSON.parse(cli.stdout) as { item: View }).item.criteria, expected);
  const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => spoke.close());
  assert.deepEqual((await spoke.call<{ item: View }>('task.view', { id: item.id })).item.criteria, expected);
  assert.equal(await readFile(join(root, item.path), 'utf8'), before);
});

test('orphan and wrongly indented mark lines are reported verbatim without inventing criteria', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const body = `## Acceptance criteria
  - verified: qa-2 [QA] · run q-1 · 2026-10-09T11:00Z
- [ ] C1. Actual criterion
    - done: impl-1 · 2026-10-09T10:00Z`;
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'Malformed', body });
  assert.equal(made.ok, true, made.error);
  const item = (made.value as { item: View }).item;
  const view = await ui.request({ type: 'task.view', item: item.id });
  assert.equal(view.ok, true, view.error);
  const actual = (view.value as { item: View }).item;
  assert.deepEqual(actual.criteriaWarnings, [
    { line: 2, text: '  - verified: qa-2 [QA] · run q-1 · 2026-10-09T11:00Z', reason: 'Mark has no criterion' },
    { line: 4, text: '    - done: impl-1 · 2026-10-09T10:00Z', reason: 'Mark must be indented two spaces below its criterion' },
  ]);
  assert.deepEqual(actual.criteria, [{ id: 'C1', text: 'Actual criterion', checked: false, marks: [], malformedMarks: [
    { line: 4, text: '    - done: impl-1 · 2026-10-09T10:00Z', reason: 'Mark must be indented two spaces below its criterion' },
  ] }]);
  assert.equal(actual.body, body);
});

test('every criterion list sub-item is parsed or reported, including bullet whitespace and tab indentation', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const body = [
    '## Acceptance criteria',
    '- [ ] C3. Actual criterion',
    '  -  verified: qa-2 [QA] · run q-3 · 2026-10-09T11:00Z',
    '  -\tverified: qa-2 [QA] · run q-4 · 2026-10-09T12:00Z',
    '\t- done: impl-1 · 2026-10-09T10:00Z',
    '  -  verified: qa-2 [QA] · yesterday',
    '  -\tverified: qa-2 [QA] · yesterday',
    '  - verifed: qa-2 [QA] · run q-5 · 2026-10-09T13:00Z',
    '  - Supporting prose',
    '  -',
    '  1. An ordered supporting item',
  ].join('\n');
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'Sub-items', body });
  assert.equal(made.ok, true, made.error);
  const item = (made.value as { item: View }).item;
  const before = await readFile(join(root, item.path), 'utf8');
  const view = await ui.request({ type: 'task.view', item: item.id });
  assert.equal(view.ok, true, view.error);
  const actual = (view.value as { item: View }).item;
  const warnings = [
    { line: 5, text: '\t- done: impl-1 · 2026-10-09T10:00Z', reason: 'Mark must be indented two spaces below its criterion' },
    { line: 6, text: '  -  verified: qa-2 [QA] · yesterday', reason: 'Malformed verified mark' },
    { line: 7, text: '  -\tverified: qa-2 [QA] · yesterday', reason: 'Malformed verified mark' },
    { line: 8, text: '  - verifed: qa-2 [QA] · run q-5 · 2026-10-09T13:00Z', reason: 'Unrecognized criterion sub-item' },
    { line: 9, text: '  - Supporting prose', reason: 'Unrecognized criterion sub-item' },
    { line: 10, text: '  -', reason: 'Unrecognized criterion sub-item' },
    { line: 11, text: '  1. An ordered supporting item', reason: 'Unrecognized criterion sub-item' },
  ];
  assert.deepEqual(actual.criteria, [{ id: 'C3', text: 'Actual criterion', checked: false, marks: [
    { kind: 'verified', current: false, by: 'qa-2 [QA]', run: 'q-3', at: '2026-10-09T11:00Z' },
    { kind: 'verified', current: false, by: 'qa-2 [QA]', run: 'q-4', at: '2026-10-09T12:00Z' },
  ], malformedMarks: warnings }]);
  assert.deepEqual(actual.criteriaWarnings, warnings);
  assert.equal(actual.body, body);
  assert.equal(await readFile(join(root, item.path), 'utf8'), before);

  const tabBody = '## Acceptance criteria\n  - [ ] C4. Indented criterion\n\t- Unknown sub-item\n\t\t- done: impl-1 · 2026-10-09T10:00Z';
  const changed = await ui.request({ type: 'task.edit', item: item.id, body: tabBody });
  assert.equal(changed.ok, true, changed.error);
  const tabView = await ui.request({ type: 'task.view', item: item.id });
  assert.equal(tabView.ok, true, tabView.error);
  assert.deepEqual((tabView.value as { item: View }).item.criteriaWarnings, [
    { line: 3, text: '\t- Unknown sub-item', reason: 'Unrecognized criterion sub-item' },
    { line: 4, text: '\t\t- done: impl-1 · 2026-10-09T10:00Z', reason: 'Mark must be indented two spaces below its criterion' },
  ]);
});

test('hand edits re-index reworded and reordered criteria, preserve marks, and report malformed source', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const body = `## Acceptance criteria
- [x] C1. First
  - done: impl-1 · 2026-10-09T10:00Z
- [ ] C8. Second`;
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'Hand edit', body });
  assert.equal(made.ok, true, made.error);
  const item = (made.value as { item: View }).item;
  const file = join(root, item.path);
  const original = await readFile(file, 'utf8');
  const editedBody = `## Acceptance criteria
- [ ] C8. Second, reworded
  - verified: qa-2 [QA] · run q-8 · 2026-10-09T11:00Z
  - verified: qa-2 [QA] · 2026-10-09T11:00Z
  - done: impl-1 · yesterday
  - failed: qa-2 [QA] · 2026-10-09T12:00Z
  - done impl-1 · 2026-10-09T12:00Z
- [x] C1. First
  - done: impl-1 · 2026-10-09T10:00Z`;
  const eventAt = ui.frames.length;
  const edited = original.replace(body, editedBody);
  await writeFile(file, edited);
  await ui.waitFor(f => ui.frames.indexOf(f) >= eventAt && f.type === 'task' && f.id === item.id);
  const view = await ui.request({ type: 'task.view', item: item.id });
  assert.equal(view.ok, true, view.error);
  assert.deepEqual((view.value as { item: View }).item.criteria, [
    { id: 'C8', text: 'Second, reworded', checked: false, marks: [
      { kind: 'verified', current: false, by: 'qa-2 [QA]', run: 'q-8', at: '2026-10-09T11:00Z' },
    ], malformedMarks: [
      { line: 4, text: '  - verified: qa-2 [QA] · 2026-10-09T11:00Z', reason: 'Malformed verified mark' },
      { line: 5, text: '  - done: impl-1 · yesterday', reason: 'Malformed done mark' },
      { line: 6, text: '  - failed: qa-2 [QA] · 2026-10-09T12:00Z', reason: 'Malformed failed mark' },
      { line: 7, text: '  - done impl-1 · 2026-10-09T12:00Z', reason: 'Malformed done mark' },
    ] },
    { id: 'C1', text: 'First', checked: true, marks: [
      { kind: 'done', by: 'impl-1', at: '2026-10-09T10:00Z' },
    ], malformedMarks: [] },
  ]);
  assert.equal((view.value as { item: View }).item.body, editedBody);
  assert.equal(await readFile(file, 'utf8'), edited);
  // Rebuilding the index after restart still reads exactly the file's ids and marks.
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  await startDaemon(t, root);
  const cli = await cland(root, 'task', 'view', item.id, '--json');
  assert.equal(cli.code, 0, cli.stderr);
  assert.deepEqual((JSON.parse(cli.stdout) as { item: View }).item.criteria, (view.value as { item: View }).item.criteria);
});

test('legacy criteria keep checkbox state but have no ids or inferred marks; absent sections return no criteria', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  for (const [body, expected] of [
    ['## Acceptance criteria\n- [ ] Open legacy criterion\n- [X] Checked legacy criterion', [
      { id: null, text: 'Open legacy criterion', checked: false, marks: [], malformedMarks: [] },
      { id: null, text: 'Checked legacy criterion', checked: true, marks: [], malformedMarks: [] },
    ]],
    ['## Acceptance criteria\n\nNo criteria yet.', []],
    ['## Definition of done\n- [x] Other section', []],
    ['', []],
  ] as const) {
    const made = await ui.request({ size: 'M', type: 'task.create', title: 'Legacy', body });
    assert.equal(made.ok, true, made.error);
    const item = (made.value as { item: View }).item;
    const before = await readFile(join(root, item.path), 'utf8');
    const view = await ui.request({ type: 'task.view', item: item.id });
    assert.equal(view.ok, true, view.error);
    assert.deepEqual((view.value as { item: View }).item.criteria, expected);
    assert.equal(await readFile(join(root, item.path), 'utf8'), before);
  }
});

test('criteria parsing respects Markdown fences, section boundaries and wrapped criterion text', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  const body = [
    '```markdown', '## Acceptance criteria', '- [x] C99. Example outside the section', '```',
    '## Acceptance criteria',
    '- [ ] C3. A wrapped criterion', '  continues on this line.',
    '  - [ ] Nested supporting checklist',
    '  - verified: qa-2 [QA] · run q-3 · 2026-10-09T11:00:01.123+02:00',
    '', '```', '- [x] C77. Example inside the section', '## Other heading in the example',
    '  - done: impl-1 · 2026-10-09T10:00Z', '```',
    '* [X] A legacy criterion using another Markdown bullet',
    '  - done: impl-1 · 2026-02-30T10:00Z',
    '## Next section', '- [x] C5. Outside the section',
  ].join('\n');
  const made = await ui.request({ size: 'M', type: 'task.create', title: 'Markdown', body });
  assert.equal(made.ok, true, made.error);
  const item = (made.value as { item: View }).item;
  const view = await ui.request({ type: 'task.view', item: item.id });
  assert.equal(view.ok, true, view.error);
  assert.deepEqual((view.value as { item: View }).item.criteria, [
    { id: 'C3', text: 'A wrapped criterion\ncontinues on this line.', checked: false, marks: [
      { kind: 'verified', current: false, by: 'qa-2 [QA]', run: 'q-3', at: '2026-10-09T11:00:01.123+02:00' },
    ], malformedMarks: [
      { line: 8, text: '  - [ ] Nested supporting checklist', reason: 'Unrecognized criterion sub-item' },
    ] },
    { id: null, text: 'A legacy criterion using another Markdown bullet', checked: true, marks: [], malformedMarks: [
      { line: 17, text: '  - done: impl-1 · 2026-02-30T10:00Z', reason: 'Malformed done mark' },
    ] },
  ]);
});
