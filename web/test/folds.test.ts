// Web: browser-owned folds through the real shell, local storage and outgoing frames.
import test from 'node:test';
import assert from 'node:assert/strict';
import { webFixture, pageUntil } from './harness.ts';
import { visibleProse } from './prose.ts';

test('browser folds and the prose guard', async t => {
  const fixture = await webFixture(t);
  await t.test('folds remember the chevron and physical keys without hub frames', async t => {
    const sent: string[] = [];
    await fixture.pageCase(t, async page => {
      await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent === 'Live', 'authenticated shell');
      const toggle = page.getByRole('button', { name: 'Fold Inbox', exact: true });
      await toggle.waitFor();
      const objects = page.getByRole('list', { name: 'Inbox objects' });
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
      sent.length = 0;
      await toggle.click();
      await objects.waitFor({ state: 'hidden' });
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      assert.deepEqual(sent, [], 'chevron sends no frame');
      await page.reload();
      await toggle.waitFor();
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent === 'Live', 'reconnected shell before counting fold frames');
      await toggle.focus();
      sent.length = 0;
      await page.evaluate(() => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', {
        code: 'ArrowRight', key: 'ж', bubbles: true, cancelable: true,
      })));
      await objects.waitFor({ state: 'visible' });
      await page.evaluate(() => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', {
        code: 'ArrowLeft', key: 'ж', bubbles: true, cancelable: true,
      })));
      await objects.waitFor({ state: 'hidden' });
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      assert.deepEqual(sent, [], 'physical fold keys send no frame');
      await page.reload();
      await toggle.waitFor();
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false', 'keyboard fold survives reload');
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('cland.ui.inbox.v1')!)), { folds: { objects: true } });
    }, page => { page.on('websocket', socket => socket.on('framesent', event => sent.push(String(event.payload)))); });
  });

  await t.test('the prose guard rejects explanatory header fixtures and accepts the shell', async t => {
    await fixture.pageCase(t, async page => {
      await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent === 'Live', 'authenticated shell');
      assert.deepEqual(await visibleProse(page), []);
      await page.evaluate(() => {
        const header = document.querySelector('main header')!;
        const fixture = document.createElement('span');
        fixture.dataset.proseFixture = '';
        fixture.textContent = 'This group contains items needing your attention.';
        header.append(fixture);
      });
      assert.deepEqual(await visibleProse(page), ['This group contains items needing your attention.']);
      await page.evaluate(() => { document.querySelector('[data-prose-fixture]')!.textContent = 'One two three four five six seven'; });
      assert.deepEqual(await visibleProse(page), ['One two three four five six seven']);
      await page.evaluate(() => { document.querySelector('[data-prose-fixture]')!.textContent = 'Explanation.'; });
      assert.deepEqual(await visibleProse(page), ['Explanation.']);
      await page.evaluate(() => {
        const fixture = document.querySelector<HTMLElement>('[data-prose-fixture]')!;
        fixture.hidden = true;
        document.querySelector('main header')!.setAttribute('title', 'This tooltip explains what the group means.');
      });
      assert.deepEqual(await visibleProse(page), [], 'hidden text and title attributes are excluded');
      await page.evaluate(() => {
        const tooltip = document.createElement('span');
        tooltip.setAttribute('role', 'tooltip');
        tooltip.textContent = 'This tooltip explains what the group means.';
        document.body.append(tooltip);
      });
      assert.deepEqual(await visibleProse(page), [], 'tooltip text is exempt');
      await page.getByRole('button', { name: 'Help', exact: true }).click();
      await page.getByRole('dialog', { name: 'Inbox keys', exact: true }).waitFor();
      await page.evaluate(() => {
        const explanation = document.createElement('p');
        explanation.textContent = 'These keys act on the currently focused group.';
        document.querySelector('dialog')!.append(explanation);
      });
      assert.deepEqual(await visibleProse(page), [], 'the keys help panel is exempt');
    });
  });

  await t.test('folds share the client state between panes and preserve unrelated area preferences', async t => {
    await fixture.pageCase(t, async page => {
      const first = page.locator('[data-pane="primary"] [data-fold-toggle]');
      assert.equal(await first.getAttribute('aria-expanded'), 'true', 'a fresh browser context has independent state');
      await page.keyboard.press('Meta+Backslash');
      const second = page.locator('[data-pane="secondary"] [data-fold-toggle]');
      await second.waitFor();
      await first.click();
      assert.equal(await second.getAttribute('aria-expanded'), 'false', 'same area and fold agree across panes');
      assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('cland.ui.inbox.v1')!)),
        { filter: 'waiting', folds: { other: true, objects: true } });
      await page.keyboard.press('2');
      await page.getByRole('button', { name: 'Fold Items', exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Fold Items', exact: true }).getAttribute('aria-expanded'), 'true', 'another area has independent folds');
    }, async page => { await page.addInitScript(() => localStorage.setItem('cland.ui.inbox.v1', JSON.stringify({ filter: 'waiting', folds: { other: true } }))); });
  });

  await t.test('denied writes keep folds usable even with an existing preference record', async t => {
    await fixture.pageCase(t, async page => {
      const toggle = page.getByRole('button', { name: 'Fold Inbox', exact: true });
      await toggle.click();
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      await toggle.press('Space');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true', 'native Space activates the fold rather than starting a leader');
      await toggle.press('Enter');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
    }, async page => {
      await page.addInitScript(() => {
        localStorage.setItem('cland.ui.inbox.v1', JSON.stringify({ filter: 'waiting' }));
        Storage.prototype.setItem = () => { throw new Error('denied'); };
      });
    });
  });

  await t.test('invalid stored folds fall back independently and unavailable storage still permits folding', async t => {
    for (const value of ['{broken', '[]', '{"folds":{"objects":"true"}}', '{"folds":null}']) {
      await fixture.pageCase(t, async page => {
        const toggle = page.getByRole('button', { name: 'Fold Inbox', exact: true });
        assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
        await toggle.click();
        assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      }, async page => { await page.addInitScript(value => localStorage.setItem('cland.ui.inbox.v1', value), value); });
    }
    await fixture.pageCase(t, async page => {
      const toggle = page.getByRole('button', { name: 'Fold Inbox', exact: true });
      await toggle.click();
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      await toggle.press('ArrowRight');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
    }, async page => {
      await page.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', { get() { throw new Error('denied'); } });
      });
    });
  });
});
