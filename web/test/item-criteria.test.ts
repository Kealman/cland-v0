// Web: human criterion edits through the card and CLI readback in a sealed root.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import type { Page } from 'playwright-core';
import { webFixture, pageUntil } from './harness.ts';
import { seedItem } from './items-fixture.ts';
import { cland, connectUi } from '../../hub/test/harness.ts';
import type { ItemView } from '../../hub/src/tracker/tracker.ts';

async function openCriteria(page: Page, id: string) {
  await page.keyboard.press('2');
  const tree = page.getByRole('tree', { name: 'Items tree' });
  await tree.getByRole('treeitem').filter({ hasText: 'Unscheduled' }).click();
  await page.keyboard.press('l');
  await tree.locator(`[data-object-id="${id}"]`).click();
  const card = page.getByRole('region', { name: 'Item card' });
  await card.getByRole('button', { name: 'Criteria', exact: true }).focus();
  await page.keyboard.press('e');
  await card.getByLabel('New criterion', { exact: true }).waitFor();
  return card;
}

test('criteria edits on the card', async t => {
  const fixture = await webFixture(t, { prepare: async root => {
    for (let n = 1; n <= 3; n++) await seedItem(root, `T-${900000 + n}`, 'task', `Criteria task ${n}`, {
      labels: ['keep-label'], rank: n * 10, branch: `t/criteria-${n}`,
    }, '## Summary\n\nKeep summary.\n\n## Details\n\nKeep agents text.\n\n## Acceptance criteria\n\n- [ ] C1. First boundary\n- [ ] C2. Second boundary\n- [ ] C3. Third boundary');
    for (const [id, sequence] of [['T-900004', 1], ['T-900005', 12]] as const) await seedItem(root, id, 'task', 'Legacy criteria', { criterion_seq: sequence },
      '## Acceptance criteria\n\n- [ ] Legacy boundary\n- [x] C1. Stable keeper\n  - done: keeper · 2026-10-20T12:00:00Z');
    await seedItem(root, 'T-900006', 'task', 'Normalize criteria', { criterion_seq: 4 },
      '## Acceptance criteria\n\n- [ ] Legacy boundary\n- [x] C1. Stable keeper\n  - done: keeper · 2026-10-20T12:00:00Z\n- [ ] Another legacy');
  } });
  const view = async (id: string) => {
    const reply = await cland(fixture.root, 'task', 'view', id, '--json');
    assert.equal(reply.code, 0, reply.stderr);
    return JSON.parse(reply.stdout).item as ItemView;
  };
  const frames: Record<string, unknown>[] = [];
  const ui = await connectUi(t, fixture.hub.discovery);
  await t.test('C1 add edit and remove preserve other ids and never reuse an id', async t => fixture.pageCase(t, async page => {
    const card = await openCriteria(page, 'T-900001');
    const added = card.getByRole('textbox', { name: 'Criterion C4', exact: true }).waitFor();
    void added.catch(() => {});
    await card.getByLabel('New criterion', { exact: true }).fill('Added boundary');
    await card.getByRole('button', { name: 'Add criterion', exact: true }).click();
    await added;
    assert.deepEqual((await view('T-900001')).criteria.map(c => [c.id, c.text]), [
      ['C1', 'First boundary'], ['C2', 'Second boundary'], ['C3', 'Third boundary'], ['C4', 'Added boundary'],
    ]);
    assert.equal(await card.getByLabel('Criterion C2', { exact: true }).inputValue(), 'Second boundary', 'draft excludes the C2. label');
    await card.getByLabel('Criterion C2', { exact: true }).fill('Edited boundary');
    const edited = pageUntil(page, () => document.querySelector('[data-criterion-id="C2"]')?.textContent?.includes('Saved') === true, 'edit acknowledged in its row');
    void edited.catch(() => {});
    await card.getByRole('button', { name: 'Save C2', exact: true }).click();
    await edited;
    assert.deepEqual((await view('T-900001')).criteria.map(c => [c.id, c.text]), [
      ['C1', 'First boundary'], ['C2', 'Edited boundary'], ['C3', 'Third boundary'], ['C4', 'Added boundary'],
    ]);
    const removed = card.getByLabel('Criterion C4', { exact: true }).waitFor({ state: 'detached' });
    void removed.catch(() => {});
    await card.getByRole('button', { name: 'Remove C4', exact: true }).click();
    await removed;
    assert.deepEqual((await view('T-900001')).criteria.map(c => c.id), ['C1', 'C2', 'C3']);
    const next = card.getByLabel('Criterion C5', { exact: true }).waitFor();
    void next.catch(() => {});
    await card.getByLabel('New criterion', { exact: true }).fill('Next boundary');
    await card.getByRole('button', { name: 'Add criterion', exact: true }).click();
    await next;
    assert.deepEqual((await view('T-900001')).criteria.map(c => c.id), ['C1', 'C2', 'C3', 'C5']);
    await card.getByLabel('Criterion C2', { exact: true }).fill('C2. Label must stay separate');
    const invalid = card.getByRole('alert').waitFor();
    void invalid.catch(() => {});
    await card.getByRole('button', { name: 'Save C2', exact: true }).click();
    await invalid;
    assert.equal(await card.getByRole('alert').getAttribute('title'), 'Use one line of criterion text without a Ck. label');
    assert.equal((await view('T-900001')).criteria[1]!.text, 'Edited boundary');
    assert.equal(await card.getByLabel('Criterion C2', { exact: true }).inputValue(), 'C2. Label must stay separate', 'refused edits retain the draft');
    const refreshed = pageUntil(page, () => document.querySelector<HTMLInputElement>('[aria-label="Criterion C3"]')?.value === 'Third replacement', 'open criterion refreshes after a task delta');
    void refreshed.catch(() => {});
    const reply = await ui.request({ type: 'task.criterion', item: 'T-900001', op: 'edit', criterion: 'C3', text: 'Third replacement' });
    assert.equal(reply.ok, true, reply.error);
    await refreshed;
    assert.equal(await card.getByLabel('Criterion C3', { exact: true }).inputValue(), 'Third replacement');
    assert.equal(await card.getByLabel('Criterion C2', { exact: true }).inputValue(), 'C2. Label must stay separate', 'deltas preserve an unsaved draft');
    for (const [id, assigned, addedId] of [['T-900004', 'C2', 'C3'], ['T-900005', 'C13', 'C14']] as const) {
      const legacyCard = await openCriteria(page, id);
      await legacyCard.locator('[data-criterion-id="C1"] input').first().waitFor();
      const original = (await view(id)).criteria;
      assert.equal(original[0]!.id, null);
      const keeper = original[1]!;
      const legacy = legacyCard.locator('[data-criterion-legacy]');
      assert.equal(await legacy.count(), 1, 'an id-less row is read-only until the hub persists its identity');
      assert.equal(await legacy.locator('input, button, textarea, [contenteditable="true"]').count(), 0);
      assert.match(await legacy.innerText(), /Legacy boundary/);
      assert.equal(await legacyCard.getByLabel('Criterion C1', { exact: true }).count(), 1, 'only the explicit row carries C1');
      const assignedRow = legacyCard.getByLabel(`Criterion ${assigned}`, { exact: true }).waitFor();
      void assignedRow.catch(() => {});
      await legacyCard.getByLabel('New criterion', { exact: true }).fill('Identity receipt');
      await legacyCard.getByRole('button', { name: 'Add criterion', exact: true }).click();
      await assignedRow;
      let current = (await view(id)).criteria;
      assert.deepEqual(current.map(c => c.id), [assigned, 'C1', addedId]);
      assert.deepEqual(current[1], keeper);
      await legacyCard.getByLabel(`Criterion ${assigned}`, { exact: true }).fill('Edited legacy boundary');
      const saved = legacyCard.locator(`[data-criterion-id="${assigned}"]`).getByRole('status').waitFor();
      void saved.catch(() => {});
      await legacyCard.getByRole('button', { name: `Save ${assigned}`, exact: true }).click();
      await saved;
      current = (await view(id)).criteria;
      assert.equal(current[0]!.text, 'Edited legacy boundary');
      assert.deepEqual(current[1], keeper);
      const done = legacyCard.locator(`[data-criterion-id="${assigned}"]`).getByText('human', { exact: true }).waitFor();
      void done.catch(() => {});
      await legacyCard.getByRole('button', { name: `Mark ${assigned} done`, exact: true }).click();
      await done;
      current = (await view(id)).criteria;
      assert.deepEqual(current[0]!.marks.map(mark => [mark.kind, mark.by]), [['done', 'human']]);
      assert.deepEqual(current[1], keeper);
      const removedLegacy = legacyCard.locator(`[data-criterion-id="${assigned}"]`).waitFor({ state: 'detached' });
      void removedLegacy.catch(() => {});
      await legacyCard.getByRole('button', { name: `Remove ${assigned}`, exact: true }).click();
      await removedLegacy;
      current = (await view(id)).criteria;
      assert.deepEqual(current.map(c => c.id), ['C1', addedId]);
      assert.deepEqual(current[0], keeper, 'edit/done/remove leave the explicit row text, marks and identity untouched');
    }
  }));
  await t.test('legacy criteria become editable after assigning ids on the card', async t => {
    const sent: Record<string, unknown>[] = [];
    await fixture.pageCase(t, async page => {
      const before = (await view('T-900006')).criteria;
      assert.deepEqual(before.map(c => c.id), [null, 'C1', null]);
      const card = await openCriteria(page, 'T-900006');
      const legacy = card.locator('[data-criterion-legacy]');
      const legacyRendered = legacy.first().waitFor();
      void legacyRendered.catch(() => {});
      await legacyRendered;
      assert.equal(await legacy.count(), 2, 'the id-less rows wait for normalization');
      assert.equal(await card.getByLabel('Criterion C5', { exact: true }).count(), 0);
      const assign = card.getByRole('button', { name: 'Assign ids', exact: true });
      assert.equal(await assign.getAttribute('title'), 'Assign stable ids to the criteria that have none; their text and marks stay as they are.');
      const editable = pageUntil(page, () => document.querySelectorAll('[data-criterion-legacy]').length === 0
        && document.querySelector('input[aria-label="Criterion C5"]') !== null
        && document.querySelector('input[aria-label="Criterion C6"]') !== null, 'both assigned criteria are editable inputs');
      void editable.catch(() => {});
      await assign.click();
      await editable;
      assert.deepEqual((await view('T-900006')).criteria.map(c => [c.id, c.text]), [['C5', 'Legacy boundary'], ['C1', 'Stable keeper'], ['C6', 'Another legacy']]);
      assert.deepEqual((await view('T-900006')).criteria[1]!.marks, before[1]!.marks, 'normalization keeps the explicit row marks');
      await card.getByLabel('Criterion C6', { exact: true }).fill('Edited after normalization');
      const saved = card.locator('[data-criterion-id="C6"]').getByRole('status').waitFor();
      void saved.catch(() => {});
      await card.getByRole('button', { name: 'Save C6', exact: true }).click();
      await saved;
      assert.deepEqual((await view('T-900006')).criteria.map(c => [c.id, c.text]), [['C5', 'Legacy boundary'], ['C1', 'Stable keeper'], ['C6', 'Edited after normalization']]);
      assert.equal(sent.filter(frame => frame.type === 'task.criterion' && frame.item === 'T-900006' && frame.op === 'add').length, 0, 'no add was needed to edit');
      assert.equal(sent.filter(frame => frame.type === 'task.criterion' && frame.item === 'T-900006' && frame.op === 'normalize').length, 1);
    }, page => { page.on('websocket', socket => socket.on('framesent', event => sent.push(JSON.parse(String(event.payload))))); });
  });
  await t.test('C2 done is recorded as the human', async t => fixture.pageCase(t, async page => {
    const card = await openCriteria(page, 'T-900002');
    const marked = pageUntil(page, () => document.querySelector('[data-criterion-id="C1"]')?.textContent?.includes('human') === true, 'human done receipt rendered');
    void marked.catch(() => {});
    await card.getByRole('button', { name: 'Mark C1 done', exact: true }).click();
    await marked;
    const criterion = (await view('T-900002')).criteria[0]!;
    assert.equal(criterion.checked, true);
    assert.deepEqual(criterion.marks.map(mark => [mark.kind, mark.by]), [['done', 'human']]);
    assert.equal(await card.getByRole('button', { name: 'Mark C1 done', exact: true }).isDisabled(), true);
    assert.deepEqual(frames.filter(frame => frame.type === 'task.criterion').map(({ type, item, op, criterion, as }) => ({ type, item, op, criterion, as })), [
      { type: 'task.criterion', item: 'T-900002', op: 'done', criterion: 'C1', as: undefined },
    ]);
    await mkdir('web/test-results', { recursive: true });
    await page.screenshot({ path: 'web/test-results/item-criteria.png' });
  }, page => { page.on('websocket', socket => socket.on('framesent', event => frames.push(JSON.parse(String(event.payload))))); }));
  await t.test('C3 the card exposes only criterion fields for editing', async t => fixture.pageCase(t, async page => {
    const before = await view('T-900003');
    const card = await openCriteria(page, 'T-900003');
    await card.getByLabel('Criterion C3', { exact: true }).waitFor();
    assert.deepEqual(await card.getByRole('textbox').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label'))), [
      'Criterion C1', 'Criterion C2', 'Criterion C3', 'New criterion',
    ]);
    assert.equal(await card.locator('textarea, select, [contenteditable="true"]').count(), 0);
    await card.getByRole('button', { name: 'Agents’ text' }).click();
    await pageUntil(page, () => document.querySelector('[aria-label="Item card"] pre')?.textContent?.includes('Keep agents text.') === true, 'agents text remains read-only');
    assert.equal(await card.locator('pre input, pre textarea, pre [contenteditable="true"]').count(), 0);
    await card.getByRole('button', { name: 'Criteria', exact: true }).click();
    await card.focus();
    await page.keyboard.press('e');
    assert.equal(await card.getByRole('button', { name: 'Criteria', exact: true }).getAttribute('aria-expanded'), 'false', 'e applies only on the criteria block');
    for (const name of ['Summary', 'Facts', 'Progress', 'Relations', 'Branch and suite', 'Dates']) {
      await card.getByRole('heading', { name, exact: true }).click();
      await page.keyboard.press('e');
    }
    assert.equal(await card.getByRole('textbox').count(), 0);
    assert.deepEqual(await view('T-900003'), before, 'UI navigation leaves every item field unchanged');
    assert.equal(frames.some(frame => ['task.edit', 'task.rank', 'task.link', 'task.close', 'task.create'].includes(String(frame.type))), false);
    assert.ok(frames.filter(frame => frame.type === 'task.criterion').every(frame => !Object.hasOwn(frame, 'as')));
  }, page => { page.on('websocket', socket => socket.on('framesent', event => frames.push(JSON.parse(String(event.payload))))); }));
});
