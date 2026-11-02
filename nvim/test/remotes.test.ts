// T3: real headless Neovim, Unix frames and production Telegram against the loopback fake.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { telegramLivenessFixture } from '../../hub/test/telegram-liveness-fixture.ts';
import { Store } from '../../hub/src/hub/store.ts';
import { control, pairing } from '../../hub/test/telegram-polling-fixture.ts';
import { within } from '../../hub/src/executor/droplet/deadline.ts';
import { nvimOrSkip, startClient } from './harness.ts';
import { until } from '../../hub/test/until.ts';
import { waitInitialSnapshots } from './readiness.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false, bin = 'bin' in nvim ? nvim.bin : '';

test('native fake outage turns the sessions Remotes row red within one second and recovery clears it', { skip }, async t => {
  const f = await telegramLivenessFixture(t);
  const seed = new Store(join(f.root, '.cland/hub.db'));
  try { seed.remotes.forMessenger('telegram').setPairing(pairing); seed.remotes.forMessenger('telegram').set('mute', 'true'); }
  finally { seed.close(); }
  const polled = f.fake.waitForPoll();
  await f.start();
  const poll = await within(polled, 1_000);
  // The child scope tears down Neovim before its shared hub/fake/root.
  await t.test('rendered native transition receipts', async child => {
    const c = await startClient(child, bin, f.root, {}, { screenPollMs: 10 });
    await waitInitialSnapshots(c);
    await c.lua("vim.api.nvim_win_set_width(require('cland.layout').win.right, 115)");
    await c.waitScreen(s => s.includes('telegram · connected · paired Fixture human · muted · outbox 0'), 'connected remote facts', 1_000);
    const marks = () => c.lua<Array<{ text: string; group: string }>>(`local b=require('cland.panels').bufs.sessions;local out={};local ls=vim.api.nvim_buf_get_lines(b,0,-1,false)
      for _,m in ipairs(vim.api.nvim_buf_get_extmarks(b,vim.api.nvim_create_namespace('cland.panels'),0,-1,{details=true})) do
      out[#out+1]={text=ls[m[2]+1]:sub(m[3]+1,m[4].end_col),group=m[4].hl_group} end;return out`);
    assert.ok((await marks()).some(m => m.text.includes('telegram') && m.group === 'ClandDim'));
    // Arm the actual rendered-row observer before failing the held native poll.
    const offline = c.waitScreen(s => s.includes('offline since') && s.includes('fake outage'), 'offline row', 1_000);
    void offline.catch(() => {});
    await control(f.fake.url, 'fault', { method: 'getUpdates', code: 500, description: 'fake outage' });
    const closed = f.fake.waitForPollClose(poll.id);
    await control(f.fake.url, 'release-polls', {});
    await within(closed, 1_000);
    await f.waitRetry(1);
    await offline;
    assert.ok((await marks()).some(m => m.text.includes('fake outage') && m.group === 'ClandRed'));
    const healthy = c.waitScreen(s => s.includes('telegram · connected · paired Fixture human · muted · outbox 0'), 'recovered row', 1_000);
    void healthy.catch(() => {});
    await f.clock.advance(1_000);
    await healthy;
    assert.ok((await marks()).some(m => m.text.includes('telegram') && m.group === 'ClandDim'));
  });
});

