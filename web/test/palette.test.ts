// Web: palette and keys help through the rendered shell and physical keyboard codes.
import test from 'node:test';
import type { Page } from 'playwright-core';
import assert from 'node:assert/strict';
import { connectUi } from '../../hub/test/harness.ts';
import { until } from '../../hub/test/until.ts';
import { webFixture, pageUntil } from './harness.ts';

async function physical(page: Page, chord: string) {
        for (const stroke of chord.split(' ')) await page.evaluate(stroke => {
          const parts = stroke.split('+'); const code = parts.pop()!;
          document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { code, key: 'ж',
            metaKey: parts.includes('Meta'), shiftKey: parts.includes('Shift'), bubbles: true, cancelable: true }));
        }, stroke);
}


test('the palette and area keys help', async t => {
  const fixture = await webFixture(t);
  await t.test('command K and Space p open a modal palette; Escape closes without a frame or selection', async t => {
    const sent: string[] = [];
    await fixture.pageCase(t, async page => {
      await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent === 'Live', 'connected shell');
      for (const open of [async () => page.keyboard.press('Meta+k'), async () => { await page.keyboard.press('Space'); await page.keyboard.press('p'); }]) {
        await open();
        const dialog = page.getByRole('dialog', { name: 'Palette', exact: true });
        await dialog.waitFor();
        assert.equal(await dialog.evaluate(node => node.matches(':modal')), true);
        assert.equal(await page.getByRole('combobox', { name: 'Search palette' }).evaluate(node => node === document.activeElement), true);
        sent.length = 0;
        await physical(page, 'Escape');
        await dialog.waitFor({ state: 'detached' });
        assert.deepEqual(sent, [], 'closing sends no frame');
        assert.equal(await page.locator('main').getAttribute('aria-label'), 'Inbox');
      }
    }, page => { page.on('websocket', socket => socket.on('framesent', event => sent.push(String(event.payload)))); });
  });
  await t.test('five prefixes narrow fixed-order groups, actions show mapped keys and matching characters are blue', async t => {
    const ui = await connectUi(t, fixture.hub.discovery);
    for (const frame of [
      { type: 'task.create', title: 'Palette item', size: 'S' },
      { type: 'session.launch', name: 'palette-worker', harness: 'claude-code' },
      { type: 'artifact.create', kind: 'file', title: 'Palette artifact', topic: 'general', content: 'Palette bytes' },
      { type: 'topic.create', title: 'Palette topic' },
    ] as const) { const result = await ui.request(frame); assert.equal(result.ok, true, result.error); }
    await fixture.pageCase(t, async page => {
      await page.keyboard.press('Meta+k');
      const dialog = page.getByRole('dialog', { name: 'Palette', exact: true });
      const input = page.getByRole('combobox', { name: 'Search palette' });
      await pageUntil(page, () => document.querySelectorAll('[data-palette-group]').length === 5, 'all five groups populated');
      assert.deepEqual(await dialog.locator('[data-palette-group]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-palette-group'))), ['Actions', 'Items', 'Sessions', 'Artifacts', 'Topics']);
      assert.equal(await dialog.getByRole('option', { name: /Go to Sessions/ }).locator('kbd').textContent(), '3');
      for (const [prefix, group, title] of [['>', 'Actions', 'Go to Items'], ['#', 'Items', 'Palette item'], ['@', 'Sessions', 'palette-worker'], ['~', 'Artifacts', 'Palette artifact'], ['/', 'Topics', 'Palette topic']]) {
        await input.fill(prefix!);
        await dialog.getByRole('option').filter({ hasText: title! }).waitFor();
        assert.deepEqual(await dialog.locator('[data-palette-group]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-palette-group'))), [group]);
      }
      await input.fill('#pLi');
      const item = dialog.getByRole('option').filter({ hasText: 'Palette item' });
      await item.waitFor();
      assert.equal(await item.locator('mark').evaluateAll(nodes => nodes.map(node => node.textContent).join('').toLowerCase()), 'pli');
      assert.equal(await item.locator('mark').first().evaluate(node => getComputedStyle(node).color), 'rgb(106, 165, 255)');
    });
  });
  await t.test('Enter opens the best result, command Enter opens in the other pane and Tab cycles kind', async t => {
    await fixture.pageCase(t, async page => {
      await page.keyboard.press('Meta+k');
      const input = page.getByRole('combobox', { name: 'Search palette' });
      await input.fill('#Palette item');
      await physical(page, 'Enter');
      await page.getByRole('complementary', { name: 'Drawer', exact: true }).getByRole('heading', { name: 'Palette item', exact: true }).waitFor();
      assert.equal(await page.locator('main').getAttribute('aria-label'), 'Items');
      await page.keyboard.press('Meta+k');
      await physical(page, 'Shift+Tab');
      assert.equal(await input.inputValue(), '/', 'reverse cycle from all begins with topics');
      for (const prefix of ['>', '#', '@', '~', '/', '>']) {
        await physical(page, 'Tab');
        assert.equal(await input.inputValue(), prefix);
        assert.equal(await input.evaluate(node => node === document.activeElement), true);
      }
      assert.deepEqual(await page.locator('footer kbd').allTextContents(), ['Enter', '⌘Enter', 'Tab', '⇧Tab', '↓', '↑', 'Esc']);
      await input.fill('>Go to');
      await physical(page, 'ArrowDown');
      assert.match(await page.getByRole('dialog', { name: 'Palette', exact: true }).getByRole('option', { selected: true }).textContent() ?? '', /Go to Items/);
      await physical(page, 'ArrowUp');
      assert.match(await page.getByRole('dialog', { name: 'Palette', exact: true }).getByRole('option', { selected: true }).textContent() ?? '', /Go to Inbox/);
      await input.fill('@palette-worker');
      await physical(page, 'Meta+Enter');
      await page.locator('[data-pane="secondary"]').getByRole('heading', { name: 'palette-worker', exact: true }).waitFor();
      assert.equal(await page.getByRole('complementary', { name: 'Drawer', exact: true }).count(), 0);
      assert.equal(await page.locator('[data-pane="primary"] h1').textContent(), 'Items');
      await page.locator('[data-pane="secondary"]').getByRole('button', { name: 'Close', exact: true }).click();
      await page.keyboard.press('Meta+k');
      await input.fill('Go to Accounts');
      await physical(page, 'Enter');
      await page.getByRole('heading', { name: 'Accounts', exact: true }).waitFor();
      assert.equal(await page.getByRole('dialog').count(), 0);
      await page.keyboard.press('Meta+k');
      await input.fill('#no such item');
      await physical(page, 'Enter');
      assert.equal(await page.getByRole('dialog', { name: 'Palette', exact: true }).count(), 1, 'empty search never acts');
      await physical(page, 'Escape');
    });
  });

  await t.test('area help and every displayed shell chord work by physical code with Cyrillic key values', async t => {
    await fixture.pageCase(t, async page => {
      await physical(page, 'Shift+Slash');
      const help = page.getByRole('dialog', { name: 'Inbox keys', exact: true });
      await help.waitFor();
      assert.deepEqual(await help.locator('[data-key-action="split"] kbd').evaluate(node => Array.from(node.textContent!, character => character.codePointAt(0))), [8984, 92], 'command plus exactly one backslash');
      assert.deepEqual(await help.locator('kbd').allTextContents(), ['1', '2', '3', '4', '5', '6', '7', '⌘K / Space p', '?', '⌘\\', '⌘Enter', 'Esc', '←', '→']);
      await physical(page, 'Escape');
      await help.waitFor({ state: 'detached' });
      for (const [index, area] of ['Inbox', 'Items', 'Sessions', 'Topics', 'Events', 'Artifacts', 'Accounts'].entries()) {
        await physical(page, `Digit${index + 1}`);
        await page.getByRole('heading', { name: area, exact: true }).waitFor();
        await physical(page, 'Shift+Slash');
        const localHelp = page.getByRole('dialog', { name: `${area} keys`, exact: true });
        await localHelp.waitFor();
        assert.equal(await localHelp.locator('kbd').count(), area === 'Items' ? 32 : 14);
        assert.equal(await localHelp.locator('[data-key-action="dismiss"]').count(), 1, 'one contextual row per action');
        if (area === 'Items') {
          assert.equal(await localHelp.locator('[data-key-action="accept"] kbd').textContent(), 'Enter');
          assert.equal(await localHelp.locator('[data-key-action="dismiss"] dt').textContent(), 'Return from card or close drawer');
        }
        await physical(page, 'Escape');
        await localHelp.waitFor({ state: 'detached' });
      }
      await physical(page, 'Meta+Backslash');
      await page.locator('[data-pane="secondary"]').waitFor();
      await physical(page, 'Meta+Backslash');
      await page.locator('[data-pane="secondary"]').waitFor({ state: 'detached' });
      await physical(page, 'Digit2');
      await page.locator('[data-tree-key=":unscheduled"]').click();
      await page.getByRole('treeitem', { name: /Palette item/ }).click();
      await physical(page, 'Meta+Enter');
      await page.locator('[data-pane="secondary"]').getByRole('heading', { name: 'Palette item', exact: true }).waitFor();
      for (const chord of ['Meta+KeyK', 'Space KeyP']) {
        await physical(page, chord);
        await page.getByRole('dialog', { name: 'Palette', exact: true }).waitFor();
        await physical(page, 'Escape');
        await page.getByRole('dialog').waitFor({ state: 'detached' });
      }
      await page.evaluate(() => { const field = document.createElement('textarea'); field.setAttribute('aria-label', 'Draft'); document.body.append(field); field.focus(); });
      await page.keyboard.type('1 ? p');
      assert.equal(await page.getByRole('textbox', { name: 'Draft' }).inputValue(), '1 ? p');
      await physical(page, 'Meta+KeyK');
      await page.getByRole('dialog', { name: 'Palette', exact: true }).waitFor();
      await physical(page, 'Escape');
      assert.equal(await page.getByRole('textbox', { name: 'Draft' }).evaluate(node => node === document.activeElement), true);
    });
  });
  await t.test('the Space leader survives an ordinary hub update between the physical strokes', async t => {
    const ui = await connectUi(t, fixture.hub.discovery);
    await fixture.pageCase(t, async page => {
      await page.keyboard.press('2');
      await page.getByRole('heading', { name: 'Items', exact: true }).waitFor();
      await page.locator('[data-tree-key=":unscheduled"]').click();
      await page.keyboard.press('Space');
      const created = await ui.request({ type: 'task.create', title: 'Between strokes', size: 'S' });
      assert.equal(created.ok, true, created.error);
      await page.getByRole('treeitem', { name: /Between strokes/ }).waitFor();
      await page.keyboard.press('p');
      await page.getByRole('dialog', { name: 'Palette', exact: true }).waitFor();
    });
  });

  await t.test('a pending Space cannot consume p after focus moves to a field or a palette input', async t => {
    await fixture.pageCase(t, async page => {
      await page.evaluate(() => { const field = document.createElement('textarea'); field.setAttribute('aria-label', 'Draft'); document.body.append(field); });
      await page.keyboard.press('Space');
      await page.getByRole('textbox', { name: 'Draft' }).click();
      await page.keyboard.press('p');
      assert.equal(await page.getByRole('textbox', { name: 'Draft' }).inputValue(), 'p');
      assert.equal(await page.getByRole('dialog').count(), 0);
      await physical(page, 'Meta+KeyK');
      await page.getByRole('dialog', { name: 'Palette', exact: true }).waitFor();
      await physical(page, 'Escape');
      assert.equal(await page.getByRole('textbox', { name: 'Draft' }).inputValue(), 'p', 'direct command K preserves draft');
      await page.getByRole('button', { name: 'Items', exact: true }).focus();
      await page.keyboard.press('Space');
      await page.getByRole('button', { name: 'Palette', exact: true }).click();
      await page.getByRole('combobox', { name: 'Search palette' }).press('p');
      assert.equal(await page.getByRole('combobox', { name: 'Search palette' }).inputValue(), 'p');
    });
  });

  await t.test('blue matches use original characters after emoji and expanding case normalization', async t => {
    const ui = await connectUi(t, fixture.hub.discovery);
    for (const title of ['🐈 Кот', '🐈 İ Cat']) {
      const created = await ui.request({ type: 'task.create', title, size: 'S' });
      assert.equal(created.ok, true, created.error);
    }
    await fixture.pageCase(t, async page => {
      await page.keyboard.press('Meta+k');
      const dialog = page.getByRole('dialog', { name: 'Palette', exact: true });
      for (const [query, title, marks] of [['#кот', '🐈 Кот', 'Кот'], ['#cat', '🐈 İ Cat', 'Cat'], ['#İ', '🐈 İ Cat', 'İ']]) {
        await page.getByRole('combobox', { name: 'Search palette' }).fill(query!);
        const result = dialog.getByRole('option').filter({ hasText: title! });
        await result.waitFor();
        assert.equal(await result.locator('mark').evaluateAll(nodes => nodes.map(node => node.textContent).join('')), marks);
      }
    });
  });

});

