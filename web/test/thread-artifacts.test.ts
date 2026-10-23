// Web: inline artifact capabilities, sandbox isolation and opening from the thread.
import test from 'node:test';
import assert from 'node:assert/strict';
import { unlink } from 'node:fs/promises';
import { connectUi } from '../../hub/test/harness.ts';
import { webFixture } from './harness.ts';
import type { Artifact } from '../../shared/wire/index.ts';

test('HTML artifacts render their hub address inline at 240 px while files and folders stay chips', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const artifacts: Artifact[] = [];
  for (const [kind, title, folder, content] of [
    ['page', 'Inline page', false, '<h1>Inline artifact content</h1>'],
    ['file', 'Receipt file', false, 'Receipt bytes'],
    ['note', 'Receipt folder', true, 'Folder entry'],
  ] as const) {
    const made = await ui.request({ type: 'artifact.create', topic: 'general', kind, title, folder, content });
    assert.equal(made.ok, true, made.error);
    artifacts.push((made.value as { artifact: Artifact }).artifact);
  }
  const addresses: string[] = [];
  await fixture.pageCase(t, async (page, origin) => {
    await page.getByRole('button', { name: 'Topics', exact: true }).click();
    await page.locator('[data-object-id="general"]').click();
    const thread = page.getByRole('log', { name: 'General thread', exact: true });
    const inline = thread.locator(`[data-artifact-id="${artifacts[0]!.id}"]`);
    const frame = inline.locator('iframe');
    await frame.waitFor();
    const url = await frame.getAttribute('src');
    assert.ok(url && addresses.includes(url), 'source is an artifact.url reply from this authenticated connection');
    assert.equal(new URL(url).origin, origin);
    assert.match(new URL(url).pathname, /^\/a\/[a-f0-9]{64}\//);
    assert.equal(await frame.getAttribute('sandbox'), 'allow-scripts');
    assert.equal(await frame.getAttribute('srcdoc'), null);
    assert.equal(await frame.evaluate(node => node.getBoundingClientRect().height), 240);
    await frame.contentFrame().getByRole('heading', { name: 'Inline artifact content' }).waitFor();
    assert.match(await inline.locator('header').innerText(), /Inline page.*Open full.*Open in a pane/s);
    for (const artifact of artifacts.slice(1)) {
      const chip = thread.locator(`[data-artifact-id="${artifact.id}"]`);
      await chip.waitFor();
      assert.ok((await chip.innerText()).includes(artifact.title));
      assert.equal(await chip.locator('iframe').count(), 0);
      if (artifact.folder) assert.match(await chip.innerText(), /folder/);
    }
    assert.equal(await thread.locator('iframe').count(), 1);
    const attached = thread.locator('article').filter({ hasText: 'Attached HTML receipt' });
    const rendered = attached.locator('iframe').waitFor(); void rendered.catch(() => {});
    assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: 'Attached HTML receipt', artifacts: [artifacts[0]!.id] })).ok, true);
    await rendered;
    assert.equal(await attached.locator('iframe').getAttribute('sandbox'), 'allow-scripts');
    assert.equal(await attached.locator('iframe').evaluate(node => node.getBoundingClientRect().height), 240);
  }, page => {
    page.on('websocket', socket => socket.on('framereceived', ({ payload }) => {
      const frame = JSON.parse(String(payload)) as { type: string; ok?: boolean; value?: { url?: string } };
      if (frame.type === 'result' && frame.ok && frame.value?.url) addresses.push(frame.value.url);
    }));
  });
});

test('moving a thread-opened page into a folder does not resurrect a top-level artifact', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const made = await ui.request({ type: 'artifact.create', topic: 'general', kind: 'page', title: 'Moving page', content: '<h1>Moving artifact content</h1>' });
  assert.equal(made.ok, true, made.error);
  const artifact = (made.value as { artifact: Artifact }).artifact;
  const madeFolder = await ui.request({ type: 'artifact.create', topic: 'general', kind: 'note', title: 'Destination folder', folder: true, content: 'Folder entry' });
  assert.equal(madeFolder.ok, true, madeFolder.error);
  const folder = (madeFolder.value as { artifact: Artifact }).artifact;
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Topics', exact: true }).click();
    await page.locator('[data-object-id="general"]').click();
    await page.locator(`[data-artifact-id="${artifact.id}"]`).getByRole('button', { name: 'Open in a pane', exact: true }).click();
    await page.locator('[data-pane="secondary"] iframe').contentFrame().getByRole('heading', { name: 'Moving artifact content' }).waitFor();
    await page.getByRole('button', { name: 'Artifacts', exact: true }).click();
    const list = page.locator('[data-pane="primary"]').getByRole('list', { name: 'Artifacts objects', exact: true });
    const row = list.locator(`[data-object-id="${artifact.id}"]`);
    await row.waitFor();
    const removed = row.waitFor({ state: 'detached' }); void removed.catch(() => {});
    const moved = await ui.request({ type: 'artifact.move', artifact: artifact.id, folder: folder.id, name: 'moved.html' });
    assert.equal(moved.ok, true, moved.error);
    await removed;
    assert.equal(await row.count(), 0, 'the moved child leaves the authoritative top-level inventory');
    const folderRow = list.locator(`[data-object-id="${folder.id}"]`);
    await folderRow.press('Enter');
    const child = list.locator(`[data-artifact-owner="${folder.id}"][data-artifact-file="moved.html"]`);
    await child.waitFor();
    assert.match(await child.innerText(), /moved.html/);
    assert.equal(await row.count(), 0, 'the child is listed only under its folder');
  });
});

