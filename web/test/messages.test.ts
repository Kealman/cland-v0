// Web: P12 message blocks through authenticated history/deltas and rendered elements.
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright-core';
import { connectUi, inProcessSpoke } from '../../hub/test/harness.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import { webFixture } from './harness.ts';
import { seedItem } from './items-fixture.ts';
import type { Artifact } from '../../shared/wire/index.ts';

async function openThread(page: Page, topic = 'general', title = 'General') {
  await page.getByRole('button', { name: 'Topics', exact: true }).click();
  await page.locator(`[data-object-id="${topic}"]`).click();
  const thread = page.getByRole('log', { name: `${title} thread`, exact: true });
  await thread.locator('[data-message-id]').first().waitFor();
  return thread;
}

test('P12 headers show sender role addressees kinds time and delivery in a separate colour gutter', async t => {
  const clock = new FakeClock(Date.parse('2026-10-20T12:00:00Z'));
  const fixture = await webFixture(t, { clock });
  const ui = await connectUi(t, fixture.hub.discovery);
  const coord = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', sessionId: 'header-coord', role: 'coordinator' });
  await coord.waitForPresence(['coord']);
  assert.equal((await coord.call<{ ok: boolean }>('send', { topic: 'general', kind: 'report', text: 'Header report' })).ok, true);
  for (const kind of ['message', 'decision', 'question']) {
    assert.equal((await ui.request({ type: 'topic.send', topic: 'general', to: ['coord'], kind, text: `Human ${kind}` })).ok, true);
  }
  clock.block(86_400_000);
  assert.equal((await coord.call<{ ok: boolean }>('send', { topic: 'general', kind: 'progress', text: 'Next day progress' })).ok, true);
  await fixture.pageCase(t, async page => {
    const thread = await openThread(page);
    const report = thread.locator('article').filter({ hasText: 'Header report' });
    await report.waitFor();
    assert.match(await report.locator('header').innerText(), /coord.*Coordinator.*→ you.*report/s);
    assert.equal(await report.locator('time').getAttribute('datetime'), '2026-10-20T12:00:00.000Z');
    assert.equal(await report.locator('[data-message-role]').evaluate(node => getComputedStyle(node).color), 'rgb(53, 196, 160)');
    assert.equal(await report.locator('[data-role-gutter]').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(53, 196, 160)');
    assert.deepEqual(await report.evaluate(node => {
      const gutter = node.querySelector('[data-role-gutter]')!;
      const header = node.querySelector('header')!.getBoundingClientRect();
      const body = node.querySelector('p')!.getBoundingClientRect();
      return { width: gutter.getBoundingClientRect().width, height: gutter.getBoundingClientRect().height >= node.lastElementChild!.getBoundingClientRect().height,
        separate: gutter.getBoundingClientRect().right < header.left, above: header.bottom <= body.top, border: getComputedStyle(node).borderTopWidth };
    }), { width: 3, height: true, separate: true, above: true, border: '0px' });
    for (const kind of ['Message', 'Decision', 'Question']) {
      const human = thread.locator('article').filter({ hasText: `Human ${kind.toLowerCase()}` });
      assert.match(await human.locator('header').innerText(), new RegExp(`you.*Human.*→ coord.*${kind}`, 's'));
      assert.ok(await human.locator('[data-delivery-stage]').innerText());
    }
    assert.equal(await thread.getByRole('separator').count(), 2);
    assert.match(await thread.getByRole('separator').nth(0).innerText(), /20.*October.*2026/);
    assert.match(await thread.getByRole('separator').nth(1).innerText(), /21.*October.*2026/);
  });
});

test('agent clear reports retain target navigation in their one-row summary', async t => {
  const fixture = await webFixture(t, { prepare: root => seedItem(root, 'T-900001', 'task', 'Legacy verdict target') });
  const reviewer = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'rev', sessionId: 'legacy-reviewer', role: 'reviewer' });
  await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', sessionId: 'legacy-coord', role: 'coordinator' });
  await reviewer.waitForPresence(['rev', 'coord']);
  const sent = await reviewer.call<{ ok: boolean; error?: string }>('send', { to: 'coord', topic: 'general', text: 'review clear T-900001\nLengthy source review details' });
  assert.equal(sent.ok, true, sent.error);
  await fixture.pageCase(t, async page => {
    const thread = await openThread(page);
    const message = thread.locator('article[data-compact="true"]');
    await message.waitFor();
    const target = message.locator('[data-item-link="T-900001"]');
    assert.equal(await target.count(), 1, 'a public agent report retains its first-line item target');
    assert.match(await message.locator('header').innerText(), /review clear T-900001/);
    assert.equal(await message.locator('p').count(), 0);
    assert.equal(await message.evaluate(node => node.getBoundingClientRect().height < 45), true);
    assert.equal(await target.evaluate(node => getComputedStyle(node).whiteSpace), 'nowrap');
    const navigated = page.locator('[aria-label="Item card"][data-item-id="T-900001"]').waitFor(); void navigated.catch(() => {});
    await target.click();
    await navigated;
    assert.match(await page.getByRole('region', { name: 'Item card' }).innerText(), /T-900001/);
  });
});

