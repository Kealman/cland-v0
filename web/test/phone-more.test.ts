// Web: More's read-only areas through sealed public frames and touch Headless Shell.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Artifact } from '../../shared/wire/index.ts';
import { webFixture, pageUntil } from './harness.ts';
import { seedItem } from './items-fixture.ts';
import { cland, connectUi } from '../../hub/test/harness.ts';
import { until } from '../../hub/test/until.ts';

async function more(page: Page, area: string) {
  await page.getByRole('button', { name: 'More', exact: true }).tap();
  await page.getByRole('navigation', { name: 'More areas' }).getByRole('button', { name: area, exact: true }).tap();
  await pageUntil(page, () => document.querySelector('nav[aria-label="Phone areas"] [aria-label="More"]')?.getAttribute('aria-current') === 'page', 'More is current');
  assert.equal(await page.locator('main').getAttribute('aria-label'), area);
}

test('phone Items opens a reusable read-only full-screen card and returns by either back control', async t => {
  const fixture = await webFixture(t, { prepare: async root => {
    await seedItem(root, 'T-1', 'task', 'Phone card', {}, '## Summary\n\nPhone summary\n\n## Acceptance criteria\n\n- [ ] C1. Keep criterion');
  } });
  await fixture.pageCase(t, async page => {
    await more(page, 'Items');
    const tree = page.getByRole('tree', { name: 'Items tree' });
    await tree.waitFor();
    assert.equal(await page.getByRole('group', { name: 'Items view', exact: true }).count(), 0);
    await tree.locator('[data-tree-key=":unscheduled"]').tap();
    const row = tree.locator('[data-object-id="T-1"]');
    await row.tap();
    const card = page.getByRole('region', { name: 'Item card', exact: true });
    await card.waitFor();
    assert.equal(await page.getByRole('button', { name: 'More', exact: true }).getAttribute('aria-current'), 'page');
    assert.equal(await tree.count(), 0);
    for (const block of ['Summary', 'Facts', 'Progress', 'Latest verdict', 'Relations', 'Branch and suite', 'Dates']) {
      assert.equal(await card.getByRole('heading', { name: block, exact: true }).count(), 1);
    }
    await card.getByRole('button', { name: 'Criteria', exact: true }).tap();
    await card.getByText('Keep criterion', { exact: false }).waitFor();
    assert.equal(await card.locator('input, textarea, form').count(), 0);
    assert.equal(await card.getByRole('button', { name: /Save|Remove|Mark.*done|Message|Approve|Archive|Add criterion/ }).count(), 0);
    await page.screenshot({ path: 'web/test-results/phone-item-card.png' });
    assert.equal(await page.getByRole('complementary', { name: 'Drawer', exact: true }).count(), 0);
    const back = page.getByRole('button', { name: 'Back to Items', exact: true });
    assert.ok((await back.boundingBox())!.height >= 44);
    await back.tap();
    await row.waitFor();
    await row.tap();
    await card.waitFor();
    await page.goBack();
    await row.waitFor();
    assert.equal(await card.count(), 0);
    await page.setViewportSize({ width: 640, height: 844 });
    assert.equal(await page.getByRole('group', { name: 'Items view', exact: true }).getByRole('button', { name: 'Graph', exact: true }).getAttribute('aria-pressed'), 'true');
  }, async page => {
    await page.addInitScript(() => { if (!localStorage.getItem('cland.ui.items.v1')) localStorage.setItem('cland.ui.items.v1', JSON.stringify({ view: 'graph' })); });
  }, { phone: true });
});