test('Items help stays inside small viewports and every row is reachable by keyboard scrolling', async t => {
  const fixture = await webFixture(t);
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1024, height: 600 }]) {
    await t.test(`${viewport.width}×${viewport.height}`, async t => {
      await fixture.pageCase(t, async page => {
        await page.keyboard.press('2');
        await page.getByRole('heading', { name: 'Items', exact: true }).waitFor();
        await physical(page, 'Shift+Slash');
        const help = page.getByRole('dialog', { name: 'Items keys', exact: true });
        await help.waitFor();
        const rows = help.locator('[data-key-action]');
        assert.equal(await rows.count(), 32);
        const visibleRows = () => rows.evaluateAll(nodes => {
          const dialog = document.querySelector('dialog')!.getBoundingClientRect();
          return nodes.filter(node => {
            const row = node.getBoundingClientRect();
            return row.top >= Math.max(0, dialog.top) && row.bottom <= Math.min(innerHeight, dialog.bottom);
          }).map(node => node.getAttribute('data-key-action')!);
        });
        const actions = await rows.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-key-action')!));
        await page.keyboard.press('PageDown');
        await page.keyboard.press('End');
        await pageUntil(page, () => {
          const dialog = document.querySelector('dialog')!.getBoundingClientRect();
          const last = document.querySelector('[data-key-action="accept"]')!.getBoundingClientRect();
          return last.top >= Math.max(0, dialog.top) && last.bottom <= Math.min(innerHeight, dialog.bottom);
        }, 'last Items help row visible after End');
        assert.equal(await rows.last().locator('dt').textContent(), 'Enter card or return to tree');
        assert.equal(await help.evaluate(node => {
          const rect = node.getBoundingClientRect();
          return rect.top >= 0 && rect.left >= 0 && rect.bottom <= innerHeight && rect.right <= innerWidth;
        }), true, 'help dialog stays inside the viewport');
        await page.keyboard.press('Home');
        await pageUntil(page, () => {
          const dialog = document.querySelector('dialog')!.getBoundingClientRect();
          const first = document.querySelector('[data-key-action="Inbox"]')!.getBoundingClientRect();
          return first.top >= Math.max(0, dialog.top) && first.bottom <= Math.min(innerHeight, dialog.bottom);
        },
          'first help row visible after Home');
        const seen = new Set(await visibleRows());
        for (let step = 0; step < actions.length && seen.size < actions.length; step++) {
          const next = actions.find(action => !seen.has(action))!;
          const reached = until(async () => (await visibleRows()).includes(next), { what: `PageDown reveals ${next}`, timeoutMs: 3000 });
          await page.keyboard.press('PageDown');
          await reached;
          const visible = await visibleRows();
          assert.ok(visible.includes(next), `PageDown reveals ${next}`);
          for (const action of visible) seen.add(action);
        }
        assert.equal(seen.size, 32, 'PageDown brings every help row into view');
      }, page => page.setViewportSize(viewport));
    });
  }
});
