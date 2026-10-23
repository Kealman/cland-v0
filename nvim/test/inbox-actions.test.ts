import test from 'node:test';
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eventually, tempProject } from './fixture.ts';
import { waitInitialSnapshots } from './readiness.ts';
import { localClock } from './local-clock.ts';
import { fixtureEnvironment } from '../../test-support/fixture-environment.ts';
import { nvimOrSkip, startClient, type Client } from './stub-client.ts';
const nvim = await nvimOrSkip(), skip = 'skip' in nvim ? nvim.skip : false, bin = 'bin' in nvim ? nvim.bin : '';
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));
const ts = new Date().toISOString();
const topic = (id: string) => ({ id, title: id, status: 'open', standing: false, createdAt: ts, updatedAt: ts, item: null, unread: 3 });
function control(path: string, command: Record<string, unknown>) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const socket = createConnection(path); let text = ''; socket.on('error', reject);
    socket.setTimeout(5000, () => socket.destroy(new Error('stub control did not reply within 5000 ms')));
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
  await c.input(' ?'); const help = await c.waitScreen(s => s.includes('r reply') && s.includes('d deny/decline/read') && s.includes('A seven-day archive'), 'help follows registry');
  assert.doesNotMatch(help, /D dismiss|dismiss.*notification/i);
});

test('r on a message arms its exact reply, sending archives it as answered; empty inbox keeps the archive line', { skip }, async t => {
  const root = await tempProject(t), path = join(root, 'stub.sock'), messagesTopic = topic('message-topic');
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_CONTROL: path,
    CLAND_STUB_SCENARIO_JSON: JSON.stringify({ topics: [topic('general'), topic('agents'), messagesTopic], inbox: { messages: [{ id: 'm', topic: messagesTopic, subject: messagesTopic.id, text: 'Answer me', from: 'qa', since: ts }] } }) });
  await c.waitScreen(s => s.includes('hub: connected'), 'connected'); await focus(c, 'full');
  await c.waitScreen(s => s.includes('Answer me'), 'message row before selection');
  await select(c, 'Answer me'); await c.input('r');
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
  await c.waitScreen(s => s.includes('hub: connected'), 'connected'); await focus(c, 'full');
  await c.waitScreen(s => s.includes('Give an answer'), 'free ask row before selection');
  await select(c, 'Give an answer'); await c.input('r');
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

test('Enter on a recorded Claude Code approval requests attachment of that session', { skip }, async t => {
  const root = await tempProject(t), path = join(root, 'stub.sock');
  const record = { id: 'worker-id:episode-1', sessionId: 'worker-id', session: 'worker', harness: 'claude-code',
    label: 'worker [Implementer]', role: 'implementer', kind: 'command', subject: { command: 'echo review me' },
    command: 'echo review me', choices: [], answerIn: 'tui', attach: null, state: 'pending', since: ts };
  // The stub refuses attachment instead of launching a shell. Real terminal transport is covered at T3.
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_CONTROL: path,
    CLAND_STUB_SCENARIO_JSON: JSON.stringify({ attach: {}, inbox: { approvals: [record] } }) });
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await focus(c, 'panel');
  await c.waitScreen(s => s.includes('echo review me'), 'Claude approval row');
  await select(c, 'echo review me');
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('cannot attach worker'), 'approval Enter reaches attachment boundary');
  const frames = (await control(path, { requests: true })).requests as Array<Record<string, unknown>>;
  assert.ok(frames.some(f => f.type === 'session.attach' && f.session === 'worker'));
  assert.deepEqual(await c.lua("return require('cland.qa').state().view"), { kind: 'session', id: 'worker' });
});

