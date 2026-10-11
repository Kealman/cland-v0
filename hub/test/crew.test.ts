import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { clandWithEnv, connectUi, eventually, startDaemon, tempProject } from './harness.ts';
import type { CrewConfig } from '../src/crew.ts';

type View = { config: CrewConfig; summary: string };

test('crew CLI and protocol validate changes, reload hand edits, and retain the last good policy with a notice', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const path = join(root, '.cland/crew.toml');
  const initial = await readFile(path, 'utf8');
  const show = async () => {
    const result = await ui.request({ type: 'crew.show' });
    assert.equal(result.ok, true, JSON.stringify(result));
    return result.value as View;
  };
  const defaults = (await show()).config;
  assert.deepEqual(defaults.leads, []);
  assert.equal(defaults.crew.implementer!.stop_after, 'merge');
  assert.equal(defaults.crew.reviewer!.keep_context, true);
  assert.equal(defaults.crew.aide!.size, null);
  for (const [role, rule] of Object.entries(defaults.crew)) assert.equal(rule.subagents, role === 'coordinator' || role === 'lead');
  const set = await clandWithEnv(root, {}, 'crew', 'set', 'reviewer.size', '2', '--json');
  assert.equal(set.code, 0, set.stderr);
  assert.match((JSON.parse(set.stdout) as View).summary, /rev pool 2/);
  const cliShow = await clandWithEnv(root, {}, 'crew', 'show');
  assert.equal(cliShow.code, 0, cliShow.stderr);
  assert.match(cliShow.stdout, /rev pool 2/);
  await eventually('crew event reaches UI', () => ui.frames.find(f => f.type === 'crew' && String(f.summary).includes('rev pool 2')));
  const saved = await readFile(path, 'utf8');
  for (const [key, value] of [['reviewer.size', 0], ['reviewer.size', 1.5], ['reviewer.size', '2'], ['reviewer.policy', ['pool']], ['reviewer.policy', 'unknown'], ['qa.size', 2], ['reviewer.keep_context', 'true'], ['implementer.stop_after', 'exit'], ['reviewer.harness', 'codex'], ['unknown.size', 2], ['leads', ['task']], ['leads', ['epic', 'epic']]] as const) {
    const refused = await ui.request({ type: 'crew.set', key, value });
    assert.equal(refused.ok, false, `${key}=${JSON.stringify(value)} ${JSON.stringify(refused)}`);
    assert.equal(await readFile(path, 'utf8'), saved);
  }
  const leads = await clandWithEnv(root, {}, 'crew', 'set', 'leads', '["epic"]', '--json');
  assert.equal(leads.code, 0, leads.stderr);
  const good = await readFile(path, 'utf8');
  await writeFile(path, good.replace('size = 2', 'size = 3'));
  await eventually('hand edit reloaded', async () => (await show()).config.crew.reviewer!.size === 3 ? true : undefined);
  const status = await ui.request({ type: 'hub.status' });
  assert.match((status.value as { crew: View }).crew.summary, /rev pool 3.*leads: epic/);
  for (const broken of ['[crew.reviewer]\nsize = 0\n', '[crew.reviewer\n', 'model = "codex"\n', '[crew.reviewer]\nkeep_context = 1\n']) {
    const previous = ui.frames.length;
    await writeFile(path, broken);
    await eventually('refusal recorded', () => ui.frames.slice(previous).find(f => f.type === 'message' && String((f.message as { text?: string })?.text).includes('crew refused')));
    assert.equal((await show()).config.crew.reviewer!.size, 3);
    const rejectedSet = await ui.request({ type: 'crew.set', key: 'reviewer.size', value: 4 });
    assert.equal(rejectedSet.ok, false);
    assert.equal(await readFile(path, 'utf8'), broken);
  }
  await unlink(path);
  await eventually('missing file refusal', async () => {
    const result = await ui.request({ type: 'topic.history', topic: 'agents' });
    return JSON.stringify(result.value).includes('ENOENT') ? true : undefined;
  });
  assert.equal((await show()).config.crew.reviewer!.size, 3);
  await writeFile(path, initial);
  await eventually('restored policy reloaded', async () => (await show()).config.crew.reviewer!.size === 1 ? true : undefined);
});

test('crew set observes the session role boundary from CLI', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  for (const [name, role, allowed] of [['coord', 'coordinator', true], ['aide-one', 'aide', true], ['impl', 'implementer', false], ['rev', 'reviewer', false], ['qa-one', 'qa', false]] as const) {
    assert.equal((await ui.request({ type: 'role.set', session: name, role })).ok, true);
    const result = await clandWithEnv(root, { CLAND_SESSION_NAME: name }, 'crew', 'set', 'reviewer.size', '2');
    assert.equal(result.code, allowed ? 0 : 1, result.stderr);
    if (!allowed) assert.match(result.stderr, /forbidden.*crew.set/);
    const show = await clandWithEnv(root, { CLAND_SESSION_NAME: name }, 'crew', 'show', '--json');
    assert.equal(show.code, 0, show.stderr);
  }
});

test('non-table crew values are refused and cannot replace the last good staffing', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  assert.equal((await ui.request({ type: 'crew.set', key: 'reviewer.size', value: 3 })).ok, true);
  await eventually('last good staffing published', () => ui.frames.find(f => f.type === 'crew' && (f.config as CrewConfig)?.crew.reviewer?.size === 3));
  const path = join(root, '.cland/crew.toml');
  // smol-toml represents dates and times as objects; arrays are objects as well.
  for (const value of ['1979-05-27', '1979-05-27T07:32:00Z', '1979-05-27T07:32:00', '07:32:00', '[]', '[{}]']) {
    for (const text of [`crew = ${value}\n`, `[crew]\nreviewer = ${value}\n`]) {
      const previous = ui.frames.length;
      await writeFile(path, text);
      // A crew event may still be arriving from the preceding valid set. Only
      // the refusal notice proves this invalid hand edit has been processed.
      await eventually('invalid source refused', () => ui.frames.slice(previous).find(f => f.type === 'message' && String((f.message as { text?: string })?.text).includes('crew refused')));
      const show = await ui.request({ type: 'crew.show' });
      assert.equal((show.value as View).config.crew.reviewer!.size, 3, `invalid source replaced the last good crew: ${text}`);
      assert.ok(ui.frames.slice(previous).some(f => f.type === 'message' && String((f.message as { text?: string })?.text).includes('crew refused')), 'broken source emits a refusal notice');
    }
  }
});
