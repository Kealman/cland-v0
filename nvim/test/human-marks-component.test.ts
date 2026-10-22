// T2: headless workbench exchanges recorded protocol frames with a second scripted frame peer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nvimOrSkip, startClient } from './stub-client.ts';
import { tempProject, eventually } from './fixture.ts';
import { stubControl } from './stub-control.ts';
import { waitInitialSnapshots } from './readiness.ts';

const nvim = await nvimOrSkip();
const skip = 'skip' in nvim ? nvim.skip : false;
const bin = 'bin' in nvim ? nvim.bin : '';
const isolated = (root: string) => ({ HOME: join(root, 'home'), XDG_CONFIG_HOME: join(root, 'config'), XDG_CACHE_HOME: join(root, 'cache'), XDG_DATA_HOME: join(root, 'data'), GIT_CONFIG_GLOBAL: join(root, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1' });
const STUB = fileURLToPath(new URL('./stub-hub.ts', import.meta.url));

test('C2: visiting events publishes the shared last look; a peer reading a topic clears its Neovim row', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.git'), { recursive: true });
  const control = join(root, 'control.sock');
  const c = await startClient(t, bin, root, {
    ...isolated(root), CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]),
    CLAND_STUB_CONTROL: control,
    CLAND_STUB_SCENARIO_JSON: JSON.stringify({ topics: [
      { id: 'general', title: 'General', status: 'open', unread: 0 },
      { id: 'shared', title: 'Shared reading', status: 'open', unread: 3 },
    ] }),
  });
  await waitInitialSnapshots(c);
  await eventually('shared marks setup completes before visiting Events', async () => await c.lua<boolean>("return require('cland.marks').ready") || undefined);
  const before = (await stubControl(control, { frame: { type: 'marks.get', id: 'before-visit' } })).frame as any;
  const visit = eventually('the peer reads the acknowledged Events visit', async () => {
    const result = (await stubControl(control, { frame: { type: 'marks.get', id: 'visit-receipt' } })).frame as any;
    return typeof result.value.marks.events === 'string' && result.value.marks.events !== before.value.marks.events ? result.value.marks.events as string : undefined;
  });
  void visit.catch(() => {});
  await c.input('<Esc> E');
  const visited = await visit;
  await c.waitScreen(s => s.includes('events · newest first'), 'events rendered after acknowledged visit');
  const frames = (await stubControl(control, { requests: true })).requests as Array<Record<string, unknown>>;
  assert.ok(frames.some(f => f.type === 'marks.set' && typeof f.events === 'string'), 'events visit sends its last look to the hub');
  const peer = await stubControl(control, { frame: { type: 'marks.get', id: 'peer-read' } });
  assert.equal((peer.frame as any).value.marks.events, visited);
  assert.equal(visited, frames.findLast(f => f.type === 'marks.set' && f.events)!.events);
  await c.input('   t');
  await c.waitScreen(s => s.includes('Shared reading') && s.includes('3'), 'unread topic row');
  await stubControl(control, { frame: { type: 'topic.read', id: 'peer-topic', topic: 'shared' } });
  await eventually('Neovim installs the peer read position', async () => (await c.lua<number>("return require('cland.state').topic('shared').unread")) === 0 || undefined);
  assert.equal(await c.lua("return require('cland.state').topic('shared').unread"), 0);
  await stubControl(control, { frame: { type: 'marks.set', id: 'peer-update', events: '2030-01-01T00:00:00.000Z' } });
  await stubControl(control, { emit: { type: 'role.filled', role: 'coordinator', session: 'peer-mark-barrier', ts: '2030-01-01T00:00:00.000Z' } });
  await c.waitScreen(s => s.includes('peer-mark-barrier'), 'ordered peer mark publication processed');
  assert.equal(await c.lua("return require('cland.marks').events()"), '2030-01-01T00:00:00.000Z');
});


test('C3: legacy marks import once before their ui.json keys are removed', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.git'), { recursive: true });
  await mkdir(join(root, '.cland'), { recursive: true });
  const path = join(root, '.cland/ui.json');
  const old = '2026-10-12T10:00:00.000Z';
  const preferences = { version: 2, panels: { left: false, right: 'sessions', dock: false },
    sizes: {}, items_filter: 'board', plan_seen: { 'E-12': 'legacy-plan' },
    events: { filter: { warnings: true }, muted: [], last_look: old }, other_owner: { keep: true } };
  await writeFile(path, JSON.stringify(preferences));
  const control = join(root, 'control.sock');
  const env = { ...isolated(root), CLAND_HUB_TRANSPORT: 'stdio', CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_CONTROL: control };
  const c = await startClient(t, bin, root, env);
  await waitInitialSnapshots(c);
  const read = async () => (await stubControl(control, { frame: { type: 'marks.get', id: 'peer-read' } })).frame as any;
  const marks = await eventually('legacy import acknowledged by the peer', async () => {
    const f = await read(); return f.value.marks.imported ? f.value.marks : undefined;
  });
  assert.equal(marks.events, old);
  assert.deepEqual(marks.plans, { 'T-12': 'legacy-plan' });
  await eventually('legacy mark keys removed from disk', async () => {
    const saved = JSON.parse(await readFile(path, 'utf8'));
    return !('plan_seen' in saved) && !('last_look' in saved.events) ? saved : undefined;
  });
  const saved = JSON.parse(await readFile(path, 'utf8'));
  assert.equal('plan_seen' in saved, false);
  assert.equal('last_look' in saved.events, false);
  assert.deepEqual(saved.events.filter, { warnings: true });
  assert.deepEqual(saved.other_owner, { keep: true });
  const exited = once(c.process, 'close', { signal: AbortSignal.timeout(5000) });
  await c.input('<Esc>:qa!<CR>');
  await exited;
  assert.equal(c.process.exitCode, 0);
  await eventually('old editor and its stub process group disappear before the cold start', () => {
    try { process.kill(-c.process.pid!, 0); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return true; throw error; }
    return undefined;
  }, 5000);
  assert.throws(() => process.kill(-c.process.pid!, 0), { code: 'ESRCH' });
  // A stale copy from another workbench cannot re-import after the human's durable import receipt.
  await writeFile(path, JSON.stringify(preferences));
  const cold = await startClient(t, bin, root, { ...env, CLAND_STUB_SCENARIO_JSON: JSON.stringify({ marks }) });
  await waitInitialSnapshots(cold);
  await eventually('cold start installs the durable shared marks', async () => (await cold.lua<any>("return require('cland.marks').value")).imported || undefined);
  const requests = (await stubControl(control, { requests: true })).requests as Array<Record<string, unknown>>;
  assert.equal(requests.filter(f => f.type === 'marks.set' && f.import).length, 0);
  await eventually('cold start removes stale local keys without importing', async () => !('plan_seen' in JSON.parse(await readFile(path, 'utf8'))) || undefined);
  assert.deepEqual(await cold.lua("return require('cland.marks').value"), marks);
});


