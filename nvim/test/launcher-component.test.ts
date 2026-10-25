// T2: real launcher UI against the recorded stub protocol; no harness subprocesses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eventually } from './fixture.ts';
import { skip, startShell, requestsOf, onSessionRow, proc, statusLine, waitHeldSnapshot, type Shell } from './shell-fixture.ts';
import { centreOf } from './stub-client.ts';
import { failedOrEmptyModelAnswers } from './launcher-model-fixture.ts';

test('a role selected before role.list arrives fills launcher defaults when the reply lands', { skip }, async t => {
  const c = await startShell(t, s => { s.holdSnapshots = ['role.list']; }, {}, false);
  await waitHeldSnapshot(c, 'role.list');
  await c.input('<Esc><Space>l');
  await c.waitScreen(s => s.includes('launch a session'), 'launcher before role snapshot');
  await c.input('early-reviewer<Tab>reviewer<Tab>');
  await c.waitScreen(s => /role +reviewer/.test(s), 'role selected while defaults are pending');
  await c.control({ releaseSnapshots: ['role.list'] });
  const screen = await c.waitScreen(s => /harness +codex/.test(s) && /model +gpt-6\.1-sol/.test(s) && /effort +high/.test(s), 'defaults after delayed role reply');
  assert.doesNotMatch(screen, /unknown role/);
  assert.equal(await c.mode(), 'i');
  await c.input('<CR>');
  await c.waitScreen(s => !s.includes('launch a session') && s.includes('early-reviewer [Reviewer]'), 'launched early role selection');
  const [frame] = await requestsOf(c, 'session.launch');
  assert.equal(frame?.role, 'reviewer');
  assert.equal(frame?.harness, 'codex');
  assert.equal(frame?.model, 'gpt-6.1-sol');
  assert.equal(frame?.effort, 'high');
});

for (const harness of ['codex', 'opencode']) {
  test(`late role defaults preserve typed ${harness}, model and effort`, { skip }, async t => {
    const c = await startShell(t, s => { s.holdSnapshots = ['role.list']; }, {}, false);
    await waitHeldSnapshot(c, 'role.list');
    await c.input('<Esc><Space>l');
    await c.waitScreen(s => s.includes('launch a session'), 'launcher before role snapshot');
    await c.input(`typed-role<Tab>Reviewer<Tab>${harness}<Tab>custom-model<Tab><Tab>custom-effort`);
    await c.waitScreen(s => /effort +custom-effort/.test(s) && /unknown role/.test(s), 'typed fields before defaults');
    await c.control({ releaseSnapshots: ['role.list'] });
    const screen = await c.waitScreen(s => s.includes('launch a session') && !s.includes('unknown role'), 'role resolved without another key');
    assert.match(screen, new RegExp(`harness +${harness}`));
    assert.match(screen, /model +custom-model/);
    assert.match(screen, /effort +custom-effort/);
    await c.input('<CR>');
    await c.waitScreen(s => !s.includes('launch a session') && s.includes('typed-role [Reviewer]'), 'typed defaults launch');
    const [frame] = await requestsOf(c, 'session.launch');
    assert.equal(frame?.harness, harness);
    assert.equal(frame?.model, 'custom-model');
    assert.equal(frame?.effort, 'custom-effort');
    assert.equal(frame?.role, 'reviewer');
  });
}

const aide = proc('aide-1', 'aide', 'idle');
// Only shell builtins: keep the stub attachment alive and report its inherited environment.
const aideAttach = `printf 'open-session=%s\\n' "${'${CLAND_OPEN_SESSION-unset}'}"; read -r line`;

test('CLAND_OPEN_SESSION opens the first listed session in the centre in Terminal mode and is absent from its environment', { skip }, async t => {
  const c = await startShell(t, s => {
    s.processes!.push(aide);
    s.attach = { ...s.attach, 'aide-1': aideAttach };
    s.holdSnapshots = ['session.list'];
  }, { CLAND_OPEN_SESSION: 'aide-1' }, false);
  await c.control({ waitSnapshot: 'session.list' });
  await c.control({ releaseSnapshots: ['session.list'] });
  const screen = await c.waitScreen(s => centreOf(s).includes('open-session=unset') && statusLine(s).includes('TERMINAL  aide-1'), 'the requested Aide terminal without the hand-over variable');
  assert.match(centreOf(screen), /open-session=unset/);
  assert.equal(await c.mode(), 't');
  assert.equal(await c.lua('return vim.env.CLAND_OPEN_SESSION == nil'), true);
  assert.equal((await requestsOf(c, 'session.attach'))[0]?.session, 'aide-1');
});

