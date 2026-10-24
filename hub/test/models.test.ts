// T3 integration: native Codex/OpenCode probe process startup, RPC/HTTP discovery and confirmed
// teardown before scratch-directory removal. Real CLI and fake harness binaries are necessary
// here to prove their catalog protocol, CLI output and the account environment seen by the child.
import { sessionUi as connectUi, sessionClandWithEnv as clandWithEnv } from './session-credential-fixture.ts';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { cland, FAKE_CLAUDE_DIR, FAKE_CODEX_DIR, nativeProjectHub as projectHub, tempProject } from './harness.ts';
import type { ModelList } from '../src/models.ts';
const FAKE_OPENCODE_DIR = fileURLToPath(new URL('./fakes/opencode', import.meta.url));

async function fixture(t: TestContext, extra: NodeJS.ProcessEnv | ((root: string) => NodeJS.ProcessEnv) = {}) {
  const root = await tempProject(t);
  const config = join(root, 'config');
  for (const dir of [join(config, 'cland'), join(root, 'codex-a'), join(root, 'oc-data'), join(root, 'oc-db')]) await mkdir(dir, { recursive: true });
  await writeFile(join(config, 'cland', 'accounts.toml'), `[accounts.codex-a]\nharness = "codex"\nhome = ${JSON.stringify(join(root, 'codex-a'))}\n[accounts.oc-data]\nharness = "opencode"\ndata_home = ${JSON.stringify(join(root, 'oc-data'))}\n[accounts.oc-db]\nharness = "opencode"\ndb = ${JSON.stringify(join(root, 'oc-db', 'account.db'))}\n`);
  const env = { XDG_CONFIG_HOME: config, XDG_DATA_HOME: join(root, 'data'), CODEX_HOME: join(root, 'default-codex'),
    CLAND_CODEX_BIN: join(FAKE_CODEX_DIR, 'codex'), CLAND_OPENCODE_BIN: join(FAKE_OPENCODE_DIR, 'opencode'), CLAND_CLAUDE_BIN: join(FAKE_CLAUDE_DIR, 'claude'),
    FAKE_CODEX_HOME: join(root, 'fake-codex'), FAKE_OPENCODE_HOME: join(root, 'fake-opencode'), ...(typeof extra === 'function' ? extra(root) : extra) };
  const served = await projectHub(t, root, env);
  const probes = async (harness: string): Promise<Array<Record<string, unknown>>> => {
    const source = await readFile(join(root, `fake-${harness}`, 'model-probes.jsonl'), 'utf8').catch(() => '');
    return source.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  };
  const models = async (harness: string, ...args: string[]) => {
    const r = await cland(root, 'models', harness, ...args, '--json');
    assert.equal(r.code, 0, r.stderr);
    return JSON.parse(r.stdout) as ModelList;
  };
  return { root, env, ...served, probes, models };
}

test('models CLI lists native catalogs, waits for OpenCode and caches each harness until refresh', async t => {
  // The native catalog's empty response is a protocol event, independent of when the caller is scheduled.
  const f = await fixture(t, { FAKE_OPENCODE_EMPTY_FIRST_MODEL_PROBE: '1' });
  for (const [harness, expected] of [['codex', 'fake-codex-default'], ['opencode', 'opencode/fake-free']]) {
    const r = await cland(f.root, 'models', harness!);
    assert.equal(r.code, 0, r.stderr);
    assert.ok(r.stdout.includes(`${expected} (default)`), r.stdout);
    assert.match(r.stdout, /probed now/);
    assert.ok(r.stdout.includes(harness === 'codex' ? 'fake-codex-other' : 'opencode/fake-paid'));
    const first = await f.probes(harness!);
    if (harness === 'opencode') {
      assert.ok(first.some(p => p.empty === true));
      assert.ok(first.some(p => p.empty === false));
      assert.ok(first.every(p => p.OPENCODE_DB === join(f.root, 'data', 'cland', 'opencode', 'opencode.db')));
    }
    const cached = await cland(f.root, 'models', harness!);
    assert.match(cached.stdout, /cached 0 min ago/);
    assert.equal((await f.probes(harness!)).length, first.length);
    const refreshed = await f.models(harness!, '--refresh');
    assert.deepEqual(Object.keys(refreshed).sort(), ['account', 'harness', 'models', 'probedAt', 'source']);
    assert.equal(refreshed.harness, harness);
    assert.equal(refreshed.account, null);
    assert.ok(Number.isFinite(Date.parse(refreshed.probedAt)));
    assert.ok((await f.probes(harness!)).length > first.length);
    assert.equal((await readdir(join(f.root, '.cland', 'run', 'models'))).length, 0, 'probe directories removed after process exit');
  }
});