test('whole item links navigate without wrapping and posted or attached artifacts stay chips', async t => {
  const fixture = await webFixture(t, { prepare: async root => {
    await seedItem(root, 'T-900001', 'task', 'Linked message item');
    await seedItem(root, 'E-900002', 'epic', 'Linked message epic');
  } });
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: 'Open T-900001 and E-900002; Z-42 stays text; `T-900001` stays code.' })).ok, true);
  const artifacts: Artifact[] = [];
  for (const [kind, title, folder, content] of [['file', 'Receipt file', false, 'Receipt bytes'], ['note', 'Receipt folder', true, 'Folder entry'], ['page', 'HTML preview', false, '<h1>Artifact HTML</h1>']] as const) {
    const made = await ui.request({ type: 'artifact.create', topic: 'general', kind, title, folder, content });
    assert.equal(made.ok, true, made.error);
    artifacts.push((made.value as { artifact: Artifact }).artifact);
  }
  await fixture.pageCase(t, async page => {
    const thread = await openThread(page);
    for (const artifact of artifacts) {
      const chip = thread.locator(`[data-artifact-id="${artifact.id}"]`);
      assert.equal(await chip.count(), 1);
      assert.ok((await chip.innerText()).includes(`${artifact.id} ${artifact.kind}`));
      assert.ok((await chip.innerText()).includes(artifact.title));
      if (artifact.folder) assert.match(await chip.innerText(), /folder/);
    }
    assert.equal(await thread.locator('iframe').count(), 0, 'HTML remains a chip until the inline slice');
    const attached = thread.locator('article').filter({ hasText: 'Attached receipts' });
    const rendered = attached.locator('[data-artifact-id]').nth(1).waitFor(); void rendered.catch(() => {});
    assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: 'Attached receipts', artifacts: artifacts.slice(0, 2).map(row => row.id) })).ok, true);
    await rendered;
    assert.deepEqual(await attached.locator('[data-artifact-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-artifact-id'))), artifacts.slice(0, 2).map(row => row.id));
    const body = thread.locator('article').filter({ hasText: 'Open T-900001' });
    assert.equal(await body.locator('[data-item-link]').count(), 2, 'code and unconfigured prefixes stay literal');
    const link = body.locator('[data-item-link="T-900001"]');
    assert.equal(await link.innerText(), 'T-900001');
    assert.equal(await link.getAttribute('href'), '#item/T-900001');
    assert.equal(await link.evaluate(node => {
      (node.parentElement as HTMLElement).style.width = '40px';
      return getComputedStyle(node).whiteSpace === 'nowrap' && node.getClientRects().length === 1;
    }), true, 'the whole id remains one line even in a narrow body');
    const navigated = page.locator('[aria-label="Item card"][data-item-id="T-900001"]').waitFor(); void navigated.catch(() => {});
    await link.click();
    await navigated;
    const card = page.getByRole('region', { name: 'Item card' });
    assert.match(await card.innerText(), /T-900001/);
  });
});

test('message Markdown renders safe elements with message-local fences and literal HTML', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const text = '# Heading\n\n**Strong** and *emphasis* with `inline`\n\n- First\n- Second\n\n3. Third\n4. Fourth\n\n> Quoted text\n\n```ts\nconst example = "<img src=x>";\n```\n\n[Docs](https://example.com/docs) and https://example.com/bare\n\n<script>window.messageExecuted=true</script> <img src="https://example.com/tracker"> <button>Fake</button>\n\n[jump](javascript:alert) ![image](https://example.com/image)\n\n| A | B |\n| --- | --- |\n| x | y |';
  const sent = await ui.request({ type: 'topic.send', topic: 'general', text });
  assert.equal(sent.ok, true, sent.error);
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: '```js\nUnclosed fence' })).ok, true);
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: '**Next message**' })).ok, true);
  await fixture.pageCase(t, async (page, _origin, requests) => {
    const thread = await openThread(page);
    const message = thread.locator(`[data-message-id="${(sent.value as { message: { id: string } }).message.id}"]`);
    assert.equal(await message.getByRole('heading', { name: 'Heading', exact: true }).count(), 1);
    assert.equal(await message.locator('strong').filter({ hasText: 'Strong' }).count(), 1);
    assert.equal(await message.locator('em').innerText(), 'emphasis');
    assert.deepEqual(await message.locator('ul li').allTextContents(), ['First', 'Second']);
    assert.equal(await message.locator('ol').getAttribute('start'), '3');
    assert.deepEqual(await message.locator('ol li').allTextContents(), ['Third', 'Fourth']);
    assert.equal(await message.locator('blockquote').innerText(), 'Quoted text');
    const code = message.locator('pre').filter({ hasText: 'const example' });
    assert.equal(await code.locator('code').innerText(), 'const example = "<img src=x>";');
    assert.equal(await message.locator('[data-code-language]').innerText(), 'ts');
    assert.equal(await code.evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(26, 33, 44)');
    for (const label of ['Docs', 'https://example.com/bare']) {
      const link = message.getByRole('link', { name: label, exact: true });
      assert.equal(await link.getAttribute('target'), '_blank');
      assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
      assert.match(await link.evaluate(node => getComputedStyle(node).textDecorationLine), /underline/);
    }
    assert.equal(await message.locator('script, img, button, iframe').count(), 0);
    assert.equal(await page.evaluate(() => 'messageExecuted' in window), false);
    assert.ok((await message.innerText()).includes('<script>window.messageExecuted=true</script>'));
    assert.ok((await message.innerText()).includes('[jump](javascript:alert)'));
    assert.equal(await message.locator('a').count(), 2);
    assert.ok(requests.every(url => !url.startsWith('https://example.com')));
    assert.match(await message.locator('pre').filter({ hasText: '| A |' }).innerText(), /\| x \| y \|/);
    assert.equal(await thread.locator('article').filter({ hasText: 'Unclosed fence' }).locator('pre code').innerText(), 'Unclosed fence');
    assert.equal(await thread.locator('article').filter({ hasText: 'Next message' }).locator('strong').filter({ hasText: 'Next message' }).count(), 1);
  });
});