test('CLAND_OPEN_SESSION waits quietly for a later session list and opens only once across further updates', { skip }, async t => {
  const c = await startShell(t, s => {
    s.attach = { ...s.attach, 'aide-1': aideAttach };
  }, { CLAND_OPEN_SESSION: 'aide-1' });
  assert.equal((await requestsOf(c, 'session.attach')).length, 0, 'an unknown name does not attach');
  assert.doesNotMatch((await c.screen()).join('\n'), /cannot attach|refused|CLAND_OPEN_SESSION|Press ENTER/);
  await c.control({ set: { processes: [aide] } });
  await c.lua("require('cland').refresh_sessions()");
  await c.waitScreen(s => centreOf(s).includes('open-session=unset') && statusLine(s).includes('TERMINAL  aide-1'), 'the Aide after it appears in a later list');
  await c.input('<C-\\><C-n><Space>g');
  await c.waitScreen(s => s.includes('Starting T-12') && statusLine(s).includes('General'), 'General after leaving the terminal');
  await c.control({ emit: { type: 'session.process', process: { ...aide, state: 'busy' } } });
  await c.lua("require('cland').refresh_sessions(); assert(vim.wait(5000, function() return next(require('cland').client.snapshots) == nil end))");
  await launcherBarrier(c);
  assert.equal(await c.lua("return require('cland.state').S.ui.view.kind"), 'thread');
  assert.equal(await c.lua("return require('cland.state').S.ui.view.id"), 'general');
  assert.equal((await requestsOf(c, 'session.attach')).length, 1, 'later lists and process events do not reopen the terminal');
});

test('a saved restart view wins over CLAND_OPEN_SESSION and still consumes it', { skip }, async t => {
  const c = await startShell(t, s => {
    s.processes!.push(aide);
    s.attach = { ...s.attach, 'aide-1': aideAttach };
  });
  // Exercise the public restore path in-process, without restarting the owned Neovim child (T2).
  await c.lua(`
    local cland, state = require('cland'), require('cland.state')
    local snap = state.snapshot()
    snap.view = { kind = 'inbox' }
    require('cland.restart').save(snap)
    cland.client:stop()
    vim.env.CLAND_OPEN_SESSION = 'aide-1'
    cland.start({ root = state.S.root, transport = 'stdio', restore = true })
  `);
  await c.waitScreen(s => s.includes('Inbox · full width') && s.includes('aide-1'), 'the restored Inbox after the session list');
  await launcherBarrier(c);
  assert.equal(await c.lua("return require('cland.state').S.ui.view.kind"), 'inbox');
  assert.equal(await c.lua('return vim.env.CLAND_OPEN_SESSION == nil'), true);
  assert.equal((await requestsOf(c, 'session.attach')).length, 0, 'restore does not attach the requested session');
});

