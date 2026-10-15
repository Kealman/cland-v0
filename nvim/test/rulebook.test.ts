import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { cland, connectUi, readDiscovery, tempProject } from '../../hub/test/harness.ts';
import type { Rule } from '../../hub/src/rules/rulebook.ts';
import { nvimOrSkip, startClient } from './harness.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
const source = '# Project rules\n\n## 1 Older rule\nScope: all\nDate: 2026-10-14\nStatus: retired 2026-10-15\nOrigin: memory:/planning/rules.md\nReason: replaced\n\nOld text.\n\n## 2 Serial suites\nScope: implementer\nDate: 2026-10-15\nStatus: active\nOrigin: shell\nReason: avoid contention\n\nRun only one suite.\n';

test('Rulebook keys and palette show sorted rule rows, unfold origins and list help', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/RULES.md'), source);
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio' });
  await c.input('<Esc> R');
  const screen = await c.waitScreen(s => s.includes('rule 2') && s.includes('rule 1'), 'rule rows', 2000);
  assert.match(screen, /rule 2.*Serial suites.*implementer.*active.*2026-10-15/);
  assert.ok(screen.indexOf('rule 2') < screen.indexOf('rule 1'));
  assert.equal(await c.lua("local ns=vim.api.nvim_get_namespaces()['cland.rulebook']; for _,m in ipairs(vim.api.nvim_buf_get_extmarks(0,ns,0,-1,{details=true})) do if m[2]==2 and m[4].hl_group=='ClandRuleRetired' then return true end end; return false"), true);
  await c.input('j<CR>');
  await c.waitScreen(s => s.includes('Run only one suite.') && s.includes('avoid contention') && s.includes('Origin: shell'), 'unfolded rule');
  await c.input('gt');
  await c.waitScreen(s => s.includes('origin is not a thread'), 'non-thread origin notice');
  await c.input('<CR>');
  await c.waitScreen(s => !s.includes('Run only one suite.'), 'folded rule');
  await c.input('G<CR>');
  await c.waitScreen(s => s.includes('Origin: /planning/rules.md') && s.includes('Old text.'), 'memory origin');
  await c.input('q');
  await c.input(' p');
  await c.waitScreen(s => s.includes('palette ›'), 'palette');
  await c.input('Rulebook');
  await c.waitScreen(s => s.includes('Rulebook') && s.includes('␣R'), 'Rulebook action');
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('rule 2') && !s.includes('palette ›'), 'palette opens Rulebook');
  await c.input(' ?');
  await c.waitScreen(s => s.includes('␣R') && s.includes('Rulebook'), 'key help');
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
});

test('workbench drafts add and edit rules, retain refused text, retire, and follow shell changes live', { skip }, async t => {
  const root = await tempProject(t);
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio' });
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await c.input('<Esc> Ra');
  await c.waitScreen(s => s.includes('Text:') && s.includes('Scope: all') && s.includes('Reason:'), 'new rule draft');
  await c.input('gg0f:a Run serially.<Esc>jjAavoid contention<Esc>:w<CR>');
  await c.waitScreen(s => s.includes('rule 1') && s.includes('Run serially.') && !s.includes('Text:'), 'new row selected');
  const list = async () => {
    const result = await cland(root, 'rule', 'list', '--all', '--json');
    assert.equal(result.code, 0, result.stderr);
    return JSON.parse(result.stdout).rules as Rule[];
  };
  assert.deepEqual((await list()).map(r => [r.text, r.scope, r.reason, r.origin]), [['Run serially.', 'all', 'avoid contention', 'workbench']]);
  await c.input('e');
  await c.waitScreen(s => s.includes('Text: Run serially.'), 'edit populated');
  await c.input('j0f:lDaimpossible<Esc>:w<CR>');
  await c.waitScreen(s => s.includes('unknown role impossible') && s.includes('Scope:impossible') && s.includes('Text: Run serially.'), 'hub refusal keeps draft');
  await c.input('q');
  await c.waitScreen(s => s.includes('rule 1') && !s.includes('Text:'), 'leave draft');
  await c.input('e');
  await c.waitScreen(s => s.includes('Scope:impossible') && s.includes('Text: Run serially.'), 'draft survives navigation');
  await c.input('ggj0f:lDaall<Esc>ggA Every time.<Esc>:w<CR>');
  await c.waitScreen(s => s.includes('rule 1') && !s.includes('Text:'), 'edit saved');
  assert.equal((await list())[0]?.text, 'Run serially. Every time.');
  await c.input('X');
  await c.waitScreen(s => s.includes('Retire rule 1'), 'retire reason prompt');
  await c.input('superseded<CR>');
  await c.waitScreen(s => s.includes('rule 1') && s.includes('retired'), 'retired row');
  assert.equal((await list())[0]?.status, 'retired');
  const added = await cland(root, 'rule', 'add', 'Shell update.', '--scope', 'implementer', '--reason', 'live push');
  assert.equal(added.code, 0, added.stderr);
  await c.waitScreen(s => s.includes('rule 2') && s.includes('Shell update.'), 'shell rule pushed with no key');
  assert.match(await c.lua<string>('return vim.api.nvim_get_current_line()'), /rule 1/);
  const path = join(root, '.cland/RULES.md');
  const good = await readFile(path, 'utf8');
  await writeFile(path, good.replaceAll('Shell update.\n', 'Hand edit update.\n'));
  await c.waitScreen(s => s.includes('Hand edit update.'), 'hand edit reloaded');
  await c.input('ggje');
  await c.waitScreen(s => s.includes('Text: Hand edit update.'), 'edit shell rule');
  await c.input('ggA Updated.<Esc>:w<CR>');
  await c.waitScreen(s => s.includes('rule 2') && !s.includes('Text:'), 'shell rule edited');
  assert.equal((await list()).find(r => r.number === 2)?.origin, 'workbench');
});


