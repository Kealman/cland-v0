import test from 'node:test';
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient, type Client } from './harness.ts';
const nvim = await nvimOrSkip(), skip = 'skip' in nvim ? nvim.skip : false, bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));
const ts = new Date().toISOString();
const topic = (id: string) => ({ id, title: id, status: 'open', standing: false, createdAt: ts, updatedAt: ts, item: null, unread: 3 });
function control(path: string, command: Record<string, unknown>) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const socket = createConnection(path); let text = ''; socket.on('error', reject);
    socket.on('data', chunk => { text += chunk; if (text.includes('\n')) { socket.end(); resolve(JSON.parse(text)); } });
    socket.write(JSON.stringify(command) + '\n');
  });
}
async function select(c: Client, text: string) {
  await c.lua("local text=...; for i,l in ipairs(vim.api.nvim_buf_get_lines(0,0,-1,false)) do local info=require('cland.panels').row_at(vim.api.nvim_get_current_buf(),i); if l:find(text,1,true) or (info and info.text and info.text:find(text,1,true)) then vim.api.nvim_win_set_cursor(0,{i,0}); return end end; error('missing '..text)", text);
  await c.input('<Ignore>');
}
async function focus(c: Client, view: string) {
  await c.input('<Esc>');
  if (view === 'full') await c.input(' N');
  else await c.lua("local layout=require('cland.layout'); if require('cland.state').S.ui.right~='inbox' then layout.right_panel('inbox') else vim.api.nvim_set_current_win(layout.win.right) end");
}
for (const view of ['panel', 'full']) test(`${view}: r replies to the selected row, d declines or reads one row, A toggles the seven-day archive`, { skip }, async t => {
  const root = await tempProject(t), path = join(root, 'stub.sock');
  const requestTopic = topic('review-topic'), messageTopic = topic('message-topic');
  const request = { id: 'request-1', topic: requestTopic, subject: 'T-1', request: 'review', from: 'impl', text: 'Review the build\nBody hidden', since: ts, ts };
  const inbox = {
    asks: [{ id: 'ask-1', topic: topic('general'), question: 'Which direction?', options: ['Go'], free: true, from: 'coord', since: ts, ts }],
    approvals: [{ id: 'cmd-1', session: 'worker', label: 'worker', command: 'touch approved', since: ts }],
    plans: [{ id: 'T-1', title: 'Pending plan', since: ts }], requests: [request],
    messages: ['First message', 'Second message'].map((text, i) => ({ id: `message-${i}`, topic: messageTopic, subject: messageTopic.id, from: 'qa', text, since: ts, ts, layer: 'now' })),
  };
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_CONTROL: path,
    CLAND_STUB_SCENARIO_JSON: JSON.stringify({ inbox, topics: [topic('general'), topic('agents'), requestTopic, messageTopic] }) });
  await c.waitScreen(s => s.includes('hub: connected'), 'connected'); await focus(c, view);
  await c.waitScreen(s => s.includes('REQUESTS TO YOU') && s.includes('archive · 0 rows left today'), 'row and hidden archive line');
  for (const [text, explanation] of [['Which direction?', 'answer this ask'], ['touch approved', 'answer this command approval in its session'], ['Pending plan', 'answer this plan approval in its plan']] as const) {
    await select(c, text); await c.input('d'); await c.waitScreen(s => s.includes(explanation), `d refuses ${text}`);
  }
  await select(c, 'touch approved'); await c.input('r'); await c.waitScreen(s => s.includes('answer this command approval in its session'), 'r approval refusal');
  await select(c, 'Review the build'); await c.input('r');
  await c.waitScreen(s => s.includes('Reply to: Review the build') && s.includes('INSERT'), 'row composer');
  assert.equal(await c.lua("return require('cland.views').topic('review-topic').composer.replying.id"), 'request-1');
  let frames = (await control(path, { requests: true })).requests as Array<Record<string, unknown>>;
  assert.equal(frames.filter(f => f.type === 'topic.read' && f.topic === 'review-topic').length, 0, 'reply drafts do not consume message rows as read');
  await c.input('Reviewed<CR>');
  await c.waitScreen(s => /needs you\s+5\b/.test(s.split('\n')[0] ?? ''), 'request reply clears row');
  await focus(c, view); await c.waitScreen(s => !s.includes('Review the build') && s.includes('archive · 1 rows left today'), 'request departed');
  // A new request is declined from its row, independently of its topic's earlier reply.
  const next = { ...inbox, requests: [{ ...request, id: 'request-2', text: 'Second review' }], archiveToday: 1,
    archive: [{ kind: 'request', id: 'request-1', subject: 'T-1', text: 'Review the build', since: ts, ts, reason: 'replied' }] };
  await control(path, { set: { inbox: next }, emit: { type: 'inbox', inbox: next } });
  await c.waitScreen(s => s.includes('Second revi'), 'new request');
  await select(c, 'Second review'); await c.input('d'); await c.waitScreen(s => !s.includes('Second review') && s.includes('archive · 2 rows left today'), 'declined');
  await select(c, 'First message'); await c.input('d');
  await c.waitScreen(s => !s.includes('First message') && s.includes('Second messa') && s.includes('archive · 3 rows left today'), 'one message read');
  await c.input('A');
  await c.waitScreen(s => s.includes('declined') && s.includes('read') && s.includes('replied'), 'archive reasons');
  const lines = (await c.lua<string[]>("return vim.api.nvim_buf_get_lines(0,0,-1,false)")).join('\n');
  assert.ok(lines.indexOf('First message') < lines.indexOf('Second review') && lines.indexOf('Second review') < lines.lastIndexOf('Review the build'), 'archive is newest first');
  assert.match(lines, /\d{4}-\d{2}-\d{2}T/); assert.doesNotMatch(lines, /Body hidden/);
  await c.input('A'); await c.waitScreen(s => !s.includes('declined') && s.includes('▸ archive'), 'archive hidden');
  await c.input('D'); // No cland action is bound to the retired key.
  assert.deepEqual(await c.lua("local out={}; for _,m in ipairs(vim.api.nvim_buf_get_keymap(0,'n')) do if m.lhs=='D' then out[#out+1]=m.lhs end end; return out"), []);
  frames = (await control(path, { requests: true })).requests as Array<Record<string, unknown>>;
  assert.ok(frames.some(f => f.type === 'topic.send' && f.topic === 'review-topic' && f.replyTo === 'request-1' && f.text === 'Reviewed'));
  assert.deepEqual(frames.filter(f => f.type === 'inbox.decline').map(f => f.request), ['request-2']);
  assert.deepEqual(frames.filter(f => f.type === 'inbox.read').map(f => f.message), ['message-0']);
  assert.ok(frames.some(f => f.type === 'inbox.list' && f.archive === true));
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
  const actions = await c.lua<Array<{ id: string; title: string; key: string }>>("local out={}; for _,a in ipairs(require('cland.actions').all()) do out[#out+1]={id=a.id,title=a.title,key=a.key} end; return out");
  const scope = view === 'panel' ? 'inbox' : 'inbox_full';
  assert.match(actions.find(a => a.id === `${scope}:r`)!.title, /Reply/);
  assert.match(actions.find(a => a.id === `${scope}:d`)!.title, /Decline.*mark message read/);
  assert.match(actions.find(a => a.id === `${scope}:A`)!.title, /seven-day/);
  assert.ok(!actions.some(a => a.id === `${scope}:D` || /dismiss.*notification/i.test(a.title)));
  assert.deepEqual(frames.filter(f => f.type === 'inbox.dismiss' || f.type === 'inbox.dismiss_all'), []);
  await c.input(' ?'); const help = await c.waitScreen(s => s.includes('r reply') && s.includes('d decline/read') && s.includes('A seven-day archive'), 'help follows registry');
  assert.doesNotMatch(help, /D dismiss|dismiss.*notification/i);
});