test('the launcher: ␣l opens the form, a role fills its launch defaults, typed values win, Enter submits session.launch; the session shows in the panel', { skip }, async (t) => {
  const c = await startShell(t);
  await c.input('<Esc><Space>l');
  await c.waitScreen((x) => x.includes('launch a session') && x.includes('↵ launch'), 'the launcher form');
  assert.equal(await c.mode(), 'i', 'the form takes typing at once');
  await c.input('rev-2<Tab>reviewer<Tab>');
  let s = await c.waitScreen((x) => /harness +codex/.test(x) && /model +gpt-6\.1-sol/.test(x) && /effort +high/.test(x), "the reviewer's launch defaults");
  assert.match(s, /directory +\/\S+/, 'the working directory defaults to the project root');
  // over the default model: the typed one goes out
  await c.input('<Tab><C-u>gpt-x<CR>');
  s = await c.waitScreen((x) => !x.includes('launch a session') && /rev-2 \[Reviewer\] +free/.test(x), 'rev-2 in the panel');
  await onSessionRow(c, 'rev-2');
  s = await c.waitScreen(x => x.includes('Codex · gpt-x · idle'), 'launched session selected');
  assert.match(s, /Codex · gpt-x · idle/);
  assert.match(s, /launched rev-2 \[Reviewer\] · Codex ·/);
  for (const type of ['session.list', 'hub.status']) assert.equal((await requestsOf(c, type)).length, 2, `${type}: connect and own launch`);
  const [frame] = await requestsOf(c, 'session.launch');
  assert.deepEqual({ ...frame, id: undefined, cwd: undefined }, { type: 'session.launch', id: undefined, name: 'rev-2', role: 'reviewer', harness: 'codex', model: 'gpt-x', effort: 'high', cwd: undefined });
  assert.match(String(frame?.cwd), /proj-shell$/);

  // a role alone: its defaults are what goes out
  await c.input('<Esc><Space>l');
  await c.waitScreen((x) => x.includes('launch a session'), 'the launcher again');
  await c.input('qa-2<Tab>qa<CR>');
  await c.waitScreen((x) => /qa-2 \[QA\] +free/.test(x), 'qa-2 in the panel');
  const second = (await requestsOf(c, 'session.launch'))[1];
  assert.equal(second?.harness, 'codex');
  assert.equal(second?.model, 'gpt-6-astra');
  assert.equal(second?.effort, 'high');
  // a harness that is not the role's drops the model and effort meant for the role's
  await c.input('<Esc><Space>l');
  await c.waitScreen((x) => x.includes('launch a session'), 'the launcher a third time');
  await c.input('qa-3<Tab>qa<Tab><C-u>opencode<Tab>');
  s = await c.waitScreen((x) => /harness +opencode/.test(x) && !/model +gpt-6-astra/.test(x) && !/effort +high/.test(x), 'the model cleared for OpenCode');
  await c.input('<Esc>');
  await c.waitScreen((x) => !x.includes('launch a session'), 'the form closed with Esc');
  assert.equal((await requestsOf(c, 'session.launch')).length, 2, 'Esc launches nothing');
});

test('the launcher fetches model completion only on focus, default first', { skip }, async t => {
  const c = await startShell(t, s => {
    s.models = [{ id: 'opencode-listed-other', default: false }, { id: 'opencode-listed-default', default: true }];
  });
  await c.input('<Esc><Space>l');
  await c.waitScreen(x => x.includes('launch a session'), 'launcher');
  assert.equal((await requestsOf(c, 'models.list')).length, 0, 'opening the launcher does not probe models');
  await c.input('impl-model<Tab>implementer<Tab>');
  await c.waitScreen(x => /harness +opencode/.test(x), 'OpenCode harness');
  assert.equal((await requestsOf(c, 'models.list')).length, 0, 'editing other fields does not probe models');
  await c.input('<Tab>');
  const choices = await eventually('model completion on focus', async () => {
    const info = await c.lua<{ pum_visible: boolean; items: Array<{ word: string }>; selected: number }>("return vim.fn.complete_info({ 'pum_visible', 'items', 'selected' })");
    return info.pum_visible ? info : undefined;
  });
  assert.deepEqual(choices.items.map(m => m.word), ['opencode-listed-default', 'opencode-listed-other']);
  assert.equal(choices.selected, -1, 'offering models does not replace free text');
  const frames = await requestsOf(c, 'models.list');
  assert.equal(frames.length, 1);
  assert.equal(frames[0]?.harness, 'opencode');
  await c.input('<C-n>');
  await c.waitScreen(x => /model +opencode-listed-default/.test(x), 'the catalog default');
  await c.input('<C-n>');
  await c.waitScreen(x => /model +opencode-listed-other/.test(x), 'the next catalog model');
  assert.equal((await requestsOf(c, 'models.list')).length, 1, 'cycling uses the offered list');
  await c.input('<C-p><CR>');
  await c.waitScreen(x => !x.includes('launch a session'), 'launch with the selected completion');
  assert.equal((await requestsOf(c, 'session.launch'))[0]?.model, 'opencode-listed-default', 'Enter accepts the selected model before submitting');
});

