// T2: config CLI argument handling requires the CLI against an in-process project hub.
import { sessionUi as connectUi, sessionClandWithEnv as clandWithEnv } from './session-credential-fixture.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, symlink, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultConfig, parseConfig, renderConfig } from '../src/init/config.ts';
import { cland, eventually, projectHub, tempProject } from './harness.ts';
import { writeAtomic } from '../src/init/files.ts';
import { testMessenger } from './fakes/messenger.ts';
import type { RemoteSettings } from '../src/remote/configuration.ts';
import { heldRemoteBoundary } from './fakes/held-remote-boundary.ts';
import { within } from '../src/executor/droplet/deadline.ts';

test('a remote secrets reload refusal retains valid role admission and the last-good pair', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Remote refusal');
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  await writeFile(join(root, '.cland/roles.toml'), '[reviewer.launch]\nharness="claude-code"\nmodel="stable"\n');
  const logs: Record<string, unknown>[] = [];
  const hub = await projectHub(t, root, {}, { log: entry => { logs.push(entry); } });
  const ui = await connectUi(t, hub.discovery);
  const before = (await ui.request({ type: 'hub.status' })).value as { config: unknown };
  await writeFile(join(root, '.cland/secrets.toml'), '[broken');
  const refused = await ui.request({ type: 'hub.reload' });
  assert.equal(refused.ok, false);
  assert.match(String(refused.error), /secrets.toml: invalid TOML/);
  const launch = await ui.request({ type: 'session.launch', name: 'after-remote-refusal', role: 'reviewer' });
  assert.equal(launch.ok, true, JSON.stringify(launch));
  assert.equal(hub.fakes['claude-code']!.spawns.find(spawn => spawn.name === 'after-remote-refusal')?.model, 'stable');
  assert.deepEqual(((await ui.request({ type: 'hub.status' })).value as { config: unknown }).config, before.config);
  assert.equal(logs.some(entry => entry.event === 'roles-unreadable'), false, 'a remote application failure is not a role policy error');
  assert.ok(logs.some(entry => entry.event === 'config-reload-failed' && entry.file === 'remote configuration' && String(entry.error).includes('secrets.toml: invalid TOML')));
});

test('config set and hub reload start and stop configured messengers only with a token', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Remote settings');
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const remotes: ReturnType<typeof testMessenger>[] = [];
  const hub = await projectHub(t, root, {}, { gatewayMessenger: (via, _token, _settings) => {
    const remote = testMessenger(via, via);
    remotes.push(remote);
    return remote;
  } });
  for (const via of ['telegram', 'discord'] as const) {
    const enabled = await cland(root, 'config', 'set', `remote.${via}.enabled`, 'true');
    assert.equal(enabled.code, 0, enabled.stderr);
    assert.equal((await cland(root, 'hub', 'reload')).code, 0);
    assert.equal(remotes.length, 0, 'enabled without token stays inactive');
    // Made-up secrets enter through a private fixture file, never argv or a frame.
    await writeFile(join(root, '.cland/secrets.toml'), `[${via}]\ntoken="123456:made_up_test_token_abcdefghijk"\n`, { mode: 0o600 });
    const loaded = await cland(root, 'hub', 'reload', '--json');
    assert.equal(loaded.code, 0, loaded.stderr);
    const remote = remotes.at(-1)!;
    await remote.client.waitFor(frame => frame.type === 'welcome');
    assert.equal(remote.started, true);
    assert.equal((await remote.client.request({ type: 'hub.status' })).ok, true);
    assert.equal((await cland(root, 'hub', 'reload')).code, 0);
    assert.equal(remotes.length, 1, 'an unchanged reload retains the connected messenger');
    const disabled = await cland(root, 'config', 'set', `remote.${via}.enabled`, 'false');
    assert.equal(disabled.code, 0, disabled.stderr);
    assert.equal((await cland(root, 'hub', 'reload')).code, 0);
    assert.equal(remote.stopped, true, 'reload result follows messenger stop receipt');
    await unlink(join(root, '.cland/secrets.toml'));
    remotes.length = 0;
  }
  await hub.stop();
});

