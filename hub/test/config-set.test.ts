// T2: config CLI argument handling requires the CLI against an in-process project hub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, symlink, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultConfig, parseConfig, renderConfig } from '../src/init/config.ts';
import { cland, clandWithEnv, connectUi, eventually, projectHub, tempProject } from './harness.ts';
import { writeAtomic } from '../src/init/files.ts';

async function fixture(t: Parameters<typeof tempProject>[0]) {
  const root = await tempProject(t);
  const path = join(root, '.cland/config.toml');
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Settings test');
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(path, renderConfig(config));
  const hub = await projectHub(t, root);
  return { root, path, ...hub };
}

test('config set keeps verification command arguments verbatim and applies them now', async t => {
  const { root, path } = await fixture(t);
  for (const [key, value] of [
    ['test', 'python3 -m unittest discover -s tests'],
    ['check', 'python3 -m compileall . && printf "checked" | cat'],
    ['prepare', '  python3 -m pip install -r "dev requirements.txt"  '],
    ['test', 'true'],
    ['check', '"printf"'],
    ['prepare', "'printf'"],
  ] as const) {
    const result = await cland(root, 'config', 'set', `verification.${key}`, value);
    assert.equal(result.code, 0, result.stderr);
    assert.ok(result.stdout.includes(`verification.${key} = ${JSON.stringify(value)}; applies now`), result.stdout);
    assert.equal(parseConfig(await readFile(path, 'utf8'), root).verification[key], value);
  }
});

test('config set without a running hub refuses and leaves the managed file unchanged', async t => {
  const root = await tempProject(t);
  const path = join(root, '.cland/config.toml');
  await mkdir(join(root, '.cland'), { recursive: true });
  const original = renderConfig(defaultConfig('Offline project'));
  await writeFile(path, original);
  const result = await cland(root, 'config', 'set', 'plan.approval', 'human');
  assert.equal(result.code, 1);
  assert.match(result.stderr, /no hub runs for this project.*cland hub start/);
  assert.equal(await readFile(path, 'utf8'), original);
});

test('config set changes plan approval through the project hub and keeps every other parsed value', async t => {
  const root = await tempProject(t);
  const path = join(root, '.cland/config.toml');
  await mkdir(join(root, '.cland'), { recursive: true });
  const before = defaultConfig('Custom project');
  before.verification.lockPath = join(root, 'suite.lock');
  before.hygiene.rateLimit.max = 37;
  before.verification.remoteBudget = 7;
  before.visibility = { messages: { agent: 'watch' } };
  await writeFile(path, renderConfig(before));
  await projectHub(t, root);
  const original = parseConfig(await readFile(path, 'utf8'), root);
  const result = await cland(root, 'config', 'set', 'plan.approval', 'human', '--json');
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { key: 'plan.approval', value: 'human', applies: 'now' });
  assert.deepEqual(parseConfig(await readFile(path, 'utf8'), root), { ...original, plan: { ...original.plan, approval: 'human' } });
});

test('config set parses numbers and lists, applies reloadable values now and reports pending startup edits', async t => {
  const { root, path } = await fixture(t);
  const regions = await cland(root, 'config', 'set', 'verification.droplet.regions', '["lon1"]', '--json');
  assert.equal(regions.code, 0, regions.stderr);
  assert.deepEqual(JSON.parse(regions.stdout), { key: 'verification.droplet.regions', value: ['lon1'], applies: 'now' });
  const live = await cland(root, 'config', 'set', 'verification.remote_budget', '3');
  assert.equal(live.code, 0, live.stderr);
  assert.match(live.stdout, /verification.remote_budget = 3; applies now/);
  assert.equal(JSON.parse((await cland(root, 'hub', 'status', '--json')).stdout).verification.remoteBudget, 3);
  const workers = await cland(root, 'config', 'set', 'verification.workers', '3');
  assert.equal(workers.code, 0, workers.stderr);
  assert.match(workers.stdout, /verification.workers = 3; applies at the next hub start/);
  const pending = await cland(root, 'config', 'set', 'verification.remote_budget', '5', '--json');
  assert.equal(pending.code, 0, pending.stderr);
  const result = JSON.parse(pending.stdout);
  assert.equal(result.value, 5);
  assert.match(result.applies, /saved; not applied:.*verification.workers changed: restart required.*cland hub reload.*restart/);
  const readback = parseConfig(await readFile(path, 'utf8'), root);
  assert.equal(readback.verification.workers, 3);
  assert.equal(readback.verification.remoteBudget, 5);
  assert.deepEqual(readback.verification.droplet.regions, ['lon1']);
  assert.equal(JSON.parse((await cland(root, 'hub', 'status', '--json')).stdout).verification.remoteBudget, 3);
});