const approvalTime = '2026-10-22T23:00:00.000Z';
const approvalRecord = (extra: Record<string, unknown> = {}) => ({
  id: 'worker-id:relay-1', sessionId: 'worker-id', session: 'worker', harness: 'codex',
  label: 'worker [Implementer]', role: 'implementer', kind: 'command',
  subject: { command: 'echo approval', cwd: '/scratch', reason: 'Run the check' }, command: 'echo approval',
  choices: ['once', 'always', 'deny'], answerIn: 'hub', attach: null, state: 'pending', since: approvalTime, ...extra,
});
async function approvalClient(t: Parameters<typeof tempProject>[0], view: string, record = approvalRecord(), ageMs = 0) {
  const root = await tempProject(t), path = join(root, 'approval.sock');
  const c = await startClient(t, bin, root, fixtureEnvironment(root, {}, {
    CLAND_STUB_NOW: approvalTime, CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]),
    CLAND_STUB_CONTROL: path, CLAND_STUB_SCENARIO_JSON: JSON.stringify({ attach: {}, inbox: { approvals: [record] } }),
  }));
  await waitInitialSnapshots(c);
  await localClock(c, 'cland.inbox', Date.parse(approvalTime) + ageMs);
  await focus(c, view);
  const subject = record.subject as { change?: string };
  const text = String(record.command ?? subject.change);
  await eventually('exact approval row rendered and selected', async () => await c.lua<boolean>(`
    local id=...
    for i=1,vim.api.nvim_buf_line_count(0) do
      local info=require('cland.panels').row_at(vim.api.nvim_get_current_buf(),i)
      if info and info.approval and info.approval.id==id then
        vim.api.nvim_win_set_cursor(0,{i,0}); return true
      end
    end
    return false
  `, record.id) || undefined);
  await c.input('<Ignore>');
  await eventually('selected approval subject unfolds in full', async () => (await c.lua<string>(`
    local id=...; local lines={}
    for i,line in ipairs(vim.api.nvim_buf_get_lines(0,0,-1,false)) do
      local info=require('cland.panels').row_at(vim.api.nvim_get_current_buf(),i)
      if info and info.detail and info.approval and info.approval.id==id then lines[#lines+1]=line:sub(4) end
    end
    return table.concat(lines,'')
  `, record.id)).includes(text) || undefined);
  return Object.assign(c, { control: (command: Record<string, unknown>) => control(path, command) });
}
async function approvalRequests(c: Awaited<ReturnType<typeof approvalClient>>) {
  return (await c.control({ requests: true })).requests as Array<Record<string, unknown>>;
}
for (const view of ['panel', 'full']) test(`${view}: 1 approves once and folds the recorded approval to its attributed outcome`, { skip }, async t => {
  const c = await approvalClient(t, view);
  const outcome = { choice: 'once', by: 'human', via: 'neovim', at: approvalTime };
  // A scripted result is a recorded wire boundary, not an approval gate reimplementation.
  await c.control({ set: { approvalAnswer: { approval: approvalRecord({ state: 'closed', outcome }) } } });
  await c.input('1');
  await eventually('one approval answer reached the stub', async () => (await approvalRequests(c)).find(f => f.type === 'approval.answer'));
  await c.waitScreen(s => s.includes('approved once by the human') && s.includes(approvalTime), 'folded outcome and full attribution in status');
  const lines = await c.lua<string[]>("return vim.api.nvim_buf_get_lines(0,0,-1,false)");
  const folded = lines.find(l => l.includes('approved once by the human'));
  assert.ok(folded); assert.match(folded, /\d{2}:\d{2}/);
  if (view === 'full') { assert.match(folded, /neovim/); assert.ok(folded.includes(approvalTime)); }
  const frames = (await approvalRequests(c)).filter(f => f.type === 'approval.answer');
  assert.equal(frames.length, 1); assert.equal(frames[0]!.approval, 'worker-id:relay-1'); assert.equal(frames[0]!.choice, 'once');
  assert.equal(frames[0]!.note, undefined);
});
for (const view of ['panel', 'full']) test(`${view}: d opens an optional denial note and Enter sends that note`, { skip }, async t => {
  const c = await approvalClient(t, view);
  const outcome = { choice: 'deny', by: 'human', via: 'neovim', at: approvalTime, note: 'Please use the safe path' };
  await c.control({ set: { approvalAnswer: { approval: approvalRecord({ state: 'closed', outcome }) } } });
  await c.input('d');
  await c.waitScreen(s => s.includes('Denial note (optional):'), 'denial note field');
  assert.equal((await approvalRequests(c)).filter(f => f.type === 'approval.answer').length, 0, 'opening the note never answers');
  await c.input('Please use the safe path<CR>');
  await c.waitScreen(s => s.includes('denied by the human'), 'denial outcome');
  const answers = (await approvalRequests(c)).filter(f => f.type === 'approval.answer');
  assert.equal(answers.length, 1); assert.equal(answers[0]!.choice, 'deny'); assert.equal(answers[0]!.note, outcome.note);
});
for (const view of ['panel', 'full']) test(`${view}: a refused answer folds to the durable winner, including who and when`, { skip }, async t => {
  const c = await approvalClient(t, view);
  const outcome = { choice: 'always', by: 'human', via: 'web', at: approvalTime };
  const departure = { kind: 'approval', id: 'worker-id:relay-1', subject: 'worker', text: 'echo approval', since: approvalTime,
    ts: approvalTime, reason: 'answered', outcome };
  await c.control({ set: { approvalAnswer: { error: `approval already answered by human via web at ${approvalTime}` },
    inbox: { approvals: [], archive: [departure], archiveToday: 1 } } });
  await c.input('1');
  await c.waitScreen(s => s.includes('approval already answered by human via web at ' + approvalTime), 'refusal names winner');
  await c.waitScreen(s => s.includes('approved always by the human'), 'fold uses winner choice, not attempted once');
  const lines = await c.lua<string[]>("return vim.api.nvim_buf_get_lines(0,0,-1,false)");
  assert.equal(lines.filter(l => l.includes('approved always by the human')).length, 1);
  assert.ok(!lines.some(l => l.includes('approved once')));
  const frames = await approvalRequests(c);
  assert.equal(frames.filter(f => f.type === 'approval.answer').length, 1);
  assert.ok(frames.some(f => f.type === 'inbox.list' && f.archive === true), 'race resolves from durable outcome, not parsed error text');
});
for (const [view, harness] of [['panel', 'claude-code'], ['full', 'opencode']] as const) test(`${view}: TUI-only ${harness} rows refuse 1, 2 and d and keep Enter to attach`, { skip }, async t => {
  const c = await approvalClient(t, view, approvalRecord({ answerIn: 'tui', choices: [], harness }));
  for (const key of ['1', '2', 'd']) {
    await c.input('r'); await c.waitScreen(s => s.includes('in its session: ↵ attaches'), 'reply explains TUI route before the next key');
    await c.input(key);
    await c.waitScreen(s => s.includes('in its session TUI: ↵ attaches'), `${key} says where to answer`);
  }
  assert.equal((await approvalRequests(c)).filter(f => f.type === 'approval.answer').length, 0);
  await c.input('<CR>'); await c.waitScreen(s => s.includes('cannot attach worker'), 'Enter requests session attachment');
  assert.equal((await approvalRequests(c)).filter(f => f.type === 'session.attach' && f.session === 'worker').length, 1);
});

