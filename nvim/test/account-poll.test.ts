// The workbench opens the real sessions panel; its normal hub client sends the frame.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eventually, tempProject } from './fixture.ts';
import { nvimOrSkip, startClient } from './stub-client.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
const stub = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));

test('sessions-panel openings send account.poll once; redraws and closing do not', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.git'), { recursive: true });
  const path = join(root, 'control.sock');
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, stub]), CLAND_STUB_CONTROL: path });
  const requests = () => new Promise<Array<{ type: string }>>((resolve, reject) => {
    const socket = createConnection(path);
    let text = '';
    socket.setEncoding('utf8');
    socket.on('error', reject);
    socket.on('data', data => { text += data; if (text.includes('\n')) { socket.end(); resolve(JSON.parse(text.slice(0, text.indexOf('\n'))).requests); } });
    socket.write('{"requests": true}\n');
  });
  const count = async () => (await requests()).filter(r => r.type === 'account.poll').length;
  await c.waitScreen(s => s.includes('hub: connected') && s.includes('SESSIONS'), 'initial sessions opening');
  await eventually('initial poll request', async () => (await count()) === 1 || undefined);
  await c.lua("require('cland.layout').render(); require('cland').refresh_sessions()");
  await c.lua("require('cland.layout').render()");
  assert.equal(await count(), 1);
  await c.input('<Esc><Space>s');
  await c.waitScreen(s => !s.includes('SESSIONS'), 'sessions hidden');
  assert.equal(await count(), 1);
  await c.input('<Space>s');
  await c.waitScreen(s => s.includes('SESSIONS'), 'sessions reopened');
  await eventually('second opening poll request', async () => (await count()) === 2 || undefined);
  await c.input('<Space>t');
  await c.waitScreen(s => s.includes('TOPICS') && !s.includes('SESSIONS'), 'topics replace sessions');
  assert.equal(await count(), 2);
  await c.input('<Space>s');
  await c.waitScreen(s => s.includes('SESSIONS'), 'sessions replace topics');
  await eventually('third opening poll request', async () => (await count()) === 3 || undefined);
});