test('r on a message arms its exact reply, sending archives it as answered; empty inbox keeps the archive line', { skip }, async t => {
  const root = await tempProject(t), path = join(root, 'stub.sock'), messagesTopic = topic('message-topic');
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_CONTROL: path,
    CLAND_STUB_SCENARIO_JSON: JSON.stringify({ topics: [topic('general'), topic('agents'), messagesTopic], inbox: { messages: [{ id: 'm', topic: messagesTopic, subject: messagesTopic.id, text: 'Answer me', from: 'qa', since: ts }] } }) });
  await c.waitScreen(s => s.includes('hub: connected'), 'connected'); await focus(c, 'full'); await select(c, 'Answer me'); await c.input('r');
  await c.waitScreen(s => s.includes('Reply to: Answer me') && s.includes('INSERT'), 'message reply');
  await c.input('Answered<CR>'); await c.waitScreen(s => /needs you\s+0\b/.test(s.split('\n')[0] ?? ''), 'answered');
  await focus(c, 'full'); await c.waitScreen(s => s.includes('nothing needs you') && s.includes('▸ archive · 1 rows left today'), 'empty archive line');
  await c.input('A'); await c.waitScreen(s => s.includes('answered') && s.includes('Answer me'), 'answered departure');
  const frames = (await control(path, { requests: true })).requests as Array<Record<string, unknown>>;
  assert.ok(frames.some(f => f.type === 'topic.send' && f.replyTo === 'm' && f.topic === 'message-topic'));
  assert.equal(frames.filter(f => f.type === 'topic.read' && f.topic === 'message-topic').length, 0);
});

