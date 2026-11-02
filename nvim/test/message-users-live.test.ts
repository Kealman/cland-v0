// T3: real production hub message subscription and a headless Neovim process.
// Setup owns scratch config/SQLite, hub and client; behavior waits for exact live frame and rendered author;
// registered fixture cleanup joins the Neovim native exit and hub stop before deleting roots.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultConfig, renderConfig } from '../../hub/src/init/config.ts';
import { projectHub, tempProject, connectUi, dispatcherUi } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';
import type { User } from '../../hub/src/hub/users.ts';
import type { TopicMessage } from '../../shared/wire/index.ts';
const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false, bin = 'bin' in nvim ? nvim.bin : '';

test('an open Neovim thread renders the other user from the production live message frame', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Live authors');
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const hub = await projectHub(t, root);
  const ui = await connectUi(t, hub.discovery);
  assert.equal((await ui.request({ type: 'auth.mode', mode: 'users' })).ok, true);
  const listed = await ui.request({ type: 'user.list' });
  assert.equal(listed.ok, true, listed.error);
  const first = (listed.value as { users: User[] }).users[0]!;
  const added = await ui.request({ type: 'user.add', name: 'other-author', displayName: 'Other\r\nPerson' });
  assert.equal(added.ok, true, added.error);
  const user = (added.value as { user: User }).user;
  const db = new DatabaseSync(join(root, '.cland/hub.db'));
  try { db.prepare("update users set state='active' where id=?").run(user.id); } finally { db.close(); }
  user.state = 'active';
  const other = await dispatcherUi(t, { open: (peer, transport) => hub.dispatcher.open(peer, { ...transport, edge: 'web', user: () => user }) }, root);
  const own = await ui.request({ type: 'topic.send', topic: 'general', text: 'Own history words' });
  assert.equal(own.ok, true, own.error);
  const c = await startClient(t, bin, root);
  await waitInitialSnapshots(c);
  await c.waitScreen(s => s.includes('Own history words'), 'thread history installed before live send');
  await c.lua("local id = ...; assert(vim.wait(5000, function() return require('cland.state').S.viewer_user_id == id end), 'viewer identity read')", first.id);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const frame = ui.waitFor(f => f.type === 'message' && (f.message as TopicMessage).text === 'Other live words');
  const sent = await other.request({ type: 'topic.send', topic: 'general', text: 'Other live words' });
  assert.equal(sent.ok, true, sent.error);
  const published = (await frame).message as TopicMessage;
  assert.equal(published.userId, user.id);
  assert.equal(published.userDisplayName, user.displayName);
  await c.waitScreen(s => s.includes('Other live words') && s.includes('Other Person'), 'live other author rendered');
  const lines = await c.lua<string[]>("return vim.api.nvim_buf_get_lines(require('cland.views').topic('general').thread.buf,0,-1,false)");
  const body = lines.findIndex(line => line.includes('Other live words'));
  assert.ok(body > 0);
  assert.ok(lines[body - 1]!.includes('Other Person'));
});
