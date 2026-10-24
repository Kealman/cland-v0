// Web: public artifact frames and the isolated production Headless Shell.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { Artifact, TopicMessage } from '../../shared/wire/index.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import { connectUi, inProcessSpoke } from '../../hub/test/harness.ts';
import { pageUntil, webFixture } from './harness.ts';

test('notes and prompts open rendered Markdown with literal HTML and a raw source toggle', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const source = '# Review notes\n\n- First fact\n- Second fact\n\n```ts\nconst value = 7;\n```\n\n<script>untrusted()</script>';
  const artifacts: Artifact[] = [];
  for (const kind of ['note', 'prompt'] as const) {
    const made = await ui.request({ type: 'artifact.create', kind, title: `${kind} Markdown`, topic: 'general', content: source });
    assert.equal(made.ok, true, made.error);
    artifacts.push((made.value as { artifact: Artifact }).artifact);
  }
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Artifacts', exact: true }).click();
    const drawer = page.getByRole('complementary', { name: 'Drawer', exact: true });
    for (const artifact of artifacts) {
      const row = page.locator(`[data-artifact-section="mine"] [data-object-id="${artifact.id}"]`);
      const rendered = drawer.locator(`[data-artifact-selection="${artifact.id}"]`).getByRole('heading', { name: 'Review notes', exact: true }).waitFor();
      await row.click();
      await row.press('Enter');
      await rendered;
      assert.deepEqual(await drawer.locator('li').allTextContents(), ['First fact', 'Second fact']);
      assert.equal(await drawer.locator('pre code').textContent(), 'const value = 7;');
      assert.ok((await drawer.textContent())?.includes('<script>untrusted()</script>'));
      assert.equal(await drawer.locator('script, iframe').count(), 0);
      await drawer.getByRole('button', { name: 'Show source', exact: true }).focus();
      await page.keyboard.press('Enter');
      assert.equal(await drawer.getByRole('region', { name: 'File text', exact: true }).textContent(), source);
      assert.equal(await drawer.getByRole('heading', { name: 'Review notes', exact: true }).count(), 0);
      await drawer.getByRole('button', { name: 'Show rendered', exact: true }).click();
      await drawer.getByRole('heading', { name: 'Review notes', exact: true }).waitFor();
    }
  });
});

test('This topic follows the last opened thread and s adds its artifact to the retained composer draft and sent history', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const coordinator = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'artifact-coord', role: 'coordinator' });
  await coordinator.waitForPresence(['artifact-coord']);
  const created = await ui.request({ type: 'topic.create', title: 'Another topic' });
  assert.equal(created.ok, true, created.error);
  const other = (created.value as { topic: { id: string } }).topic.id;
  const artifacts: Artifact[] = [];
  for (const topic of ['general', other]) {
    const made = await ui.request({ type: 'artifact.create', kind: 'note', title: `Notes for ${topic}`, topic, content: 'Topic note' });
    assert.equal(made.ok, true, made.error);
    artifacts.push((made.value as { artifact: Artifact }).artifact);
  }
  await fixture.pageCase(t, async page => {
    const go = async (area: string) => page.getByRole('button', { name: area, exact: true }).click();
    const section = page.locator('[data-artifact-section="topic"]');
    await go('Artifacts');
    await page.locator('[data-artifact-section="mine"] [data-artifact-row]').first().waitFor();
    assert.equal(await section.count(), 0, 'absent before a thread is opened');
    await go('Topics');
    await page.locator('[data-object-id="general"]').click();
    const form = page.getByRole('form', { name: 'Composer', exact: true });
    await form.getByRole('textbox', { name: 'Message text' }).fill('Artifact attachment receipt');
    await go('Artifacts');
    await section.locator(`[data-object-id="${artifacts[0]!.id}"]`).waitFor();
    assert.deepEqual(await section.locator('[data-object-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-object-id'))), [artifacts[0]!.id]);
    const row = section.locator(`[data-object-id="${artifacts[0]!.id}"]`);
    const attached = form.locator('[data-composer-artifact]').waitFor();
    await row.click();
    await row.evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', key: 'ы', bubbles: true, cancelable: true })));
    await attached;
    assert.equal(await form.getByRole('textbox', { name: 'Message text' }).inputValue(), 'Artifact attachment receipt');
    assert.ok((await form.locator('[data-composer-artifact]').textContent())?.includes(artifacts[0]!.id));
    const delivered = coordinator.waitForEvent(event => event.params.content === 'Artifact attachment receipt');
    await form.getByRole('button', { name: 'Send', exact: true }).click();
    await delivered;
    await form.locator('[data-pending-message]').waitFor({ state: 'detached' });
    const history = await ui.request({ type: 'topic.history', topic: 'general' });
    assert.equal(history.ok, true, history.error);
    const sent = (history.value as { messages: TopicMessage[] }).messages.find(message => message.text === 'Artifact attachment receipt');
    assert.deepEqual(sent?.artifacts?.map(artifact => artifact.id), [artifacts[0]!.id]);
    await page.locator(`[data-object-id="${other}"]`).click();
    await page.getByRole('log', { name: 'Another topic thread', exact: true }).waitFor();
    await go('Artifacts');
    await section.locator(`[data-object-id="${artifacts[1]!.id}"]`).waitFor();
    assert.deepEqual(await section.locator('[data-object-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-object-id'))), [artifacts[1]!.id]);
    await page.reload();
    await section.locator(`[data-object-id="${artifacts[1]!.id}"]`).waitFor();
  });
});

