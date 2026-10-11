import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'node:net';
import { ownDirectory } from '../../hub/test/process-cleanup.ts';
import { connectUi, fakeClaude, spawnSpoke, startDaemon, tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip, startClient } from './harness.ts';
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
  const fake = await fakeClaude(t, { pollMs: 50 });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  const created = await ui.request({ type: 'task.create', title: 'Warning evidence' });
  assert.equal(created.ok, true, created.error);
  const item = (created.value as { item: { id: string } }).item.id;
  const bound = await ui.request({ type: 'topic.create', title: 'Warning evidence', item });
  assert.equal(bound.ok, true, bound.error);
  const c = await startClient(t, bin, root);
  await c.waitScreen(s => s.includes('hub: connected'), 'real hub connected');
  const verdict = await ui.request({ type: 'task.comment', item, text: 'Fix the warning.', verdict: { verdict: 'review', result: 'not clear', run: 'headless-warning' }, as: { name: 'rev', role: 'reviewer' } });
  assert.equal(verdict.ok, true, verdict.error);
  const launch = await ui.request({ type: 'session.launch', name: 'worker', role: 'implementer', harness: 'claude-code' }, 30_000);
  assert.equal(launch.ok, true, launch.error);
  const subscribed = await coord.call<{ ok: boolean }>('subscribe', { subject: { session: 'worker' }, events: ['session.state'] });
  assert.equal(subscribed.ok, true);
  process.kill((launch.value as { process: { pid: number } }).process.pid, 'SIGKILL');
  await c.input('<Esc><Space>N');
  let s = await c.waitScreen(s => s.includes(`⚠ ${item} review not clear`) && s.includes('⚠ worker died'), 'real warnings in inbox');
  const inbox = (await c.lua<string[]>("return vim.api.nvim_buf_get_lines(0, 0, -1, false)")).join('\n');
  assert.ok(!inbox.includes('NOW'), inbox);
  assert.match(s, /WATCH/);
  assert.match(s, /needs you\s+0/);
  assert.match(s, /nothing needs you/);
  await c.input(`gg/${item} review not clear<CR>d`);
  await c.waitScreen(s => s.includes('warn events are informational and are not dismissed'), 'warning dismissal refused');
  await c.input('D');
  s = await c.waitScreen(s => s.includes(`⚠ ${item} review not clear`) && s.includes('⚠ worker died'), 'dismiss all retains warnings');
  assert.equal(await c.lua("return require('cland.state').needs_you()"), 0);
  await c.input('<Space>L');
  await c.waitScreen(s => s.includes(`⚠ event · task · ${item} verdict posted review not clear`) && s.includes('⚠ event · session.state · worker died'), 'real warning subscription events in Agents');
  const log = (await c.lua<string[]>("return vim.api.nvim_buf_get_lines(0, 0, -1, false)")).join('\n');
  assert.match(log, new RegExp(`⚠ event · task · ${item} verdict posted review not clear · headless-warning`));
  assert.match(log, /⚠ event · session.state · worker died/);
  assert.equal(await c.lua("return require('cland.state').needs_you()"), 0);
});

test('inbox archive is opt-in and stays separate from background in both views', { skip }, async t => {
  const ts = new Date().toISOString();
  const c = await start(t, {
    visibility: { inbox: { clear: 'archive' } },
    inbox: { notifications: [
      { id: 'old', kind: 'verdict', result: 'clear', text: 'archived verdict', ts },
      { id: 'book', kind: 'role', text: 'hidden bookkeeping', ts },
      { id: 'idle', kind: 'idle', text: 'watch idle', ts },
    ] },
  });
  await c.input('<Esc><Space>n');
  let s = await c.waitScreen(s => s.includes('watch idle') && s.includes('WATCH'), 'inbox panel');
  assert.ok(!s.includes('archived verdict'));
  await c.input('zR');
  s = await c.waitScreen(s => s.includes('watch idle'), 'ordinary unfold');
  assert.ok(!s.includes('archived verdict'), 'unfold is not an archive request');
  await c.input('A');
  await c.waitScreen(s => s.includes('ARCHIVE') && s.includes('archived verdict') && !s.includes('hidden bookkeeping'), 'explicit archive request');
  await c.input('<Space>N');
  await c.waitScreen(s => s.includes('Inbox · full width') && s.includes('archived verdict'), 'full width shares archive selection');
  await c.input('A');
  await c.waitScreen(s => !s.includes('archived verdict') && s.includes('watch idle'), 'archive hidden again');
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
});