test('r gives a free ask answer and failed row replies retain their draft and target', { skip }, async t => {
  const root = await tempProject(t), path = join(root, 'stub.sock'), replyTopic = topic('reply-topic');
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_CONTROL: path,
    CLAND_STUB_SCENARIO_JSON: JSON.stringify({ topics: [topic('general'), topic('agents'), replyTopic], inbox: {
      asks: [{ id: 'ask', topic: replyTopic, question: 'Give an answer', options: [], free: true, from: 'coord', since: ts, ts }],
      messages: [{ id: 'message', topic: replyTopic, subject: replyTopic.id, text: 'Reply draft', from: 'qa', since: ts, layer: 'now' }],
    } }) });
  await c.waitScreen(s => s.includes('hub: connected'), 'connected'); await focus(c, 'full'); await select(c, 'Give an answer'); await c.input('r');
  await c.waitScreen(s => s.includes('Your answer to: Give an answer') && s.includes('INSERT'), 'free ask answer');
  await c.input('Free answer<CR>'); await c.waitScreen(s => /needs you\s+1\b/.test(s.split('\n')[0] ?? ''), 'ask answered');
  await focus(c, 'full'); await select(c, 'Reply draft'); await c.input('r');
  await c.waitScreen(s => s.includes('Reply to: Reply draft') && s.includes('INSERT'), 'message reply');
  await control(path, { set: { send: 'refuse' } }); await c.input('Saved draft<CR>');
  await c.waitScreen(s => s.includes('not sent:') && s.includes('Saved draft'), 'failed reply restored');
  assert.deepEqual(await c.lua("local c=require('cland.views').topic('reply-topic').composer; return {text=c:text(),id=c.replying.id}"), { text: 'Saved draft', id: 'message' });
  assert.equal(await c.lua("return require('cland.state').needs_you()"), 1);
  await control(path, { set: { send: 'ok' } }); await c.input('<Esc>A<CR>');
  await c.waitScreen(s => /needs you\s+0\b/.test(s.split('\n')[0] ?? ''), 'retry sent');
  const frames = (await control(path, { requests: true })).requests as Array<Record<string, unknown>>;
  assert.ok(frames.some(f => f.type === 'topic.answer' && f.ask === 'ask' && f.text === 'Free answer'));
  assert.deepEqual(frames.filter(f => f.type === 'topic.send').map(f => [f.replyTo, f.text]), [['message', 'Saved draft'], ['message', 'Saved draft']]);
});