test('phone item action keys are inert and desktop keys still filter, compose and edit', async t => {
  const fixture = await webFixture(t, { prepare: async root => {
    await seedItem(root, 'T-1', 'task', 'Keys card', {}, '## Acceptance criteria\n\n- [ ] C1. Keep criterion');
  } });
  const view = async () => {
    const reply = await cland(fixture.root, 'task', 'view', 'T-1', '--json');
    assert.equal(reply.code, 0, reply.stderr);
    const item = JSON.parse(reply.stdout).item;
    return { criteria: item.criteria, state: item.state, status: item.status, topic: item.topic };
  };
  await fixture.pageCase(t, async page => {
    const before = await view();
    await more(page, 'Items');
    const tree = page.getByRole('tree', { name: 'Items tree' });
    await tree.locator('[data-tree-key=":unscheduled"]').tap();
    const row = tree.locator('[data-object-id="T-1"]');
    await row.focus();
    const filters = await page.locator('[aria-pressed]').evaluateAll(nodes => nodes.map(node => [node.textContent, node.getAttribute('aria-pressed')]));
    for (const key of ['Shift+D', 'Shift+A', 'm', 'Shift+M', 'e', 'a', 'd']) await page.keyboard.press(key);
    assert.deepEqual(await page.locator('[aria-pressed]').evaluateAll(nodes => nodes.map(node => [node.textContent, node.getAttribute('aria-pressed')])), filters);
    assert.deepEqual(await view(), before);
    await row.tap();
    const card = page.getByRole('region', { name: 'Item card', exact: true });
    await card.getByRole('button', { name: 'Criteria', exact: true }).focus();
    for (const key of ['e', 'm', 'Shift+M']) await page.keyboard.press(key);
    assert.equal(await card.locator('input, form').count(), 0);
    await page.getByRole('button', { name: 'Palette', exact: true }).tap();
    const dialog = page.getByRole('dialog');
    for (const label of ['Hide done items', 'Show archived roots', 'Message General', 'Message item topic', 'Edit criteria block', 'Approve plan', 'Discuss plan with Lead']) {
      assert.equal(await dialog.getByRole('option').filter({ hasText: label }).count(), 0, label);
    }
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Back to Items', exact: true }).tap();
    await row.waitFor();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('group', { name: 'Items view', exact: true }).waitFor();
    await row.focus();
    await page.keyboard.press('Shift+D');
    assert.equal(await page.getByRole('button', { name: 'D · Done hidden', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('Shift+A');
    assert.equal(await page.getByRole('button', { name: 'A · Archive shown', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('m');
    await page.getByRole('textbox', { name: 'Quick message', exact: true }).waitFor();
    await pageUntil(page, () => document.activeElement?.getAttribute('aria-label') === 'Quick message', 'message key focus committed');
    await row.focus();
    await page.keyboard.press('Shift+M');
    await pageUntil(page, () => [...document.querySelectorAll('button')].some(node => node.textContent === 'Item topic' && node.getAttribute('aria-pressed') === 'true'), 'topic message key committed');
    assert.equal(await page.getByRole('button', { name: 'Item topic', exact: true }).getAttribute('aria-pressed'), 'true');
    await card.getByRole('button', { name: 'Criteria', exact: true }).focus();
    await page.keyboard.press('e');
    await card.getByRole('button', { name: 'Mark C1 done', exact: true }).click();
    await card.getByRole('button', { name: 'Mark C1 done', exact: true }).getByText('✓ Done', { exact: true }).waitFor();
    assert.equal((await view()).criteria[0].checked, true);
    await page.setViewportSize({ width: 640, height: 844 });
    await page.getByRole('group', { name: 'Items view', exact: true }).waitFor();
    assert.equal(await card.getByRole('textbox', { name: 'Criterion C1', exact: true }).count(), 1);
  }, undefined, { phone: true });
});

test('phone Artifacts opens the full-screen viewer without Keep, Archive or compose', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const made = await ui.request({ type: 'artifact.create', kind: 'note', title: 'Phone note', topic: 'general', content: '# Phone artifact\n\nRead this note' });
  assert.equal(made.ok, true, made.error);
  const artifact = (made.value as { artifact: Artifact }).artifact;
  const frames: Array<{ type: string }> = [];
  await fixture.pageCase(t, async page => {
    await more(page, 'Artifacts');
    const row = page.locator(`[data-artifact-section="mine"] [data-object-id="${artifact.id}"]`);
    await row.focus();
    for (const key of ['k', 'd', 's']) await page.keyboard.press(key);
    await row.tap();
    const viewer = page.locator('[data-area-surface="page"] [data-artifact-viewer]');
    await viewer.getByRole('heading', { name: 'Phone artifact', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'More', exact: true }).getAttribute('aria-current'), 'page');
    assert.equal(await page.locator('[data-area-surface="pane"][data-area-module="Artifacts"]').count(), 0);
    assert.equal(await page.getByRole('complementary', { name: 'Drawer', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: /^(Keep|Archive|Compose|Attach)/ }).count(), 0);
    assert.equal(frames.filter(frame => ['artifact.keep', 'artifact.archive'].includes(frame.type)).length, 0);
    await page.getByRole('button', { name: 'Palette', exact: true }).tap();
    const dialog = page.getByRole('dialog');
    for (const label of ['Keep artifact', 'Archive artifact', 'Attach to composer']) assert.equal(await dialog.getByRole('option').filter({ hasText: label }).count(), 0);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Back to Artifacts', exact: true }).tap();
    await row.waitFor();
    await row.tap();
    await viewer.waitFor();
    await page.goBack();
    await row.waitFor();
    const listed = await ui.request({ type: 'artifact.list', artifact: artifact.id });
    assert.equal(listed.ok, true);
    const current = (listed.value as { artifact: Artifact }).artifact;
    assert.equal(current.status, artifact.status);
    assert.equal(current.kept, artifact.kept);
  }, page => { page.on('websocket', socket => socket.on('framesent', event => frames.push(JSON.parse(String(event.payload))))); }, { phone: true });
});

test('phone Accounts retains registry and window facts while notification switches stay desktop only', async t => {
  const fixture = await webFixture(t, { accountReader: async () => [
    { id: '5h', label: '5h', usedPercent: 38, resetsAt: '2026-10-24T15:10:00Z' },
  ], prepare: async root => {
    await mkdir(join(root, 'phone-account'));
    await writeFile(join(process.env.XDG_CONFIG_HOME!, 'cland/accounts.toml'), `[accounts.phone-account]\nharness = "codex"\nhome = ${JSON.stringify(join(root, 'phone-account'))}\n`);
  } });
  await fixture.pageCase(t, async page => {
    await more(page, 'Accounts');
    const account = page.locator('[data-account-id="codex/phone-account"]');
    await account.getByText('38%', { exact: true }).waitFor();
    for (const fact of ['phone-account', 'Codex', join(fixture.root, 'phone-account'), '5h', 'poll']) assert.ok((await account.textContent())?.includes(fact), fact);
    await page.getByRole('region', { name: 'Profile', exact: true }).locator('time').nth(2).waitFor();
    assert.equal(await page.getByRole('switch').count(), 0);
    assert.equal(await page.getByRole('button', { name: /clear|remove|edit|revoke/i }).count(), 0);
    await page.setViewportSize({ width: 640, height: 844 });
    await page.getByRole('switch', { name: 'Needs you', exact: true }).waitFor();
    assert.equal(await page.getByRole('switch').count(), 2);
  }, undefined, { phone: true });
});

test('phone Back wins over an earlier held item-link read', async t => {
  const fixture = await webFixture(t, { prepare: async root => {
    await seedItem(root, 'T-1', 'task', 'Current phone card', {}, '## Summary\n\nSee T-2');
    await seedItem(root, 'T-2', 'task', 'Held phone target', { state: 'closed', status: 'done' });
  } });
  for (const back of ['button', 'browser'] as const) {
    let release: (() => void) | undefined;
    let heldId: string | undefined;
    await fixture.pageCase(t, async page => {
      await more(page, 'Items');
      const tree = page.getByRole('tree', { name: 'Items tree' });
      await tree.locator('[data-tree-key=":unscheduled"]').tap();
      await tree.locator('[data-object-id="T-1"]').tap();
      const card = page.getByRole('region', { name: 'Item card', exact: true });
      await card.getByRole('link', { name: 'T-2', exact: true }).tap();
      await until(() => !!release, { what: 'held target summary response', timeoutMs: 3000 });
      if (back === 'button') await page.getByRole('button', { name: 'Back to Items', exact: true }).tap();
      else await page.goBack();
      await tree.locator('[data-object-id="T-1"]').waitFor();
      await page.getByRole('button', { name: 'Palette', exact: true }).tap();
      const palette = page.getByRole('dialog', { name: 'Palette', exact: true });
      await palette.getByRole('combobox', { name: 'Search palette' }).fill('#T-2');
      await palette.getByText('0 results', { exact: true }).waitFor();
      // Observe the exact target in the rendered model before asserting Back won.
      const received = palette.getByRole('option', { name: /T-2.*Held phone target/ }).waitFor();
      release!();
      await received;
      assert.equal(await card.count(), 0, `${back} Back must not reopen the late target`);
      assert.equal(await tree.locator('[data-object-id="T-1"]').count(), 1);
      await page.keyboard.press('Escape');
    }, async page => {
      await page.addInitScript(() => localStorage.setItem('cland.ui.items.v1', JSON.stringify({ tree: { hideDone: true, open: {} } })));
      await page.routeWebSocket('**/ws', route => {
        const server = route.connectToServer();
        route.onMessage(message => {
          const frame = JSON.parse(String(message)) as { type: string; id?: string; ids?: string[] };
          if (frame.type === 'task.list' && frame.ids?.includes('T-2')) heldId = frame.id;
          server.send(message);
        });
        server.onMessage(message => {
          const frame = JSON.parse(String(message)) as { type: string; id?: string };
          if (frame.type === 'result' && frame.id === heldId) release = () => { route.send(message); };
          else route.send(message);
        });
      });
    }, { phone: true });
  }
});