test('s refuses without a writable topic and for archived or other-topic artifacts without changing the draft', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const created = await ui.request({ type: 'topic.create', title: 'Unrelated topic' });
  assert.equal(created.ok, true, created.error);
  const other = (created.value as { topic: { id: string } }).topic.id;
  const artifacts: Artifact[] = [];
  for (const [title, topic] of [['Available note', 'general'], ['Archived note', 'general'], ['Other topic note', other]]) {
    const made = await ui.request({ type: 'artifact.create', kind: 'note', title, topic, content: 'Note' });
    assert.equal(made.ok, true, made.error);
    artifacts.push((made.value as { artifact: Artifact }).artifact);
  }
  assert.equal((await ui.request({ type: 'artifact.archive', artifact: artifacts[1]!.id })).ok, true);
  await fixture.pageCase(t, async page => {
    const go = async (area: string) => page.getByRole('button', { name: area, exact: true }).click();
    const refuse = async (id: string, reason: string, section = 'mine') => {
      const row = page.locator(`[data-artifact-section="${section}"] [data-object-id="${id}"]`);
      const receipt = page.getByRole('alert').getByText(reason, { exact: true }).waitFor();
      await row.click();
      await row.press('s');
      await receipt;
      assert.equal(await page.locator('[data-composer-artifact]').count(), 0);
    };
    await go('Artifacts');
    await refuse(artifacts[0]!.id, 'Open a writable topic to attach artifacts');
    await go('Topics');
    await page.locator('[data-object-id="general"]').click();
    const form = page.getByRole('form', { name: 'Composer', exact: true });
    await form.getByRole('textbox', { name: 'Message text' }).fill('Keep this draft');
    await go('Artifacts');
    await refuse(artifacts[2]!.id, `Artifact belongs to ${other}; open that topic to attach`);
    await page.getByRole('button', { name: 'Fold Archived', exact: true }).click();
    await refuse(artifacts[1]!.id, 'Artifact is archived; keep it to attach', 'archived');
    assert.equal(await page.locator(`[data-artifact-section="topic"] [data-object-id="${artifacts[1]!.id}"]`).count(), 0);
    await go('Topics');
    await page.locator('[data-object-id="general"]').click();
    assert.equal(await form.getByRole('textbox', { name: 'Message text' }).inputValue(), 'Keep this draft');
    assert.equal(await form.locator('[data-composer-artifact]').count(), 0);
    await page.locator('[data-object-id="agents"]').click();
    await page.getByRole('log', { name: 'Agents thread', exact: true }).waitFor();
    await go('Artifacts');
    await refuse(artifacts[0]!.id, 'Open a writable topic to attach artifacts');
    await page.reload();
    await go('Topics');
    await page.locator('[data-object-id="general"]').click();
    assert.equal(await form.locator('[data-composer-artifact]').count(), 0);
    assert.equal(await form.getByRole('textbox', { name: 'Message text' }).inputValue(), 'Keep this draft');
  });
});