const session = (name: string, state: string, status = 'running') => ({
  name, sessionId: name + '-id', role: 'reviewer', harness: 'codex', state, status,
});

test('sessions show now and watch while background folds behind more (N)', { skip }, async t => {
  const c = await start(t, { processes: [session('working', 'busy'), session('resting', 'idle'), session('finished', 'unknown', 'stopped')] });
  const s = await c.waitScreen(s => s.includes('working [Reviewer]') && s.includes('resting [Reviewer]'), 'visible sessions');
  assert.ok(s.includes('NOW') && s.includes('WATCH') && s.includes('more (1)'), s);
  assert.ok(!s.includes('finished [Reviewer]'));
  await c.input('<Esc><C-l>/more (<CR><Tab>');
  await c.waitScreen(s => s.includes('finished [Reviewer]'), 'background unfolded with Tab');
  await c.input('/finished<CR>zc');
  await c.waitScreen(s => !s.includes('finished [Reviewer]'), 'background closed from its session row');
  assert.match(String(await c.lua('return vim.api.nvim_get_current_line()')), /more \(1\)/, 'closing returns the cursor to its fold header');
  await c.input('<CR>');
  await c.waitScreen(s => s.includes('finished [Reviewer]'), 'Enter unfolds header');
  await c.input('zM');
  await c.waitScreen(s => !s.includes('finished [Reviewer]'), 'all folds closed');
  await c.input('zR');
  await c.waitScreen(s => s.includes('finished [Reviewer]'), 'all background unfolded');
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
});

test('session folds use hub layers even for live background and explicitly requested archive', { skip }, async t => {
  const c = await start(t, {
    visibility: { sessions: { idle: 'background', stopped: 'archive' } },
    processes: [session('working', 'busy'), session('quiet', 'idle'), session('archived', 'unknown', 'stopped')],
  });
  let s = await c.waitScreen(s => s.includes('working [Reviewer]') && s.includes('more (1)'), 'custom layer placement');
  assert.ok(!s.includes('quiet [Reviewer]') && !s.includes('archived [Reviewer]'));
  await c.input('<Esc><C-l>zR');
  s = await c.waitScreen(s => s.includes('quiet [Reviewer]'), 'live background unfolded');
  assert.ok(!s.includes('archived [Reviewer]'), 'zR does not reach archive');
  await c.input('/quiet<CR>');
  await c.waitScreen(s => s.includes('Codex'), 'selected background session');
  await c.control({ emit: { type: 'session.state', session: 'quiet', sessionId: 'quiet-id', state: 'busy' } });
  await c.waitScreen(s => s.includes('BUSY · 2') && s.includes('more (0)'), 'layer changes on a live frame');
  assert.match(String(await c.lua('return vim.api.nvim_get_current_line()')), /quiet \[Reviewer\]/, 'cursor follows session across layers');
  await c.input('A');
  await c.waitScreen(s => s.includes('ARCHIVE · 1') && s.includes('archived [Reviewer]'), 'explicit session archive');
  await c.input('zM');
  await c.waitScreen(s => s.includes('archived [Reviewer]'), 'folding background leaves requested archive visible');
  await c.input('A');
  await c.waitScreen(s => !s.includes('archived [Reviewer]'), 'archive hidden');
  assert.deepEqual(await c.lua("return require('cland.actions').audit()"), []);
});