test('artifact scripts cannot read the workbench document or navigate its top window', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const made = await ui.request({ type: 'artifact.create', topic: 'general', kind: 'page', title: 'Hostile page', content: `
    <button id="attempt">Attempt escape</button><p id="receipt">pending</p><script>
      document.getElementById('attempt').addEventListener('click', () => {
        let read = 'allowed', navigate = 'allowed';
        try { parent.document.body.textContent; } catch (error) { read = error.name; }
        try { top.location.href = '/artifact-escaped'; } catch (error) { navigate = error.name; }
        document.getElementById('receipt').textContent = JSON.stringify({ read, navigate });
      });
    </script>` });
  assert.equal(made.ok, true, made.error);
  const artifact = (made.value as { artifact: Artifact }).artifact;
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Topics', exact: true }).click();
    await page.locator('[data-object-id="general"]').click();
    const before = page.url();
    const frame = page.locator(`[data-artifact-id="${artifact.id}"] iframe`);
    await frame.waitFor();
    const attempt = frame.contentFrame().getByRole('button', { name: 'Attempt escape' });
    await attempt.waitFor();
    const receipt = frame.contentFrame().locator('#receipt');
    const completed = frame.contentFrame().getByText('{"read":"SecurityError","navigate":"SecurityError"}', { exact: true }).waitFor(); void completed.catch(() => {});
    await attempt.click();
    await completed;
    assert.deepEqual(JSON.parse(await receipt.innerText()), { read: 'SecurityError', navigate: 'SecurityError' });
    assert.equal(page.url(), before, 'the workbench remains the top document after both attempts completed');
    assert.equal(await page.getByRole('button', { name: 'Topics', exact: true }).count(), 1);
  });
});

test('an unservable HTML artifact remains a chip with the serving reason in its tooltip', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const made = await ui.request({ type: 'artifact.create', topic: 'general', kind: 'page', title: 'Missing page', content: '<h1>Missing bytes</h1>' });
  assert.equal(made.ok, true, made.error);
  const artifact = (made.value as { artifact: Artifact }).artifact;
  await unlink(artifact.path);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Topics', exact: true }).click();
    await page.locator('[data-object-id="general"]').click();
    const chip = page.locator(`[data-artifact-id="${artifact.id}"][title]`);
    await chip.waitFor();
    assert.match(await chip.getAttribute('title') ?? '', /not found|missing|unavailable/i);
    assert.match(await chip.innerText(), /Missing page/);
    assert.equal(await chip.locator('iframe, a, button').count(), 0);
  });
});

test('Open full opens the artifact address in a new page and Open in a pane keeps the thread beside it', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const made = await ui.request({ type: 'artifact.create', topic: 'general', kind: 'page', title: 'Openable page', content: '<h1>Full artifact content</h1>' });
  assert.equal(made.ok, true, made.error);
  const artifact = (made.value as { artifact: Artifact }).artifact;
  const storage = await ui.request({ type: 'topic.create', title: 'Older inventory fixture' });
  assert.equal(storage.ok, true, storage.error);
  const storageTopic = (storage.value as { topic: { id: string } }).topic.id;
  for (let index = 0; index < 200; index++) {
    const stored = await ui.request({ type: 'artifact.create', topic: storageTopic, kind: 'note', title: `Newer note ${index}`, content: 'Inventory bytes' });
    assert.equal(stored.ok, true, stored.error);
  }
  const inventory = await ui.request({ type: 'artifact.list' });
  assert.equal(inventory.ok, true, inventory.error);
  assert.equal((inventory.value as { artifacts: Artifact[] }).artifacts.some(row => row.id === artifact.id), false, 'the thread page is older than the initial inventory');
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Topics', exact: true }).click();
    await page.locator('[data-object-id="general"]').click();
    const inline = page.locator(`[data-artifact-id="${artifact.id}"]`);
    const link = inline.getByRole('link', { name: 'Open full', exact: true });
    await link.waitFor();
    const url = await inline.locator('iframe').getAttribute('src');
    assert.equal(await link.getAttribute('href'), url);
    const opened = page.context().waitForEvent('page'); void opened.catch(() => {});
    await link.click();
    const full = await opened;
    try {
      await full.getByRole('heading', { name: 'Full artifact content' }).waitFor();
      assert.equal(full.url(), url);
      assert.equal(await full.evaluate(() => window.opener === null), true);
    } finally { await full.close(); }
    await inline.getByRole('button', { name: 'Open in a pane', exact: true }).click();
    const other = page.locator('[data-pane="secondary"]');
    const frame = other.locator('iframe');
    await frame.contentFrame().getByRole('heading', { name: 'Full artifact content' }).waitFor();
    assert.equal(await frame.getAttribute('sandbox'), 'allow-scripts');
    assert.equal(await frame.evaluate(node => node.getBoundingClientRect().height > 240), true);
    assert.equal(await page.locator('[data-pane="primary"]').getByRole('log', { name: 'General thread', exact: true }).count(), 1);
    assert.equal(await other.locator('[data-artifact-viewer]').getAttribute('data-artifact-selection'), artifact.id);
    await other.getByRole('button', { name: 'Swap', exact: true }).click();
    await page.locator('[data-pane="secondary"]').getByRole('log', { name: 'General thread', exact: true }).waitFor();
    await page.locator('[data-pane="secondary"]').getByRole('button', { name: 'Open in a pane', exact: true }).click();
    await page.locator('[data-pane="primary"] iframe').contentFrame().getByRole('heading', { name: 'Full artifact content' }).waitFor();
    assert.equal(await page.locator('[data-pane="secondary"]').getByRole('log', { name: 'General thread', exact: true }).count(), 1, 'opening from the secondary pane preserves that thread');
  });
});