test('s in a split pane adds one shared composer chip while an open ask answer draft stays unchanged', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const coordinator = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'artifact-coord', role: 'coordinator' });
  await coordinator.waitForPresence(['artifact-coord']);
  const ask = await coordinator.call<{ ok: boolean; ask: string; error?: string }>('ask', { topic: 'general', question: 'Keep the report?', options: ['Keep', 'Change'], free: true });
  assert.equal(ask.ok, true, ask.error);
  const made = await ui.request({ type: 'artifact.create', kind: 'note', title: 'Ask companion', topic: 'general', content: 'Report' });
  assert.equal(made.ok, true, made.error);
  const artifact = (made.value as { artifact: Artifact }).artifact;
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Topics', exact: true }).click();
    await page.locator('[data-object-id="general"]').click();
    const primary = page.locator('[data-pane="primary"]');
    const answer = primary.locator(`[data-ask-id="${ask.ask}"]`).getByRole('textbox', { name: 'Free answer', exact: true });
    await answer.fill('Keep my unfinished answer');
    await primary.getByRole('textbox', { name: 'Message text' }).fill('Separate message draft');
    await primary.getByRole('heading', { name: 'General', exact: true }).click();
    await page.keyboard.press('Meta+Backslash');
    const secondary = page.locator('[data-pane="secondary"]');
    await secondary.click({ position: { x: 10, y: 10 } });
    for (let n = 0; n < 2; n++) {
      await page.getByRole('button', { name: 'Artifacts', exact: true }).click();
      const row = secondary.locator(`[data-artifact-section="topic"] [data-object-id="${artifact.id}"]`);
      const attached = secondary.locator('[data-composer-artifact]').waitFor();
      await row.click();
      await row.press('s');
      await attached;
      assert.equal(await primary.locator('[data-composer-artifact]').count(), 1);
      assert.equal(await secondary.locator('[data-composer-artifact]').count(), 1);
      assert.equal(await answer.inputValue(), 'Keep my unfinished answer');
      assert.equal(await secondary.getByRole('textbox', { name: 'Message text' }).inputValue(), 'Separate message draft');
      assert.equal(await primary.locator('[data-ask-outcome]').count(), 0);
    }
  });
});

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

