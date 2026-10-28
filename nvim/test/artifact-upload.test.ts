// T3: frame upload through one projectHub and one real headless Neovim;
// the system-viewer boundary is a scratch-owned stub, with no GUI process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, eventually, projectHub, tempProject } from '../../hub/test/harness.ts';
import type { Artifact } from '../../hub/src/protocol.ts';
import { nvimOrSkip, startClient } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';

test('uploaded PNG and extensionless JPEG open once in the viewer while a note opens in a buffer', { skip }, async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root);
  const ui = await connectUi(t, hub.discovery);
  const uploaded = await ui.request({ type: 'artifact.upload', topic: 'general', files: [
    { name: 'picture', mime: 'image/png', data: Buffer.from('synthetic PNG').toString('base64') },
    { name: 'photograph', mime: 'image/jpeg', data: Buffer.from('synthetic JPEG').toString('base64') },
  ] });
  assert.equal(uploaded.ok, true, uploaded.error);
  const images = (uploaded.value as { artifacts: Artifact[] }).artifacts;
  assert.equal(images.length, 2);
  assert.match(images[0]!.path, /\.png$/);
  assert.match(images[1]!.path, /\.jpg$/);
  const created = await ui.request({ type: 'artifact.create', kind: 'note', title: 'Buffer control', topic: 'general', content: '# Note stays inside Neovim' });
  assert.equal(created.ok, true, created.error);
  const note = (created.value as { artifact: Artifact }).artifact;
  const opened = join(root, 'viewer-receipts');
  const opener = join(root, 'viewer-stub');
  await writeFile(opener, '#!/bin/sh\nprintf "%s\\n" "$#" "$1" >> "$CLAND_TEST_OPENED"\n', { mode: 0o755 });
  const c = await startClient(t, bin, root, { CLAND_OPENER: opener, CLAND_TEST_OPENED: opened });
  await waitInitialSnapshots(c);
  await c.input('<Esc>:Cland view artifacts general<CR>zR');
  await c.waitScreen(s => s.includes('ARTIFACTS') && images.every(a => s.includes(a.id)) && s.includes(note.id), 'uploaded artifacts installed in list');
  const select = async (a: Artifact) => {
    await c.lua(`local id=...; for i,l in ipairs(vim.api.nvim_buf_get_lines(0,0,-1,false)) do
      if l:find(id .. ' ',1,true) then vim.api.nvim_win_set_cursor(0,{i,0}); return end
    end; error('missing artifact row ' .. id)`, a.id);
    await c.input('<CR>');
  };
  for (const [i, image] of images.entries()) {
    await select(image);
    await eventually('viewer received exact uploaded path', async () => {
      const lines = (await readFile(opened, 'utf8').catch(() => '')).trimEnd().split('\n');
      return lines.length === (i + 1) * 2 && lines.at(-1) === image.path || undefined;
    });
  }
  await select(note);
  await c.waitScreen(s => s.includes('Note stays inside Neovim') && !s.includes('# Note stays'), 'note rendered in a buffer');
  assert.equal(await c.lua('return vim.b.cland_artifact'), note.id);
  assert.deepEqual((await readFile(opened, 'utf8')).trimEnd().split('\n'), ['1', images[0]!.path, '1', images[1]!.path]);
});