async function heldConfiguration(t: Parameters<typeof tempProject>[0], receipt = true) {
  const hold = heldRemoteBoundary(t, receipt);
  let hub: Awaited<ReturnType<typeof projectHub>> | undefined;
  hold.close(() => within(hub?.stop() ?? Promise.resolve(), 1000));
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/secrets.toml'), '[telegram]\ntoken="123456:made_up_test_token_abcdefghijk"\n', { mode: 0o600 });
  const config = defaultConfig('Held reload');
  config.verification.lockPath = join(root, 'suite.lock');
  const path = join(root, '.cland/config.toml');
  const rolePath = join(root, '.cland/roles.toml');
  await writeFile(path, renderConfig(config));
  await writeFile(rolePath, '[reviewer.launch]\nharness="claude-code"\nmodel="stable"\n');
  const remote = testMessenger('telegram');
  hub = await projectHub(t, root, {}, { gatewayMessenger: () => ({ ...remote, start: async send => {
    await hold.hold();
    remote.start(send);
  } }) });
  const ui = await connectUi(t, hub.discovery);
  return { hold, root, config, path, rolePath, remote, hub, ui,
    reload: () => hold.own(ui.request({ type: 'hub.reload' }, 1000)),
    stop: () => within(hold.own(hub!.stop()), 1000),
  };
}

test('shutdown joins a messenger start held during config reload before removing its store', { timeout: 5000 }, async t => {
  const f = await heldConfiguration(t);
  try {
    f.config.remote.telegram.enabled = true;
    await writeFile(f.path, renderConfig(f.config));
    const started = f.hold.setup();
    const reloading = f.reload();
    await started;
    const stopping = f.stop();
    f.hold.resume();
    await stopping;
    await reloading.catch(() => {}); // Closing the edge may win the request response.
    assert.equal(f.remote.stopped, true);
    assert.equal(f.remote.running, false);
  } finally { await f.hold.dispose(); }
});

for (const failure of ['missing receipt', 'aborted setup'] as const) {
  test(`held reload disposal drains the messenger after ${failure}`, { timeout: 5000 }, async t => {
    const f = await heldConfiguration(t, false);
    f.config.remote.telegram.enabled = true;
    await writeFile(f.path, renderConfig(f.config));
    const setup = f.hold.setup();
    const failed = assert.rejects(setup, failure === 'missing receipt' ? /setup receipt deadline reached/ : /setup cancelled/);
    const actual = f.hold.actual();
    const reloading = f.reload();
    await actual;
    if (failure === 'missing receipt') await f.hold.clock.advance(1000);
    else f.hold.setupAbort.abort(new Error('remote fixture setup cancelled'));
    await failed;
    await f.hold.dispose();
    assert.equal((await reloading).ok, true, 'disposal releases and joins the held reload before closing the hub');
    await within(f.hub.stopped, 1000);
    assert.equal(f.remote.stopped, true, 'the hub stop receipt follows the messenger stop');
    assert.equal(f.remote.running, false);
    assert.equal(f.hold.clock.pending, 0);
  });
}

for (const source of ['config', 'roles'] as const) {
  test(`reload refuses ${source} source edits during held messenger preparation and retains the last-good pair`, { timeout: 5000 }, async t => {
    t.mock.timers.enable({ apis: ['setInterval'] }); // Explicit reload owns this race, not the role watcher.
    const f = await heldConfiguration(t);
    try {
      const before = (await f.ui.request({ type: 'hub.status' })).value as { config: unknown; verification: { remoteBudget: number } };
      f.config.remote.telegram.enabled = true;
      f.config.verification.remoteBudget = 3;
      await writeFile(f.path, renderConfig(f.config));
      const setup = f.hold.setup();
      const reloading = f.reload();
      await setup;
      if (source === 'config') {
        f.config.verification.remoteBudget = 8;
        await writeFile(f.path, renderConfig(f.config) + '# edited while preparing\n');
      } else await writeFile(f.rolePath, '[reviewer.launch]\nharness="claude-code"\nmodel="changed-during-preparation"\n');
      f.hold.resume();
      const refused = await reloading;
      assert.equal(refused.ok, false, JSON.stringify(refused));
      assert.match(String(refused.error), new RegExp(`${source}.toml changed during reload; retry`));
      const retained = (await f.ui.request({ type: 'hub.status' })).value as { config: unknown; verification: { remoteBudget: number } };
      assert.deepEqual(retained.config, before.config);
      assert.equal(retained.verification.remoteBudget, before.verification.remoteBudget);
      const listed = (await f.ui.request({ type: 'role.list' })).value as { roles: Array<{ role: string; launch: { model: string } }> };
      assert.equal(listed.roles.find(role => role.role === 'reviewer')?.launch.model, 'stable');
    } finally { await f.hold.dispose(); }
  });
}

