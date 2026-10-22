// Web: Graph criteria at the real hub/Headless Shell DOM boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { checkColours } from '../check-colours.ts';
import { webFixture, pageUntil } from './harness.ts';
import { seedItem } from './items-fixture.ts';
import type { HubFrame } from '../../shared/wire/index.ts';

test('the Graph view in Items', async t => {
  const fixture = await webFixture(t, { prepare: async root => {
    await seedItem(root, 'R-900000', 'release', 'Graph release', { version: '1.0.0' });
    await seedItem(root, 'E-900010', 'epic', 'Working epic', { parent: 'R-900000' });
    await seedItem(root, 'E-900020', 'epic', 'Closed epic', { parent: 'R-900000', state: 'closed' });
    await seedItem(root, 'E-900030', 'epic', 'Dependent epic', { parent: 'R-900000', blocked_by: ['E-900010'] });
    for (const [i, status] of (['in progress', 'review', 'qa', 'ready', 'planned', 'done'] as const).entries()) {
      await seedItem(root, `T-${900100 + i}`, 'task', `Graph task ${i}`, {
        parent: 'E-900010', status, rank: i * 10,
        ...(i === 1 ? { blocked_by: ['T-900100'] } : {}),
        ...(status === 'done' ? { state: 'closed' } : {}),
      });
    }
    await seedItem(root, 'T-900200', 'task', 'Closed child', { parent: 'E-900020', state: 'closed', status: 'done' });
  } });
  await t.test('C1 release Graph shows closed epic progress and open epic work from hub counts', async t => {
    const frames: Record<string, unknown>[] = [], snapshots: string[][] = [];
    await fixture.pageCase(t, async page => {
      assert.equal(await page.getByRole('button', { name: 'Graph', exact: true }).isEnabled(), true);
      await page.getByRole('button', { name: 'Graph', exact: true }).click();
      const graph = page.getByRole('tree', { name: 'Items graph' });
      const closed = graph.locator('[data-object-id="E-900020"]');
      await closed.waitFor();
      assert.match(await closed.textContent() ?? '', /1\/1 · 0 in work/);
      assert.equal(snapshots.length, 1);
      assert.equal(snapshots[0]!.includes('E-900020'), false, 'fully closed epic is absent from the open snapshot');
      assert.ok(frames.some(frame => frame.type === 'task.list' && frame.parent === 'R-900000' && frame.state === 'closed'), 'Graph loads closed siblings through the parent page');
      assert.equal(frames.some(frame => frame.type === 'task.list' && frame.parent === 'E-900020'), false, 'full fraction needs no closed epic child read');
      assert.match(await graph.locator('[data-object-id="E-900010"]').textContent() ?? '', /1\/6 · 4 in work/);
      assert.equal(await closed.locator('[data-graph-glyph]').textContent(), '✓');
      assert.deepEqual(await closed.evaluate(node => {
        const probe = document.createElement('span');
        document.body.append(probe);
        const colour = (token: string) => { probe.style.color = `var(${token})`; return getComputedStyle(probe).color; };
        const title = node.querySelector('[data-graph-title]')!;
        const glyph = node.querySelector('[data-graph-glyph]')!;
        const result = [getComputedStyle(title).fill === colour('--done-text'), getComputedStyle(glyph).fill === colour('--done-glyph')];
        probe.remove();
        return result;
      }), [true, true]);
      assert.ok(await graph.locator('[data-graph-edge]').count() > 0, 'dependency has a routed SVG edge');
      await pageUntil(page, () => document.querySelectorAll('[aria-label="Items graph"] [data-object-id="E-900020"]').length === 1, 'closed parent page deduplicates nodes');
    }, async page => {
      page.on('websocket', socket => {
        socket.on('framesent', event => frames.push(JSON.parse(String(event.payload)) as Record<string, unknown>));
        socket.on('framereceived', event => {
          const frame = JSON.parse(String(event.payload)) as HubFrame;
          if (frame.type === 'snapshot' && frame.domain === 'items') snapshots.push(frame.value.items.map(item => item.id));
        });
      });
      await page.addInitScript(() => {
        localStorage.setItem('cland.ui.shell.v1', JSON.stringify({ area: 'Items', release: 'R-900000' }));
        localStorage.setItem('cland.ui.items.v1', JSON.stringify({ view: 'graph' }));
      });
    });
  });
  await t.test('C2 Graph round trip retains scope, filters and selection and node selection selects its tree row', async t => fixture.pageCase(t, async page => {
    const tree = page.getByRole('tree', { name: 'Items tree' });
    await tree.locator('[data-object-id="T-900100"]').click();
    await page.getByRole('button', { name: 'Graph', exact: true }).click();
    const graph = page.getByRole('tree', { name: 'Items graph' });
    assert.match(await page.getByLabel('Graph scope', { exact: true }).textContent() ?? '', /E-900010 Working epic/);
    assert.equal(await graph.locator('[data-object-id="T-900100"]').getAttribute('aria-selected'), 'true');
    assert.equal(await graph.locator('[data-object-id="E-900010"]').count(), 0);
    assert.equal(await graph.locator('[data-object-id="T-900105"]').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'D · Done hidden', exact: true }).getAttribute('aria-pressed'), 'true');
    await graph.locator('[data-object-id="T-900100"]').click();
    await page.keyboard.press('j');
    await pageUntil(page, () => document.activeElement?.getAttribute('data-object-id') === 'T-900101', 'Graph key selects next node');
    assert.equal(await graph.locator('[data-object-id="T-900101"]').getAttribute('aria-selected'), 'true');
    await page.keyboard.press('Enter');
    await pageUntil(page, () => document.activeElement?.getAttribute('aria-label') === 'Item card', 'Graph node enters card');
    await page.keyboard.press('Escape');
    await pageUntil(page, () => document.activeElement?.getAttribute('data-object-id') === 'T-900101', 'card returns to Graph node');
    await page.keyboard.press('Shift+D');
    await graph.locator('[data-object-id="T-900105"]').waitFor();
    const closed = graph.locator('[data-object-id="T-900105"]');
    assert.equal(await closed.locator('[data-graph-glyph]').textContent(), '✓');
    await graph.locator('[data-object-id="T-900104"]').click();
    await page.getByRole('button', { name: 'Tree', exact: true }).click();
    assert.equal(await tree.locator('[data-object-id="T-900104"]').getAttribute('aria-selected'), 'true');
    assert.equal(await tree.locator('[data-object-id="R-900000"]').count(), 0);
    await tree.locator('[data-object-id="T-900105"]').waitFor();
    assert.equal(await page.getByRole('region', { name: 'Item card' }).getAttribute('data-item-id'), 'T-900104');
    await page.getByRole('button', { name: 'Graph', exact: true }).click();
    assert.equal(await graph.locator('[data-object-id="T-900104"]').getAttribute('aria-selected'), 'true');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('cland.ui.items.v1')!).tree.scope), 'E-900010');
  }, async page => { await page.addInitScript(() => {
    localStorage.setItem('cland.ui.shell.v1', JSON.stringify({ area: 'Items', release: 'R-900000' }));
    localStorage.setItem('cland.ui.items.v1', JSON.stringify({ tree: { scope: 'E-900010', hideDone: true, open: { 'E-900010': true } } }));
  }); }));
  await t.test('C3 token-only source guard passes and SVG selection paints with the shared tokens', async t => fixture.pageCase(t, async page => {
    assert.deepEqual(await checkColours(fileURLToPath(new URL('../src/', import.meta.url))), []);
    await page.keyboard.press('2');
    await page.getByRole('button', { name: 'Graph', exact: true }).click();
    const node = page.getByRole('tree', { name: 'Items graph' }).locator('[data-object-id="E-900010"]');
    await node.click();
    assert.deepEqual(await node.evaluate(node => {
      const probe = document.createElement('span'); document.body.append(probe);
      const colour = (token: string) => { probe.style.color = `var(${token})`; return getComputedStyle(probe).color; };
      const result = [getComputedStyle(node.querySelector('rect')!).fill === colour('--selection'),
        getComputedStyle(node.querySelector('[data-graph-title]')!).fill === colour('--text')];
      probe.remove(); return result;
    }), [true, true]);
    assert.equal(await node.getAttribute('aria-selected'), 'true');
    await mkdir('web/test-results', { recursive: true });
    await page.screenshot({ path: 'web/test-results/items-graph.png', fullPage: true });
  }));
});
