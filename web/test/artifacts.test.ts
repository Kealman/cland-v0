// Web: public artifact frames and the isolated production Headless Shell.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Artifact } from '../../shared/wire/index.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import { connectUi, inProcessSpoke } from '../../hub/test/harness.ts';
import { pageUntil, webFixture } from './harness.ts';

test('Artifacts groups human, Aide and crew records with remembered section folds', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const madeTopic = await ui.request({ type: 'topic.create', title: 'Artifact work' });
  const topic = (madeTopic.value as { topic: { id: string } }).topic.id;
  const peers = new Map<string, Awaited<ReturnType<typeof inProcessSpoke>>>();
  const create = async (title: string, creator?: string, folder = false) => {
    const args = { kind: 'note', title, topic, content: title, folder };
    if (creator) {
      const result = await peers.get(creator)!.call<{ ok: boolean; error?: string; artifact: Artifact }>('artifact.create', args);
      assert.equal(result.ok, true, result.error);
      return result.artifact;
    }
    const result = await ui.request({ type: 'artifact.create', ...args });
    assert.equal(result.ok, true, result.error);
    return (result.value as { artifact: Artifact }).artifact;
  };
  const human = await create('A human note');
  const folder = await create('Z human folder', undefined, true);
  const crew: Array<[string, Artifact]> = [];
  for (const [role, label] of [['aide', 'Mine'], ['coordinator', 'Coordinator'], ['implementer', 'Implementers'], ['reviewer', 'Reviewers'], ['qa', 'QA'], ['lead', 'Other']] as const) {
    const name = `artifact-${role}`;
    const peer = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name, role });
    await peer.waitForPresence([name]);
    peers.set(name, peer);
    assert.equal((await ui.request({ type: 'topic.send', topic, to: [name], text: 'Please share an artifact' })).ok, true);
    await peer.waitForEvent(event => event.params.content === 'Please share an artifact');
    crew.push([label!, await create(`${role} note`, name)]);
  }
  const archived = await create('Archived human note');
  assert.equal((await ui.request({ type: 'artifact.archive', artifact: archived.id })).ok, true);
  const sent: { type: string }[] = [];
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Artifacts', exact: true }).click();
    const list = page.getByRole('list', { name: 'Artifacts objects', exact: true });
    await list.getByRole('button', { name: 'Fold Mine', exact: true }).waitFor();
    const mine = list.getByRole('region', { name: 'Mine', exact: true });
    assert.equal(await mine.locator('header').textContent(), 'Mine3');
    assert.equal(await list.getByRole('region', { name: 'Kept', exact: true }).locator('header').textContent(), 'Kept0');
    assert.equal(await list.getByRole('region', { name: 'By role', exact: true }).locator('header').first().textContent(), 'By role5');
    assert.equal(await list.getByRole('region', { name: 'Archived', exact: true }).locator('header').textContent(), 'Archived1');
    assert.deepEqual(await mine.locator('[data-object-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-object-id'))), [folder.id, human.id, crew[0]![1].id]);
    for (const label of ['By role', 'Archived']) assert.equal(await list.getByRole('button', { name: `Fold ${label}`, exact: true }).getAttribute('aria-expanded'), 'false');
    await list.getByRole('button', { name: 'Fold By role', exact: true }).click();
    for (const [label, artifact] of crew.slice(1)) {
      const group = list.getByRole('region', { name: label, exact: true });
      const toggle = group.getByRole('button', { name: `Fold ${label}`, exact: true });
      if (await toggle.getAttribute('aria-expanded') === 'false') await toggle.click();
      const row = group.locator(`[data-object-id="${artifact.id}"]`);
      await row.waitFor();
      for (const fact of ['note', artifact.id, artifact.title, artifact.creator, 'shared']) assert.ok((await row.textContent())?.includes(fact), fact);
    }
    sent.length = 0;
    await mine.getByRole('button', { name: 'Fold Mine', exact: true }).click();
    assert.deepEqual(sent, [], 'folds stay in this browser');
    await page.reload();
    await list.getByRole('button', { name: 'Fold Mine', exact: true }).waitFor();
    assert.equal(await list.getByRole('button', { name: 'Fold Mine', exact: true }).getAttribute('aria-expanded'), 'false');
    await page.keyboard.press('Shift+a');
    await list.getByRole('region', { name: 'Archived', exact: true }).locator(`[data-object-id="${archived.id}"]`).waitFor();
  }, page => { page.on('websocket', socket => socket.on('framesent', event => sent.push(JSON.parse(String(event.payload))))); });
});

