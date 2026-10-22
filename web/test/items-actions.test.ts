// Web: physical keys -> real browser/protocol -> fake Coordinator delivery.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { connectUi, eventually, inProcessSpoke } from '../../hub/test/harness.ts';
import { webFixture, pageUntil } from './harness.ts';
import { seedItem } from './items-fixture.ts';

async function prepare(root: string) {
  await seedItem(root, 'R-900000', 'release', 'Actions release', { version: '1.0.0' });
  await seedItem(root, 'E-900001', 'epic', 'Actions epic', { parent: 'R-900000' });
  for (let n = 2; n < 6; n++) await seedItem(root, `T-${900000 + n}`, 'task', `Action task ${n}`, { parent: 'E-900001' });
}

test('three selected items send one General message to the fake Coordinator', async t => {
  const fixture = await webFixture(t, { prepare });
  const ui = await connectUi(t, fixture.hub.discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'coord', harness: 'codex', role: 'coordinator' });
  assert.equal(launched.ok, true, launched.error);
  const fake = fixture.fakes.codex!;
  const coord = await inProcessSpoke(t, { cwd: fixture.root, discover: true, name: 'coord', assignRole: false, sessionId: (launched.value as { process: { sessionId: string } }).process.sessionId, launchToken: fake.spawns[0]!.launchToken! });
  await coord.waitForPresence(['coord']);
  fake.idle('coord');
  await fixture.pageCase(t, async page => {
    await page.keyboard.press('2');
    let tree = page.getByRole('tree', { name: 'Items tree' });
    await tree.locator('[data-object-id="E-900001"]').click();
    await page.keyboard.press('l');
    await tree.locator('[data-object-id="T-900002"]').click();
    await page.keyboard.press('x');
    await page.keyboard.press('Shift+j');
    await page.keyboard.press('Shift+j');
    await pageUntil(page, () => document.querySelectorAll('[data-marked="true"]').length === 3, 'three selected rows rendered');
    assert.deepEqual(await tree.locator('[data-marked="true"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-object-id'))), ['T-900002', 'T-900003', 'T-900004']);
    await page.getByRole('button', { name: 'Board', exact: true }).click();
    tree = page.getByRole('tree', { name: 'Items board' });
    await tree.locator('[data-object-id="E-900001"] [data-tree-chevron]').click();
    await tree.locator('[data-object-id="T-900005"]').click();
    assert.equal(await tree.locator('[data-marked="true"]').count(), 3, 'Tree marks remain visible in Board');
    assert.equal(await tree.locator('[data-object-id="T-900005"]').evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('m');
    const field = page.getByRole('textbox', { name: 'Quick message' });
    await field.fill('Please prioritise these');
    const delivered = eventually('fake Coordinator receives the selected-item message', () => fake.injections.find(value => value.message.text.includes('Please prioritise these')));
    void delivered.catch(() => {});
    await field.press('Enter');
    const receipt = await delivered;
    assert.equal(receipt.topic?.id, 'general');
    assert.equal(fake.injections.filter(value => value.message.text.includes('Please prioritise these')).length, 1);
    assert.deepEqual(receipt.message.text.split('\n').slice(1).map(line => line.match(/T-\d+/)?.[0]), ['T-900002', 'T-900003', 'T-900004']);
    await tree.locator('[data-object-id="T-900004"]').click();
    await page.keyboard.press('Escape');
    await pageUntil(page, () => document.querySelectorAll('[data-marked="true"]').length === 0, 'Escape clears selection');
    assert.equal(await tree.locator('[data-marked="true"]').count(), 0);
    await page.keyboard.press('x'); await page.keyboard.press('Shift+k');
    await pageUntil(page, () => document.querySelectorAll('[aria-label="Items board"] [data-marked="true"]').length === 2, 'Board x and Shift+k extend the shared selection');
    assert.equal(await tree.locator('[data-marked="true"]').count(), 2);
    await page.keyboard.press('Escape');
    await page.keyboard.press('s');
    await page.getByRole('navigation', { name: 'Item scope' }).locator('[aria-current="page"]').filter({ hasText: 'E-900001' }).waitFor();
    assert.match(await page.getByLabel('Board scope', { exact: true }).innerText(), /E-900001/);
    await page.keyboard.press('Space'); await page.keyboard.press('Space');
    await pageUntil(page, () => document.querySelector('[aria-label="Board scope"]')?.textContent?.includes('R-900000') === true, 'Board back restores release scope');
    assert.match(await page.getByLabel('Board scope', { exact: true }).innerText(), /R-900000/);
    await page.keyboard.press('g'); await page.keyboard.press('s');
    await page.getByRole('main', { name: 'Sessions', exact: true }).waitFor();
    assert.equal(await page.locator('[aria-label="Sessions objects"] [data-object-id="coord"]').count(), 1);
  });
});