test('live approval deltas show answering, restore a failed delivery and fold another client outcome', { skip }, async t => {
  const c = await approvalClient(t, 'full');
  const outcome = { choice: 'deny', by: 'human', via: 'web', at: approvalTime };
  await c.control({ emit: { type: 'approval', approval: approvalRecord({ state: 'answering', outcome }) } });
  await c.waitScreen(s => s.includes('answering'), 'answering state');
  await c.input('1'); await c.waitScreen(s => s.includes('this approval is being answered'), 'no answer during reservation');
  assert.equal((await approvalRequests(c)).filter(f => f.type === 'approval.answer').length, 0);
  const pending = c.waitScreen(s => s.includes('1 approve once') && !s.includes('answering · waiting for delivery'), 'pending approval choices restored before retry');
  await c.control({ emit: { type: 'approval', approval: approvalRecord() } });
  await pending;
  await c.control({ set: { approvalAnswer: { error: 'adapter could not deliver' } } });
  await c.input('1'); await c.waitScreen(s => s.includes('adapter could not deliver'), 'delivery failure is visible');
  await c.control({ emit: { type: 'approval', approval: approvalRecord({ state: 'closed', outcome }) } });
  await c.waitScreen(s => s.includes('denied by the human') && s.includes('web · ' + approvalTime), 'remote winning outcome folded');
  await c.control({ emit: { type: 'inbox', inbox: { approvals: [], needsYou: 0 } } });
  await c.waitScreen(s => s.includes('denied by the human') && /needs you\s+0\b/.test(s), 'fold survives confirming departure without changing hub count');
  await c.input('1'); await c.waitScreen(s => s.includes('denied by the human via web at ' + approvalTime), 'closed choice reports outcome');
  assert.equal((await approvalRequests(c)).filter(f => f.type === 'approval.answer').length, 1);
  await select(c, 'archive ·');
  await c.waitScreen(s => s.includes('web · ' + approvalTime), 'fold stays while moving within the inbox');
  const lines = await c.lua<string[]>("return vim.api.nvim_buf_get_lines(0,0,-1,false)");
  assert.ok(lines.some(l => l.includes('denied by the human')), 'same visit retains the folded row');
});
test('file changes show their paths and change; 2 always answers only when offered', { skip }, async t => {
  const change = approvalRecord({ command: undefined, kind: 'file change', subject: { files: ['report.txt'], change: '+ reviewed content' }, choices: ['once', 'deny'] });
  const c = await approvalClient(t, 'full', change);
  await c.waitScreen(s => s.includes('report.txt') && s.includes('+ reviewed content'), 'file change subject');
  await c.input('2'); await c.waitScreen(s => s.includes('choice always is not offered'), 'unoffered wider grant refused locally');
  assert.equal((await approvalRequests(c)).filter(f => f.type === 'approval.answer').length, 0);
  const offered = { ...change, choices: ['once', 'always', 'deny'] };
  await c.control({ emit: { type: 'approval', approval: offered } });
  await c.waitScreen(s => s.includes('2 always for this command'), 'offered always choice');
  const outcome = { choice: 'always', by: 'human', via: 'neovim', at: approvalTime };
  await c.control({ set: { approvalAnswer: { approval: { ...offered, state: 'closed', outcome } } } });
  await c.input('2'); await c.waitScreen(s => s.includes('approved always by the human'), 'always outcome');
  const answers = (await approvalRequests(c)).filter(f => f.type === 'approval.answer');
  assert.equal(answers.length, 1); assert.equal(answers[0]!.choice, 'always');
});
test('answering from an unfolded detail keeps the folded outcome under the cursor', { skip }, async t => {
  const c = await approvalClient(t, 'panel');
  await c.waitScreen(s => s.includes('1 approve once'), 'unfolded approval choice');
  await select(c, '1 approve once');
  const outcome = { choice: 'once', by: 'human', via: 'neovim', at: approvalTime };
  await c.control({ set: { approvalAnswer: { approval: approvalRecord({ state: 'closed', outcome }) } } });
  await c.input('1');
  await c.waitScreen(s => s.includes('approved once by the human'), 'detail folds to outcome');
  assert.match(await c.lua<string>("return vim.api.nvim_get_current_line()"), /approved once by the human/);
});
test('denial note cancellation sends nothing, and Enter with no note still denies', { skip }, async t => {
  const c = await approvalClient(t, 'full');
  await c.input('d'); await c.waitScreen(s => s.includes('Denial note (optional):'), 'note before cancellation');
  await c.input('Cancelled draft<Esc>');
  await eventually('note prompt cancelled', async () => await c.mode() === 'n' || undefined);
  assert.equal((await approvalRequests(c)).filter(f => f.type === 'approval.answer').length, 0);
  const outcome = { choice: 'deny', by: 'human', via: 'neovim', at: approvalTime };
  await c.control({ set: { approvalAnswer: { approval: approvalRecord({ state: 'closed', outcome }) } } });
  await c.input('d'); await c.waitScreen(s => s.includes('Denial note (optional):'), 'new empty optional note');
  await c.input('<CR>'); await c.waitScreen(s => s.includes('denied by the human'), 'empty note denial');
  const answers = (await approvalRequests(c)).filter(f => f.type === 'approval.answer');
  assert.equal(answers.length, 1); assert.equal(answers[0]!.choice, 'deny'); assert.equal(answers[0]!.note, '');
});
test('an in-flight approval answer is sent once and failure permits an explicit retry', { skip }, async t => {
  const c = await approvalClient(t, 'full');
  await c.control({ set: { approvalAnswer: { hold: true } } });
  await c.input('1');
  const sent = await eventually('first approval request held', async () => (await approvalRequests(c)).find(f => f.type === 'approval.answer'));
  await c.input('2'); await c.waitScreen(s => s.includes('this approval is being answered'), 'duplicate blocked while in flight');
  assert.equal((await approvalRequests(c)).filter(f => f.type === 'approval.answer').length, 1);
  await c.control({ emit: { type: 'result', id: sent.id, ok: false, error: 'adapter could not deliver' } });
  await c.waitScreen(s => s.includes('adapter could not deliver'), 'failed request completed');
  const outcome = { choice: 'always', by: 'human', via: 'neovim', at: approvalTime };
  await c.control({ set: { approvalAnswer: { approval: approvalRecord({ state: 'closed', outcome }) } } });
  await c.input('2'); await c.waitScreen(s => s.includes('approved always by the human'), 'explicit retry completed');
  assert.deepEqual((await approvalRequests(c)).filter(f => f.type === 'approval.answer').map(f => f.choice), ['once', 'always']);
});

