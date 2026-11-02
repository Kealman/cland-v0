// Web: authenticated scratch web edge and isolated Headless Shell; human sends use production dispatch.
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultConfig, renderConfig } from '../../hub/src/init/config.ts';
import { askHubFrame } from '../../hub/src/cli/socket-client.ts';
import { dispatcherUi } from '../../hub/test/harness.ts';
import { webFixture } from './harness.ts';
import type { User } from '../../hub/src/hub/users.ts';

test('desktop and phone distinguish users with identical display names by id', async t => {
  const fixture = await webFixture(t, { prepare: async root => {
    await mkdir(join(root, '.cland'), { recursive: true });
    const config = defaultConfig('Authors');
    config.verification.lockPath = join(root, 'suite.lock');
    await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  } });
  const request = (frame: Parameters<typeof askHubFrame>[1]) => askHubFrame(fixture.hub.discovery, frame, 3000, {});
  await request({ type: 'auth.mode', mode: 'users' });
  const { users } = await request({ type: 'user.list' }) as { users: User[] };
  const { user } = await request({ type: 'user.add', name: 'other-author', displayName: users[0]!.displayName }) as { user: User };
  const db = new DatabaseSync(join(fixture.root, '.cland/hub.db'));
  try { db.prepare("update users set state='active' where id=?").run(user.id); } finally { db.close(); }
  user.state = 'active';
  const own = await request({ type: 'topic.send', topic: 'general', text: 'Own words' }) as { message: { id: string } };
  const other = await dispatcherUi(t, { open: (peer, transport) => fixture.hub.dispatcher.open(peer, { ...transport, edge: 'web', user: () => user }) }, fixture.root);
  const sent = await other.request({ type: 'topic.send', topic: 'general', text: 'Other words' });
  assert.equal(sent.ok, true, sent.error);
  const id = (sent.value as { message: { id: string } }).message.id;
  for (const phone of [false, true]) await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Topics', exact: true }).click();
    await page.locator('[data-object-id="general"]').click();
    const mine = page.locator(`[data-message-id="${own.message.id}"] header strong`);
    const theirs = page.locator(`[data-message-id="${id}"] header strong`);
    await page.locator(`[data-message-id="${own.message.id}"] header`).getByText('you', { exact: true }).first().waitFor();
    await page.locator(`[data-message-id="${id}"] header`).getByText(user.displayName, { exact: true }).waitFor();
    assert.equal(await mine.innerText(), 'you');
    assert.equal(await theirs.innerText(), user.displayName);
    const liveText = `Live other words ${phone}`;
    const rendered = page.getByText(liveText, { exact: true }).waitFor();
    const live = await other.request({ type: 'topic.send', topic: 'general', text: liveText });
    assert.equal(live.ok, true, live.error);
    await rendered;
    const liveId = (live.value as { message: { id: string } }).message.id;
    const liveHeader = page.locator(`[data-message-id="${liveId}"] header strong`);
    await liveHeader.waitFor();
    assert.equal(await liveHeader.innerText(), user.displayName);
  }, undefined, { phone });
  let oldShape = false;
  await fixture.pageCase(t, async page => {
    await page.getByRole('button', { name: 'Topics', exact: true }).click();
    await page.locator('[data-object-id="general"]').click();
    const header = page.locator(`[data-message-id="${id}"] header strong`);
    await header.waitFor();
    assert.equal(await header.innerText(), 'you');
    assert.equal(oldShape, true);
  }, async page => {
    await page.routeWebSocket('**/ws', route => {
      const server = route.connectToServer();
      server.onMessage(message => route.send(JSON.stringify(JSON.parse(String(message)), (key, value: unknown) => {
        if (key === 'userDisplayName') { oldShape = true; return undefined; }
        return value;
      })));
    });
  });
});
