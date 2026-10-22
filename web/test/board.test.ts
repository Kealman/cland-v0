// Web: the Board's three acceptance boundaries through the sealed hub/browser fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { webFixture, pageUntil } from './harness.ts';
import { seedItem } from './items-fixture.ts';
import { connectUi } from '../../hub/test/harness.ts';
import type { ExplorerSummary } from '../../shared/wire/index.ts';

test('the Board view and Items view switcher', async t => {
  const fixture = await webFixture(t, { prepare: async root => {
    await seedItem(root, 'R-900000', 'release', 'Board release', { version: '1.0.0' });
    await seedItem(root, 'E-900010', 'epic', 'Working epic', { parent: 'R-900000' });
    await seedItem(root, 'E-900020', 'epic', 'Closed epic', { parent: 'R-900000', state: 'closed', closed: '2026-10-20T12:00:00Z' });
    const statuses = ['in progress', 'review', 'qa', 'ready', 'planned', 'planned', 'backlog', 'done', 'done'] as const;
    for (const [i, status] of statuses.entries()) await seedItem(root, `T-${900100 + i}`, 'task', `Board task ${i}`, {
      parent: 'E-900010', status, rank: (i + 1) * 10,
      ...(i === 4 ? { blocked_by: ['T-900101'] } : {}),
      ...(status === 'done' ? { state: 'closed', closed: '2026-10-20T12:00:00Z' } : {}),
    }, '## Acceptance criteria\n\n- [ ] C1. First\n- [ ] C2. Second', i === 1 ? [{
      author: 'reviewer', at: '2026-10-20T12:00:00Z', text: 'Repair the boundary.',
      verdict: { verdict: 'review', result: 'not clear', by: 'reviewer', run: 'board-review' },
    }] : []);
    await seedItem(root, 'T-900200', 'task', 'Closed epic child', { parent: 'E-900020', state: 'closed', status: 'done' });
    await seedItem(root, 'T-900300', 'task', 'Direct task', { parent: 'R-900000', status: 'planned' });
    await seedItem(root, 'E-900030', 'epic', 'Later epic', { parent: 'R-900000' });
    await seedItem(root, 'T-900301', 'task', 'Later planned task', { parent: 'E-900030', status: 'planned' });
    await seedItem(root, 'C-900400', 'category', 'Bugs');
    await seedItem(root, 'T-900401', 'task', 'Category task', { parent: 'C-900400' });
  } });
  await t.test('C2 release epics fold with hub totals including closed children and unfold into status sections', async t => fixture.pageCase(t, async page => {
    const frames: Record<string, unknown>[] = [];
    page.on('websocket', socket => socket.on('framesent', event => { frames.push(JSON.parse(String(event.payload)) as Record<string, unknown>); }));
    await page.reload();
    await page.keyboard.press('2');
    await page.getByRole('button', { name: 'Board', exact: true }).click();
    const board = page.getByRole('tree', { name: 'Items board' });
    const epic = board.locator('[data-object-id="E-900010"]');
    await pageUntil(page, () => document.querySelector('[aria-label="Items board"] [data-object-id="E-900010"]')?.textContent?.includes('2/9') === true, 'folded epic keeps unloaded closed-child totals');
    assert.equal(await epic.getAttribute('aria-expanded'), 'false');
    assert.match(await epic.innerText(), /2\/9/);
    assert.match(await epic.innerText(), /1 in progress.*1 review.*1 qa.*1 ready.*2 planned.*1 backlog/s);
    assert.equal(await board.locator('[data-object-id^="T-"]').count(), 0);
    assert.equal(frames.some(frame => frame.type === 'task.list' && frame.parent === 'E-900010'), false, 'folded epic needs no closed-child read');
    const closedEpic = board.locator('[data-object-id="E-900020"]');
    await closedEpic.waitFor();
    assert.match(await closedEpic.innerText(), /1\/1/);
    const direct = board.getByRole('treeitem').filter({ hasText: 'Direct tasks' });
    assert.match(await direct.innerText(), /Direct tasks \(1\)/);
    assert.match(await page.getByLabel('Board categories').innerText(), /Bugs.*1 open/);
    await epic.locator('[data-tree-chevron]').click();
    await board.locator('[data-object-id="T-900108"]').waitFor();
    assert.equal(await epic.getAttribute('aria-expanded'), 'true');
    assert.deepEqual(await board.locator('[data-board-section]').allTextContents(), [
      'IN PROGRESS · 1', 'REVIEW · 1', 'QA · 1', 'READY · 1', 'PLANNED · 2', 'BACKLOG · 1', 'DONE · 2',
    ]);
    assert.match(await board.locator('[data-object-id="T-900101"]').innerText(), /E-900010 ›.*✗ review r1.*0\/2/s);
    assert.match(await board.locator('[data-object-id="T-900104"]').innerText(), /blocked/);
    assert.match(await board.locator('[data-object-id="T-900105"]').innerText(), /next/);
    assert.doesNotMatch(await board.locator('[data-object-id="T-900104"]').innerText(), /next/);
    await page.getByRole('button', { name: 'E-900010 Working epic', exact: true }).click();
    assert.equal(await board.locator('[data-object-id="E-900010"]').count(), 0, 'epic tab narrows to sections');
    assert.equal(await board.locator('[data-object-id="T-900300"]').count(), 0);
    await page.getByRole('button', { name: 'E-900030 Later epic', exact: true }).click();
    await board.locator('[data-object-id="T-900301"]').waitFor();
    assert.doesNotMatch(await board.locator('[data-object-id="T-900301"]').innerText(), /next/, 'narrowing never replaces the release next');
    await page.getByRole('button', { name: 'All epics', exact: true }).click();
    await mkdir('web/test-results', { recursive: true });
    await page.screenshot({ path: 'web/test-results/items-board.png', fullPage: true });
    await direct.click();
    await board.locator('[data-object-id="T-900300"]').waitFor();
    await page.getByRole('button', { name: 'Tree', exact: true }).click();
    const tree = page.getByRole('tree', { name: 'Items tree' });
    const treeDirect = tree.getByRole('treeitem').filter({ hasText: 'Direct tasks' });
    assert.equal(await treeDirect.getAttribute('aria-expanded'), 'false', 'Board unfolding leaves Tree folded');
    await treeDirect.click();
    await tree.locator('[data-object-id="T-900300"]').waitFor();
    await page.getByRole('button', { name: 'Board', exact: true }).click();
    await direct.click();
    assert.equal(await direct.getAttribute('aria-expanded'), 'false');
    await page.getByRole('button', { name: 'Tree', exact: true }).click();
    assert.equal(await treeDirect.getAttribute('aria-expanded'), 'true', 'Board folding leaves Tree unfolded');
    await treeDirect.click();
    await treeDirect.click();
    await tree.locator('[data-object-id="T-900300"]').waitFor();
    await page.getByRole('button', { name: 'Board', exact: true }).click();
    assert.equal(await direct.getAttribute('aria-expanded'), 'false', 'Tree unfolding leaves Board folded');
  }));
  await t.test('C1 Tree to Board to Tree retains epic scope, filter and selected task', async t => fixture.pageCase(t, async page => {
    const tree = page.getByRole('tree', { name: 'Items tree' });
    await tree.locator('[data-object-id="T-900105"]').click();
    assert.equal(await tree.locator('[data-object-id="R-900000"]').count(), 0, 'tree is scoped to the epic');
    assert.equal(await tree.locator('[data-object-id="T-900107"]').count(), 0, 'done filter is active');
    await page.getByRole('button', { name: 'Board', exact: true }).click();
    const board = page.getByRole('tree', { name: 'Items board' });
    assert.match(await page.getByLabel('Board scope', { exact: true }).innerText(), /E-900010 Working epic/);
    assert.equal(await board.locator('[data-object-id="T-900105"]').getAttribute('aria-selected'), 'true');
    assert.equal(await board.locator('[data-object-id="T-900107"]').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'D · Done hidden', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('button', { name: 'Graph', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Plan', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Tree', exact: true }).click();
    assert.equal(await tree.locator('[data-object-id="T-900105"]').getAttribute('aria-selected'), 'true');
    assert.equal(await tree.locator('[data-object-id="R-900000"]').count(), 0);
    assert.equal(await tree.locator('[data-object-id="T-900107"]').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'D · Done hidden', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.getByRole('region', { name: 'Item card' }).getAttribute('data-item-id'), 'T-900105');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cland.ui.items.v1')!).tree.scope), 'E-900010');
  }, async page => { await page.addInitScript(() => {
    localStorage.setItem('cland.ui.shell.v1', JSON.stringify({ area: 'Items', release: 'R-900000' }));
    localStorage.setItem('cland.ui.items.v1', JSON.stringify({ tree: { scope: 'E-900010', hideDone: true, open: { 'E-900010': true } } }));
  }); }));
  await t.test('C3 Board keys and mouse expose no rank or move action', async t => {
    const ui = await connectUi(t, fixture.hub.discovery);
    const frames: Record<string, unknown>[] = [];
    await fixture.pageCase(t, async page => {
      await page.keyboard.press('2');
      await page.getByRole('button', { name: 'Board', exact: true }).click();
      const board = page.getByRole('tree', { name: 'Items board' });
      await board.locator('[data-object-id="E-900010"] [data-tree-chevron]').click();
      const first = board.locator('[data-object-id="T-900100"]');
      const second = board.locator('[data-object-id="T-900101"]');
      await first.click();
      // Neovim's rank/top chords and ordinary drag gestures must remain inert here.
      for (const key of ['Shift+J', 'Shift+K', 'Shift+T', 'Control+j', 'Control+k']) await page.keyboard.press(key);
      await first.dragTo(second);
      await second.click({ button: 'right' });
      await page.getByRole('button', { name: 'Help', exact: true }).click();
      const help = page.getByRole('dialog', { name: 'Items keys' });
      await help.waitFor();
      assert.doesNotMatch(await help.innerText(), /\brank\b|\bmove (?:item|task|up|down|top)\b/i);
      await page.keyboard.press('Escape');
      await first.click();
      await page.keyboard.press('j');
      await pageUntil(page, () => document.activeElement?.getAttribute('data-object-id') === 'T-900101', 'Board still navigates after inert rank chords and mouse gestures');
      assert.equal(await second.getAttribute('aria-selected'), 'true');
      assert.equal(await board.locator('[draggable="true"]').count(), 0);
      assert.equal(await page.getByRole('button', { name: /rank|move.*(?:item|task|up|down|top)/i }).count(), 0);
      assert.equal(frames.some(frame => ['task.rank', 'task.move', 'task.edit'].includes(String(frame.type))), false);
      const result = await ui.request({ type: 'task.list', projection: 'summary', under: 'E-900010' });
      assert.equal(result.ok, true, result.error);
      assert.deepEqual((result.value as { items: ExplorerSummary[] }).items.map(item => [item.id, item.parent, item.rank]),
        Array.from({ length: 9 }, (_, i) => [`T-${900100 + i}`, 'E-900010', (i + 1) * 10]));
    }, page => { page.on('websocket', socket => socket.on('framesent', event => frames.push(JSON.parse(String(event.payload))))); });
  });
});