test('M creates a missing item topic and sends the quick message there', async t => {
  const fixture = await webFixture(t, { prepare });
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  await fixture.pageCase(t, async page => {
    await page.keyboard.press('2');
    const tree = page.getByRole('tree', { name: 'Items tree' });
    await tree.locator('[data-object-id="E-900001"]').click();
    await page.keyboard.press('l');
    await tree.locator('[data-object-id="T-900002"]').click();
    await page.keyboard.press('Shift+m');
    const field = page.getByRole('textbox', { name: 'Quick message' });
    await field.fill('Discuss the missing topic');
    const posted = ui.waitFor(frame => frame.type === 'message' && (frame.message as { text: string }).text.includes('Discuss the missing topic'));
    void posted.catch(() => {});
    await field.press('Enter');
    const frame = await posted;
    const topic = frame.topic as { id: string; item: string };
    assert.equal(topic.item, 'T-900002');
    assert.notEqual(topic.id, 'general');
    const viewed = await ui.request({ type: 'task.view', item: 'T-900002' });
    assert.equal((viewed.value as { item: { topic: string } }).item.topic, topic.id);
    const history = await ui.request({ type: 'topic.history', topic: topic.id });
    assert.equal((history.value as { messages: { text: string }[] }).messages.filter(row => row.text === 'Discuss the missing topic\nT-900002 · Action task 2').length, 1);
    await page.getByRole('button', { name: 'Item topic', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Item topic', exact: true }).getAttribute('aria-pressed'), 'false');
    await page.getByRole('button', { name: 'Item topic', exact: true }).click();
    await field.fill('Continue here');
    const continued = ui.waitFor(value => value.type === 'message' && (value.message as { text: string }).text.startsWith('Continue here'));
    void continued.catch(() => {});
    await field.press('Enter');
    assert.equal(((await continued).topic as { id: string }).id, topic.id);
    const topics = await ui.request({ type: 'topic.list' });
    assert.equal((topics.value as { topics: { item: string }[] }).topics.filter(value => value.item === 'T-900002').length, 1);
    await tree.locator('[data-object-id="T-900002"]').click();
    await page.keyboard.press('g'); await page.keyboard.press('t');
    await page.getByRole('main', { name: 'Topics', exact: true }).waitFor();
    await page.keyboard.press('g'); await page.keyboard.press('i');
    await page.getByRole('main', { name: 'Items', exact: true }).waitFor();
    await pageUntil(page, () => document.activeElement?.getAttribute('data-object-id') === 'T-900002', 'gi reveals the bound topic item');
    assert.equal(await tree.locator('[data-object-id="T-900002"]').evaluate(node => node === document.activeElement), true);
  });
});

test('scope breadcrumbs, back and item-id links reveal item ancestors', async t => {
  const fixture = await webFixture(t, { prepare: async root => {
    await prepare(root);
    await seedItem(root, 'C-900010', 'category', 'Link category');
    await seedItem(root, 'E-900011', 'epic', 'Closed link epic', { parent: 'C-900010', state: 'closed' });
    await seedItem(root, 'T-900012', 'task', 'Closed link target', { parent: 'E-900011', state: 'closed', status: 'done' });
    await seedItem(root, 'T-900002', 'task', 'Action task 2', { parent: 'E-900001' }, '## Summary\n\nSee T-900012 for the earlier result');
  } });
  await fixture.pageCase(t, async page => {
    await page.keyboard.press('2');
    const tree = page.getByRole('tree', { name: 'Items tree' });
    await tree.locator('[data-object-id="E-900001"]').click();
    const scoped = tree.locator('[data-object-id="R-900000"]').waitFor({ state: 'hidden' });
    void scoped.catch(() => {});
    await page.keyboard.press('s');
    await scoped;
    const crumbs = page.getByRole('navigation', { name: 'Item scope' });
    assert.equal(await tree.locator('[data-object-id="R-900000"]').count(), 0);
    assert.equal(await tree.locator('[data-object-id="T-900004"]').count(), 1);
    await crumbs.getByRole('button', { name: 'R-900000', exact: true }).click();
    await tree.locator('[data-object-id="R-900000"]').waitFor();
    assert.equal(await tree.locator('[data-object-id="R-900000"]').count(), 1);
    const backed = tree.locator('[data-object-id="R-900000"]').waitFor({ state: 'hidden' });
    void backed.catch(() => {});
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    await backed;
    assert.equal(await tree.locator('[data-object-id="R-900000"]').count(), 0);
    await tree.locator('[data-object-id="T-900002"]').click();
    await page.keyboard.press('s');
    assert.equal(await crumbs.getByRole('button', { name: 'E-900001', exact: true }).getAttribute('aria-current'), 'page', 's on a leaf scopes to its parent');
    await page.getByRole('button', { name: 'Board', exact: true }).click();
    await page.getByRole('tree', { name: 'Items board' }).locator('[data-object-id="T-900002"]').click();
    await page.getByRole('button', { name: 'Graph', exact: true }).click();
    await page.getByRole('tree', { name: 'Items graph' }).locator('[data-object-id="T-900002"]').click();
    await page.getByRole('link', { name: 'T-900012', exact: true }).click();
    const target = tree.locator('[data-object-id="T-900012"]');
    await target.waitFor();
    await pageUntil(page, () => document.activeElement?.getAttribute('data-object-id') === 'T-900012', 'linked item row focused');
    assert.equal(await target.evaluate(node => node === document.activeElement), true);
    assert.equal(await tree.locator('[data-object-id="C-900010"]').getAttribute('aria-expanded'), 'true');
    assert.equal(await tree.locator('[data-object-id="E-900011"]').getAttribute('aria-expanded'), 'true');
    assert.equal(await page.getByRole('region', { name: 'Item card' }).getAttribute('data-item-id'), 'T-900012');
    await page.screenshot({ path: resolve(import.meta.dirname, '../test-results/items-actions.png') });
  });
});

async function deferredLinks(t: TestContext, laterKinds: string[]) {
  const fixture = await webFixture(t, { prepare: async root => {
    await prepare(root);
    await seedItem(root, 'E-900010', 'epic', 'Later epic', { parent: 'R-900000' });
    await seedItem(root, 'T-900011', 'task', 'Later task', { parent: 'E-900010' });
    await seedItem(root, 'T-900020', 'task', 'Deferred link target', { state: 'closed', status: 'done' });
    await seedItem(root, 'T-900002', 'task', 'Action task 2', { parent: 'E-900001' }, '## Summary\n\nSee T-900020 for the earlier result');
  } });
  for (const later of laterKinds) {
    let release: (() => void) | undefined;
    let heldId: string | undefined;
    await fixture.pageCase(t, async page => {
      await page.keyboard.press('2');
      const tree = page.getByRole('tree', { name: 'Items tree' });
      await tree.locator('[data-object-id="E-900001"]').click();
      await page.keyboard.press('l');
      await tree.locator('[data-object-id="T-900002"]').click();
      if (later === 'tab' || later === 'all') {
        await page.getByRole('button', { name: 'Board', exact: true }).click();
        if (later === 'all') await page.getByRole('button', { name: 'E-900001 Actions epic', exact: true }).click();
        else await page.getByRole('tree', { name: 'Items board' }).locator('[data-object-id="E-900001"] [data-tree-chevron]').click();
        await page.getByRole('tree', { name: 'Items board' }).locator('[data-object-id="T-900002"]').click();
      }
      await page.getByRole('link', { name: 'T-900020', exact: true }).click();
      await eventually('closed-item summary response held at the browser edge', () => release);
      if (later === 'area') {
        await page.keyboard.press('3');
        await page.getByRole('main', { name: 'Sessions', exact: true }).waitFor();
      } else if (later === 'row') {
        await tree.locator('[data-object-id="T-900003"]').click();
        assert.equal(await page.getByRole('region', { name: 'Item card' }).getAttribute('data-item-id'), 'T-900003');
      } else {
        await page.getByRole('button', { name: later === 'all' ? 'All epics' : 'E-900010 Later epic', exact: true }).click();
      }
      // Opening the palette observes the loaded row in the rendered connection model.
      // The held target has no parent, so that row completes the exact lookup chain.
      await page.keyboard.press('Meta+k');
      await page.getByRole('combobox', { name: 'Search palette' }).fill('#T-900020');
      await page.getByText('0 results', { exact: true }).waitFor();
      assert.equal(await page.getByRole('dialog', { name: 'Palette', exact: true }).getByRole('option').count(), 0, 'target is still absent before release');
      release!();
      await page.getByRole('option', { name: /T-900020.*Deferred link target/ }).waitFor();
      assert.equal(await page.getByRole('main').getAttribute('aria-label'), later === 'area' ? 'Sessions' : 'Items');
      if (later === 'row') assert.equal(await page.getByRole('region', { name: 'Item card' }).getAttribute('data-item-id'), 'T-900003');
      if (later === 'tab' || later === 'all') {
        assert.equal(await page.getByRole('button', { name: 'Board', exact: true }).getAttribute('aria-pressed'), 'true');
        assert.equal(await page.getByRole('button', { name: later === 'all' ? 'All epics' : 'E-900010 Later epic', exact: true }).getAttribute('aria-pressed'), 'true');
      }
      await page.keyboard.press('Escape');
    }, async page => {
      await page.routeWebSocket('**/ws', route => {
        const server = route.connectToServer();
        route.onMessage(message => {
          const frame = JSON.parse(String(message)) as { type: string; id?: string; ids?: string[] };
          if (frame.type === 'task.list' && frame.ids?.includes('T-900020')) heldId = frame.id;
          server.send(message);
        });
        server.onMessage(message => {
          const frame = JSON.parse(String(message)) as { type: string; id?: string };
          if (frame.type === 'result' && frame.id === heldId) release = () => { route.send(message); };
          else route.send(message);
        });
      });
    });
  }
}


test('late item-link results preserve later area and row navigation', t => deferredLinks(t, ['area', 'row']));

test('late item links preserve later Board epic and All tabs', t => deferredLinks(t, ['tab', 'all']));

test('Board selection and scope retain a non-first epic from Tree', async t => {
  const fixture = await webFixture(t, { prepare: async root => {
    await prepare(root);
    await seedItem(root, 'E-900010', 'epic', 'Later epic', { parent: 'R-900000' });
    await seedItem(root, 'T-900011', 'task', 'Later task', { parent: 'E-900010' });
  } });
  await fixture.pageCase(t, async page => {
    await page.keyboard.press('2');
    const tree = page.getByRole('tree', { name: 'Items tree' });
    await tree.locator('[data-object-id="E-900010"]').click();
    await page.getByRole('button', { name: 'Board', exact: true }).click();
    const board = page.getByRole('tree', { name: 'Items board' });
    assert.equal(await board.locator('[data-object-id="E-900010"]').getAttribute('aria-selected'), 'true');
    await page.keyboard.press('x');
    await pageUntil(page, () => document.querySelector('[aria-label="Items board"] [data-object-id="E-900010"]')?.getAttribute('data-marked') === 'true', 'Board x marks the retained second epic');
    assert.deepEqual(await board.locator('[data-marked="true"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-object-id'))), ['E-900010']);
    await page.keyboard.press('s');
    await pageUntil(page, () => document.querySelector('[aria-label="Board scope"]')?.textContent?.includes('E-900010') === true, 'Board s scopes the retained second epic');
    assert.match(await page.getByLabel('Board scope', { exact: true }).innerText(), /E-900010/);
    await board.locator('[data-object-id="T-900011"]').waitFor();
    await page.getByRole('button', { name: 'Tree', exact: true }).click();
    await tree.locator('[data-object-id="E-900010"]').waitFor();
    assert.equal(await tree.locator('[data-object-id="R-900000"]').count(), 0);
    assert.equal(await tree.locator('[data-object-id="E-900010"]').getAttribute('data-marked'), 'true');
  });
});


