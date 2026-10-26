// Web: real gateway frames and an isolated Headless Shell, with only the messenger faked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { connectUi, inProcessSpoke } from '../../hub/test/harness.ts';
import { testMessenger } from '../../hub/test/fakes/messenger.ts';
import { webFixture } from './harness.ts';
import type { TopicMessage } from '../../shared/wire/index.ts';

test('remote messages, ask decisions and Codex approvals show their source in the thread and Inbox', async t => {
  const messenger = testMessenger();
  const discord = testMessenger('discord', 'discord');
  const fixture = await webFixture(t, { gatewayRemotes: [messenger, discord] });
  const local = await connectUi(t, fixture.hub.discovery);
  const coord = await inProcessSpoke(t, { cwd: fixture.root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const asked = await coord.call<{ ask: string }>('ask', { topic: 'general', question: 'Remote direction?', options: ['Continue'] });
  const launched = await local.request({ type: 'session.launch', name: 'worker', harness: 'codex', role: 'implementer' });
  assert.equal(launched.ok, true, launched.error);
  const approvalId = `${(launched.value as { process: { sessionId: string } }).process.sessionId}:source`;
  fixture.hub.fakes.codex!.raiseApproval('worker', { id: 'source', kind: 'command', subject: { command: 'echo source' }, choices: ['once', 'deny'] });
  await fixture.pageCase(t, async page => {
    await page.locator(`[data-object-id="${asked.ask}"]`).waitFor();
    await page.locator(`[data-object-id="${approvalId}"]`).waitFor();
    const sent = await messenger.client.request({ type: 'topic.send', topic: 'general', text: 'From the phone' });
    assert.equal(sent.ok, true, sent.error);
    const other = await discord.client.request({ type: 'topic.send', topic: 'general', text: 'From Discord' });
    assert.equal(other.ok, true, other.error);
    const discordId = (other.value as { message: TopicMessage }).message.id;
    const id = (sent.value as { message: TopicMessage }).message.id;
    const answer = await messenger.client.request({ type: 'topic.answer', ask: asked.ask, option: 1 });
    assert.equal(answer.ok, true, answer.error);
    const ask = page.locator(`[data-inbox-kind="ask"] [data-ask-id="${asked.ask}"][data-ask-state="answered"]`);
    await ask.getByText('via Telegram', { exact: true }).waitFor();
    assert.match(await ask.innerText(), /Continue.*human.*via Telegram/s);
    const approved = await messenger.client.request({ type: 'approval.answer', approval: approvalId, choice: 'deny' });
    assert.equal(approved.ok, true, approved.error);
    const approval = page.locator('[data-approval-outcome]');
    await approval.getByText(/via Telegram/).waitFor();
    assert.match(await approval.innerText(), /Denied by the human.*via Telegram/s);
    await page.locator('[data-inbox-archive-toggle]').click();
    for (const archived of [asked.ask, approvalId]) {
      const row = page.locator(`[data-inbox-archive-id="${archived}"]`);
      await row.getByText(/via Telegram/).waitFor();
      assert.match(await row.innerText(), /via Telegram/);
    }
    await page.getByRole('button', { name: 'Topics', exact: true }).click();
    await page.locator('[data-object-id="general"]').click();
    const message = page.locator(`[data-message-id="${id}"]`);
    await message.getByText('via Telegram', { exact: true }).waitFor();
    assert.match(await message.innerText(), /via Telegram/);
    const discordMessage = page.locator(`[data-message-id="${discordId}"]`);
    await discordMessage.getByText('via Discord', { exact: true }).waitFor();
    assert.match(await discordMessage.innerText(), /via Discord/);
    // History reload exercises persisted outcomes rather than only live deltas.
    await page.reload();
    const history = page.locator(`[data-message-id="${asked.ask}"] [data-ask-state="answered"]`);
    await history.getByText('via Telegram', { exact: true }).waitFor();
    assert.match(await history.innerText(), /via Telegram/);
  });
});


test('client reads the previous ask outcome shape without via in history and the archive', async t => {
  const fixture = await webFixture(t);
  const local = await connectUi(t, fixture.hub.discovery);
  const coord = await inProcessSpoke(t, { cwd: fixture.root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'legacy-coord' });
  const asked = await coord.call<{ ask: string }>('ask', { topic: 'general', question: 'Previous hub question?', options: [] });
  const answer = await local.request({ type: 'topic.answer', ask: asked.ask, text: 'Legacy answer' });
  assert.equal(answer.ok, true, answer.error);
  let previousShape = false;
  await fixture.pageCase(t, async page => {
    await page.locator('[data-inbox-archive-toggle]').click();
    const row = page.locator(`[data-inbox-archive-id="${asked.ask}"]`);
    await row.getByText(/Legacy answer/).waitFor();
    assert.match(await row.innerText(), /Legacy answer.*human/s);
    await page.getByRole('button', { name: 'Topics', exact: true }).click();
    await page.locator('[data-object-id="general"]').click();
    const card = page.locator(`[data-message-id="${asked.ask}"] [data-ask-state="answered"]`);
    await card.getByText('Legacy answer', { exact: true }).waitFor();
    assert.match(await card.innerText(), /Legacy answer.*human/s);
    assert.doesNotMatch(await card.innerText(), /undefined|via /);
    assert.equal(previousShape, true, 'the client actually received an outcome without via');
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      server.onMessage(message => route.send(JSON.stringify(JSON.parse(String(message)), (key, value: unknown) => {
        if (key === 'outcome' && value && typeof value === 'object' && 'status' in value && 'via' in value) {
          const { via: _source, ...old } = value;
          previousShape = true;
          return old;
        }
        return value;
      })));
    });
  });
});
