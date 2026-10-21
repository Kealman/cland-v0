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

});
