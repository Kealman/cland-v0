// Web: Plan approval, changes and width policy through the sealed hub/browser seam.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { resizePage, webFixture, pageUntil } from './harness.ts';
import { seedItem } from './items-fixture.ts';
import { until } from '../../hub/test/until.ts';
import { cland, connectUi } from '../../hub/test/harness.ts';

const yaml = (name: string) => `stages:\n  - name: ${name}\n    qa: { scope: affected, when: after-stage }\n    lanes:\n      - [T-900100]\n  - name: Completed stage\n    qa: { scope: none, when: per-item }\n    lanes:\n      - [T-900101]\n`;
test('the Plan view in Items', async t => {
  const fixture = await webFixture(t, { prepare: async root => {
    await seedItem(root, 'R-900000', 'release', 'Plan release', { version: '1.0.0' });
    await seedItem(root, 'E-900010', 'epic', 'Planned epic', { parent: 'R-900000' });
    await seedItem(root, 'T-900100', 'task', 'Planned task', { parent: 'E-900010' });
    await seedItem(root, 'T-900101', 'task', 'Completed work', { parent: 'E-900010', state: 'closed', status: 'done' }, '## Acceptance criteria\n\n- [x] C1. Completed', [{ author: 'reviewer', at: '2026-10-20T12:00:00Z', text: 'Completed review', verdict: { verdict: 'review', result: 'clear', by: 'reviewer', run: 'plan-closed-review' } }]);
    await writeFile(join(root, '.cland/config.toml'), '[plan]\napproval = "human"\n');
  } });
  const ui = await connectUi(t, fixture.hub.discovery);
  const set = await ui.request({ type: 'task.plan', item: 'E-900010', op: 'set', yaml: yaml('First stage') });
  assert.equal(set.ok, true, set.error);
  const snapshots: string[][] = [], firstFrames: Record<string, unknown>[] = [];
  await t.test('C1 a approves a waiting plan as the human and the CLI reads the receipt', async t => fixture.pageCase(t, async page => {
    const plan = page.getByRole('region', { name: 'Epic plan' });
    await plan.getByRole('button', { name: 'a · Approve' }).waitFor();
    await pageUntil(page, () => document.querySelector('[aria-label="Epic plan"]')?.textContent?.includes('Completed work') === true, 'Plan-first resolves its closed member');
    assert.equal(snapshots[0]?.includes('T-900101'), false, 'closed member is absent from open snapshot');
    assert.match(await plan.innerText(), /✓.*T-900101 Completed work.*done · 0\/1.*review · clear · round 1 · plan-closed-review/s);
    assert.ok(firstFrames.some(frame => frame.type === 'task.list' && frame.projection === 'summary' && Array.isArray(frame.ids) && frame.ids.includes('T-900101')), 'missing member uses a bounded by-id summary');
    assert.equal((await ui.request({ type: 'task.edit', item: 'T-900101', title: 'Updated completed work' })).ok, true);
    await pageUntil(page, () => document.querySelector('[aria-label="Epic plan"]')?.textContent?.includes('Updated completed work') === true, 'closed-member delta stays in Plan');
    assert.match(await plan.innerText(), /✓.*T-900101 Updated completed work.*done · 0\/1.*plan-closed-review/s);
    assert.equal(firstFrames.some(frame => frame.type === 'task.view' && frame.item === 'T-900101'), false, 'closed member needs no body read');
    await plan.evaluate(node => node.setAttribute('data-test-visit', 'original'));
    const markWrites = firstFrames.filter(frame => frame.type === 'marks.set').length;
    const closed = await ui.request({ type: 'task.close', item: 'T-900100' });
    assert.equal(closed.ok, true, closed.error);
    await pageUntil(page, () => document.querySelector('[aria-label="Epic plan"]')?.textContent?.includes('✓ T-900100 Planned task') === true, 'selected open member remains in Plan after closing');
    assert.equal(await plan.getAttribute('data-test-visit'), 'original', 'same epic visit survives selected task closure');
    assert.match(await plan.getByRole('heading', { name: 'Plan of E-900010 Planned epic', exact: true }).innerText(), /E-900010/);
    assert.match(await plan.innerText(), /✓ T-900100 Planned task.*done · 0\/0/s);
    assert.equal(firstFrames.filter(frame => frame.type === 'marks.set').length, markWrites, 'closure did not re-enter the plan or advance its look');
    assert.equal(firstFrames.some(frame => frame.type === 'task.view' && ['T-900100', 'T-900101'].includes(String(frame.item))), false);
    await plan.click();
    await page.keyboard.press('a');
    await pageUntil(page, () => document.querySelector('[aria-label="Epic plan"]')?.textContent?.includes('Approved by human') === true, 'hub approval rendered');
    const shown = await cland(fixture.root, 'task', 'plan', 'show', 'E-900010', '--json');
    assert.equal(shown.code, 0, shown.stderr);
    assert.equal(JSON.parse(shown.stdout).approval.state, 'approved');
    assert.equal(JSON.parse(shown.stdout).approval.by, 'human');
    assert.match(await plan.getByLabel('Plan summary').innerText(), /2 items · 2 stages/);
    assert.match(await plan.innerText(), /One affected QA run on dev after all items merge closes the stage/);
    await plan.click(); await page.keyboard.press('d');
    await page.getByRole('textbox', { name: 'Plan discussion' }).fill('Please explain the QA gate.');
    await plan.getByRole('button', { name: 'Send', exact: true }).click();
    await page.getByRole('textbox', { name: 'Plan discussion' }).waitFor({ state: 'detached' });
    assert.equal(await page.getByRole('textbox', { name: 'Plan discussion' }).count(), 0);
    const topics = (await ui.request({ type: 'topic.list' })).value as { topics: { id: string; item: string | null }[] };
    const topic = topics.topics.find(topic => topic.item === 'E-900010');
    assert.ok(topic, 'discussion creates the epic topic');
    const history = await ui.request({ type: 'topic.history', topic: topic.id });
    assert.match(JSON.stringify(history.value), /Please explain the QA gate/);
    await mkdir('web/test-results', { recursive: true });
    await page.screenshot({ path: 'web/test-results/items-plan.png', fullPage: true });
  }, async page => {
    page.on('websocket', socket => {
      socket.on('framesent', event => firstFrames.push(JSON.parse(String(event.payload))));
      socket.on('framereceived', event => {
        const frame = JSON.parse(String(event.payload));
        if (frame.type === 'snapshot' && frame.domain === 'items') snapshots.push(frame.value.items.map((item: { id: string }) => item.id));
      });
    });
    await page.addInitScript(() => {
      localStorage.setItem('cland.ui.shell.v1', JSON.stringify({ area: 'Items', release: 'R-900000', row: 'T-900100' }));
      localStorage.setItem('cland.ui.items.v1', JSON.stringify({ view: 'plan', tree: { hideDone: true } }));
    });
  }));
  await t.test('C2 changes since the last look use watch colour and entry advances the shared mark', async t => {
    const first = await ui.request({ type: 'task.plan', item: 'E-900010', op: 'show' });
    const initial = (first.value as { history: { id: string }[] }).history.at(-1)!.id;
    assert.equal((await ui.request({ type: 'marks.set', plans: { 'E-900010': initial } })).ok, true);
    assert.equal((await ui.request({ type: 'task.plan', item: 'E-900010', op: 'set', yaml: yaml('Changed stage'), reason: 'New QA gate' })).ok, true);
    const shown = await ui.request({ type: 'task.plan', item: 'E-900010', op: 'show' });
    const latest = (shown.value as { history: { id: string }[] }).history.at(-1)!.id;
    await fixture.pageCase(t, async page => {
      await page.keyboard.press('2');
      await page.getByRole('tree', { name: 'Items tree' }).locator('[data-object-id="E-900010"]').click();
      await page.getByRole('button', { name: 'Plan', exact: true }).click();
      const stage = page.getByRole('heading', { name: '△ S1 · Changed stage' });
      await stage.waitFor();
      assert.equal(await stage.evaluate(node => {
        const probe = document.createElement('span'); probe.style.color = 'var(--watch)'; document.body.append(probe);
        const result = getComputedStyle(node).color === getComputedStyle(probe).color; probe.remove(); return result;
      }), true);
      assert.match(await page.getByLabel('Plan changes').innerText(), /human.*New QA gate/s);
      const mark = async () => ((await ui.request({ type: 'marks.get' })).value as { marks: { plans: Record<string, string> } }).marks.plans['T-900010'];
      await until(async () => await mark() === latest, { what: 'entry durably advances plan mark', timeoutMs: 3000 });
      assert.equal(await mark(), latest);
      assert.equal(await stage.count(), 1, 'acknowledgement keeps this visit highlighted');
      assert.equal((await ui.request({ type: 'task.plan', item: 'E-900010', op: 'set', yaml: yaml('Changed stage').replace('affected', 'full'), reason: 'Stronger QA' })).ok, true);
      await pageUntil(page, () => document.querySelector('[aria-label="Plan changes"]')?.textContent?.includes('Stronger QA') === true, 'active visit refreshes the changed plan');
      assert.equal(await mark(), latest, 'a live update does not acknowledge another look');
      await page.getByRole('button', { name: 'Tree', exact: true }).click();
      await page.getByRole('button', { name: 'Plan', exact: true }).click();
      await stage.waitFor();
      assert.match(await page.getByLabel('Plan changes').innerText(), /Stronger QA/);
      const newest = ((await ui.request({ type: 'task.plan', item: 'E-900010', op: 'show' })).value as { history: { id: string }[] }).history.at(-1)!.id;
      await until(async () => await mark() === newest, { what: 'second entry advances to new plan receipt', timeoutMs: 3000 });
      assert.equal(await mark(), newest);
      await page.getByRole('button', { name: 'Tree', exact: true }).click();
      await page.getByRole('button', { name: 'Plan', exact: true }).click();
      await page.getByRole('heading', { name: 'S1 · Changed stage', exact: true }).waitFor();
      assert.equal(await page.getByLabel('Plan changes').count(), 0, 'a later visit uses the shared receipt');
    });
  });

  await t.test('C3 approval is absent and inert below desktop width and on a live resize', async t => fixture.pageCase(t, async page => {
    const frames: Record<string, unknown>[] = [];
    page.on('websocket', socket => socket.on('framesent', event => frames.push(JSON.parse(String(event.payload)))));
    await page.reload();
    await page.keyboard.press('2');
    await page.getByRole('tree', { name: 'Items tree' }).locator('[data-object-id="E-900010"]').click();
    await page.getByRole('button', { name: 'Plan', exact: true }).click();
    const plan = page.getByRole('region', { name: 'Epic plan' });
    await plan.getByRole('button', { name: 'a · Approve' }).waitFor();
    await resizePage(page, { width: 1279, height: 900 });
    await plan.getByRole('button', { name: 'a · Approve' }).waitFor({ state: 'detached' });
    assert.equal(await plan.getByRole('button', { name: 'a · Approve' }).count(), 0);
    await plan.click();
    await page.keyboard.press('a');
    await page.getByRole('button', { name: 'Help', exact: true }).click();
    const help = page.getByRole('dialog', { name: 'Items keys' });
    await help.waitFor();
    assert.doesNotMatch(await help.innerText(), /Approve plan/);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await resizePage(page, { width: 390, height: 844 });
    const row = page.getByRole('tree', { name: 'Items tree' }).locator('[data-object-id="E-900010"]');
    await row.waitFor();
    assert.equal(await plan.count(), 0, 'phone width replaces the planning view with the tree');
    assert.equal(await page.getByRole('group', { name: 'Items view', exact: true }).count(), 0);
    await row.focus(); await page.keyboard.press('a');
    assert.equal(frames.some(frame => frame.type === 'task.plan' && frame.op === 'approve'), false);
    assert.equal((await ui.request({ type: 'task.plan', item: 'E-900010', op: 'show' })).ok, true);
    assert.equal(((await ui.request({ type: 'task.plan', item: 'E-900010', op: 'show' })).value as { approval: { state: string } }).approval.state, 'pending');
    await resizePage(page, { width: 1280, height: 900 });
    await plan.getByRole('button', { name: 'a · Approve' }).waitFor();
    assert.equal(await plan.getByRole('button', { name: 'a · Approve' }).isEnabled(), true);
  }));

});
