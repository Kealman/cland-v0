// Web: phone topic pages through sealed public frames and touch Headless Shell.
import test from 'node:test';
import assert from 'node:assert/strict';
import { connectUi, inProcessSpoke } from '../../hub/test/harness.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import type { Artifact, ThreadRun, TopicMessage } from '../../shared/wire/index.ts';
import { pageUntil, webFixture } from './harness.ts';
import { seedItem } from './items-fixture.ts';

test('phone topic opens full screen with its facts and both Back paths return to Topics', async t => {
  const fixture = await webFixture(t, { prepare: root => seedItem(root, 'T-1', 'task', 'Thread item') });
  const ui = await connectUi(t, fixture.hub.discovery);
  const made = await ui.request({ type: 'topic.create', title: 'Phone discussion', item: 'T-1' });
  assert.equal(made.ok, true, made.error);
  const topic = (made.value as { topic: { id: string } }).topic;
  assert.equal((await ui.request({ type: 'topic.send', topic: topic.id, text: 'Phone thread receipt' })).ok, true);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Topics', exact: true }).tap();
    const row = page.locator(`[data-object-id="${topic.id}"]`);
    for (const back of ['button', 'browser']) {
      await row.tap();
      const log = page.getByRole('log', { name: 'Phone discussion thread', exact: true });
      await log.getByText('Phone thread receipt', { exact: true }).waitFor();
      assert.equal(await page.getByRole('list', { name: 'Topics objects' }).count(), 0);
      await page.getByRole('heading', { name: 'Phone discussion', exact: true }).waitFor();
      assert.equal(await page.locator('[data-phone-thread]').getByText(topic.id, { exact: true }).count(), 1);
      assert.equal(await page.locator('[data-phone-thread]').getByText('open', { exact: true }).count(), 1);
      const card = page.getByRole('button', { name: 'Item card T-1', exact: true });
      assert.ok((await card.boundingBox())!.height >= 44);
      const control = page.getByRole('button', { name: 'Back to Topics', exact: true });
      assert.ok((await control.boundingBox())!.height >= 44);
      assert.equal(await page.getByRole('button', { name: 'Topics', exact: true }).getAttribute('aria-current'), 'page');
      const box = (await log.boundingBox())!;
      assert.equal(box.x, 0);
      assert.equal(box.width, 390);
      if (back === 'button') await control.tap(); else await page.goBack();
      await row.waitFor();
      assert.equal(await log.count(), 0);
    }
  }, undefined, { phone: true });
});

test('phone verdicts long ids and fenced code fit 390 px with horizontal scrolling inside code only', async t => {
  const fixture = await webFixture(t, { prepare: root => seedItem(root, 'T-1', 'task', 'Verdict item', {}, '## Acceptance criteria\n\n- [ ] C1. Layout criterion') });
  const ui = await connectUi(t, fixture.hub.discovery);
  const made = await ui.request({ type: 'topic.create', title: 'Layout discussion', item: 'T-1' });
  assert.equal(made.ok, true, made.error);
  const topic = (made.value as { topic: { id: string } }).topic.id;
  const reviewer = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'reviewer-long-session-id', sessionId: 'phone-verdict-reviewer', role: 'reviewer' });
  await reviewer.waitForPresence(['reviewer-long-session-id']);
  const long = 'long-session-identity-'.repeat(15);
  const longId = `T-${'9'.repeat(160)}`;
  const code = 'const veryLongValue = "' + 'x'.repeat(240) + '";';
  assert.equal((await ui.request({ type: 'topic.send', topic, text: `${long}\n\n${longId}\n\n\`\`\`typescript\n${code}\n\`\`\`` })).ok, true);
  const red = await reviewer.call<{ ok: boolean; error?: string }>('task.comment', { id: 'T-1', text: 'Review layout receipt', verdict: 'review', scope: 'full', result: 'not clear', run: 'phone-red', failed: [{ criterion: 'C1', note: long }] });
  assert.equal(red.ok, true, red.error);
  const green = await reviewer.call<{ ok: boolean; error?: string }>('task.comment', { id: 'T-1', text: 'Layout reviewed', verdict: 'review', scope: 'full', result: 'clear', run: 'phone-green', verified: 'all' });
  assert.equal(green.ok, true, green.error);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Topics', exact: true }).tap();
    await page.locator(`[data-object-id="${topic}"]`).tap();
    const log = page.getByRole('log', { name: 'Layout discussion thread', exact: true });
    await log.locator('pre').waitFor();
    await log.locator('[data-verdict="clear"]').waitFor();
    assert.deepEqual(await log.locator('[data-criterion="C1"]').allTextContents(), [`✗ C1 failed · ${long}`, '✓ C1 verified']);
    const bounds = await log.evaluate(node => ({ width: node.clientWidth, scroll: node.scrollWidth }));
    assert.deepEqual(bounds, { width: 390, scroll: 390 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
    for (const node of await log.locator('article, [data-criterion], [data-artifact-id]').all()) {
      const box = (await node.boundingBox())!;
      assert.ok(box.x >= 0 && box.x + box.width <= 390, 'message facts stay within phone');
    }
    const pre = log.locator('pre');
    assert.equal(await pre.innerText(), code);
    assert.equal(await pre.evaluate(node => node.scrollWidth > node.clientWidth), true);
    await pre.evaluate(node => { node.scrollLeft = node.scrollWidth; });
    assert.ok(await pre.evaluate(node => node.scrollLeft > 0), 'code can scroll horizontally');
    assert.equal(await log.evaluate(node => node.scrollLeft), 0);
    await page.screenshot({ path: 'web/test-results/phone-thread.png' });
  }, undefined, { phone: true });
});