test('Enter opens a capability page full height and its script cannot read the workbench document or cookie', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const content = `<!doctype html><body><pre id="result"></pre><script>
    const result = {};
    try { result.document = parent.document.title; } catch (error) { result.document = error.name; }
    try { result.cookie = parent.document.cookie; } catch (error) { result.cookie = error.name; }
    try { result.ownCookie = document.cookie; } catch (error) { result.ownCookie = error.name; }
    document.getElementById('result').textContent = JSON.stringify(result);
  </script>`;
  const made = await ui.request({ type: 'artifact.create', kind: 'page', title: 'Isolated page', topic: 'general', content });
  assert.equal(made.ok, true, made.error);
  const artifact = (made.value as { artifact: Artifact }).artifact;
  const frames: Array<{ type: string; artifact?: string }> = [];
  await fixture.pageCase(t, async (page, origin) => {
    await page.evaluate(() => { document.cookie = 'workbench_probe=private; SameSite=Strict; Path=/'; });
    await page.getByRole('button', { name: 'Artifacts', exact: true }).click();
    const row = page.locator(`[data-artifact-section="mine"] [data-object-id="${artifact.id}"]`);
    const frame = page.getByRole('complementary', { name: 'Drawer', exact: true }).locator('iframe');
    const appeared = frame.waitFor();
    await row.click();
    await row.press('Enter');
    await appeared;
    assert.equal(await frame.getAttribute('sandbox'), 'allow-scripts');
    const src = await frame.getAttribute('src');
    assert.equal(new URL(src!).origin, origin);
    assert.match(new URL(src!).pathname, /^\/a\/[a-f0-9]{64}\//);
    assert.ok(frames.some(frame => frame.type === 'artifact.url' && frame.artifact === artifact.id));
    const result = page.frameLocator('iframe').locator('#result');
    await result.getByText('SecurityError', { exact: false }).waitFor();
    assert.deepEqual(JSON.parse((await result.textContent())!), { document: 'SecurityError', cookie: 'SecurityError', ownCookie: 'SecurityError' });
    assert.ok((await page.evaluate(() => document.cookie)).includes('workbench_probe=private'));
    const box = await frame.boundingBox();
    assert.ok(box && box.height > 740, `full drawer height: ${box?.height}`);
    await page.getByRole('complementary', { name: 'Drawer', exact: true }).getByRole('button', { name: 'Close', exact: true }).click();
    assert.equal(await frame.count(), 0);
    await row.focus();
    const reopened = frame.waitFor();
    await row.press('Enter');
    await reopened;
    const splitFrame = page.locator('[data-pane="secondary"] iframe');
    const splitOpened = splitFrame.waitFor();
    await row.press('Meta+Enter');
    await splitOpened;
    assert.equal(await splitFrame.getAttribute('sandbox'), 'allow-scripts');
    assert.equal(await page.getByRole('complementary', { name: 'Drawer', exact: true }).count(), 0);
  }, page => { page.on('websocket', socket => socket.on('framesent', event => frames.push(JSON.parse(String(event.payload))))); });
});

