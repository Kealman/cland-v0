// T2: screen permutations consume committed protocol frames through stub-client.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import { nvimOrSkip, startClient, type Client } from './stub-client.ts';
import { waitInitialSnapshots } from './readiness.ts';
import { tempProject, eventually } from './fixture.ts';

const nvim = await nvimOrSkip();

const skip = 'skip' in nvim ? nvim.skip : false;

const bin = 'bin' in nvim ? nvim.bin : '';

async function row(c: Client, text: string) {
  await c.lua(`for i,l in ipairs(vim.api.nvim_buf_get_lines(0,0,-1,false)) do if l:find(...,1,true) then vim.api.nvim_win_set_cursor(0,{i,0}); return end end; error('no row: ' .. ...)`, text);
}

async function input(c: Client, prompt: string, value: string) {
  await c.waitScreen(s => s.includes(prompt), prompt);
  await c.input(value + '<CR>');
}

test('a refused ordinary send restores artifacts when an ask was armed while its reply was pending', { skip }, async t => {
  const root = await tempProject(t);
  const path = join(root, 'pending.md');
  await writeFile(path, '# Pending');
  const controlPath = join(root, 'stub.sock');
  const control = (cmd: Record<string, unknown>) => new Promise<Record<string, unknown>>((resolve, reject) => {
    const socket = createConnection(controlPath);
    let response = '';
    socket.setEncoding('utf8');
    socket.on('error', reject);
    socket.on('data', chunk => {
      response += chunk;
      if (response.includes('\n')) { socket.end(); resolve(JSON.parse(response.slice(0, response.indexOf('\n')))); }
    });
    socket.write(JSON.stringify(cmd) + '\n');
  });
  const question = 'Decide while sending';
  const c = await startClient(t, bin, root, {
    CLAND_HUB_TRANSPORT: 'stdio',
    CLAND_COMMAND: JSON.stringify([process.execPath, fileURLToPath(new URL('./stub-hub.ts', import.meta.url))]),
    CLAND_STUB_CONTROL: controlPath,
    CLAND_STUB_SCENARIO_JSON: JSON.stringify({send:'hold', artifacts:[{id:'A-1',title:'Pending artifact',kind:'note',path,creator:'human',creatorKind:'human',topic:'general',status:'shared'}],
      messages:{general:[{id:'ask-pending',from:'coord',fromKind:'agent',fromRole:'coordinator',to:['human'],text:question,ts:new Date().toISOString(),topic:'general',ask:{question,options:['Start','Wait'],free:true,state:'open'}}]},
      inbox:{asks:[{id:'ask-pending',question,topic:{id:'general',title:'General'},options:['Start','Wait'],from:'coord',ts:new Date().toISOString()}]}}),
  });
  await c.waitScreen(s => s.includes('hub: connected'), 'stub connected');
  await waitInitialSnapshots(c);
  await c.input('<Esc>:Cland view artifacts general<CR>');
  await c.waitScreen(s => s.includes('Pending artifact') && s.includes('Mine'), 'browser');
  await row(c, 'Pending artifact');
  await c.input('s');
  await c.waitScreen(s => s.includes('attached: A-1'), 'artifact staged');
  await c.input('Notes to send<CR>');
  await eventually('ordinary send held', async () => {
    const requests = (await control({requests:true})).requests as Array<Record<string,unknown>>;
    return requests.find(f => f.type === 'topic.send' && f.text === 'Notes to send');
  });
  await c.input('<Esc>');
  await c.lua("vim.api.nvim_set_current_win(require('cland.layout').centre())");
  await row(c, question);
  await c.input('i');
  await c.waitScreen(s => s.includes('answer to:'), 'ask armed during send');
  await control({release:{error:'send refused after ask was armed'},set:{send:'accept'}});
  await c.waitScreen(s => s.includes('not sent: send refused') && s.includes('Notes to send'), 'original text restored');
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('answered in your words') && s.includes('to: Coordinator'), 'restored text sent as answer');
  await c.input('Message with preserved artifact<CR>');
  await eventually('next ordinary frame retains attachment', async () => {
    const requests = (await control({requests:true})).requests as Array<Record<string,unknown>>;
    const frame = requests.find(f => f.type === 'topic.send' && f.text === 'Message with preserved artifact');
    if (!frame) return;
    assert.deepEqual(frame.artifacts, ['A-1']);
    return true;
  });
});