test('marks startup without validated legacy keys never flushes pending preferences', { skip }, async t => {
  const clean = JSON.stringify({ version: 2, panels: { left: false, right: 'sessions', dock: false }, sizes: {}, items_filter: 'board' });
  for (const content of [null, 'directory', '{broken', '{"version":1,"panels":false}', '{"version":2}',
    clean]) {
    const root = await tempProject(t);
    await mkdir(join(root, '.cland'));
    const path = join(root, '.cland/ui.json');
    if (content === 'directory') await mkdir(path);
    else if (content !== null) await writeFile(path, content);
    const control = join(root, 'control.sock');
    const c = await startClient(t, bin, root, { ...isolated(root), CLAND_HUB_TRANSPORT: 'stdio',
      CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_CONTROL: control,
      CLAND_STUB_SCENARIO_JSON: JSON.stringify({ holdSnapshots: ['marks.get'] }),
    });
    await waitInitialSnapshots(c);
    await stubControl(control, { waitSnapshot: 'marks.get' });
    // Hold the ordinary preference debounce independently of startup. The marks
    // acknowledgement must not take ownership of this pending preference write.
    await c.lua(`local path = ...; local ui = require('cland.ui'); local open = vim.uv.fs_open
      _G.preference_write_attempts = 0
      vim.uv.fs_open = function(file, flags, mode)
        if file:sub(1, #path + 1) == path .. '.' and flags == 'wx' then
          _G.preference_write_attempts = _G.preference_write_attempts + 1
        end
        return open(file, flags, mode)
      end
      ui.DEBOUNCE_MS = 60000
      require('cland.state').S.ui.accounts_folded = true
      ui.changed()`, path);
    await stubControl(control, { releaseSnapshots: ['marks.get'] });
    await eventually('marks startup callback completes without importing local keys', async () =>
      await c.lua<boolean>("return require('cland.marks').ready") || undefined);
    assert.equal(await c.lua('return _G.preference_write_attempts'), 0, `no startup preference write for ${content}`);
    assert.equal(await c.lua("return require('cland').client:connected()"), true);
    const requests = (await stubControl(control, { requests: true })).requests as Array<Record<string, unknown>>;
    assert.equal(requests.filter(f => f.type === 'marks.set' && f.import).length, 0);
    const notice = await c.lua<string | null>("return require('cland.state').S.flash and require('cland.state').S.flash.text or vim.NIL");
    if (content === null || content === clean) assert.equal(notice, null);
    else assert.equal(notice, 'ui.json unreadable or invalid; using default layout');
    // The pending ordinary preference write still exists, and the filesystem
    // observer sees it when explicitly flushed after the startup assertions.
    await c.lua("require('cland.ui').flush()");
    assert.ok(await c.lua<number>('return _G.preference_write_attempts') > 0);
  }
});

test('marks.get replays a peer delta received before its held older response', { skip }, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.git'), { recursive: true });
  const control = join(root, 'control.sock');
  const c = await startClient(t, bin, root, { ...isolated(root), CLAND_HUB_TRANSPORT: 'stdio',
    CLAND_COMMAND: JSON.stringify([process.execPath, STUB]), CLAND_STUB_CONTROL: control,
    CLAND_STUB_SCENARIO_JSON: JSON.stringify({ marks: { events: '2026-10-11T00:00:00.000Z', plans: {}, imported: true } }),
  });
  await waitInitialSnapshots(c);
  await eventually('marks setup before holding a fresh read', async () => await c.lua<boolean>("return require('cland.marks').ready") || undefined);
  await stubControl(control, { set: { holdSnapshots: ['marks.get'] } });
  const held = stubControl(control, { waitSnapshot: 'marks.get' });
  await c.lua("require('cland.marks').refresh(function() _G.marks_read_finished = true end)");
  await held;
  await stubControl(control, { frame: { type: 'marks.set', id: 'newer-peer-mark', events: '2030-01-01T00:00:00.000Z' } });
  await stubControl(control, { releaseSnapshots: ['marks.get'] });
  await eventually('held read callback completes after the later delta', async () => await c.lua<boolean>("return _G.marks_read_finished == true") || undefined);
  assert.equal(await c.lua("return require('cland.marks').events()"), '2030-01-01T00:00:00.000Z');
});
