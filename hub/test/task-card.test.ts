// T3: exact native branch/epic tips and closing-time publication through CLI/MCP.
import { fixtureEnvironment } from './fixture-environment.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, eventually, spawnSpoke, startDaemon, tempProject } from './harness.ts';
import { parseItem } from '../src/tracker/item.ts';
import { execFileSync } from 'node:child_process';
import { preparedProject } from './prepared-project.ts';
import { type ItemView, type ItemSummary } from '../src/tracker/tracker.ts';

test('list criteria counts use exclusive mark precedence and exact branch and epic tips', async t => {
  const root = await preparedProject(t);
  const tip = execFileSync('git', ['rev-parse', 'dev'], { env: fixtureEnvironment(root, process.env), cwd: root, encoding: 'utf8' }).trim();
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const body = `## Acceptance criteria
- [x] C1. Done only
  - done: impl · 2026-10-13T10:00Z
- [x] C2. Current beats stale and done
  - done: impl · 2026-10-13T10:00Z
  - verified: rev [reviewer] · run old · 2026-10-13T10:00Z
  - verified: rev [reviewer] · run current · 2026-10-13T10:00Z · commit ${tip}
- [x] C3. Stale beats done
  - done: impl · 2026-10-13T10:00Z
  - verified: rev [reviewer] · run old · 2026-10-13T10:00Z · commit ${'a'.repeat(40)}
- [ ] C4. Failed beats current
  - failed: rev [reviewer] · 2026-10-13T10:00Z · note Broken
  - verified: rev [reviewer] · run current · 2026-10-13T10:00Z · commit ${tip}
- [x] C5. A checkbox alone is open
- [ ] C6. Legacy verification is stale
  - verified: rev [reviewer] · run legacy · 2026-10-13T10:00Z`;
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  const { item } = await coord.call<{ item: ItemView }>('task.create', { size: 'M', title: 'Counts', body, branch: 'dev' });
  const counts = { total: 6, done: 1, verified: 1, stale: 2, failed: 1 };
  await eventually('counts resolve the current branch tip', async () => {
    const list = await coord.call<{ items: ItemSummary[] }>('task.list', {});
    return JSON.stringify(list.items[0]?.criteria) === JSON.stringify(counts) ? true : undefined;
  });
  const detail = await coord.call<{ item: ItemView }>('task.view', { id: item.id });
  assert.deepEqual(detail.item.criteriaCounts, counts);
  assert.equal(detail.item.criteria[1]!.marks.at(-1)?.kind, 'verified');
  const epic = await coord.call<{ item: ItemView }>('task.create', { title: 'Definition', kind: 'epic', body: body.replace('Acceptance criteria', 'Definition of done') });
  const list = await coord.call<{ items: ItemSummary[] }>('task.list', {});
  assert.deepEqual(list.items.find(i => i.id === epic.item.id)?.criteria, counts);
  assert.deepEqual(epic.item.criteriaCounts, counts);
  const event = await ui.waitFor(f => f.type === 'task' && (f.item as ItemSummary)?.id === epic.item.id);
  assert.deepEqual((event.item as ItemSummary).criteria, counts);
  assert.match((await cland(root, 'task', 'view', item.id)).stdout, /criteria +1 verified \/ 6 total.*1 done.*2 stale.*1 failed/);
});

test('close, done and reopen publish the file closing time through CLI, MCP and task events', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  const { item } = await coord.call<{ item: { id: string; path: string } }>('task.create', { size: 'M', title: 'Closing time' });
  const read = async () => (await coord.call<{ item: { closed?: string; state: string } }>('task.view', { id: item.id })).item;
  for (const args of [['close', item.id], ['edit', item.id, '--status', 'done']]) {
    const from = ui.frames.length;
    const result = await cland(root, 'task', ...args, '--json');
    assert.equal(result.code, 0, result.stderr);
    const closed = JSON.parse(result.stdout).item.closed;
    assert.match(closed, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    assert.equal((await read()).closed, closed);
    assert.equal(parseItem(await readFile(join(root, item.path), 'utf8')).fm.closed, closed);
    const list = await cland(root, 'task', 'list', '--json');
    assert.equal(JSON.parse(list.stdout).items[0].closed, closed);
    const event = await ui.waitFor(f => ui.frames.indexOf(f) >= from && f.type === 'task' && (f.item as { closed?: string })?.closed === closed);
    assert.equal((event.item as { id: string }).id, item.id);
    assert.match((await cland(root, 'task', 'view', item.id)).stdout, new RegExp(`closed +${closed.replaceAll('.', '\\.')}\n`));
    await coord.call('task.edit', { id: item.id, state: 'open' });
    assert.equal((await read()).closed, undefined);
    assert.doesNotMatch(await readFile(join(root, item.path), 'utf8'), /^closed:/m);
  }
  const { item: container } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Category', kind: 'category' });
  const result = await coord.call<{ item: { closed: string } }>('task.close', { id: container.id });
  assert.ok(result.item.closed);
  // A hand close does not invent a time from updated or the wall clock.
  const source = await readFile(join(root, item.path), 'utf8');
  await writeFile(join(root, item.path), source.replace('state: open', 'state: closed').replace('status: backlog', 'status: done'));
  await eventually('hand close indexed without a time', async () => {
    const list = JSON.parse((await cland(root, 'task', 'list', '--json')).stdout).items;
    return list.find((i: { id: string; state: string; closed?: string }) => i.id === item.id && i.state === 'closed' && i.closed === undefined);
  });
});