test('files and folder children open capability text or a named binary download and report missing bytes', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const source = join(fixture.root, 'files');
  await mkdir(source);
  await writeFile(join(source, 'read me.md'), '# Plain Markdown\n<script>untrusted text</script>');
  await writeFile(join(source, 'data.bin'), Buffer.from([0, 255, 1, 2]));
  const create = async (fields: Record<string, unknown>) => {
    const result = await ui.request({ type: 'artifact.create', kind: 'file', topic: 'general', ...fields });
    assert.equal(result.ok, true, result.error);
    return (result.value as { artifact: Artifact }).artifact;
  };
  const text = await create({ title: 'Markdown file', path: join(source, 'read me.md') });
  const binary = await create({ title: 'Binary file', path: join(source, 'data.bin') });
  const folder = await create({ title: 'Folder files', path: source });
  const gone = await create({ title: 'Gone file', content: 'will disappear' });
  await unlink(gone.path);
  const frames: Array<{ type: string; artifact?: string }> = [];
  await fixture.pageCase(t, async (page, _origin, requests) => {
    await page.getByRole('button', { name: 'Artifacts', exact: true }).click();
    const mine = page.locator('[data-artifact-section="mine"]');
    const drawer = page.getByRole('complementary', { name: 'Drawer', exact: true });
    const open = async (id: string, receipt: Promise<unknown>) => {
      const row = mine.locator(`[data-object-id="${id}"]`);
      await row.click();
      await row.press('Enter');
      await receipt;
    };
    const plain = drawer.getByRole('region', { name: 'File text', exact: true });
    await open(text.id, plain.getByText('# Plain Markdown', { exact: false }).waitFor());
    assert.equal(await plain.textContent(), '# Plain Markdown\n<script>untrusted text</script>');
    assert.equal(await plain.locator('script').count(), 0);
    const filename = basename(binary.path);
    const download = drawer.getByRole('link', { name: `Download ${filename}`, exact: true });
    await open(binary.id, download.waitFor());
    assert.equal(await download.getAttribute('download'), filename);
    assert.match(new URL((await download.getAttribute('href'))!).pathname, /^\/a\/[a-f0-9]{64}\/A-\d+-binary-file.bin$/);
    const received = page.waitForEvent('download');
    await download.click();
    const saved = await received;
    assert.equal(saved.suggestedFilename(), filename);
    assert.equal(await saved.failure(), null);
    const downloaded = join(fixture.root, 'downloaded.bin');
    await saved.saveAs(downloaded);
    assert.deepEqual(await readFile(downloaded), Buffer.from([0, 255, 1, 2]));
    await open(folder.id, mine.locator(`[data-object-id="${folder.id}/read me.md"]`).waitFor());
    await open(`${folder.id}/read me.md`, plain.getByText('# Plain Markdown', { exact: false }).waitFor());
    assert.equal(await plain.textContent(), '# Plain Markdown\n<script>untrusted text</script>');
    const splitOpened = page.locator('[data-pane="secondary"]').getByRole('link', { name: 'Download data.bin', exact: true }).waitFor();
    await mine.locator(`[data-object-id="${folder.id}/data.bin"]`).press('Meta+Enter');
    await splitOpened;
    await page.locator('[data-pane="secondary"]').getByRole('button', { name: 'Close', exact: true }).click();
    await open(gone.id, drawer.getByRole('alert').getByText('Artifact file not found', { exact: true }).waitFor());
    assert.equal(await drawer.locator('iframe, pre, a[download]').count(), 0);
    for (const a of [text, binary, folder]) assert.ok(frames.some(frame => frame.type === 'artifact.url' && frame.artifact === a.id));
    assert.ok(requests.some(url => /\/a\/[a-f0-9]{64}\/read%20me.md$/.test(url)), 'folder child uses an encoded capability path');
    assert.equal(frames.some(frame => frame.type === 'artifact.read'), false);
  }, page => { page.on('websocket', socket => socket.on('framesent', event => frames.push(JSON.parse(String(event.payload))))); });
});

test('diagram HTML, SVG and Mermaid use the sandboxed viewer with source one physical key away', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const source = join(fixture.root, 'diagrams');
  await mkdir(source);
  await writeFile(join(source, 'drawing.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><text y="20">SVG diagram</text></svg>');
  await writeFile(join(source, 'drawing.html'), '<!doctype html><p>HTML diagram</p>');
  const create = async (fields: Record<string, unknown>) => {
    const result = await ui.request({ type: 'artifact.create', kind: 'diagram', topic: 'general', ...fields });
    assert.equal(result.ok, true, result.error);
    return (result.value as { artifact: Artifact }).artifact;
  };
  const raw = await create({ title: 'Mermaid source', content: 'graph TD; A-->B' });
  const svg = await create({ title: 'SVG diagram', path: join(source, 'drawing.svg') });
  const html = await create({ title: 'HTML diagram', path: join(source, 'drawing.html') });
  const folder = await create({ title: 'Diagram folder', path: source, entry: 'drawing.html' });
  await fixture.pageCase(t, async (page, _origin, requests) => {
    await page.getByRole('button', { name: 'Artifacts', exact: true }).click();
    const mine = page.locator('[data-artifact-section="mine"]');
    const drawer = page.getByRole('complementary', { name: 'Drawer', exact: true });
    const open = async (id: string, receipt: Promise<unknown>) => {
      const row = mine.locator(`[data-object-id="${id}"]`);
      await row.click();
      await row.press('Enter');
      await receipt;
    };
    assert.equal(requests.some(url => /\/mermaid\.(js|css)/.test(url)), false, 'no Mermaid load before a .mmd opens');
    const rendered = drawer.frameLocator('iframe');
    await open(raw.id, rendered.locator('svg .node').first().waitFor({ timeout: 3000 }));
    assert.ok(requests.some(url => url.endsWith('/mermaid.js')), 'renderer requested on first .mmd open');
    assert.equal(await drawer.locator('iframe').getAttribute('sandbox'), 'allow-scripts');
    assert.match((await drawer.locator('iframe').getAttribute('src'))!, /\/a\/[a-f0-9]{64}\/.*\.mmd\?render=mermaid$/);
    await page.keyboard.press('s');
    assert.equal(await rendered.getByRole('region', { name: 'File text', exact: true }).textContent(), 'graph TD; A-->B');
    await page.keyboard.press('s');
    await rendered.locator('svg .node').first().waitFor();
    for (const [id, label] of [[svg.id, 'SVG diagram'], [html.id, 'HTML diagram']] as const) {
      await open(id, drawer.frameLocator('iframe').getByText(label, { exact: true }).waitFor());
      assert.equal(await drawer.locator('iframe').getAttribute('sandbox'), 'allow-scripts');
    }
    await open(folder.id, mine.locator(`[data-object-id="${folder.id}/drawing.html"]`).waitFor());
    await open(`${folder.id}/drawing.html`, drawer.frameLocator('iframe').getByText('HTML diagram', { exact: true }).waitFor());
    assert.match((await drawer.locator('iframe').getAttribute('src'))!, /\/a\/[a-f0-9]{64}\/drawing.html$/);
    assert.equal(await drawer.locator('iframe').getAttribute('sandbox'), 'allow-scripts');
  });
});

