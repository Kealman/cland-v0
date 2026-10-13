import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { clandWithEnv, startDaemon, tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';

test('sessions header follows crew CLI and hand edits, retaining the last good summary on refusal and refresh', { skip }, async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const c = await startClient(t, bin, root);
  await waitInitialSnapshots(c);
  await c.input('<Space>s');
  await c.lua("vim.api.nvim_win_set_width(require('cland.layout').win.right, 80)");
  await c.waitScreen(s => s.includes('rev pool 1'), 'initial crew in the sessions header');
  const set = await clandWithEnv(root, {}, 'crew', 'set', 'reviewer.size', '2');
  assert.equal(set.code, 0, set.stderr);
  await c.waitScreen(s => s.includes('rev pool 2'), 'crew set updates the header');
  const path = join(root, '.cland/crew.toml');
  const good = await readFile(path, 'utf8');
  await writeFile(path, good.replace('leads = []', 'leads = ["epic"]'));
  await c.waitScreen(s => s.includes('rev pool 2') && s.includes('leads: epic'), 'hand edit updates the header');
  await writeFile(path, '[crew.reviewer]\nsize = 0\n');
  // The refusal must arrive before checking retention, rather than checking before the poll can run.
  const until = Date.now() + 5000;
  let log = '';
  while (Date.now() < until) {
    log = await readFile(join(root, '.cland/log/hub.log'), 'utf8');
    if (log.includes('crew-refused')) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.match(log, /crew-refused/);
  await c.lua("require('cland').refresh_sessions()");
  await c.waitScreen(s => s.includes('rev pool 2') && s.includes('leads: epic'), 'last good summary survives a status refresh');
  await writeFile(path, good);
  await c.waitScreen(s => s.includes('rev pool 2') && s.includes('leads: none'), 'valid file restores the summary');
});