test('startup and reload supply every remote and speech setting to the messenger factory', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/secrets.toml'), '[telegram]\ntoken="123456:made_up_test_token_abcdefghijk"\n', { mode: 0o600 });
  const config = defaultConfig('Factory settings');
  config.verification.lockPath = join(root, 'suite.lock');
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const settings: RemoteSettings[] = [];
  const remotes: ReturnType<typeof testMessenger>[] = [];
  const hub = await projectHub(t, root, {}, { gatewayMessenger: (via, token, snapshot) => {
    assert.equal(token === '123456:made_up_test_token_abcdefghijk', true, 'factory receives the resolved fixture token privately');
    settings.push(snapshot);
    const remote = testMessenger(via, via);
    remotes.push(remote);
    return remote;
  } });
  assert.equal(remotes[0]!.running, true, 'enabled with token starts at hub startup');
  const ui = await connectUi(t, hub.discovery);
  for (const [key, value] of [
    ['remote.mute_default', true], ['remote.telegram.format', 'entities'], ['remote.discord.enabled', true],
    ['speech.provider', 'command'], ['speech.model', 'custom'], ['speech.language', 'en'],
    ['speech.max_seconds', 90], ['speech.command', ['transcribe', '--input']],
  ]) {
    const reply = await ui.request({ type: 'config.set', key, value });
    assert.equal(reply.ok, true, JSON.stringify(reply));
  }
  assert.deepEqual(settings.at(-1), {
    remote: { muteDefault: true, telegram: { enabled: true, format: 'entities' }, discord: { enabled: true } },
    speech: { provider: 'command', model: 'custom', language: 'en', maxSeconds: 90, command: ['transcribe', '--input'] },
  });
  const reply = await ui.request({ type: 'hub.reload' });
  assert.equal(reply.ok, true, JSON.stringify(reply));
  const applied = (reply.value as { applied: string[] }).applied;
  for (const key of ['remote.mute_default', 'remote.telegram.enabled', 'remote.telegram.format', 'remote.discord.enabled', 'speech.provider', 'speech.model', 'speech.language', 'speech.max_seconds', 'speech.command']) assert.ok(applied.includes(key), key);
  await hub.stop();
  assert.equal(remotes.every(remote => remote.stopped), true);
});

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
  // The CLI proves literal argv handling; writer permutations live at T1.
  for (const [key, value] of [
    ['test_unit', '  python3 -m pytest "unit tests" && echo unit | cat  '],
    ['test_unit', 'true'],
    // README Python example: literal CLI arguments read back through the parser (C4).
    ['check', 'python3 -m compileall -q .'],
    ['test', 'python3 -m unittest'],
  ] as const) {
    const result = await cland(root, 'config', 'set', `verification.${key}`, value);
    assert.equal(result.code, 0, result.stderr);
    assert.ok(result.stdout.includes(`verification.${key} = ${JSON.stringify(value)}; applies now`), result.stdout);
    assert.equal(parseConfig(await readFile(path, 'utf8'), root).verification[key], value);
  }
});

test('config set accepts setup decline lists and refuses unknown harness ids', async t => {
  const { root, path } = await fixture(t);
  const result = await cland(root, 'config', 'set', 'setup.declined_installs', '["codex", "opencode"]');
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(parseConfig(await readFile(path, 'utf8'), root).setup.declinedInstalls, ['codex', 'opencode']);
  const original = await readFile(path, 'utf8');
  const invalid = await cland(root, 'config', 'set', 'setup.declined_installs', '["unknown"]');
  assert.equal(invalid.code, 1);
  assert.match(invalid.stderr, /setup.declined_installs.*harness ids/);
  assert.equal(await readFile(path, 'utf8'), original);
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

test('config set saves web settings for the next hub start and keeps pending edits out of the loaded config', async t => {
  const { root, path } = await fixture(t);
  const before = JSON.parse((await cland(root, 'hub', 'status', '--json')).stdout);
  const saved = await cland(root, 'config', 'set', 'web.origin', 'https://phone.example', '--json');
  assert.equal(saved.code, 0, saved.stderr);
  assert.deepEqual(JSON.parse(saved.stdout), { key: 'web.origin', value: 'https://phone.example', applies: 'restart' });
  assert.equal(parseConfig(await readFile(path, 'utf8'), root).web.origin, 'https://phone.example');
  const pending = await cland(root, 'config', 'set', 'verification.remote_budget', '5', '--json');
  assert.equal(pending.code, 0, pending.stderr);
  assert.match(JSON.parse(pending.stdout).applies, /saved; not applied:.*web changed: restart required/);
  assert.equal(JSON.parse((await cland(root, 'hub', 'status', '--json')).stdout).verification.remoteBudget, before.verification.remoteBudget);
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
