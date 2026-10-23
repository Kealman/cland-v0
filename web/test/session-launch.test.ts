// Web: session launch through the authenticated page, sealed fake harnesses and CLI readback.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from 'playwright-core';
import type { HarnessProcessView } from '../../shared/wire/index.ts';
import { cland, connectUi } from '../../hub/test/harness.ts';
import { FakeClock } from '../../hub/test/fake-clock.ts';
import { until } from '../../hub/test/until.ts';
import { webFixture, pageUntil } from './harness.ts';

async function launchFixture(t: TestContext, clock = new FakeClock()) {
  return webFixture(t, { clock, accountReader: async () => [], prepare: async root => {
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/roles.toml'), `
[aide.launch]
harness = "codex"
model = "gpt-fake-1"
account = "fake-codex"
effort = "high"
[reviewer.launch]
harness = "claude-code"
model = "fake-sonnet"
account = "fake-claude"
effort = "low"
`);
    await writeFile(join(process.env.XDG_CONFIG_HOME!, 'cland/accounts.toml'), '[accounts.fake-codex]\nharness = "codex"\n[accounts.fake-claude]\nharness = "claude-code"\n');
  } });
}

// The enabled header action means both authenticated connection and role snapshot are applied.
async function launchReady(page: Page) {
  await pageUntil(page, () => {
    const button = document.querySelector<HTMLButtonElement>('[data-session-slot="header"] button[title="New Aide (a)"]');
    return button !== null && !button.disabled;
  }, 'connected launcher with role defaults');
}

test('New Aide uses role defaults and Enter launches under Yours in the project root without a directory frame', async t => {
  const fixture = await launchFixture(t);
  const frames: Record<string, unknown>[] = [];
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await launchReady(page);
    const form = page.getByRole('form', { name: 'New Aide', exact: true });
    const opened = form.waitFor();
    await page.keyboard.press('a');
    await opened;
    for (const [field, value] of [['Name', 'aide-1'], ['Role', 'aide'], ['Harness', 'codex'], ['Model', 'gpt-fake-1'], ['Account', 'fake-codex'], ['Effort', 'high']]) {
      assert.equal(await form.getByLabel(field!, { exact: true }).inputValue(), value);
    }
    assert.equal(await form.getByLabel(/directory|cwd/i).count(), 0);
    await form.getByLabel('Brief', { exact: true }).fill('Help with the fake project');
    const appeared = page.getByRole('region', { name: 'Yours', exact: true }).locator('[data-object-id="aide-1"]').waitFor();
    await page.keyboard.press('Enter');
    await appeared;
    await pageUntil(page, () => !document.querySelector('[aria-label="New Aide"] form, form[aria-label="New Aide"]'), 'launch form closed');
    const listed = await cland(fixture.root, 'session', 'list', '--json');
    assert.equal(listed.code, 0, listed.stderr);
    const row = (JSON.parse(listed.stdout).processes as HarnessProcessView[]).find(p => p.name === 'aide-1')!;
    assert.equal(row.role, 'aide');
    assert.equal(row.cwd, fixture.root);
    assert.equal(row.model, 'gpt-fake-1');
    assert.equal(row.account, 'fake-codex');
    const launches = frames.filter(frame => frame.type === 'session.launch');
    assert.equal(launches.length, 1);
    assert.deepEqual(launches.map(({ id: _id, ...frame }) => frame), [{ type: 'session.launch', name: 'aide-1', role: 'aide', harness: 'codex', model: 'gpt-fake-1', account: 'fake-codex', effort: 'high', brief: 'Help with the fake project' }]);
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      route.onMessage(message => { frames.push(JSON.parse(String(message))); server.send(message); });
    });
  });
});

test('Role selection fills its launch defaults and a different harness clears model and effort', async t => {
  const fixture = await launchFixture(t);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await launchReady(page);
    await page.getByRole('button', { name: 'Launch a session', exact: true }).click();
    const form = page.getByRole('form', { name: 'Launch a session', exact: true });
    await form.getByLabel('Role', { exact: true }).selectOption('reviewer');
    for (const [field, value] of [['Harness', 'claude-code'], ['Model', 'fake-sonnet'], ['Account', 'fake-claude'], ['Effort', 'low']]) {
      assert.equal(await form.getByLabel(field!, { exact: true }).inputValue(), value);
    }
    await form.getByLabel('Harness', { exact: true }).fill('opencode');
    assert.equal(await form.getByLabel('Model', { exact: true }).inputValue(), '');
    assert.equal(await form.getByLabel('Effort', { exact: true }).inputValue(), '');
    await form.getByLabel('Harness', { exact: true }).fill('claude-code');
    assert.equal(await form.getByLabel('Model', { exact: true }).inputValue(), 'fake-sonnet');
    assert.equal(await form.getByLabel('Effort', { exact: true }).inputValue(), 'low');
    await form.getByLabel('Role', { exact: true }).selectOption('aide');
    for (const [field, value] of [['Harness', 'codex'], ['Model', 'gpt-fake-1'], ['Account', 'fake-codex'], ['Effort', 'high']]) {
      assert.equal(await form.getByLabel(field!, { exact: true }).inputValue(), value);
    }
    await page.keyboard.press('Escape');
    await form.waitFor({ state: 'detached' });
    assert.equal(await page.getByRole('button', { name: 'Launch a session', exact: true }).evaluate(node => node === document.activeElement), true);
  });
});

test('Focusing Model fetches the selected harness and account catalog and ignores a late old visit', async t => {
  const fixture = await launchFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  const requests: Record<string, unknown>[] = [];
  let oldReply: (() => void) | undefined;
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await launchReady(page);
    await page.getByRole('button', { name: 'New Aide', exact: true }).click();
    const form = page.getByRole('form', { name: 'New Aide', exact: true });
    const model = form.getByLabel('Model', { exact: true });
    await model.focus();
    await pageUntil(page, () => document.querySelectorAll('datalist[id$="-models"] option').length === 2, 'model catalog rendered');
    assert.deepEqual(await form.locator('datalist[id$="-models"] option').evaluateAll(nodes => nodes.map(node => node.getAttribute('value'))), ['gpt-fake-1', 'gpt-fake-2']);
    assert.deepEqual(requests.map(({ id: _id, ...frame }) => frame), [{ type: 'models.list', harness: 'codex', account: 'fake-codex' }]);
    await form.getByLabel('Brief', { exact: true }).focus();
    await model.focus(); // This catalog answer is held past its visit.
    await form.getByLabel('Harness', { exact: true }).fill('opencode');
    await model.focus();
    await pageUntil(page, () => document.querySelector('datalist[id$="-models"] option')?.getAttribute('value') === 'fake/free', 'new harness catalog');
    assert.equal(requests.at(-1)?.harness, 'opencode');
    assert.equal(Object.hasOwn(requests.at(-1)!, 'account'), false);
    // Observe a rendered row delivered after the old reply on this same WebSocket.
    // This keeps the final choices assertion after the late reply was processed.
    const barrier = page.locator('[data-object-id="catalog-barrier"]').waitFor();
    oldReply!();
    assert.equal((await ui.request({ type: 'session.launch', name: 'catalog-barrier', harness: 'codex' })).ok, true);
    await barrier;
    assert.deepEqual(await form.locator('datalist[id$="-models"] option').evaluateAll(nodes => nodes.map(node => node.getAttribute('value'))), ['fake/free']);
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      // Model discovery is the external harness boundary; never probe installed accounts or binaries.
      route.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type !== 'models.list') { server.send(message); return; }
        requests.push(frame);
        const reply = () => route.send(JSON.stringify({ type: 'result', id: frame.id, ok: true, value: { models: frame.harness === 'codex'
          ? [{ id: 'gpt-fake-2', default: false }, { id: 'gpt-fake-1', default: true }] : [{ id: 'fake/free', default: true }] } }));
        if (requests.length === 2) oldReply = reply;
        else reply();
      });
    });
  });
});

test('A limited fake account shows the hub reset refusal under the retained form and launches nothing', async t => {
  const clock = new FakeClock(new Date('2026-10-23T12:00:00Z'));
  const fixture = await launchFixture(t, clock);
  const ui = await connectUi(t, fixture.hub.discovery);
  const resetsAt = '2026-10-23T15:10:00.000Z';
  assert.equal((await ui.request({ type: 'session.launch', name: 'limit-source', harness: 'claude-code', account: 'fake-claude' })).ok, true);
  assert.equal((await ui.request({ type: 'session.signal', session: 'limit-source', event: 'mod-measure', at: clock.now().getTime(), payload: { rateLimits: [{ kind: 'five_hour', percentUsed: 100, resetsAt }] } })).ok, true);
  await clock.advance(1000);
  assert.equal((await ui.request({ type: 'session.signal', session: 'limit-source', event: 'turn-end', payload: { hook_event_name: 'StopFailure', error: 'rate_limit' } })).ok, true);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await launchReady(page);
    const form = page.getByRole('form', { name: 'Launch a session', exact: true });
    const opened = form.waitFor();
    await page.keyboard.press('l');
    await opened;
    await form.getByLabel('Name', { exact: true }).fill('refused-worker');
    await form.getByLabel('Role', { exact: true }).selectOption('reviewer');
    await form.getByRole('button', { name: 'Launch', exact: true }).click();
    const alert = form.getByRole('alert');
    await alert.waitFor();
    assert.match(await alert.textContent() ?? '', /account fake-claude is limited until/);
    assert.ok((await alert.textContent())?.includes(resetsAt));
    assert.equal(await alert.evaluate(node => !!(node.compareDocumentPosition(node.parentElement!.querySelector('fieldset')!) & Node.DOCUMENT_POSITION_PRECEDING)), true);
    assert.equal(await form.getByLabel('Name', { exact: true }).inputValue(), 'refused-worker');
    const listed = await ui.request({ type: 'session.list' });
    assert.deepEqual((listed.value as { processes: HarnessProcessView[] }).processes.map(row => row.name), ['limit-source']);
    assert.equal(fixture.fakes['claude-code']!.spawns.length, 1);
  });
});

test('Launch actions use physical keys and palette dispatch while form typing and Cancel stay native', async t => {
  const fixture = await launchFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await launchReady(page);
    const launch = page.getByRole('form', { name: 'Launch a session', exact: true });
    const opened = launch.waitFor();
    await page.getByRole('button', { name: 'Sessions', exact: true }).evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyL', key: 'д', bubbles: true, cancelable: true })));
    await opened;
    const name = launch.getByLabel('Name', { exact: true });
    await name.fill('');
    await name.press('a'); await name.press('l'); await name.press('1');
    assert.equal(await name.inputValue(), 'al1');
    assert.equal(await page.locator('form[aria-label="New Aide"]').count(), 0);
    await launch.getByRole('button', { name: 'Cancel', exact: true }).focus();
    const native = await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter', key: 'ж', bubbles: true, cancelable: true })));
    assert.equal(native, true, 'document-dispatched Enter at Cancel stays with the native control');
    assert.equal(await launch.getByRole('button', { name: 'Cancel', exact: true }).evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('Enter');
    await launch.waitFor({ state: 'detached' });
    const receipt = await ui.request({ type: 'session.list' });
    assert.equal((receipt.value as { processes: unknown[] }).processes.length, 0, 'Cancel never launches a session');
    for (const action of ['Launch a session', 'New Aide']) {
      await page.keyboard.press('Meta+k');
      await page.getByRole('combobox', { name: 'Search palette' }).fill(`>${action}`);
      await page.getByRole('option').filter({ hasText: action }).waitFor();
      const form = page.getByRole('form', { name: action, exact: true });
      const opened = form.waitFor();
      await page.keyboard.press('Enter');
      await opened;
      await page.keyboard.press('Escape');
      await form.waitFor({ state: 'detached' });
    }
    const aideOpened = page.getByRole('form', { name: 'New Aide', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Sessions', exact: true }).evaluate(node => node.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', key: 'ф', bubbles: true, cancelable: true })));
    await aideOpened;
  });
});

test('An item and artifact brief launch once while the request is pending with no client directory', async t => {
  const fixture = await launchFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'task.create', title: 'Fake launch work', size: 'S' })).ok, true);
  const made = await ui.request({ type: 'artifact.create', topic: 'general', kind: 'prompt', title: 'Fake launch brief', content: 'Implement the fake item.' });
  assert.equal(made.ok, true, made.error);
  const brief = (made.value as { artifact: { id: string } }).artifact.id;
  let submit: (() => void) | undefined;
  const launches: Record<string, unknown>[] = [];
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await launchReady(page);
    const form = page.getByRole('form', { name: 'Launch a session', exact: true });
    const opened = form.waitFor();
    await page.keyboard.press('l');
    await opened;
    for (const [field, value] of [['Name', 'item-worker'], ['Item', 'T-1'], ['Brief', brief], ['Harness', 'codex']]) await form.getByLabel(field!, { exact: true }).fill(value!);
    await form.getByLabel('Role', { exact: true }).selectOption('implementer');
    await form.getByLabel('Harness', { exact: true }).fill('codex');
    await form.getByRole('button', { name: 'Launch', exact: true }).click();
    await until(() => launches.length === 1, { what: 'launch request held at transport boundary', timeoutMs: 3000 });
    assert.equal(await form.getByRole('button', { name: 'Launch', exact: true }).isDisabled(), true);
    await page.keyboard.press('Enter');
    assert.equal(launches.length, 1);
    assert.equal(Object.hasOwn(launches[0]!, 'cwd'), false);
    const appeared = page.locator('[data-object-id="item-worker"]').waitFor();
    submit!();
    await appeared;
    const listed = await ui.request({ type: 'session.list' });
    const row = (listed.value as { processes: HarnessProcessView[] }).processes.find(row => row.name === 'item-worker')!;
    // projectHub has no territory; the existing hub worktree seam covers territory creation.
    assert.equal(row.cwd, fixture.root);
    assert.equal(launches[0]!.item, 'T-1');
    assert.equal(row.item, 'T-1');
    assert.ok(fixture.fakes.codex!.spawns.at(-1)!.brief!.text.includes('Implement the fake item.'));
    assert.equal(launches.length, 1);
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      route.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'session.launch') { launches.push(frame); submit = () => server.send(message); }
        else server.send(message);
      });
    });
  });
});

test('Offline launch is disabled and reconnect never replays the draft', async t => {
  const fixture = await launchFixture(t);
  const sent: string[] = [];
  let disconnect!: () => void;
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await launchReady(page);
    await page.getByRole('button', { name: 'New Aide', exact: true }).click();
    const form = page.getByRole('form', { name: 'New Aide', exact: true });
    await form.getByLabel('Brief', { exact: true }).fill('Keep this draft');
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    disconnect();
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Offline', 'disconnected page');
    assert.equal(await form.getByRole('button', { name: 'Launch', exact: true }).isDisabled(), true);
    await page.keyboard.press('Enter');
    assert.deepEqual(sent, []);
    await page.clock.runFor(250);
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Live', 'reconnected page');
    assert.equal(await form.getByLabel('Brief', { exact: true }).inputValue(), 'Keep this draft');
    assert.equal(await form.getByRole('button', { name: 'Launch', exact: true }).isDisabled(), false);
    assert.deepEqual(sent, []);
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      route.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'session.launch') sent.push(frame.name);
        server.send(message);
      });
      disconnect = () => { route.close(); server.close(); };
    });
  });
});

test('Session page launch actions open the same form in the active pane', async t => {
  const fixture = await launchFixture(t);
  const ui = await connectUi(t, fixture.hub.discovery);
  assert.equal((await ui.request({ type: 'session.launch', name: 'page-source', harness: 'codex' })).ok, true);
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await launchReady(page);
    await page.locator('[data-object-id="page-source"]').click();
    await page.keyboard.press('Meta+Enter');
    const pane = page.locator('[data-pane="secondary"]');
    await pane.getByRole('button', { name: 'Stop', exact: true }).focus();
    const form = pane.getByRole('form', { name: 'New Aide', exact: true });
    const opened = form.waitFor();
    await page.keyboard.press('a');
    await opened;
    await page.keyboard.press('Escape');
    await form.waitFor({ state: 'detached' });
    assert.equal(await pane.getByRole('button', { name: 'Stop', exact: true }).evaluate(node => node === document.activeElement), true);
  });
});

test('Launch waits for role defaults when the initial sessions snapshot is delayed', async t => {
  const fixture = await launchFixture(t);
  let release!: () => void;
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Sessions', exact: true }).click();
    await pageUntil(page, () => document.querySelector('[aria-label="Hub connection"]')?.textContent?.trim() === 'Live', 'authenticated status applied while role snapshot held');
    assert.equal(await page.getByRole('button', { name: 'New Aide', exact: true }).isDisabled(), true);
    await page.keyboard.press('a');
    assert.equal(await page.getByRole('form', { name: 'New Aide', exact: true }).count(), 0);
    release();
    await launchReady(page);
    const form = page.getByRole('form', { name: 'New Aide', exact: true });
    const opened = form.waitFor();
    await page.keyboard.press('a');
    await opened;
    assert.equal(await form.getByLabel('Role', { exact: true }).inputValue(), 'aide');
    assert.equal(await form.getByLabel('Model', { exact: true }).inputValue(), 'gpt-fake-1');
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      server.onMessage(message => {
        const frame = JSON.parse(String(message));
        if (frame.type === 'snapshot' && frame.domain === 'sessions') release = () => route.send(message);
        else route.send(message);
      });
    });
  });
});