test('phone HTML chips open the sandboxed full-screen viewer and return to the same thread', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const artifacts: Artifact[] = [];
  for (const [kind, title, folder, content] of [
    ['page', 'Phone HTML', false, '<h1>Phone artifact receipt</h1>'],
    ['file', 'Phone file', false, 'File bytes'],
    ['note', 'Phone folder', true, 'Folder bytes'],
  ] as const) {
    const made = await ui.request({ type: 'artifact.create', topic: 'general', kind, title, folder, content });
    assert.equal(made.ok, true, made.error);
    artifacts.push((made.value as { artifact: Artifact }).artifact);
  }
  await fixture.pageCase(t, async (page, origin) => {
    await page.getByRole('button', { name: 'Topics', exact: true }).tap();
    await page.locator('[data-object-id="general"]').tap();
    const log = page.getByRole('log', { name: 'General thread', exact: true });
    const chip = log.locator(`[data-artifact-id="${artifacts[0]!.id}"]`);
    await chip.waitFor();
    assert.equal(await log.locator('iframe').count(), 0, 'no inline HTML iframe on phone');
    for (const artifact of artifacts) {
      const row = log.locator(`[data-artifact-id="${artifact.id}"]`);
      assert.match(await row.innerText(), new RegExp(artifact.title));
      assert.equal(await row.locator('iframe').count(), 0);
    }
    const before = await log.evaluate(node => node.scrollTop);
    for (const back of ['button', 'browser']) {
      assert.ok((await chip.boundingBox())!.height >= 44);
      await chip.tap();
      const viewer = page.locator('[data-artifact-viewer]');
      const frame = viewer.locator('iframe');
      await frame.contentFrame().getByRole('heading', { name: 'Phone artifact receipt' }).waitFor();
      assert.equal(await viewer.getAttribute('data-artifact-selection'), artifacts[0]!.id);
      assert.equal(await frame.getAttribute('sandbox'), 'allow-scripts');
      assert.equal(await frame.getAttribute('srcdoc'), null);
      assert.equal(new URL((await frame.getAttribute('src'))!).origin, origin);
      const box = (await frame.boundingBox())!;
      assert.equal(box.width, 390);
      assert.ok(box.height > 500, 'viewer fills phone below back control');
      assert.equal(await page.getByRole('button', { name: 'Topics', exact: true }).getAttribute('aria-current'), 'page');
      if (back === 'button') await page.getByRole('button', { name: 'Back to thread', exact: true }).tap(); else await page.goBack();
      await chip.waitFor();
      assert.equal(await viewer.count(), 0);
      assert.equal(await log.evaluate(node => node.scrollTop), before);
    }
    await page.setViewportSize({ width: 640, height: 844 });
    await pageUntil(page, () => document.querySelector('[data-phone]')?.getAttribute('data-phone') === 'false', 'desktop width committed');
    const frame = page.locator(`[data-artifact-id="${artifacts[0]!.id}"] iframe`);
    await frame.waitFor();
    assert.equal((await frame.boundingBox())!.height, 240);
  }, undefined, { phone: true });
});