test('config set refuses unknown keys, invalid parser values and silently ignored values without changing bytes', async t => {
  const { root, path, discovery } = await fixture(t);
  const ui = await connectUi(t, discovery);
  const original = await readFile(path, 'utf8');
  for (const [key, value, reason] of [
    ['plan.missing', 'human', /known keys in plan:.*plan.approval.*plan.qa_default/],
    ['unknown.value', 'human', /known keys:.*project.name.*verification.workers/],
    ['plan.approval', 'maybe', /plan.approval must be none or human/],
    ['verification.workers', '0', /verification.workers must be a positive integer/],
    ['verification.budget', 'two', /verification.budget must be a positive integer/],
  ] as const) {
    const result = await cland(root, 'config', 'set', key, value);
    assert.equal(result.code, 1, `${key}: ${result.stdout}`);
    assert.match(result.stderr, reason);
    assert.equal(await readFile(path, 'utf8'), original);
  }
  for (const [key, value] of [
    ['project.name', ''], ['verification.budget', false], ['verification.lock_path', 'relative'],
    ['verification.cache_max_age_minutes', -1], ['keys.layouts', [1]], ['artifacts.retention_days', 'two'],
    ['hygiene.rate_limit_max', 'two'], ['hygiene.max_text_bytes', 0.5],
    ['verification.droplet.workers', 0], ['visibility.messages.agent', 'never'],
  ]) {
    const result = await ui.request({ type: 'config.set', key, value });
    assert.equal(result.ok, false, String(key));
    assert.match(String(result.error), /must be/);
    assert.equal(await readFile(path, 'utf8'), original);
  }
});

test('config set keeps unmarked and broken files unchanged and refuses symlinks', async t => {
  const { root, path } = await fixture(t);
  for (const [text, reason] of [
    ['# Project settings\n[plan]\napproval="none"\n', /no managed by cland mark.*project's own/],
    ['# managed by cland\n[broken', /parse|Invalid|Expected|TOML/i],
  ] as const) {
    await writeFile(path, text);
    const result = await cland(root, 'config', 'set', 'plan.approval', 'human');
    assert.equal(result.code, 1);
    assert.match(result.stderr, reason);
    assert.equal(await readFile(path, 'utf8'), text);
  }
  const outside = join(root, 'external.toml');
  const text = renderConfig(defaultConfig('Outside'));
  await writeFile(outside, text);
  await unlink(path);
  await symlink(outside, path);
  const result = await cland(root, 'config', 'set', 'plan.approval', 'human');
  assert.equal(result.code, 1);
  assert.match(result.stderr, /symlink/);
  assert.equal(await readFile(outside, 'utf8'), text);
});

test('config set supports optional template keys, inline tables and normalized parser readback', async t => {
  const { root, path, discovery } = await fixture(t);
  const ui = await connectUi(t, discovery);
  for (const [key, value, expected, applies] of [
    ['keys.layouts', ['ru', 'ru'], ['ru'], 'now'],
    ['verification.droplet.workers', 3, 3, 'now'],
    ['verification.wait_p90_target', '120s', '2m', 'now'],
    ['visibility.messages.agent', 'watch', 'watch', 'restart'],
  ] as const) {
    const result = await ui.request({ type: 'config.set', key, value });
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.deepEqual(result.value, { key, value: expected, applies });
  }
  const qa = await cland(root, 'config', 'set', 'plan.qa_default', '{ scope = "affected", when = "per-item" }', '--json');
  assert.equal(qa.code, 0, qa.stderr);
  assert.deepEqual(JSON.parse(qa.stdout), { key: 'plan.qa_default', value: { scope: 'affected', when: 'per-item' }, applies: 'restart' });
  const parsed = parseConfig(await readFile(path, 'utf8'), root);
  assert.equal(parsed.verification.droplet.workers, 3);
  assert.equal(parsed.visibility.messages?.agent, 'watch');
  assert.deepEqual(parsed.keys.layouts, ['ru']);
});

test('config set enforces shell roles at the frame boundary and posts refusals in Agents', async t => {
  const { root, path, discovery } = await fixture(t);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  for (const role of ['coordinator', 'aide', 'implementer', 'reviewer', 'qa', 'lead']) {
    const name = `settings-${role}`;
    assert.equal((await ui.request({ type: 'role.set', session: name, role })).ok, true);
    const allowed = role === 'coordinator' || role === 'aide';
    const before = await readFile(path, 'utf8');
    const result = await ui.request({ type: 'config.set', key: 'plan.approval', value: 'human', as: { name } });
    assert.equal(result.ok, allowed, JSON.stringify(result));
    const cli = await clandWithEnv(root, { CLAND_SESSION_NAME: name }, 'config', 'set', 'plan.approval', 'none');
    assert.equal(cli.code, allowed ? 0 : 1, cli.stderr);
    if (!allowed) {
      assert.match(String(result.error), /forbidden.*config.set.*Coordinator, an Aide or the human/);
      assert.match(cli.stderr, /forbidden.*config.set/);
      assert.equal(await readFile(path, 'utf8'), before);
      await eventually('Agents contains the role refusal', () => ui.frames.find(frame => JSON.stringify(frame).includes(name) && JSON.stringify(frame).includes('config editing belongs')));
    }
  }
});

test('atomic settings replacement refuses a changed source and removes its temporary file', async t => {
  const root = await tempProject(t);
  const path = join(root, 'config.toml');
  await writeFile(path, 'human changed this');
  assert.throws(() => writeAtomic(root, path, 'candidate', 'original source'), /changed while setting it; retry/);
  assert.equal(await readFile(path, 'utf8'), 'human changed this');
  assert.deepEqual(await readdir(root), ['config.toml']);
});