test('native Discord outage, recovery, pairing, voice and approval render in Neovim', { skip }, async t => {
  const { discordWorkbench } = await import('../../hub/test/discord-workbench-fixture.ts');
  const native = await discordWorkbench(t);
  const { root } = await native.project();
  await native.prepare(root);
  await native.startHub(root, native.env);
  await native.ready();
  await t.test('native Discord rendered receipts', async child => {
    const c = await startClient(child, bin, root, {}, { screenPollMs: 10 });
    await waitInitialSnapshots(c);
    await c.lua("vim.api.nvim_win_set_width(require('cland.layout').win.right, 115)");
    await c.waitScreen(s => s.includes('discord · connected'), 'Discord connected');
    const marks = () => c.lua<Array<{ text: string; group: string }>>(`local b=require('cland.panels').bufs.sessions;local out={};local ls=vim.api.nvim_buf_get_lines(b,0,-1,false)
      for _,m in ipairs(vim.api.nvim_buf_get_extmarks(b,vim.api.nvim_create_namespace('cland.panels'),0,-1,{details=true})) do
      out[#out+1]={text=ls[m[2]+1]:sub(m[3]+1,m[4].end_col),group=m[4].hl_group} end;return out`);
    const offline = c.waitScreen(s => s.includes('discord') && s.includes('offline since'), 'Discord offline within one second', 1000);
    void offline.catch(() => {});
    await native.fake.control('close', { code: 4000 });
    await offline;
    assert.ok((await marks()).some(m => m.text.includes('discord') && m.group === 'ClandRed'));
    const recovered = c.waitScreen(s => s.includes('discord · connected'), 'Discord recovered', 1000);
    void recovered.catch(() => {});
    await native.clock.advance(1);
    await until(async () => (await native.fake.control('state')).gateway.resumes === 1, { what: 'native resume', timeoutMs: 2000 });
    await native.fake.control('dispatch', { op: 1, d: null });
    await recovered;
    assert.ok((await marks()).some(m => m.text.includes('discord') && m.group === 'ClandDim'));
    const { pairing } = await native.exercise();
    await c.waitScreen(s => s.includes('Native Discord text'), 'native text row');
    const text = (await c.lua<string[]>("return vim.api.nvim_buf_get_lines(require('cland.views').topic('general').thread.buf,0,-1,false)")).join('\n');
    assert.match(text, /you[^\n]*via Discord[^\n]*\nNative Discord text/);
    assert.match(text, /via Discord.*🎤 not transcribed/);
    assert.match(text, /recording.ogg/);
    await c.input('<Esc> N');
    await c.waitScreen(s => s.includes('Pair Discord'), 'native pairing row');
    // The rail can clip the code beside the wide Sessions pane. Open its card.
    await c.input('/Pair Discord<CR><Esc><CR>');
    await c.waitScreen(s => s.includes(pairing.code), 'native pair code');
    assert.match((await c.lua<string[]>("return vim.api.nvim_buf_get_lines(0,0,-1,false)")).join('\n'), /Discord/);
    await c.input('qA');
    await c.waitScreen(s => s.includes('approved once') && s.includes('via Discord'), 'native approval outcome');
    assert.match((await c.lua<string[]>("return vim.api.nvim_buf_get_lines(0,0,-1,false)")).join('\n'), /approved once.*via Discord/);
  });
});

test('pairing card chooses a users-mode owner with native key presses', { skip }, async t => {
  const { tempProject, projectHub, connectUi } = await import('../../hub/test/harness.ts');
  const { defaultConfig, renderConfig } = await import('../../hub/src/init/config.ts');
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { testMessenger } = await import('../../hub/test/fakes/messenger.ts');
  const { DatabaseSync } = await import('node:sqlite');
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Pairing chooser'); config.auth.mode = 'users'; config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const seed = new Store(join(root, '.cland/hub.db'));
  seed.users.firstAdmin('Alice', [], Date.now()); seed.users.setMode('users', Date.now()); seed.close();
  const db = new DatabaseSync(join(root, '.cland/hub.db')); t.after(() => db.close());
  db.prepare('insert into users values (?,?,?,?,?,?)').run('bob-id', 'bob', 'Bob', 'admin', 'active', Date.now());
  const remote = testMessenger('telegram');
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [remote] });
  remote.pair({ userId: '202', chatId: '202', guildId: null, name: 'Native Bob' });
  const local = await connectUi(t, hub.discovery, 'nvim');
  const inbox = (await local.request({ type: 'inbox.list' })).value as import('../../hub/src/protocol.ts').Inbox;
  await t.test('rendered chooser and persisted chosen owner', async child => {
    const c = await startClient(child, bin, root);
    await waitInitialSnapshots(c);
    await c.input('<Esc>');
    await c.lua("require('cland.pairing_card').open(...)", inbox.pairings![0]);
    await c.waitScreen(s => s.includes('Native Bob') && s.includes('1 approve pairing'), 'pairing card');
    await c.input('1');
    await c.waitScreen(s => s.includes('Pair with user') && s.includes('Bob (bob)'), 'user chooser');
    await c.input('2<CR>');
    await until(() => db.prepare('select user_id from user_remote_pairings where messenger=?').get('telegram')?.user_id === 'bob-id', { what: 'durable Neovim pairing approval', timeoutMs: 3000 });
    assert.equal(db.prepare('select messenger_user_id from user_remote_pairings where user_id=?').get('bob-id')!.messenger_user_id, '202');
  });
});