test('phone run has two factual lines and a tap keeps its anchor in place', async t => {
  const clock = new FakeClock(new Date('2026-10-23T12:00:00Z'));
  const fixture = await webFixture(t, { clock });
  const ui = await connectUi(t, fixture.hub.discovery);
  const impl = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'impl', sessionId: 'phone-run-impl', role: 'implementer' });
  await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'rev', sessionId: 'phone-run-rev', role: 'reviewer' });
  await impl.waitForPresence(['impl', 'rev']);
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: 'Before run\n\n' + 'Paragraph before\n\n'.repeat(15) })).ok, true);
  for (let i = 1; i <= 3; i++) assert.equal((await impl.call<{ ok: boolean }>('send', { topic: 'general', to: ['rev'], text: `Phone run step ${i}\n\n${'Run paragraph\n\n'.repeat(6)}` })).ok, true);
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: 'After run\n\n' + 'Paragraph after\n\n'.repeat(20) })).ok, true);
  await clock.advance(125_000);
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal(history.ok, true);
  const { runs, messages } = history.value as { runs: ThreadRun[]; messages: TopicMessage[] };
  const run = runs[0]!;
  assert.equal(run.ageMs, 125_000);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Topics', exact: true }).tap();
    await page.locator('[data-object-id="general"]').tap();
    const log = page.getByRole('log', { name: 'General thread', exact: true });
    const button = log.locator('[data-run-anchor]');
    await button.waitFor();
    assert.deepEqual(await button.locator(':scope > span').allTextContents(), ['impl, rev · 3 messages', 'report · Phone run step 3 Run paragraph Run paragraph Run paragraph Run paragraph · 2m ago']);
    const age = (await button.getByText('· 2m ago', { exact: true }).boundingBox())!;
    assert.ok(age.x >= 0 && age.x + age.width <= 390, 'age stays visible beside the truncated preview');
    const lines = await button.locator(':scope > span').evaluateAll(nodes => nodes.map(node => ({ top: node.getBoundingClientRect().top, bottom: node.getBoundingClientRect().bottom, height: node.getBoundingClientRect().height, line: Number.parseFloat(getComputedStyle(node).lineHeight) })));
    assert.equal(lines.length, 2);
    assert.ok(lines[1]!.top >= lines[0]!.bottom, 'second line follows the sessions');
    assert.ok(lines.every(line => line.height <= line.line + 1), 'each summary occupies exactly one line');
    assert.ok((await button.boundingBox())!.height >= 44);
    await button.evaluate(node => { const log = node.closest('[role="log"]')!; log.scrollTop += node.getBoundingClientRect().top - log.getBoundingClientRect().top; });
    const top = (await button.boundingBox())!.y;
    await button.tap();
    await pageUntil(page, () => document.querySelector('[data-run-anchor]')?.getAttribute('aria-expanded') === 'true', 'run opens in place');
    assert.ok(Math.abs((await button.boundingBox())!.y - top) < 1);
    assert.deepEqual(await log.locator(`[data-run-id="${run.id}"] article`).evaluateAll(nodes => nodes.map(node => node.getAttribute('data-message-id'))), messages.filter(row => row.runId === run.id).map(row => row.id));
    await button.tap();
    await pageUntil(page, () => document.querySelector('[data-run-anchor]')?.getAttribute('aria-expanded') === 'false', 'run folds in place');
    assert.ok(Math.abs((await button.boundingBox())!.y - top) < 1);
    await page.setViewportSize({ width: 640, height: 844 });
    await pageUntil(page, () => document.querySelector('[data-phone]')?.getAttribute('data-phone') === 'false', 'desktop width committed');
    assert.equal(await log.locator('[data-run-anchor]').innerText(), run.foldLine);
  }, undefined, { phone: true });
});