for (const view of ['panel', 'full']) test(`${view}: folded outcomes stay for the inbox visit and retire when it is left`, { skip }, async t => {
  const c = await approvalClient(t, view);
  const outcome = { choice: 'once', by: 'human', via: 'neovim', at: approvalTime };
  await c.control({ set: { approvalAnswer: { approval: approvalRecord({ state: 'closed', outcome }) } } });
  await c.input('1'); await c.waitScreen(s => s.includes('approved once by the human'), 'completed row');
  await select(c, 'archive ·');
  const read = () => c.lua<string[]>("return vim.api.nvim_buf_get_lines(0,0,-1,false)");
  await eventually('fold retained after cursor moves', async () => (await read()).some(l => l.includes('approved once by the human')) || undefined);
  await select(c, 'approved once by the human');
  assert.match(await c.lua<string>("return vim.api.nvim_get_current_line()"), /approved once by the human/);
  await c.input(' g'); await c.waitScreen(s => s.includes('General · to'), 'leave inbox for General');
  await c.control({ emit: { type: 'inbox', inbox: { approvals: [], needsYou: 0 } } });
  await focus(c, view);
  await c.waitScreen(s => s.includes('nothing needs you'), 'reopened inbox has authoritative departure');
  assert.ok(!(await read()).some(l => l.includes('approved once by the human')), 'previous visit outcome cannot reappear');
});

