// T3: process death events, live UI writer locks, EPERM and cold preference restoration.
// Screen permutations live in layers-component.test.ts; workbench owns the shared real-hub flow.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'node:net';
import { ownDirectory } from '../../hub/test/process-cleanup.ts';
import { connectUi, fakeClaude, killDaemon, spawnSpoke, startDaemon, tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient } from './harness.ts';
import { waitInitialSnapshots } from './readiness.ts';
import { fixtureEnvironment } from '../../test-support/fixture-environment.ts';
import type { Scenario } from './stub-hub.ts';

const nvim = await nvimOrSkip();

const skip = 'skip' in nvim ? nvim.skip : false;

const bin = 'bin' in nvim ? nvim.bin : '';

const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));

async function start(t: TestContext, scenario: Scenario = {}) {
  const root = await mkdtemp(join(tmpdir(), 'cland-layers-'));
  ownDirectory(t, root);
  await mkdir(join(root, '.git'));
  const controlPath = join(root, 'stub.sock');
  const c = await startClient(t, bin, root, {
    CLAND_HUB_TRANSPORT: 'stdio',
    CLAND_COMMAND: JSON.stringify([process.execPath, STUB]),
    CLAND_STUB_SCENARIO_JSON: JSON.stringify({ inbox: {}, ...scenario }),
    CLAND_STUB_CONTROL: controlPath,
  });
  await c.waitScreen(s => s.includes('hub: connected'), 'connected');
  await waitInitialSnapshots(c);
  return Object.assign(c, { root, control: (cmd: Record<string, unknown>) => new Promise<Record<string, unknown>>((resolve, reject) => {
    const sock = createConnection(controlPath);
    let text = '';
    sock.setEncoding('utf8');
    sock.on('error', reject);
    sock.on('data', chunk => {
      text += chunk;
      if (text.includes('\n')) { sock.end(); resolve(JSON.parse(text.slice(0, text.indexOf('\n')))); }
    });
    sock.write(`${JSON.stringify(cmd)}\n`);
  }) });
}

test('real bound-topic verdict and death events show warning markers without changing the chip', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const { writeFile } = await import('node:fs/promises');
  await writeFile(join(root, '.cland/config.toml'), '[visibility]\ninbox.not_clear = "now"\ninbox.death = "now"\nmessages.not_clear = "now"\n');
  const fake = await fakeClaude(t, { pollMs: 50, reexecGraceMs: 100 });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  const created = await ui.request({ size: 'M', type: 'task.create', title: 'Warning evidence' });
  assert.equal(created.ok, true, created.error);
  const item = (created.value as { item: { id: string } }).item.id;
  const bound = await ui.request({ type: 'topic.create', title: 'Warning evidence', item });
  assert.equal(bound.ok, true, bound.error);
  const c = await startClient(t, bin, root);
  await c.waitScreen(s => s.includes('hub: connected'), 'real hub connected');
  const verdict = await ui.request({ type: 'task.comment', item, text: 'Fix the warning.', verdict: { verdict: 'review', scope: 'full', result: 'not clear', run: 'headless-warning' }, as: { name: 'rev', role: 'reviewer' } });
  assert.equal(verdict.ok, true, verdict.error);
  const launch = await ui.request({ type: 'session.launch', name: 'worker', role: 'implementer', harness: 'claude-code' }, 30_000);
  assert.equal(launch.ok, true, launch.error);
  const subscribed = await coord.call<{ ok: boolean }>('subscribe', { subject: { session: 'worker' }, events: ['session.state'] });
  assert.equal(subscribed.ok, true);
  const worker = (launch.value as { process: { pid: number; sessionId: string } }).process;
  const death = ui.waitFor(f => f.type === 'session.process' && (f.process as { sessionId: string; status: string }).sessionId === worker.sessionId && (f.process as { status: string }).status === 'exited');
  process.kill(worker.pid, 'SIGKILL');
  await killDaemon(worker.pid);
  await death;
  await c.input('<Esc><Space>N');
  const s = await c.waitScreen(s => s.includes('nothing needs you'), 'warnings do not enter the inbox');
  assert.doesNotMatch((await c.lua<string[]>("return vim.api.nvim_buf_get_lines(0,0,-1,false)")).join('\n'), /review not clear|worker died|NOTIFICATIONS/);
  assert.match(s, /needs you\s+0/);
  await c.input(' E');
  await c.waitScreen(s => s.includes('review not clear') && s.includes('worker died'), 'real warnings in events');
  const rows = await c.lua<Array<{ warning?: boolean; text: string }>>("return require('cland.events').rows");
  assert.ok(rows.some(r => r.text.includes('review not clear') && r.warning));
  assert.ok(rows.some(r => r.text.includes('worker died') && r.warning));
  assert.equal(await c.lua("return require('cland.state').needs_you()"), 0);
  await c.input('<Space>L');
  await c.waitScreen(s => s.includes(`⚠ event · task · ${item} verdict posted review not clear`) && s.includes('⚠ event · session.state · worker died'), 'real warning subscription events in Agents');
  const log = (await c.lua<string[]>("return vim.api.nvim_buf_get_lines(0, 0, -1, false)")).join('\n');
  assert.match(log, new RegExp(`⚠ event · task · ${item} verdict posted review not clear · full · headless-warning`));
  assert.match(log, /⚠ event · session.state · worker died/);
  assert.equal(await c.lua("return require('cland.state').needs_you()"), 0);
});