test('phone topic item card is read-only and both Back paths retain the exact reading anchor', async t => {
  const fixture = await webFixture(t, { prepare: root => seedItem(root, 'T-1', 'task', 'Thread item', {}, '## Summary\n\nThread card summary\n\n## Acceptance criteria\n\n- [ ] C1. Read criterion') });
  const ui = await connectUi(t, fixture.hub.discovery);
  const made = await ui.request({ type: 'topic.create', title: 'Card discussion', item: 'T-1' });
  assert.equal(made.ok, true, made.error);
  const topic = (made.value as { topic: { id: string } }).topic.id;
  for (let i = 0; i < 15; i++) assert.equal((await ui.request({ type: 'topic.send', topic, text: `Reading message ${i}\n\n${'Message paragraph\n\n'.repeat(3)}` })).ok, true);
  const reads: string[] = [];
  await fixture.pageCase(t, async page => {
    await page.clock.install({ time: new Date('2026-10-23T12:00:00Z') });
    await page.clock.pauseAt(new Date('2026-10-24T12:00:00Z'));
    await page.getByRole('button', { name: 'Topics', exact: true }).tap();
    await page.locator(`[data-object-id="${topic}"]`).tap();
    const log = page.getByRole('log', { name: 'Card discussion thread', exact: true });
    const anchor = log.locator('article').filter({ hasText: 'Reading message 7\n' });
    await anchor.waitFor();
    await anchor.evaluate(node => { const log = node.closest('[role="log"]')!; log.scrollTop += node.getBoundingClientRect().top - log.getBoundingClientRect().top; });
    const before = (await anchor.boundingBox())!.y;
    await page.clock.runFor(50);
    for (const back of ['button', 'browser']) {
      await page.getByRole('button', { name: 'Item card T-1', exact: true }).tap();
      const card = page.getByRole('region', { name: 'Item card', exact: true });
      await card.getByText('Thread card summary', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Back to thread', exact: true }).evaluate(node => node === document.activeElement), true, 'detail receives focus outside the covered thread');
      const readCount = reads.length;
      await page.clock.runFor(1000);
      assert.equal(reads.length, readCount, 'covered messages are never marked read');
      assert.equal(await card.getAttribute('data-item-id'), 'T-1');
      assert.equal(await log.isVisible(), false);
      await card.getByRole('button', { name: 'Criteria', exact: true }).tap();
      await card.getByText('Read criterion', { exact: false }).waitFor();
      assert.equal(await card.locator('input, textarea, form').count(), 0);
      assert.equal(await card.getByRole('button', { name: /Save|Remove|Mark.*done|Message|Approve|Archive|Add criterion/ }).count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Topics', exact: true }).getAttribute('aria-current'), 'page');
      if (back === 'button') await page.getByRole('button', { name: 'Back to thread', exact: true }).tap(); else await page.goBack();
      await anchor.waitFor();
      assert.equal(await card.count(), 0);
      assert.ok(Math.abs((await anchor.boundingBox())!.y - before) < 1, 'same message at same pixel after card');
    }
    await page.getByRole('button', { name: 'Item card T-1', exact: true }).tap();
    await page.getByRole('region', { name: 'Item card', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Back to thread', exact: true }).focus();
    await page.keyboard.press('Escape');
    await pageUntil(page, () => document.querySelector('[data-covered]')?.getAttribute('data-covered') === 'false', 'shared physical Escape returns to thread');
    assert.ok(Math.abs((await anchor.boundingBox())!.y - before) < 1);
  }, page => { page.on('websocket', socket => socket.on('framesent', event => { const frame = JSON.parse(String(event.payload)); if (frame.type === 'topic.read') reads.push(frame.upTo); })); }, { phone: true });
});

test('phone card retains the last message through covered live traffic and both Back paths', async t => {
  const fixture = await webFixture(t, { prepare: root => seedItem(root, 'T-1', 'task', 'Live card item') });
  const ui = await connectUi(t, fixture.hub.discovery);
  const made = await ui.request({ type: 'topic.create', title: 'Covered traffic', item: 'T-1' });
  assert.equal(made.ok, true, made.error);
  const topic = (made.value as { topic: { id: string } }).topic.id;
  for (let i = 0; i < 10; i++) assert.equal((await ui.request({ type: 'topic.send', topic, text: `Initial message ${i}\n\n${'Paragraph\n\n'.repeat(5)}` })).ok, true);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Topics', exact: true }).tap();
    await page.locator(`[data-object-id="${topic}"]`).tap();
    const log = page.getByRole('log', { name: 'Covered traffic thread', exact: true });
    await log.locator('article').filter({ hasText: 'Initial message 9\n' }).waitFor();
    for (const back of ['button', 'browser']) {
      await log.evaluate(node => { node.scrollTop = node.scrollHeight; });
      assert.equal(await log.evaluate(node => node.scrollHeight - node.clientHeight - node.scrollTop), 0, 'start at the current end');
      const id = await log.locator('article').last().getAttribute('data-message-id');
      const anchor = log.locator(`article[data-message-id="${id}"]`);
      const before = (await anchor.boundingBox())!.y;
      await page.getByRole('button', { name: 'Item card T-1', exact: true }).tap();
      await page.getByRole('region', { name: 'Item card', exact: true }).waitFor();
      const text = `${back} live behind the card`;
      const received = page.waitForFunction(text => [...document.querySelectorAll('[role="log"] article')].some(node => node.textContent?.includes(text)), text);
      void received.catch(() => {});
      assert.equal((await ui.request({ type: 'topic.send', topic, text: text + '\n\n' + 'New paragraph\n\n'.repeat(8) })).ok, true);
      // The exact hidden article proves the mounted thread consumed the live delta.
      await received;
      if (back === 'button') await page.getByRole('button', { name: 'Back to thread', exact: true }).tap(); else await page.goBack();
      await anchor.waitFor();
      assert.ok(Math.abs((await anchor.boundingBox())!.y - before) < 1, `${back}: same last message at the same pixel after covered live traffic`);
      assert.ok(await log.evaluate(node => node.scrollHeight - node.clientHeight - node.scrollTop > 100), 'new traffic is below the retained reading position');
    }
  }, undefined, { phone: true });
});