test('a held race archive reply folds its winner without replacing newer live rows or counts', { skip }, async t => {
  const c = await approvalClient(t, 'full');
  const outcome = { choice: 'always', by: 'human', via: 'web', at: approvalTime };
  const departure = { kind: 'approval', id: 'worker-id:relay-1', subject: 'worker', text: 'echo approval', since: approvalTime,
    ts: approvalTime, reason: 'answered', outcome };
  await c.control({ set: { approvalAnswer: { error: `approval already answered by human via web at ${approvalTime}` },
    holdSnapshots: ['inbox.list'], inbox: { approvals: [], archive: [departure], needsYou: 0, archiveToday: 1 } } });
  const held = c.control({ waitSnapshot: 'inbox.list' }); // Arm before triggering the read; control has its own bound.
  await c.input('1'); await held;
  const newer = approvalRecord({ id: 'second-id:relay-2', sessionId: 'second-id', session: 'second', command: 'echo newer',
    subject: { command: 'echo newer' }, state: 'answering', outcome: { choice: 'once', by: 'human', via: 'web', at: approvalTime } });
  await c.control({ emit: { type: 'approval', approval: newer } });
  await c.control({ emit: { type: 'inbox', inbox: { approvals: [newer], needsYou: 1, archiveToday: 2 } } });
  await c.waitScreen(s => s.includes('echo newer') && /needs you\s+1\b/.test(s), 'new live approval and count before releasing old reply');
  await c.control({ set: { holdSnapshots: [] }, releaseSnapshots: ['inbox.list'] });
  await c.waitScreen(s => s.includes('approved always by the human'), 'held reply consumed its exact winner');
  await c.waitScreen(s => s.includes('echo newer') && /needs you\s+1\b/.test(s), 'newer live facts survive the lookup');
  assert.deepEqual(await c.lua("local s=require('cland.state'); local r=s.S.inbox.approvals[1]; return {id=r.id,state=r.state,count=s.needs_you(),archiveToday=s.S.inbox.archiveToday}"),
    { id: 'second-id:relay-2', state: 'answering', count: 1, archiveToday: 2 });
});

test('older approval age keeps clipped panel selection anchored to the record identity', { skip }, async t => {
  const command = 'echo approval with a deliberately long command that cannot fit beside the age';
  const record = approvalRecord({ command, subject: { command } });
  const c = await approvalClient(t, 'panel', record, 2 * 60 * 60 * 1000);
  const lines = await c.lua<string[]>("return vim.api.nvim_buf_get_lines(0,0,-1,false)");
  const summary = lines.find(l => l.includes('▲ worker'))!;
  assert.match(summary, /2 h 0 m/); assert.match(summary, /…/); assert.ok(!summary.includes(command));
  const full = await c.lua<string>("return table.concat(vim.api.nvim_buf_get_lines(0,0,-1,false),'')");
  assert.ok(full.replaceAll(' ', '').includes(command.replaceAll(' ', '')), 'selected wrapped details retain the full command');
  assert.equal(await c.lua("return require('cland.panels').row_at(vim.api.nvim_get_current_buf(),vim.api.nvim_win_get_cursor(0)[1]).approval.id"), record.id);
  const outcome = { choice: 'once', by: 'human', via: 'neovim', at: approvalTime };
  await c.control({ set: { approvalAnswer: { approval: { ...record, state: 'closed', outcome } } } });
  await c.input('1'); await c.waitScreen(s => s.includes('approved once by the human'), 'clipped row answers exact record');
  const answers = (await approvalRequests(c)).filter(f => f.type === 'approval.answer');
  assert.equal(answers.length, 1); assert.equal(answers[0]!.approval, record.id);
});