const session = (name: string, state: string, status = 'running') => ({
  name, sessionId: name + '-id', role: 'reviewer', harness: 'codex', state, status,
});

test('a layout flush defers while another writer owns ui.json and preserves its pin', { skip }, async t => {
  const { readFile, writeFile, rm } = await import('node:fs/promises');
  const c = await start(t);
  const path = join(c.root, '.cland/ui.json');
  await mkdir(join(c.root, '.cland'), { recursive: true });
  await mkdir(`${path}.lock`);
  await writeFile(join(`${path}.lock`, '00000000-0000-0000-0000-000000000001.owner'), String(process.pid));
  await c.lua("require('cland.items').set_filter('watch')");
  assert.equal(await c.lua("return require('cland.ui').flush()"), false);
  await writeFile(path, JSON.stringify({ visibility: { topics: { general: 'pin' } } }));
  await rm(`${path}.lock`, { recursive: true });
  assert.equal(await c.lua("return require('cland.ui').flush()"), true);
  const saved = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(saved.items_filter, 'watch');
  assert.equal(saved.visibility.topics.general, 'pin');
});

test('stale UI recovery preserves a competing replacement and treats EPERM as alive', { skip }, async t => {
  const { readFile, writeFile, rm } = await import('node:fs/promises');
  const { spawn } = await import('node:child_process');
  const root = await tempProject(t);
  const dead = spawn(process.execPath, ['-e', ''], { cwd: root, env: fixtureEnvironment(root, process.env) });
  const deadPid = dead.pid!;
  await new Promise<void>(resolve => dead.once('exit', () => resolve()));
  const c = await start(t);
  const path = join(c.root, '.cland/ui.json');
  const lock = `${path}.lock`;
  const staleName = '00000000-0000-0000-0000-000000000001.owner';
  const replacement = '00000000-0000-0000-0000-000000000002.owner';
  await c.lua("require('cland.ui').flush()");
  const result = await c.lua(`
    local lock,stale,replacement,pid,deadPid = ...
    vim.fn.mkdir(lock,'p'); vim.fn.writefile({tostring(deadPid)},lock..'/'..stale)
    local uv=vim.uv; local unlink=uv.fs_unlink; local raced=false
    uv.fs_unlink=function(path)
      if path == lock..'/'..stale and not raced then
        raced=true
        assert(unlink(path)); assert(uv.fs_rmdir(lock)); assert(uv.fs_mkdir(lock,448))
        vim.fn.writefile({tostring(pid)},lock..'/'..replacement)
      end
      return unlink(path)
    end
    require('cland.items').set_filter('watch')
    require('cland.ui').changed()
    local ok,flushed=pcall(require('cland.ui').flush)
    uv.fs_unlink=unlink
    if not ok then error(flushed) end
    return {raced=raced,flushed=flushed}
  `, lock, staleName, replacement, process.pid, deadPid);
  assert.deepEqual(result, { raced: true, flushed: false });
  assert.equal((await readFile(join(lock, replacement), 'utf8')).trim(), String(process.pid));
  await rm(join(lock, replacement));
  await writeFile(join(lock, staleName), String(deadPid));
  assert.equal(await c.lua(`
    local uv=vim.uv; local kill=uv.kill
    uv.kill=function() return nil,'operation not permitted','EPERM' end
    local ok,flushed=pcall(require('cland.ui').flush)
    uv.kill=kill
    if not ok then error(flushed) end
    return flushed
  `), false);
  assert.equal((await readFile(join(lock, staleName), 'utf8')).trim(), String(deadPid), 'an uncertain holder is preserved');
  await rm(lock, { recursive: true });
  assert.equal(await c.lua("return require('cland.ui').flush()"), true);
});

