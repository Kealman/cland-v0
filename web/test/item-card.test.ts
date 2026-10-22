// Web: drawer facts and lazy text through a real scratch hub and Headless Shell.
import test from 'node:test';
import assert from 'node:assert/strict';
import { webFixture, pageUntil } from './harness.ts';
import { connectUi } from '../../hub/test/harness.ts';
import { seedItem } from './items-fixture.ts';

test('drawer cards use summary facts across ten rows without task.view', async t => {
  const fixture = await webFixture(t, { prepare: async root => {
    await seedItem(root, 'R-900000', 'release', 'Card release', { version: '1.0.0' });
    for (let n = 1; n <= 10; n++) await seedItem(root, `T-${900000 + n}`, 'task', `Card task ${n}`, {
      parent: 'R-900000', rank: n, labels: ['card-fixture'], branch: `t/card-${n}`,
    }, `${n === 10 ? '## Context\n\nCard fallback.' : '## Summary\n\nCard summary.'}\n\n## Details\n\nDeferred agents body.\n\n## Acceptance criteria\n\n- [ ] C1. First boundary\n- [ ] C2. Second boundary`, [
      { author: 'reviewer', at: '2026-10-20T12:00:00Z', text: 'First reason.', verdict: { verdict: 'review', result: 'not clear', by: 'reviewer', run: 'r1', scope: 'full' } },
      { author: 'reviewer', at: '2026-10-20T13:00:00Z', text: 'Repair the boundary. Further detail.', verdict: { verdict: 'review', result: 'not clear', by: 'reviewer', run: 'r2', scope: 'delta' } },
      { author: 'human', at: '2026-10-20T14:00:00Z', text: 'Decided: keep the boundary.' },
    ]);
  } });
  const frames: Array<{ type: string; [key: string]: unknown }> = [];
  await fixture.pageCase(t, async page => {
    await page.keyboard.press('2');
    const tree = page.getByRole('tree', { name: 'Items tree' });
    await tree.getByRole('treeitem').filter({ hasText: 'Direct tasks' }).click();
    await page.keyboard.press('l');
    await tree.locator('[data-object-id="T-900001"]').click();
    const card = page.getByRole('region', { name: 'Item card' });
    await card.waitFor();
    for (let n = 1; n <= 10; n++) {
      await page.locator(`[aria-label="Item card"][data-item-id="T-${900000 + n}"]`).waitFor();
      await pageUntil(page, () => document.querySelector('[aria-label="Item card"]')?.textContent?.includes('Repair the boundary.') === true, 'verdict reason rendered');
      assert.equal(await card.getAttribute('data-item-id'), `T-${900000 + n}`);
      for (const fact of [n === 10 ? 'Card fallback.' : 'Card summary.', 'not clear', 'r2', 'delta', 'Decided: keep the boundary.', 'card-fixture', 'S', `t/card-${n}`, '2026-10-20']) assert.ok((await card.innerText()).includes(fact), fact);
      assert.match(await card.innerText(), /0 of 2 verified/);
      if (n === 10) assert.match(await card.innerText(), /fallback from ## Context/);
      if (n < 10) await page.keyboard.press('j');
    }
    assert.equal(frames.filter(frame => frame.type === 'task.view').length, 0);
  }, page => { page.on('websocket', socket => socket.on('framesent', event => frames.push(JSON.parse(String(event.payload))))); });
});

test('agents text loads once on expansion and survives folding and reselection', async t => {
  const fixture = await webFixture(t, { prepare: async root => {
    await seedItem(root, 'T-900001', 'task', 'Lazy text', {}, '## Summary\n\nLazy summary.\n\n## Details\n\nDeferred agents body.');
    await seedItem(root, 'T-900002', 'task', 'Other card');
  } });
  const frames: Array<{ type: string }> = [];
  await fixture.pageCase(t, async page => {
    await page.keyboard.press('2');
    const tree = page.getByRole('tree', { name: 'Items tree' });
    await tree.getByRole('treeitem').filter({ hasText: 'Unscheduled' }).click();
    await page.keyboard.press('l');
    await tree.locator('[data-object-id="T-900001"]').click();
    const card = page.getByRole('region', { name: 'Item card' });
    const toggle = card.getByRole('button', { name: 'Agents’ text' });
    assert.equal(frames.filter(frame => frame.type === 'task.view').length, 0);
    await toggle.click();
    await pageUntil(page, () => document.querySelector('[aria-label="Item card"] pre')?.textContent?.includes('Deferred agents body.') === true, 'body rendered');
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    await toggle.click();
    assert.equal(await card.locator('pre').count(), 0);
    await toggle.click();
    assert.match(await card.locator('pre').innerText(), /Deferred agents body/);
    await page.getByRole('complementary', { name: 'Drawer' }).getByRole('button', { name: 'Close', exact: true }).click();
    await tree.locator('[data-object-id="T-900002"]').click();
    await tree.locator('[data-object-id="T-900001"]').click();
    await toggle.click();
    assert.match(await card.locator('pre').innerText(), /Deferred agents body/);
    assert.equal(frames.filter(frame => frame.type === 'task.view').length, 1);
  }, page => { page.on('websocket', socket => socket.on('framesent', event => frames.push(JSON.parse(String(event.payload))))); });
});

test('Enter enters the card and Escape or h returns to the same tree row', async t => {
  const fixture = await webFixture(t, { prepare: async root => {
    await seedItem(root, 'T-900001', 'task', 'Focus card');
    await seedItem(root, 'T-900002', 'task', 'Mouse focus card');
  } });
  await fixture.pageCase(t, async page => {
    await page.keyboard.press('2');
    const tree = page.getByRole('tree', { name: 'Items tree' });
    await tree.getByRole('treeitem').filter({ hasText: 'Unscheduled' }).click();
    await page.keyboard.press('l');
    const row = tree.locator('[data-object-id="T-900001"]');
    await row.click();
    for (const key of ['Escape', 'h', 'Enter']) {
      const entered = pageUntil(page, () => document.activeElement?.getAttribute('aria-label') === 'Item card', 'card focused');
      void entered.catch(() => {});
      await page.keyboard.press('Enter');
      await entered;
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Item card');
      await page.keyboard.press(key);
      assert.equal(await row.evaluate(node => document.activeElement === node), true);
      assert.equal(await row.getAttribute('aria-selected'), 'true');
      assert.equal(await page.getByRole('complementary', { name: 'Drawer' }).isVisible(), true);
    }
    const otherRow = tree.locator('[data-object-id="T-900002"]');
    for (const key of ['Escape', 'h']) {
      await row.click();
      const enteredA = pageUntil(page, () => document.activeElement?.getAttribute('aria-label') === 'Item card', 'first card keyboard focused');
      void enteredA.catch(() => {});
      await page.keyboard.press('Enter');
      await enteredA;
      await page.keyboard.press('Escape');
      await otherRow.click();
      await page.getByRole('region', { name: 'Item card' }).getByRole('button', { name: 'Agents’ text' }).click();
      await page.keyboard.press(key);
      assert.equal(await otherRow.evaluate(node => document.activeElement === node), true);
      assert.equal(await otherRow.getAttribute('aria-selected'), 'true');
      assert.equal(await page.getByRole('region', { name: 'Item card' }).getAttribute('data-item-id'), 'T-900002');
    }
    await row.click();
    const entered = pageUntil(page, () => document.activeElement?.getAttribute('aria-label') === 'Item card', 'card focused before split');
    void entered.catch(() => {});
    await page.keyboard.press('Enter');
    await entered;
    await page.keyboard.press('Meta+Enter');
    await page.getByRole('separator', { name: 'Pane divider' }).waitFor();
    assert.equal(await page.getByRole('complementary', { name: 'Drawer' }).count(), 0);
    assert.equal(await page.locator('[data-pane="secondary"] [aria-label="Item card"]').getAttribute('data-item-id'), 'T-900001');
    for (const swap of [false, true]) {
      if (swap) await page.locator('[data-pane="secondary"]').getByRole('button', { name: 'Swap', exact: true }).click();
      const treePane = page.locator(`[data-pane="${swap ? 'secondary' : 'primary'}"]`);
      const splitRow = treePane.locator('[data-object-id="T-900001"]');
      const cardPane = swap ? 'primary' : 'secondary';
      await splitRow.click();
      for (const key of ['Escape', 'h', 'Enter']) {
        const focused = pageUntil(page, () => document.activeElement?.getAttribute('aria-label') === 'Item card', 'split card focused');
        void focused.catch(() => {});
        await page.keyboard.press('Enter');
        await focused;
        assert.equal(await page.evaluate(() => document.activeElement?.closest('[data-pane]')?.getAttribute('data-pane')), cardPane);
        await page.keyboard.press(key);
        assert.equal(await splitRow.evaluate(node => document.activeElement === node), true);
        assert.equal(await splitRow.getAttribute('aria-selected'), 'true');
      }
    }
  });
});

test('closed cards fetch by-id facts and refresh from item deltas', async t => {
  const fixture = await webFixture(t, { prepare: async root => {
    await seedItem(root, 'R-900000', 'release', 'Closed card release', { version: '1.0.0' });
    await seedItem(root, 'T-900001', 'task', 'Closed card', { parent: 'R-900000', state: 'closed', status: 'done', branch: 't/closed', closed: '2026-10-20T15:00:00Z' },
      '## Summary\n\nClosed summary.\n\n## Details\n\nOriginal closed body.', [
        { author: 'human', at: '2026-10-20T14:00:00Z', text: 'Resolution: closed decision.' },
      ]);
  } });
  const frames: Array<{ type: string; ids?: string[] }> = [];
  const ui = await connectUi(t, fixture.hub.discovery);
  await fixture.pageCase(t, async page => {
    await page.keyboard.press('2');
    const tree = page.getByRole('tree', { name: 'Items tree' });
    await tree.getByRole('treeitem').filter({ hasText: 'Direct tasks' }).click();
    await page.keyboard.press('l');
    await tree.locator('[data-object-id="T-900001"]').click();
    const card = page.getByRole('region', { name: 'Item card' });
    await pageUntil(page, () => document.querySelector('[aria-label="Item card"]')?.textContent?.includes('Closed summary.') === true, 'closed by-id card facts rendered');
    assert.match(await card.innerText(), /t\/closed/);
    assert.match(await card.innerText(), /Resolution: closed decision/);
    assert.equal(frames.filter(frame => frame.type === 'task.list' && frame.ids?.includes('T-900001')).length, 1);
    assert.equal(frames.filter(frame => frame.type === 'task.view').length, 0);
    const updated = pageUntil(page, () => document.querySelector('[aria-label="Item card"]')?.textContent?.includes('Replacement closed summary.') === true, 'closed summary refreshed after delta');
    void updated.catch(() => {});
    const reply = await ui.request({ type: 'task.edit', item: 'T-900001', body: '## Summary\n\nReplacement closed summary.\n\n## Details\n\nReplacement body.' });
    assert.equal(reply.ok, true, reply.error);
    await updated;
    assert.equal(frames.filter(frame => frame.type === 'task.list' && frame.ids?.includes('T-900001')).length, 2);
    await card.getByRole('button', { name: 'Agents’ text' }).click();
    await pageUntil(page, () => document.querySelector('[aria-label="Item card"] pre')?.textContent?.includes('Replacement body.') === true, 'current closed body rendered');
    assert.equal(frames.filter(frame => frame.type === 'task.view').length, 1);
  }, page => { page.on('websocket', socket => socket.on('framesent', event => frames.push(JSON.parse(String(event.payload))))); });
});

test('closed container retains its open verdict owner facts through deltas', async t => {
  const fixture = await webFixture(t, { prepare: async root => {
    await seedItem(root, 'R-900000', 'release', 'Closed ancestor release', { version: '1.0.0' });
    await seedItem(root, 'E-900001', 'epic', 'Closed ancestor', { parent: 'R-900000', state: 'closed', closed: '2026-10-20T15:00:00Z' });
    await seedItem(root, 'T-900002', 'task', 'Open verdict owner', { parent: 'E-900001' }, '## Summary\n\nOwner summary.', [
      { author: 'reviewer', at: '2026-10-20T12:00:00Z', text: 'Original reason.', verdict: { verdict: 'review', result: 'not clear', by: 'reviewer', run: 'owner-r1', scope: 'full' } },
      { author: 'reviewer', at: '2026-10-20T13:00:00Z', text: 'Owner boundary needs repair.', verdict: { verdict: 'review', result: 'not clear', by: 'reviewer', run: 'owner-r2', scope: 'delta' } },
    ]);
  } });
  const frames: Array<{ type: string }> = [];
  const ui = await connectUi(t, fixture.hub.discovery);
  await fixture.pageCase(t, async page => {
    await page.keyboard.press('2');
    await page.getByRole('tree', { name: 'Items tree' }).locator('[data-object-id="E-900001"]').click();
    const card = page.getByRole('region', { name: 'Item card' });
    await pageUntil(page, () => document.querySelector('[aria-label="Item card"]')?.textContent?.includes('Owner boundary needs repair.') === true, 'closed container renders open owner verdict reason');
    assert.match(await card.innerText(), /reviewer · r2 · delta/);
    assert.match(await card.innerText(), /owner-r2/);
    const updated = pageUntil(page, () => document.querySelector('[aria-label="Item card"]')?.textContent?.includes('New evidence reason.') === true, 'closed container refreshes open owner verdict');
    void updated.catch(() => {});
    const reply = await ui.request({ type: 'task.comment', item: 'T-900002', text: 'New evidence reason. Private detail.',
      verdict: { verdict: 'review', result: 'not clear', run: 'owner-r3', scope: 'evidence', findings: [] } });
    assert.equal(reply.ok, true, reply.error);
    await updated;
    assert.match(await card.innerText(), /r3 · evidence/);
    assert.match(await card.innerText(), /owner-r3/);
    assert.equal(frames.filter(frame => frame.type === 'task.view').length, 0);
  }, page => { page.on('websocket', socket => socket.on('framesent', event => frames.push(JSON.parse(String(event.payload))))); });
});

test('hidden closed siblings defer card ordinal until a complete order or parent page arrives', async t => {
  const fixture = await webFixture(t, { prepare: async root => {
    await seedItem(root, 'R-900000', 'release', 'Ordinal release', { version: '1.0.0' });
    await seedItem(root, 'E-900010', 'epic', 'Ordinal epic', { parent: 'R-900000' });
    for (let n = 1; n <= 3; n++) await seedItem(root, `T-${900000 + n}`, 'task', `Ordinal sibling ${n}`, {
      parent: 'E-900010', rank: n * 10, state: n === 2 ? 'open' : 'closed', status: n === 2 ? 'planned' : 'done',
    });
  } });
  const ui = await connectUi(t, fixture.hub.discovery);
  const frames: Array<{ type: string; parent?: string }> = [];
  await fixture.pageCase(t, async page => {
    await page.keyboard.press('2');
    await page.getByRole('button', { name: 'D · Done shown', exact: true }).click();
    const tree = page.getByRole('tree', { name: 'Items tree' });
    await tree.locator('[data-object-id="E-900010"]').click();
    await page.keyboard.press('l');
    await tree.locator('[data-object-id="T-900002"]').click();
    const card = page.getByRole('region', { name: 'Item card' });
    await card.waitFor();
    const ordinal = card.locator('dt').filter({ hasText: /^Ordinal$/ }).locator('xpath=following-sibling::dd[1]');
    assert.equal(frames.filter(frame => frame.type === 'task.list' && frame.parent === 'E-900010').length, 0);
    assert.equal(await ordinal.innerText(), '—', 'an unloaded sibling set cannot supply a position or total');
    const ranked = card.getByText('3 of 3 E-900010', { exact: true }).waitFor();
    void ranked.catch(() => {});
    const result = await ui.request({ type: 'task.rank', item: 'T-900002', after: 'T-900003' });
    assert.equal(result.ok, true, result.error);
    await ranked;
    assert.equal(frames.filter(frame => frame.type === 'task.list' && frame.parent === 'E-900010').length, 0);
    const deferred = card.getByTitle('Full sibling order is not available yet', { exact: true }).waitFor();
    void deferred.catch(() => {});
    const moved = await ui.request({ type: 'task.link', item: 'T-900003', parent: 'R-900000' });
    assert.equal(moved.ok, true, moved.error);
    assert.equal((moved.value as {item:{parent:string}}).item.parent, 'R-900000');
    await deferred;
    const complete = card.getByText('2 of 2 E-900010', { exact: true }).waitFor();
    void complete.catch(() => {});
    await page.getByRole('button', { name: 'D · Done hidden', exact: true }).click();
    await complete;
    assert.equal(await ordinal.innerText(), '2 of 2 E-900010');
    assert.ok(frames.some(frame => frame.type === 'task.list' && frame.parent === 'E-900010'));
  }, page => { page.on('websocket', socket => socket.on('framesent', event => frames.push(JSON.parse(String(event.payload))))); });
});