test('Mermaid strict mode blocks source scripts and callbacks, and a parse failure retains its message and exact source', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const hostile = '%%{init: {"securityLevel":"loose"}}%%\n%% </pre><script>window.diagramExecuted = true</script>\nflowchart TD\nA["<img src=x onerror=window.diagramExecuted=true>"] --> B[Safe]\nclick A diagramCallback';
  const broken = '\nflowchart TD\n A[unterminated';
  const artifacts: Artifact[] = [];
  for (const [title, content] of [['Hostile diagram', hostile], ['Broken diagram', broken]]) {
    const made = await ui.request({ type: 'artifact.create', kind: 'diagram', topic: 'general', title, content });
    assert.equal(made.ok, true, made.error);
    artifacts.push((made.value as { artifact: Artifact }).artifact);
  }
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Artifacts', exact: true }).click();
    const drawer = page.getByRole('complementary', { name: 'Drawer', exact: true });
    const frame = drawer.frameLocator('iframe');
    for (const [index, artifact] of artifacts.entries()) {
      const receipt = index === 0 ? frame.locator('svg .node').first().waitFor() : frame.getByRole('alert').waitFor();
      const row = page.locator(`[data-artifact-section="mine"] [data-object-id="${artifact.id}"]`);
      await row.click();
      await row.press('Enter');
      await receipt;
      if (index === 0) {
        assert.equal(await frame.locator('svg [onclick], svg [onerror], svg script, svg a').count(), 0);
        const node = frame.locator('svg .node').first();
        await node.click();
        assert.equal(await node.evaluate(() => Reflect.get(window, 'diagramExecuted')), undefined);
        assert.equal(await page.evaluate(() => Reflect.get(window, 'diagramExecuted')), undefined);
        await frame.getByRole('button', { name: 'Show source', exact: true }).focus();
        // Physical code, independent of the active keyboard layout.
        await frame.getByRole('button', { name: 'Show source', exact: true }).evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', key: 'ы', bubbles: true, cancelable: true })));
        assert.equal(await frame.getByRole('region', { name: 'File text', exact: true }).textContent(), hostile);
      } else {
        assert.match((await frame.getByRole('alert').textContent())!, /Parse error/);
        assert.equal(await frame.getByRole('region', { name: 'File text', exact: true }).textContent(), broken);
      }
    }
  }, async page => {
    await page.addInitScript(() => {
      Reflect.set(window, 'diagramCallback', () => Reflect.set(window, 'diagramExecuted', true));
    });
  });
});