test('P12 bands and watch verdicts preserve durable criterion facts', async t => {
  const fixture = await webFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const created = await ui.request({ type: 'task.create', size: 'M', title: 'Verdict fixture', body: '## Acceptance criteria\n- [ ] C1. First boundary\n- [ ] C2. Second boundary' });
  assert.equal(created.ok, true, created.error);
  const item = (created.value as { item: { id: string } }).item.id;
  const opened = await ui.request({ type: 'topic.create', item, title: 'Verdict thread' });
  assert.equal(opened.ok, true, opened.error);
  const topic = (opened.value as { topic: { id: string } }).topic.id;
  const coord = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'coord', sessionId: 'bands-coord', role: 'coordinator' });
  const aide = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'helper', sessionId: 'bands-aide', role: 'aide' });
  const reviewer = await inProcessSpoke(t, { discover: true, cwd: fixture.root, name: 'rev', sessionId: 'bands-reviewer', role: 'reviewer' });
  await reviewer.waitForPresence(['coord', 'helper', 'rev']);
  assert.equal((await ui.request({ type: 'topic.send', topic, text: 'Human band' })).ok, true);
  const aideSent = await aide.call<{ ok: boolean; error?: string }>('send', { topic, text: 'Aide band' });
  assert.equal(aideSent.ok, true, aideSent.error);
  assert.equal((await coord.call<{ ok: boolean }>('send', { topic, kind: 'report', text: 'Watch report' })).ok, true);
  assert.equal((await reviewer.call<{ ok: boolean }>('task.comment', { id: item, text: 'Repair the boundary', verdict: 'review', scope: 'full', result: 'not clear', run: 'red', failed: [{ criterion: 'C2', note: 'Missing completion receipt' }] })).ok, true);
  await fixture.pageCase(t, async page => {
    const thread = await openThread(page, topic, 'Verdict thread');
    for (const text of ['Human band', 'Aide band']) {
      const message = thread.locator('article').filter({ hasText: text });
      assert.equal(await message.evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(19, 27, 41)');
    }
    assert.equal(await thread.locator('article[data-role="aide"] [data-role-gutter]').evaluate(node => getComputedStyle(node).borderLeftStyle), 'dashed');
    const watch = thread.locator('article').filter({ hasText: 'Watch report' });
    assert.equal(await watch.getAttribute('data-layer'), 'watch');
    assert.equal(await watch.locator('p').evaluate(node => getComputedStyle(node).color), 'rgb(167, 176, 188)');
    const red = thread.locator('article').filter({ hasText: 'Repair the boundary' });
    assert.equal(await red.locator('[data-verdict]').innerText(), 'review not clear');
    assert.equal(await red.locator('[data-verdict]').evaluate(node => getComputedStyle(node).color), 'rgb(255, 123, 114)');
    assert.match(await red.locator('[data-criterion="C2"]').innerText(), /✗ C2 failed.*Missing completion receipt/s);
    // A live recorded verdict carries the same facts as history; clear is one line.
    const green = thread.locator('article').filter({ has: page.locator('[data-verdict="clear"]') });
    const rendered = green.waitFor(); void rendered.catch(() => {});
    assert.equal((await reviewer.call<{ ok: boolean }>('task.comment', { id: item, text: 'Long review details stay compact', verdict: 'review', scope: 'full', result: 'clear', run: 'green', verified: 'all' })).ok, true);
    await rendered;
    assert.equal(await green.getAttribute('data-layer'), 'watch');
    assert.equal(await green.locator('[data-verdict]').evaluate(node => getComputedStyle(node).color), 'rgb(125, 220, 138)');
    assert.equal(await green.locator('p').count(), 0);
    assert.deepEqual(await green.locator('[data-criterion]').allTextContents(), ['✓ C1 verified', '✓ C2 verified']);
    assert.equal(await green.evaluate(node => node.getBoundingClientRect().height < 45), true, 'clear verdict stays on one row');
  });
});