test('Graph shares selection, messages and scope navigation with Tree', async t => {
  const fixture = await webFixture(t, { prepare });
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  await fixture.pageCase(t, async page => {
    await page.keyboard.press('2');
    const tree = page.getByRole('tree', { name: 'Items tree' });
    await tree.locator('[data-object-id="E-900001"]').click();
    await page.keyboard.press('l');
    await tree.locator('[data-object-id="T-900002"]').click();
    await page.keyboard.press('s');
    await page.getByRole('button', { name: 'Graph', exact: true }).click();
    const graph = page.getByRole('tree', { name: 'Items graph' });
    await page.keyboard.press('x'); await page.keyboard.press('Shift+j');
    await pageUntil(page, () => document.querySelectorAll('[aria-label="Items graph"] [data-marked="true"]').length === 2, 'Graph shares the marked selection');
    assert.deepEqual(await graph.locator('[data-marked="true"]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-object-id'))).then(ids => ids.sort()), ['T-900002', 'T-900003']);
    await page.keyboard.press('m');
    const field = page.getByRole('textbox', { name: 'Quick message' });
    await field.fill('Graph selection context');
    const posted = ui.waitFor(frame => frame.type === 'message' && (frame.message as { text: string }).text.startsWith('Graph selection context'));
    void posted.catch(() => {});
    await field.press('Enter');
    const message = await posted;
    assert.equal((message.topic as { id: string }).id, 'general');
    assert.equal((message.message as { text: string }).text, 'Graph selection context\nT-900002 · Action task 2\nT-900003 · Action task 3');
    await graph.locator('[data-object-id="T-900004"]').click();
    await page.keyboard.press('Escape');
    await pageUntil(page, () => document.querySelectorAll('[aria-label="Items graph"] [data-marked="true"]').length === 0, 'Graph Escape clears marks');
    await page.getByRole('navigation', { name: 'Item scope' }).getByRole('button', { name: 'Items', exact: true }).click();
    await graph.locator('[data-object-id="E-900001"]').click();
    await page.keyboard.press('s');
    await pageUntil(page, () => document.querySelector('[aria-label="Graph scope"]')?.textContent?.includes('E-900001') === true, 'Graph s scopes the selected epic');
    assert.match(await page.getByLabel('Graph scope', { exact: true }).innerText(), /E-900001/);
    await page.keyboard.press('Space'); await page.keyboard.press('Space');
    await pageUntil(page, () => document.querySelector('[aria-label="Graph scope"]')?.textContent?.includes('R-900000') === true, 'Graph back restores release scope');
    assert.match(await page.getByLabel('Graph scope', { exact: true }).innerText(), /R-900000/);
  });
});