test('thread origins show topic and message time, and gt reaches an older human message', { skip }, async t => {
  const root = await tempProject(t);
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio' });
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await c.input('<Esc> R');
  const ui = await connectUi(t, await readDiscovery(root));
  const topic = await ui.request({ type: 'topic.create', title: 'Suite policy' });
  assert.equal(topic.ok, true, topic.error);
  const id = (topic.value as { topic: { id: string } }).topic.id;
  const sent = await ui.request({ type: 'topic.send', topic: id, text: 'Run one suite at a time, please.' });
  assert.equal(sent.ok, true, sent.error);
  const message = (sent.value as { message: { id: string; ts: string } }).message;
  // A valid hand-recorded message origin exercises T-458 without requiring session tools (T-456).
  await writeFile(join(root, '.cland/RULES.md'), `# Project rules\n\n## 1 Serial suites\nScope: implementer\nDate: 2026-10-15\nStatus: active\nOrigin: message:${id}/${message.id}\nReason: contention\n\nRun one suite.\n`);
  for (let i = 0; i < 205; i++) {
    const next = await ui.request({ type: 'topic.send', topic: id, text: `Later message ${i}` });
    assert.equal(next.ok, true, next.error);
  }
  await c.waitScreen(s => s.includes('rule 1') && s.includes('Serial suites'), 'message rule pushed');
  await c.input('j<CR>');
  await c.waitScreen(s => s.includes('Origin: Suite policy') && s.includes(message.ts) && s.includes('Reason: contention'), 'resolved origin');
  await c.input('gt');
  await c.waitScreen(s => s.includes('Run one suite at a time, please.') && !s.includes('Rulebook ·'), 'origin human message');
  assert.equal(await c.lua('return vim.b.cland_topic'), id);
});


test('a push during the initial snapshot stays current, and Enter on a rule event selects that rule', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.git'));
  const controlPath = join(root, 'control.sock');
  const rule: Rule = { number: 1, title: 'Snapshot rule', text: 'Initial text.', scope: 'all', date: '2026-10-15', status: 'active', origin: 'session:helper', reason: 'initial' };
  const live: Rule = { ...rule, number: 2, title: 'Live rule', text: 'Current text.' };
  const event = { id: 'rule-event', ts: new Date().toISOString(), kind: 'rule', glyph: '§', subject: { kind: 'rule', id: '2' }, text: 'rule 2 changed' };
  const c = await startClient(t, bin, root, { CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, fileURLToPath(new URL('./stub-hub.ts', import.meta.url))]), CLAND_STUB_CONTROL: controlPath, CLAND_STUB_SCENARIO_JSON: JSON.stringify({ holdSnapshots: ['rule.list'], rules: [rule], events: [event] }) });
  const control = (command: Record<string, unknown>) => new Promise<void>((resolve, reject) => {
    const socket = createConnection(controlPath); let text = '';
    socket.setEncoding('utf8'); socket.on('error', reject);
    socket.on('data', data => { text += data; if (text.includes('\n')) { socket.end(); resolve(); } });
    socket.write(`${JSON.stringify(command)}\n`);
  });
  await c.waitScreen(s => s.includes('hub: connected'), 'stub connected');
  await control({ waitSnapshot: 'rule.list' });
  await control({ emit: { type: 'rules.changed', rules: [rule, live] } });
  await c.input('<Esc> R');
  await c.waitScreen(s => s.includes('Live rule'), 'live push before snapshot');
  await control({ releaseSnapshots: ['rule.list'] });
  await c.lua("assert(vim.wait(2000,function() for j in pairs(require('cland').client.snapshots) do if j.request.type=='rule.list' then return false end end; return true end))");
  await c.waitScreen(s => s.includes('Live rule') && s.includes('Snapshot rule'), 'live state survives older snapshot');
  await c.input(' E');
  await c.waitScreen(s => s.includes('rule 2 changed'), 'rule event');
  await c.input('ggjjj<CR>');
  await c.waitScreen(s => s.includes('Rulebook ·') && s.includes('Live rule'), 'event opens Rulebook');
  assert.match(await c.lua<string>('return vim.api.nvim_get_current_line()'), /rule 2/);
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('Origin: helper'), 'Aide origin name');
});