// A protocol round trip observes every earlier result callback, including a deliberately held answer.
async function launcherBarrier(c: Shell) {
  await c.lua("require('cland').client:request({ type = 'role.list' }, function() vim.g.launcher_barrier = true end); assert(vim.wait(5000, function() return vim.g.launcher_barrier end)); vim.g.launcher_barrier = nil");
}

const launcherModel = (c: Shell) => c.lua<string>("return vim.api.nvim_buf_get_lines(require('cland.launcher').cur.buf, 3, 4, false)[1]");

const completionWords = (c: Shell) => c.lua<string[]>("local words = {}; for _, item in ipairs(vim.fn.complete_info().items) do words[#words + 1] = item.word end; return words");

test('the model completion follows harness and role account on each focus', { skip }, async t => {
  const c = await startShell(t, s => {
    s.roles = ['work', 'personal'].map(account => ({ role: account, label: account, exclusive: false, skills: [], launch: { harness: 'codex', model: null, effort: null, account }, holders: [] }));
  });
  await c.lua("require('cland.launcher').open({ name = 'models', role = 'work', field = 'model' })");
  await c.waitScreen(x => x.includes('codex-listed-default'), 'Codex catalog on initial model focus');
  assert.deepEqual(await completionWords(c), ['codex-listed-default', 'codex-listed-other']);
  let frames = await requestsOf(c, 'models.list');
  assert.equal(frames.length, 1);
  assert.equal(frames[0]?.account, 'work');
  await c.input('<S-Tab><C-u>opencode<Tab>');
  await c.waitScreen(x => x.includes('opencode-listed-default'), 'OpenCode catalog after changing harness');
  assert.deepEqual(await completionWords(c), ['opencode-listed-default', 'opencode-listed-other']);
  frames = await requestsOf(c, 'models.list');
  assert.equal(frames.length, 2);
  assert.equal(frames[1]?.harness, 'opencode');
  assert.equal(frames[1]?.account, undefined, 'another harness does not inherit the role account');
  await c.input('<S-Tab><S-Tab><C-u>personal<Tab><Tab>');
  await c.waitScreen(x => x.includes('codex-listed-default'), 'catalog after changing role account');
  frames = await requestsOf(c, 'models.list');
  assert.equal(frames.length, 3);
  assert.equal(frames[2]?.harness, 'codex');
  assert.equal(frames[2]?.account, 'personal');
});

test('a pending model answer leaves typing responsive and preserves the typed id', { skip }, async t => {
  const c = await startShell(t, s => { s.holdSnapshots = ['models.list']; });
  await c.lua("require('cland.launcher').open({ name = 'models', role = 'implementer', field = 'model' })");
  await c.control({ waitSnapshot: 'models.list' });
  await c.input('custom/model');
  await c.waitScreen(x => /model +custom\/model/.test(x), 'free typing before model reply');
  await c.control({ releaseSnapshots: ['models.list'] });
  await launcherBarrier(c);
  assert.equal(await launcherModel(c), 'custom/model', 'late completion does not replace typing');
  await c.input('<Tab>');
  await eventually('next field', async () => await c.lua('return vim.api.nvim_win_get_cursor(0)[1]') === 5 ? true : undefined);
  assert.equal(await c.lua('return vim.fn.pumvisible()'), 0, 'completion closes on leaving model');
  await c.input('<CR>');
  await c.waitScreen(x => !x.includes('launch a session'), 'free-text model launches');
  assert.equal((await requestsOf(c, 'session.launch'))[0]?.model, 'custom/model');
});

test('a model reply from a previous field visit cannot replace the current completion', { skip }, async t => {
  const c = await startShell(t, s => { s.holdSnapshots = ['models.list']; });
  await c.lua("require('cland.launcher').open({ name = 'models', role = 'implementer', field = 'model' })");
  await c.control({ waitSnapshot: 'models.list' });
  await c.input('<S-Tab><C-u>codex<Tab>');
  await c.control({ waitSnapshot: 'models.list', snapshotCount: 2 });
  // The stub releases newest first, then the stale OpenCode answer.
  await c.control({ releaseSnapshots: ['models.list'] });
  await c.waitScreen(x => x.includes('codex-listed-default'), 'the current catalog');
  await launcherBarrier(c);
  assert.deepEqual(await completionWords(c), ['codex-listed-default', 'codex-listed-other']);
});

