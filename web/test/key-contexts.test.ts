// Web: declared field contexts and inactive area keys through the production shell.
import test from 'node:test';
import assert from 'node:assert/strict';
import { connectUi } from '../../hub/test/harness.ts';
import { webFixture } from './harness.ts';

test('declared composer fields own their keys while ordinary fields retain native input', async t => {
  const fixture = await webFixture(t);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Accounts', exact: true }).click();
    await page.evaluate(() => {
      for (const declared of [false, true]) {
        const field = document.createElement('textarea');
        field.setAttribute('aria-label', declared ? 'Composer fixture' : 'Ordinary fixture');
        if (declared) field.dataset.keyContext = 'composer';
        const container = document.createElement('div');
        container.dataset.keyContext = 'composer';
        container.append(field);
        document.body.append(container);
      }
    });
    for (const declared of [false, true]) {
      const field = page.getByRole('textbox', { name: declared ? 'Composer fixture' : 'Ordinary fixture' });
      await field.focus();
      for (const modifiers of [{}, { shiftKey: true }, { metaKey: true }]) {
        const consumed = await field.evaluate((node, modifiers) => {
          const event = new KeyboardEvent('keydown', { code: 'Enter', key: 'ж', bubbles: true, cancelable: true, ...modifiers });
          node.dispatchEvent(event);
          return event.defaultPrevented;
        }, modifiers);
        assert.equal(consumed, declared, `${declared ? 'composer' : 'ordinary'} Enter ${JSON.stringify(modifiers)}`);
      }
      await field.press('1');
      assert.equal(await field.inputValue(), '1', 'digits remain field text');
      assert.equal(await page.locator('h1').textContent(), 'Accounts');
      assert.equal(await page.locator('[data-pane="secondary"]').count(), 0, 'composer command Enter never opens another pane');
      await field.press('Meta+k');
      await page.getByRole('dialog', { name: 'Palette', exact: true }).waitFor();
      await page.keyboard.press('Escape');
      assert.equal(await field.evaluate(node => node === document.activeElement), true);
      assert.equal(await field.inputValue(), '1');
    }
  });
});

test('area modules keep selection and drawers while unimplemented session actions stay absent from help and palette', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'session.launch', name: 'context-session', harness: 'codex' })).ok, true);
  await fixture.pageCase(t, async page => {
    for (const area of ['Inbox', 'Sessions', 'Topics', 'Events', 'Artifacts', 'Accounts']) {
      await page.getByRole('button', { name: area, exact: true }).click();
      await page.getByRole('list', { name: `${area} objects`, exact: true }).waitFor();
      assert.equal(await page.getByRole('heading', { name: area, exact: true }).count(), 1);
    }
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    const row = page.locator('[data-object-id="context-session"]');
    await row.click();
    const fold = page.getByRole('button', { name: 'Fold Idle', exact: true });
    await fold.focus();
    await page.keyboard.press('Enter');
    assert.equal(await fold.getAttribute('aria-expanded'), 'false', 'session Enter preserves ordinary button activation');
    await page.keyboard.press('Enter');
    assert.equal(await fold.getAttribute('aria-expanded'), 'true');
    await row.focus();
    const drawer = page.getByRole('complementary', { name: 'Drawer', exact: true });
    await drawer.waitFor();
    for (const key of ['l', 'a']) await row.press(key);
    assert.equal(await row.getAttribute('aria-pressed'), 'true');
    assert.equal(await drawer.count(), 1);
    await row.press('Shift+/');
    const help = page.getByRole('dialog', { name: 'Sessions keys', exact: true });
    await help.waitFor();
    assert.deepEqual(await help.locator('[data-key-action^="session-"] dt').allTextContents(), ['Next session', 'Previous session', 'Open session', 'Stop session', 'Resume session', 'Archive session', 'Capabilities', 'Show archived sessions']);
    assert.equal(await help.locator('kbd').count(), 22);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Meta+k');
    const palette = page.getByRole('dialog', { name: 'Palette', exact: true });
    await page.getByRole('combobox', { name: 'Search palette' }).fill('>Launch a session');
    assert.equal(await palette.getByRole('option').count(), 0);
    await page.keyboard.press('Escape');
    await row.press('Meta+Enter');
    await page.locator('[data-pane="secondary"]').getByRole('heading', { name: 'context-session', exact: true }).waitFor();
    assert.equal(await drawer.count(), 0);
  });
});

test('the palette lists and runs handled Items actions after restoring focus', async t => {
  const fixture = await webFixture(t);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Items', exact: true }).click();
    const filter = page.getByRole('button', { name: 'D · Done shown', exact: true });
    await filter.focus();
    await page.keyboard.press('Meta+k');
    const search = page.getByRole('combobox', { name: 'Search palette' });
    for (const key of ['g', '1', '2', '3', '4', '5', '6', '7', 'Shift+Slash']) await search.press(key);
    assert.equal(await search.inputValue(), 'g1234567?', 'shell chords remain literal search text');
    await search.fill('>Hide done items');
    const action = page.getByRole('option').filter({ hasText: 'Hide done items' });
    await action.waitFor();
    assert.equal(await action.locator('kbd').textContent(), 'D');
    await page.keyboard.press('Enter');
    const hidden = page.getByRole('button', { name: 'D · Done hidden', exact: true });
    await hidden.waitFor();
    assert.equal(await hidden.getAttribute('aria-pressed'), 'true');
    assert.equal(await hidden.evaluate(node => node === document.activeElement), true);
  });
});
