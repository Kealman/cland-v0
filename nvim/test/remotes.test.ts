// T3: real headless Neovim, Unix frames and production Telegram against the loopback fake.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { telegramLivenessFixture } from '../../hub/test/telegram-liveness-fixture.ts';
import { Store } from '../../hub/src/hub/store.ts';
import { control, pairing } from '../../hub/test/telegram-polling-fixture.ts';
import { within } from '../../hub/src/executor/droplet/deadline.ts';
import { nvimOrSkip, startClient } from './harness.ts';
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