test('the human mutes a topic and pins a Reviewer through keys, then a cold UI restores both', { skip }, async t => {
  const { readFile } = await import('node:fs/promises');
  const scenario: Scenario = { processes: [session('quiet-reviewer', 'idle')], messages: { general: [
    { id: 'report', topic: 'general', from: 'coord', fromRole: 'coordinator', fromKind: 'agent', to: [], text: 'Coordinator notes', ts: new Date().toISOString() },
  ] } };
  const c = await start(t, scenario);
  await c.input('<Esc><Space>t<C-l>');
  // Connection precedes topic snapshot rendering; search only after the target row exists.
  await c.waitScreen(s => s.includes('TOPICS') && /● General/.test(s), 'topic row ready for mute');
  await c.input('/General<CR>gM');
  await c.waitScreen(s => s.includes('more (1)'), 'topic mute applied to its thread');
  await c.input('<Space>s<C-l>');
  await c.waitScreen(s => s.includes('SESSIONS') && s.includes('quiet-reviewer [Reviewer]'), 'Reviewer row ready for pin');
  await c.input('/quiet-reviewer<CR>gP');
  await c.waitScreen(s => s.includes('NOW · 1') && s.includes('quiet-reviewer [Reviewer]'), 'Reviewer pinned');
  await c.lua("require('cland.layout').preset('watch')");
  await c.input('<C-h><C-h>gw');
  const closed = c.rpc.closed;
  await c.lua("vim.cmd('qa!')").catch(() => {});
  await closed;
  const saved = JSON.parse(await readFile(join(c.root, '.cland/ui.json'), 'utf8'));
  assert.equal(saved.visibility.topics.general, 'mute');
  assert.equal(saved.visibility.sessions['quiet-reviewer'], 'pin');
  assert.equal(saved.items_filter, 'watch', 'layer filter persisted');
  assert.equal(saved.preset, 'watch', 'layout flush preserves hub-owned choices');
  const fresh = await startClient(t, bin, c.root, {
    CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_SCENARIO_JSON: JSON.stringify(scenario),
  });
  await fresh.waitScreen(s => s.includes('hub: connected') && s.includes('more (1)'), 'topic mute restored');
  assert.equal(await fresh.lua("return require('cland.items').filter()"), 'watch');
  await fresh.input('<Esc><Space>s<C-l>');
  await fresh.waitScreen(s => s.includes('NOW · 1') && s.includes('quiet-reviewer [Reviewer]'), 'Reviewer pin restored');
  await fresh.input('/quiet-reviewer<CR>gP');
  await fresh.waitScreen(s => s.includes('NOW · 0') && s.includes('WATCH · 1'), 'pin toggles back to watch');
  assert.deepEqual(await fresh.lua("return require('cland.actions').audit()"), []);
});
