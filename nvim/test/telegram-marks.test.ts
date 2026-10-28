// T3: real Unix hub, native fake Telegram/speech and headless Neovim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { telegramMarks } from '../../hub/test/telegram-marks-fixture.ts';
import { nvimOrSkip, startClient } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';
const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false, bin = 'bin' in nvim ? nvim.bin : '';

test('native Telegram voice marks, audio, text and approval outcome render in Neovim', { skip }, async t => {
  const native = await telegramMarks(t);
  const { root } = await native.project();
  await native.prepare(root);
  const hub = await native.startHub(root, native.env);
  await native.exercise(hub);
  await t.test('actual thread and inbox rows', async child => {
    const c = await startClient(child, bin, root);
    await waitInitialSnapshots(c);
    const lines = () => c.lua<string[]>("return vim.api.nvim_buf_get_lines(require('cland.views').topic('general').thread.buf,0,-1,false)");
    await c.waitScreen(s => s.includes('Native phone text'), 'native text row');
    const text = (await lines()).join('\n');
    assert.match(text, /you.*via Telegram.*🎤/);
    assert.match(text, /🎤 not transcribed/);
    assert.match(text, /🎤 nothing recognised/);
    assert.match(text, /voice-\d+\.ogg/);
    assert.match(text, /Native voice transcript/);
    assert.match(text, /you[^\n]*via Telegram[^\n]*\nNative phone text(?:\n|$)/, 'the native text row names its own source');
    assert.equal(text.split('🎤').length - 1, 6, 'three header marks and three literal typed markers');
    assert.match(text, /\n🎤 Typed caption/);
    assert.match(text, /\n🎤 nothing recognised/);
    assert.match(text, /\n🎤 Typed phone text/);
    await c.input('<Esc> N'); await c.input('A');
    await c.waitScreen(s => s.includes('approved once') && s.includes('via Telegram'), 'native approval archive outcome');
    assert.match((await c.lua<string[]>("return vim.api.nvim_buf_get_lines(0,0,-1,false)")).join('\n'), /approved once.*via Telegram/);
  });
});
