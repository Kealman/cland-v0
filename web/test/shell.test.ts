// Web: shell facts and navigation through the cookie-authenticated production edge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { basename } from 'node:path';
import { connectUi, inProcessSpoke } from '../../hub/test/harness.ts';
import { webFixture, pageUntil } from './harness.ts';

const areas = ['Inbox', 'Items', 'Sessions', 'Topics', 'Events', 'Artifacts', 'Accounts'];

test('the shell rail, top strip and physical-code navigation', async t => {
  const fixture = await webFixture(t);

  await t.test('the rail shows attention rather than busy-session totals and the top strip follows the hub', async t => {
    const ui = await connectUi(t, fixture.hub.discovery);
    const coord = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', role: 'coordinator', sessionId: 'shell-coord' });
    t.after(() => coord.close());
    await coord.waitForPresence(['coord']);
    const launched = await ui.request({ type: 'session.launch', name: 'busy-worker', harness: 'claude-code' });
    assert.equal(launched.ok, true, launched.error);
    fixture.hub.fakes['claude-code']!.busy('busy-worker');
    const asked = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Which release?', options: ['Current', 'Next'] });
    assert.equal(asked.ok, true);
    await fixture.pageCase(t, async page => {
      await pageUntil(page, () => document.querySelector('[aria-label="Needs you"]')?.textContent === 'Needs you1', 'needs-you count rendered');
      assert.deepEqual(await page.locator('nav [data-area]').evaluateAll(rows => rows.map(row => row.getAttribute('data-area'))), areas);
      assert.equal(await page.locator('[data-area="Inbox"] [data-count]').textContent(), '1');
      assert.equal(await page.locator('[data-area="Sessions"] [data-count]').count(), 0, 'busy does not ask for attention');
      assert.equal(await page.locator('nav [data-count]').count(), 1);
      assert.equal(await page.locator('[aria-label="Project"]').textContent(), basename(fixture.root));
      assert.equal(await page.locator('[aria-label="Coordinator"]').textContent(), 'Coordinatorcoord');
      assert.equal(await page.locator('button[aria-label="Palette"]').textContent(), 'Search⌘K');
      assert.equal(await page.locator('button[aria-label="Help"]').textContent(), '?');
      assert.equal(await page.title(), `(1) ${basename(fixture.root)} · cland`);
      await page.getByRole('button', { name: 'Collapse rail', exact: true }).click();
      assert.equal(await page.locator('[data-area="Inbox"] [data-count]').textContent(), '1', 'collapsed rail retains its badge');
      assert.equal(await page.locator('[data-area="Inbox"] svg').getAttribute('fill'), 'none');
      await page.getByRole('button', { name: 'Expand rail', exact: true }).click();
      const answer = await ui.request({ type: 'topic.answer', ask: asked.ask, option: 1 });
      assert.equal(answer.ok, true, answer.error);
      await pageUntil(page, () => document.querySelector('[aria-label="Needs you"]')?.textContent === 'Needs you✓', 'green zero state after the answer');
      assert.equal(await page.title(), `${basename(fixture.root)} · cland`);
      assert.equal(await page.locator('nav [data-count]').count(), 0);
    });
  });

  await t.test('the rail collapses to stroke icons at 60 px and remembers the button choice', async t => {
    await fixture.pageCase(t, async page => {
      const rail = page.locator('aside');
      const toggle = page.getByRole('button', { name: 'Collapse rail', exact: true });
      await toggle.click();
      assert.equal((await rail.boundingBox())?.width, 60);
      assert.equal(await rail.locator('svg').count(), 7);
      assert.equal(await rail.locator('[data-area="Inbox"]').getAttribute('title'), 'Inbox (1)');
      await page.reload();
      await pageUntil(page, () => document.querySelector('aside')?.getBoundingClientRect().width === 60, 'remembered collapsed width');
      await page.getByRole('button', { name: 'Expand rail', exact: true }).click();
      assert.equal((await rail.boundingBox())?.width, 188);
      await page.setViewportSize({ width: 1279, height: 900 });
      assert.equal((await rail.boundingBox())?.width, 60);
      await page.setViewportSize({ width: 1280, height: 900 });
      assert.equal((await rail.boundingBox())?.width, 188, 'automatic collapse does not overwrite the button choice');
      await page.reload();
      assert.equal((await rail.boundingBox())?.width, 188);
    });
  });

  await t.test('physical digit codes switch areas with Cyrillic key values and preserve field typing', async t => {
    await fixture.pageCase(t, async page => {
      for (const [index, area] of areas.entries()) {
        await page.evaluate(({ code, key }) => document.dispatchEvent(new KeyboardEvent('keydown', { code, key, bubbles: true, cancelable: true })), { code: `Digit${index + 1}`, key: 'ж' });
        await page.locator('h1').filter({ hasText: area }).waitFor();
        assert.equal(await page.locator('main').getAttribute('aria-label'), area);
      }
      await page.evaluate(() => {
        const field = document.createElement('input'); field.setAttribute('aria-label', 'Typing fixture'); document.body.append(field); field.focus();
      });
      await page.keyboard.press('1');
      assert.equal(await page.getByRole('textbox', { name: 'Typing fixture' }).inputValue(), '1');
      assert.equal(await page.locator('h1').textContent(), 'Accounts');
    });
  });

  await t.test('the release pick uses one versioned shell key and survives a reload', async t => {
    const ui = await connectUi(t, fixture.hub.discovery);
    for (const title of ['Current', 'Next']) {
      const created = await ui.request({ type: 'task.create', kind: 'release', title });
      assert.equal(created.ok, true, created.error);
    }
    await fixture.pageCase(t, async page => {
      await page.locator('select[aria-label="Release"] option').filter({ hasText: 'Next' }).waitFor({ state: 'attached' });
      await page.getByLabel('Release', { exact: true }).selectOption('R-2');
      await page.reload();
      await pageUntil(page, () => document.querySelector<HTMLSelectElement>('select[aria-label="Release"]')?.value === 'R-2', 'saved release pick rendered');
      assert.equal(await page.locator('[data-item-id]').textContent(), 'R-2');
      assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), ['cland.ui.shell.v1']);
      assert.equal(await page.getByLabel('Release', { exact: true }).inputValue(), 'R-2');
    });
  });

  await t.test('storage denial keeps the shell usable on reads, writes and storage-property access', async t => {
    for (const denied of ['methods', 'property']) {
      await fixture.pageCase(t, async page => {
        await page.getByRole('button', { name: 'Accounts', exact: true }).click();
        assert.equal(await page.locator('h1').textContent(), 'Accounts');
        await page.getByRole('button', { name: 'Collapse rail', exact: true }).click();
        await page.reload();
        await page.keyboard.press('2');
        await page.locator('h1').filter({ hasText: 'Items' }).waitFor();
        assert.equal(await page.locator('h1').textContent(), 'Items');
      }, async page => {
        await page.addInitScript(mode => {
          if (mode === 'property') Object.defineProperty(window, 'localStorage', { get() { throw new Error('denied'); } });
          else for (const method of ['getItem', 'setItem']) Object.defineProperty(Storage.prototype, method, { value() { throw new Error('denied'); } });
        }, denied);
      });
    }
  });

  await t.test('the keyboard cursor has a blue 2 px ring on selection, hover only lightens, and ids stay whole', async t => {
    const ui = await connectUi(t, fixture.hub.discovery);
    assert.equal((await ui.request({ type: 'task.create', kind: 'release', title: 'Focus fixture' })).ok, true);
    await fixture.pageCase(t, async page => {
      await page.keyboard.press('3');
      const selected = page.getByRole('button', { name: 'Sessions', exact: true });
      await selected.focus();
      const focus = await selected.evaluate(node => {
        const style = getComputedStyle(node);
        return [style.outlineWidth, style.outlineStyle, style.outlineColor, style.backgroundColor];
      });
      assert.deepEqual(focus, ['2px', 'solid', 'rgb(106, 165, 255)', 'rgb(24, 33, 49)']);
      const row = page.getByRole('button', { name: 'Items', exact: true });
      await row.hover();
      assert.equal(await row.getAttribute('aria-current'), null);
      assert.equal(await row.evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(19, 25, 35)');
      assert.equal(await page.locator('h1').textContent(), 'Sessions');
      await page.setViewportSize({ width: 800, height: 900 });
      await pageUntil(page, () => document.querySelector('[data-item-id]')?.textContent === 'R-1', 'release id rendered');
      const id = await page.locator('[data-item-id]').evaluate(node => {
        const style = getComputedStyle(node);
        return { whiteSpace: style.whiteSpace, font: style.fontFamily, height: node.getBoundingClientRect().height, lineHeight: parseFloat(style.lineHeight) };
      });
      assert.equal(id.whiteSpace, 'nowrap');
      assert.match(id.font, /JetBrains Mono/);
      assert.ok(id.height <= id.lineHeight, 'id occupies one line at a narrow viewport');
    });
  });

  await t.test('split panes start at 2:1, drag, swap and close while restoring the rail choice', async t => {
    await fixture.pageCase(t, async page => {
      await page.keyboard.press('2');
      await page.keyboard.press('Meta+Backslash');
      const left = page.locator('[data-pane="primary"]');
      const right = page.locator('[data-pane="secondary"]');
      await right.waitFor();
      const a = (await left.boundingBox())!;
      const b = (await right.boundingBox())!;
      assert.ok(Math.abs(a.width / b.width - 2) < 0.02, 'default 2:1 ratio');
      assert.equal((await page.locator('aside').boundingBox())?.width, 60);
      await right.click();
      await page.keyboard.press('4');
      await right.getByRole('heading', { name: 'Topics', exact: true }).waitFor();
      await left.getByRole('button', { name: 'Swap', exact: true }).click();
      await left.getByRole('heading', { name: 'Topics', exact: true }).waitFor();
      assert.equal(await right.getByRole('heading').textContent(), 'Items');
      const divider = page.getByRole('separator', { name: 'Pane divider' });
      const handle = (await divider.boundingBox())!;
      await page.mouse.move(handle.x + handle.width / 2, handle.y + 80);
      await page.mouse.down();
      await page.mouse.move(handle.x - 150, handle.y + 80);
      await page.mouse.up();
      await pageUntil(page, () => document.querySelector('[data-pane="primary"]')!.getBoundingClientRect().width / document.querySelector('[data-pane="secondary"]')!.getBoundingClientRect().width < 1.5, 'dragged pane ratio rendered');
      await page.reload();
      await right.getByRole('heading', { name: 'Items', exact: true }).waitFor();
      assert.ok((await left.boundingBox())!.width / (await right.boundingBox())!.width < 1.5, 'split ratio restored across reload');
      await right.getByRole('button', { name: 'Close', exact: true }).click();
      await right.waitFor({ state: 'detached' });
      assert.equal((await page.locator('aside').boundingBox())?.width, 188);
      await page.getByRole('button', { name: 'Collapse rail', exact: true }).click();
      await page.keyboard.press('Meta+Backslash');
      await left.getByRole('button', { name: 'Close', exact: true }).click();
      await right.waitFor({ state: 'detached' });
      assert.equal((await page.locator('aside').boundingBox())?.width, 60, 'manual collapsed choice restored');
      assert.equal(await page.locator('h1').textContent(), 'Topics');
    });
  });

  await t.test('selected hub rows open the drawer; close and Esc persist until selection moves; Split and command Enter open the other pane', async t => {
    const ui = await connectUi(t, fixture.hub.discovery);
    for (const title of ['Drawer first', 'Drawer second']) assert.equal((await ui.request({ type: 'task.create', title, size: 'S' })).ok, true);
    const sent: string[] = [];
    await fixture.pageCase(t, async page => {
      await page.keyboard.press('2');
      await page.locator('[data-tree-key=":unscheduled"]').click();
      const first = page.getByRole('treeitem', { name: /T-4 Drawer first/ });
      const second = page.getByRole('treeitem', { name: /T-5 Drawer second/ });
      await first.waitFor();
      const drawer = page.getByRole('complementary', { name: 'Drawer', exact: true });
      assert.equal(await drawer.count(), 0, 'no selection');
      await first.click();
      await drawer.getByRole('heading', { name: 'Drawer first', exact: true }).waitFor();
      await drawer.getByRole('button', { name: 'Close', exact: true }).click();
      await drawer.waitFor({ state: 'detached' });
      await first.click();
      assert.equal(await drawer.count(), 0, 'same selection stays dismissed');
      await page.reload();
      await first.waitFor();
      assert.equal(await drawer.count(), 0, 'dismissed selection stays closed across reload');
      await second.click();
      await drawer.getByRole('heading', { name: 'Drawer second', exact: true }).waitFor();
      sent.length = 0;
      await page.keyboard.press('Escape');
      await drawer.waitFor({ state: 'detached' });
      assert.deepEqual(sent, [], 'Esc sends no hub frame');
      await first.click();
      await drawer.getByRole('heading', { name: 'Drawer first', exact: true }).waitFor();
      await page.keyboard.press('4');
      await page.getByRole('heading', { name: 'Topics', exact: true }).waitFor();
      assert.equal(await drawer.count(), 0, 'changing area clears selection');
      await page.keyboard.press('2');
      await first.click();
      await drawer.getByRole('button', { name: 'Split', exact: true }).click();
      const other = page.locator('[data-pane="secondary"]');
      await other.getByRole('heading', { name: 'Drawer first', exact: true }).waitFor();
      assert.equal(await drawer.count(), 0, 'drawer closed while split');
      await other.getByRole('button', { name: 'Close', exact: true }).click();
      await other.waitFor({ state: 'detached' });
      assert.equal(await drawer.count(), 0, 'closing a split does not reopen the drawer');
      await second.focus();
      await page.evaluate(() => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'ж', metaKey: true, bubbles: true, cancelable: true })));
      await other.getByRole('heading', { name: 'Drawer second', exact: true }).waitFor();
      assert.equal(await drawer.count(), 0);
      await page.locator('[data-pane="primary"]').getByRole('button', { name: 'Swap', exact: true }).click();
      await page.locator('[data-pane="primary"]').getByRole('heading', { name: 'Drawer second', exact: true }).waitFor();
      await other.getByRole('button', { name: 'Close', exact: true }).click();
      await other.waitFor({ state: 'detached' });
      assert.equal(await page.locator('h1').textContent(), 'Drawer second', 'swapped row survives closing');
    }, page => { page.on('websocket', socket => socket.on('framesent', event => sent.push(String(event.payload)))); });
  });

});