test('models CLI labels static Claude aliases and reports unavailable harnesses and invalid arguments', async t => {
  const f = await fixture(t, { CLAND_CODEX_BIN: '/missing/cland-test-codex' });
  const r = await cland(f.root, 'models', 'claude-code');
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /default \(default\)/);
  assert.match(r.stdout, /sonnet\nopus\nhaiku\nClaude Code static aliases · probed now/);
  const missing = await cland(f.root, 'models', 'codex');
  assert.equal(missing.code, 1);
  assert.match(missing.stderr, /codex: not installed: CLAND_CODEX_BIN names .*which is not an executable — fix: point CLAND_CODEX_BIN/);
  for (const args of [[], ['unknown'], ['codex', '--account'], ['codex', '--other']]) {
    const invalid = await cland(f.root, 'models', ...args);
    assert.equal(invalid.code, 1);
    assert.match(invalid.stderr, /usage: cland models/);
  }
  assert.match((await cland(f.root, '--help')).stdout, /models claude-code\|codex\|opencode/);
});

test('models failed refresh keeps the cached list and original age; no cache returns the native probe error', async t => {
  const f = await fixture(t);
  for (const harness of ['codex', 'opencode']) {
    const first = await f.models(harness);
    await writeFile(join(f.root, `fake-${harness}`, 'fail-models'), 'fail');
    assert.deepEqual(await f.models(harness, '--refresh'), first);
    const text = await cland(f.root, 'models', harness, '--refresh');
    assert.equal(text.code, 0, text.stderr);
    assert.match(text.stdout, /cached 0 min ago/);
    const fresh = await cland(f.root, 'models', harness, '--account', harness === 'codex' ? 'codex-a' : 'oc-data');
    assert.equal(fresh.code, 1);
    assert.match(fresh.stderr, harness === 'codex' ? /fake Codex model probe failed/ : /fake OpenCode model probe failed/);
  }
});

test('models account probes use launch environments and have independent caches, also readable by sessions', async t => {
  const f = await fixture(t);
  const ui = await connectUi(t, f.discovery);
  for (const [harness, account, variable, path] of [
    ['codex', 'codex-a', 'CODEX_HOME', join(f.root, 'codex-a')],
    ['opencode', 'oc-data', 'XDG_DATA_HOME', join(f.root, 'oc-data')],
    ['opencode', 'oc-db', 'OPENCODE_DB', join(f.root, 'oc-db', 'account.db')],
  ]) {
    const ordinary = await f.models(harness!);
    const count = (await f.probes(harness!)).length;
    const named = await f.models(harness!, '--account', account!);
    assert.equal(named.account, account);
    const probes = await f.probes(harness!);
    assert.ok(probes.length > count);
    assert.equal(probes.at(-1)?.[variable!], path);
    if (account === 'oc-data') assert.equal(probes.at(-1)?.OPENCODE_DB, null, 'data_home must clear inherited database');
    assert.deepEqual(await f.models(harness!, '--account', account!), named);
    assert.deepEqual(await f.models(harness!), ordinary);
    assert.equal((await f.probes(harness!)).length, probes.length);
    const frame = await ui.request({ type: 'models.list', harness, account });
    assert.equal(frame.ok, true, frame.error);
    assert.deepEqual(frame.value, { ...named, cached: true });
  }
  const session = await clandWithEnv(f.root, { CLAND_SESSION_NAME: 'models-reader', CLAND_SESSION_ID: 'models-reader-id' }, 'models', 'codex', '--json');
  assert.equal(session.code, 0, session.stderr);
  assert.equal(JSON.parse(session.stdout).harness, 'codex');
  const mismatch = await cland(f.root, 'models', 'codex', '--account', 'oc-data');
  assert.equal(mismatch.code, 1);
  assert.match(mismatch.stderr, /uses opencode, but launch harness is codex/);
});

test('models cache survives hub restart, expires after 24 hours and coalesces concurrent refreshes', async t => {
  const f = await fixture(t);
  const first = await f.models('codex');
  await f.stop();
  const restarted = await projectHub(t, f.root, f.env);
  const count = (await f.probes('codex')).length;
  assert.deepEqual(await f.models('codex'), first);
  assert.equal((await f.probes('codex')).length, count);
  const ui = await connectUi(t, restarted.discovery);
  // Advance only the in-process hub's wall clock; subprocess harnesses still use real time.
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() + 25 * 60 * 60_000 });
  const answers = await Promise.all([
    ui.request({ type: 'models.list', harness: 'codex' }),
    ui.request({ type: 'models.list', harness: 'codex' }),
    ui.request({ type: 'models.list', harness: 'codex', refresh: true }),
  ]);
  for (const answer of answers) {
    assert.equal(answer.ok, true, answer.error);
    const result = answer.value as ModelList & { cached: boolean };
    assert.equal(result.cached, false);
    assert.notEqual(result.probedAt, first.probedAt);
  }
  assert.equal((await f.probes('codex')).length, count + 1);
  t.mock.timers.reset();
});

test('models resolves a relative PATH executable before starting the probe in its scratch directory', async t => {
  const f = await fixture(t, root => ({ CLAND_CODEX_BIN: '', PATH: `${relative(process.cwd(), join(root, 'bin'))}:${process.env.PATH ?? ''}` }));
  await mkdir(join(f.root, 'bin'));
  for (const file of ['codex', 'fake-codex.ts']) await symlink(join(FAKE_CODEX_DIR, file), join(f.root, 'bin', file));
  const catalog = await f.models('codex');
  assert.equal(catalog.models.find(model => model.default)?.id, 'fake-codex-default');
  assert.equal((await f.probes('codex')).length, 1);
});