test('failed or empty model answers keep free text with a one-line reason', { skip }, async t => {
  assert.equal(await failedOrEmptyModelAnswers(t), 2);
});

test("the launcher's item line sends `item` instead of the directory: the hub starts the Implementer in the item's worktree", { skip }, async (t) => {
  const c = await startShell(t);
  await c.input('<Esc><Space>l');
  await c.waitScreen((x) => x.includes('launch a session') && /item +T-<n>/.test(x), 'the launcher form with its item line');
  // name, role, then past harness, model, directory and effort to the item
  await c.input('impl-7<Tab>implementer<Tab><Tab><Tab><Tab><Tab>T-7<CR>');
  await c.waitScreen((x) => /impl-7 \[Implementer\]/.test(x), 'impl-7 in the panel');
  const [frame] = (await requestsOf(c, 'session.launch')).filter((f) => f.name === 'impl-7');
  assert.equal(frame?.item, 'T-7');
  assert.equal(frame?.role, 'implementer');
  assert.equal(frame?.cwd, undefined, 'the item replaces the directory');
});

test('the launcher shows what the hub refuses in the form and the panel, never a hit-enter prompt; a roleless launch asks first', { skip }, async (t) => {
  const c = await startShell(t, (s) => {
    s.launchError = 'role "coordinator" is held by coord-1 [Coordinator] (live): one session holds it at a time';
  });
  await c.input('<Esc><Space>l');
  await c.waitScreen((x) => x.includes('launch a session'), 'the launcher form');
  await c.input('coord-2<Tab>coordinator<CR>');
  const s = await c.waitScreen((x) => x.includes('launch coord-2 refused: role'), 'the refusal in the panel');
  assert.match(s, /launch a session/, 'the form stays open to fix it');
  assert.match(s, /role "coordinator" is held by coord-1/);
  assert.doesNotMatch(s, /Press ENTER/);
  assert.equal(await c.mode(), 'i');
  // no role: the first Enter warns, the second launches
  await c.control({ set: { launchError: '' } });
  await c.input('<Esc><Space>l');
  await c.waitScreen((x) => x.includes('launch a session'), 'the launcher again');
  await c.input('loner<CR>');
  await c.waitScreen((x) => x.includes('Enter again'), 'the roleless warning');
  assert.equal((await requestsOf(c, 'session.launch')).filter((f) => f.name === 'loner').length, 0);
  await c.input('<CR>');
  await c.waitScreen((x) => /loner +free/.test(x), 'loner in the panel');
  const [frame] = (await requestsOf(c, 'session.launch')).filter((f) => f.name === 'loner');
  assert.equal(frame?.role, undefined);
});



test('a custom role fills launcher defaults and its named session appears in the crew', { skip }, async t => {
  const c = await startShell(t, scenario => {
    scenario.roles = [...['coordinator', 'lead', 'implementer', 'reviewer', 'qa', 'aide'].map(role => ({ role, label: role, exclusive: false, skills: [], launch: { harness: 'codex', model: null, effort: null }, holders: [] })), { role: 'docs-writer', label: 'docs-writer', exclusive: false, skills: [],
      launch: { harness: 'codex', model: 'docs-model', effort: 'high' }, holders: [] }];
  });
  await c.input('<Esc><Space>l');
  await c.waitScreen(screen => screen.includes('launch a session'), 'launcher');
  await c.input('writer-1<Tab>docs-writer<Tab>');
  const defaults = await c.waitScreen(screen => /harness +codex/.test(screen) && /model +docs-model/.test(screen), 'custom role defaults');
  assert.match(defaults, /effort +high/);
  await c.input('<CR>');
  const screen = await c.waitScreen(screen => /writer-1 \[docs-writer\]/.test(screen) && !screen.includes('launch a session'), 'custom crew row');
  assert.match(screen, /writer-1 \[docs-writer\]/);
  const frame = (await requestsOf(c, 'session.launch'))[0];
  assert.equal(frame?.role, 'docs-writer');
  assert.equal(frame?.model, 'docs-model');
  assert.equal(frame?.harness, 'codex');
});