test('k keeps and unkeeps an agent artifact while the up arrow navigates', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'role.set', session: 'artifact-coord', role: 'coordinator' })).ok, true);
  const made = await ui.request({ type: 'artifact.create', as: { name: 'artifact-coord' }, kind: 'note', title: 'Keep this report', topic: 'general', content: 'Report' });
  assert.equal(made.ok, true, made.error);
  const artifact = (made.value as { artifact: Artifact }).artifact;
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Artifacts', exact: true }).click();
    await page.getByRole('button', { name: 'Fold By role', exact: true }).click();
    await page.getByRole('button', { name: 'Fold Coordinator', exact: true }).click();
    const row = page.getByRole('region', { name: 'Coordinator', exact: true }).locator(`[data-object-id="${artifact.id}"]`);
    await row.click();
    const kept = page.getByRole('region', { name: 'Kept', exact: true }).locator(`[data-object-id="${artifact.id}"]`);
    const appeared = kept.waitFor();
    await row.evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK', key: 'л', bubbles: true, cancelable: true })));
    await appeared;
    assert.ok((await kept.textContent())?.includes('kept'));
    const inventory = async () => ((await ui.request({ type: 'artifact.list' })).value as { artifacts: Artifact[] }).artifacts;
    assert.equal((await inventory()).find(a => a.id === artifact.id)?.kept, true);
    await kept.click();
    await kept.press('ArrowUp');
    assert.equal(await page.getByRole('button', { name: 'Fold Kept', exact: true }).evaluate(node => node === document.activeElement), true);
    assert.equal((await inventory()).find(a => a.id === artifact.id)?.kept, true, 'up never unkeeps');
    await kept.click();
    const removed = kept.waitFor({ state: 'detached' });
    await kept.press('k');
    await removed;
    assert.equal((await inventory()).find(a => a.id === artifact.id)?.kept, false);
    assert.equal(await row.isVisible(), true);
  });
});

test('d archives without deleting human bytes and Enter requests folder files', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const made = await ui.request({ type: 'artifact.create', kind: 'note', title: 'Folder report', topic: 'general', folder: true, entry: 'index.md', content: 'Human bytes' });
  assert.equal(made.ok, true, made.error);
  const artifact = (made.value as { artifact: Artifact }).artifact;
  const sent: Array<{ type: string; artifact?: string }> = [];
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Artifacts', exact: true }).click();
    const mine = page.getByRole('region', { name: 'Mine', exact: true });
    const folder = mine.locator(`[data-object-id="${artifact.id}"]`);
    await folder.click();
    assert.equal(sent.filter(frame => frame.type === 'artifact.list' && frame.artifact === artifact.id).length, 0, 'folder contents are lazy');
    const child = mine.locator('[data-artifact-file="index.md"]');
    const appeared = child.waitFor();
    await folder.press('Enter');
    await appeared;
    assert.equal(await child.textContent(), 'index.md');
    assert.equal(sent.filter(frame => frame.type === 'artifact.list' && frame.artifact === artifact.id).length, 1);
    await folder.press('j');
    assert.equal(await child.getAttribute('aria-pressed'), 'true');
    await child.press('ArrowUp');
    assert.equal(await folder.getAttribute('aria-pressed'), 'true');
    const removed = folder.waitFor({ state: 'detached' });
    await folder.press('d');
    await removed;
    await page.keyboard.press('Shift+a');
    const archive = page.getByRole('region', { name: 'Archived', exact: true });
    await archive.locator(`[data-object-id="${artifact.id}"]`).waitFor();
    const result = await ui.request({ type: 'artifact.list', artifact: artifact.id });
    assert.equal(result.ok, true, result.error);
    const current = result.value as { artifact: Artifact; files: string[] };
    assert.equal(current.artifact.layer, 'archive');
    assert.equal(current.artifact.fileDeleted, undefined);
    assert.deepEqual(current.files, ['index.md']);
  }, page => { page.on('websocket', socket => socket.on('framesent', event => sent.push(JSON.parse(String(event.payload))))); });
});

test('More artifacts traverses bounded inventory pages without duplicate rows', async t => {
  const fixture = await webFixture(t, { clock: new FakeClock() });
  const ui = await connectUi(t, fixture.hub.discovery);
  let oldest = '';
  for (let n = 0; n < 205; n++) {
    const made = await ui.request({ type: 'artifact.create', kind: 'note', title: `Paged note ${n}`, topic: 'general', content: 'Note' });
    assert.equal(made.ok, true, made.error);
    if (!n) oldest = (made.value as { artifact: Artifact }).artifact.id;
  }
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Artifacts', exact: true }).click();
    const mine = page.getByRole('region', { name: 'Mine', exact: true });
    await mine.locator('[data-object-id]').first().waitFor();
    assert.equal(await mine.locator('[data-object-id]').count(), 100);
    const more = page.getByRole('button', { name: 'More artifacts', exact: true });
    await more.click();
    await pageUntil(page, () => document.querySelector('[data-artifact-section="mine"]')?.querySelectorAll('[data-object-id]').length === 200, 'second inventory page rendered');
    await more.focus();
    await more.press('Enter');
    await mine.locator(`[data-object-id="${oldest}"]`).waitFor();
    const identities = await mine.locator('[data-object-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-object-id')));
    assert.equal(identities.length, 205);
    assert.equal(new Set(identities).size, 205);
    assert.equal(await more.count(), 0);
    assert.ok((await mine.locator('header').textContent())?.includes('205'));
  });
});
