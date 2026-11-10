// T3: fake harness sign-in and turns cross native child-process boundaries; detached login holders must survive sign-in and be observed reaped. No hub or provider.
import './cover-quiet.ts';
import test, { type TestContext } from 'node:test';
import { holderRequest, stopLoginHolder } from './fakes/login-holder-client.ts';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, realpath, stat, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fixtureEnvironment, scratchAccountEnvironment } from './fixture-environment.ts';
import { loginFixtureOwners, loginChild } from './login-fixture-owners.ts';
import { testWaitMs, until } from './until.ts';

const binaries = { 'claude-code': 'claude-code/fake-claude.ts', codex: 'codex/fake-codex.ts', opencode: 'opencode/fake-opencode.ts' };

type Harness = keyof typeof binaries;
async function fixture(t: TestContext, harness: Harness, extra: NodeJS.ProcessEnv = {}) {
  const owners = loginFixtureOwners(t);
  const allocatedRoot = await mkdtemp(join(tmpdir(), 'fake-login-'));
  // LIFO: root removal follows every holder and native child join, even if a join rejects.
  owners.directory(allocatedRoot);
  const root = await realpath(allocatedRoot);
  const home = join(root, 'profile');
  const env = scratchAccountEnvironment(root, fixtureEnvironment(root, {}, { PATH: process.env.PATH,
    FAKE_LOGIN_ENABLED: '1', CLAUDE_CONFIG_DIR: home, CODEX_HOME: home,
    FAKE_CLAUDE_HOME: join(root, 'claude'), FAKE_CODEX_HOME: join(root, 'codex'), FAKE_OPENCODE_HOME: join(root, 'opencode'),
    FAKE_HARNESS_CALL_LOG: join(root, 'calls.jsonl'), FAKE_LOGIN_HOST: 'host-a', ...extra }), { openCodeDatabase: join(home, 'opencode.db') });
  owners.defer(() => stopLoginHolder(env.FAKE_LOGIN_HOME || home));
  const run = async (args: string[], input = 'fake-pasted-code\n') => {
    // cland-allow-child-env: scratchAccountEnvironment validates the explicit scratch database after fixtureEnvironment seals credentials and Git
    const child = spawn(process.execPath, [resolve('hub/test/fakes', binaries[harness]), ...args], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
    const closed = loginChild(owners, child);
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    const timer = setTimeout(() => child.kill('SIGKILL'), testWaitMs());
    child.stdin.end(input);
    try { return { code: await closed(), output }; } finally { clearTimeout(timer); }
  };
  return { owners, root, home, env, run, read: async () => JSON.parse(await readFile(join(env.FAKE_LOGIN_HOME || home, 'login.json'), 'utf8')),
    signIn: () => run(harness === 'codex' ? ['login', '--device-auth'] : ['auth', 'login']),
    turn: (text: string) => run(harness === 'claude-code' ? ['-p', text, '--session-id', 'session-a'] : [harness === 'codex' ? 'exec' : 'run', text, '--session', 'session-a']) };
}
for (const harness of ['claude-code', 'codex', 'opencode'] as const) {
  test(`${harness} sign-in writes generation zero in its harness home`, async t => {
    const f = await fixture(t, harness);
    assert.equal((await f.signIn()).code, 0);
    const login = await f.read();
    assert.equal(login.generation, 0); assert.equal(login.dead, false);
    assert.ok(login.token); assert.deepEqual(login.turns, []);
  });
  test(`${harness} turns rotate and dead logins recover only after sign-in`, async t => {
    const f = await fixture(t, harness);
    const signal = harness === 'claude-code' ? /authentication_failed.*OAuth token revoked/ : harness === 'codex' ? /refresh_token_reused.*unauthorized/ : /provider.auth/;
    assert.match((await f.turn('missing')).output, signal);
    await f.signIn();
    const initial = await f.read();
    assert.equal((await f.turn('hello')).code, 0);
    const rotated = await f.read();
    assert.equal(rotated.generation, 1); assert.notEqual(rotated.token, initial.token);
    assert.deepEqual(rotated.turns, [{ host: 'host-a', session: 'session-a', generation: 1 }]);
    assert.equal(rotated.lastRotation.host, 'host-a'); assert.equal(rotated.signIn.host, 'host-a');
    assert.match((await f.turn('DEAD-LOGIN')).output, signal);
    assert.equal((await f.read()).dead, true);
    assert.match((await f.turn('later')).output, signal);
    await f.signIn();
    assert.equal((await f.turn('recovered')).code, 0);
    assert.equal((await f.read()).generation, 1);
  });
}

test('Codex refuses a live login without changing bytes and replaces a dead login', async t => {
  const f = await fixture(t, 'codex');
  await f.signIn();
  const before = await readFile(join(f.home, 'login.json'), 'utf8');
  assert.equal((await f.signIn()).code, 1);
  assert.equal(await readFile(join(f.home, 'login.json'), 'utf8'), before);
  await f.turn('DEAD-LOGIN');
  assert.equal((await f.signIn()).code, 0);
  assert.equal((await f.read()).generation, 0);
  assert.notEqual((await f.read()).token, JSON.parse(before).token);
});
for (const harness of ['claude-code', 'codex', 'opencode'] as const) {
  test(`${harness} records CLI logout and slash logout`, async t => {
    const f = await fixture(t, harness);
    await f.signIn();
    assert.equal((await f.run(harness === 'codex' ? ['logout'] : ['auth', 'logout'])).code, 0);
    await f.signIn();
    await f.turn('/logout');
    const calls = (await readFile(join(f.root, 'calls.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    assert.ok(calls.some(call => call.args.join(' ') === (harness === 'codex' ? 'logout' : 'auth logout')));
    assert.ok(calls.some(call => call.args.join(' ') === '/logout'));
    assert.equal((await f.read()).dead, true);
  });
  test(`${harness} sign-in leaves one observed detached holder with an open home file`, async t => {
    const f = await fixture(t, harness, { FAKE_LOGIN_HOLDER: '1' });
    assert.equal((await f.signIn()).code, 0);
    const receipt = JSON.parse(await readFile(join(f.home, 'login-holder.json'), 'utf8'));
    assert.equal(receipt.cwd, f.home); assert.equal(receipt.file, join(f.home, 'login-holder.open'));
    process.kill(receipt.pid, 0);
    assert.equal(receipt.inode, (await stat(receipt.file)).ino);
    // Non-Codex re-sign-in must reuse the same holder; Codex refuses the live login.
    await f.signIn();
    assert.equal(JSON.parse(await readFile(join(f.home, 'login-holder.json'), 'utf8')).pid, receipt.pid);
  });
}

test('Codex native app-server turns retain the last twenty rotations and report revocation', async t => {
  const f = await fixture(t, 'codex', { FAKE_CODEX_TURN_MS: '1' });
  await f.signIn();
  // cland-allow-child-env: fixture returns a sealed environment with validated scratch account paths
  const child = spawn(process.execPath, [resolve('hub/test/fakes/codex/fake-codex.ts'), 'app-server'], { cwd: f.root, env: f.env, stdio: ['pipe', 'pipe', 'pipe'] });
  loginChild(f.owners, child);
  let buffer = '', diagnostics = '';
  const frames: Array<any> = [];
  child.stderr.on('data', data => { diagnostics = (diagnostics + data).slice(-2000); });
  child.stdout.on('data', data => {
    buffer += data;
    let end: number;
    while ((end = buffer.indexOf('\n')) >= 0) { frames.push(JSON.parse(buffer.slice(0, end))); buffer = buffer.slice(end + 1); }
  });
  let sequence = 0;
  const rpc = async (method: string, params: unknown = {}) => {
    const id = ++sequence;
    const waiting = until(() => frames.some(frame => frame.id === id), { what: `RPC ${method}: ${diagnostics}` });
    child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
    await waiting;
    const reply = frames.find(frame => frame.id === id);
    assert.equal(reply.error, undefined, JSON.stringify(reply));
    return reply.result;
  };
  await rpc('initialize');
  const thread = (await rpc('thread/start')).thread.id;
  for (let index = 0; index < 22; index++) {
    const before = frames.length;
    const completed = until(() => frames.slice(before).some(frame => frame.method === 'turn/completed'), { what: 'native turn completion' });
    const started = await rpc('turn/start', { threadId: thread, input: [{ type: 'text', text: 'hello' }] });
    await completed;
    assert.equal(frames.slice(before).find(frame => frame.method === 'turn/completed').params.turn.id, started.turn.id);
  }
  const login = await f.read();
  assert.equal(login.generation, 22);
  assert.deepEqual(login.turns.map((turn: { generation: number }) => turn.generation), [3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22]);
  assert.ok(login.turns.every((turn: { session: string }) => turn.session === thread));
  const before = frames.length;
  const completed = until(() => frames.slice(before).some(frame => frame.method === 'turn/completed'), { what: 'native revoked completion' });
  await rpc('turn/start', { threadId: thread, input: [{ type: 'text', text: 'DEAD-LOGIN' }] });
  await completed;
  assert.deepEqual(frames.slice(before).find(frame => frame.method === 'turn/completed').params.turn.error, { message: 'refresh_token_reused', codexErrorInfo: 'unauthorized' });
});

test('Claude refuses empty pasted input without creating a login', async t => {
  const f = await fixture(t, 'claude-code');
  assert.equal((await f.run(['auth', 'login'], '\n')).code, 1);
  await assert.rejects(f.read(), { code: 'ENOENT' });
});
test('holder stale receipt cannot suppress a fresh launch or authorize a signal', async t => {
  const f = await fixture(t, 'opencode', { FAKE_LOGIN_HOLDER: '1' });
  await mkdir(f.home, { recursive: true });
  await writeFile(join(f.home, 'login-holder.json'), JSON.stringify({ pid: process.pid, cwd: f.home }));
  assert.equal((await f.signIn()).code, 0);
  const receipt = JSON.parse(await readFile(join(f.home, 'login-holder.json'), 'utf8'));
  assert.notEqual(receipt.pid, process.pid);
});

test('holder cleanup works after receipt corruption and a crashed holder is replaced', async t => {
  const f = await fixture(t, 'opencode', { FAKE_LOGIN_HOLDER: '1' });
  assert.equal((await f.signIn()).code, 0);
  const live = await holderRequest(f.home, 'status');
  assert.ok(live);
  await writeFile(join(f.home, 'login-holder.json'), 'invalid JSON');
  await holderRequest(f.home, 'crash');
  await until(() => { try { process.kill(live.pid, 0); return false; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return true; throw error; } }, { what: 'self-crashed holder OS exit' });
  assert.equal((await f.signIn()).code, 0);
  const replacement = await holderRequest(f.home, 'status');
  assert.ok(replacement);
  assert.notEqual(replacement.pid, live.pid);
  await writeFile(join(f.home, 'login-holder.json'), 'invalid JSON');
  await stopLoginHolder(f.home);
  assert.equal(await holderRequest(f.home, 'status'), null);
});
test('uncommitted holder exits when sign-in fails after readiness', async t => {
  const f = await fixture(t, 'opencode', { FAKE_LOGIN_HOLDER: '1', FAKE_LOGIN_HOLDER_FAIL_AFTER_READY: '1' });
  const result = await f.signIn();
  assert.equal(result.code, 1, result.output);
  assert.match(result.output, /planted holder admission failure/);
  assert.equal(await holderRequest(f.home, 'status'), null);
});
for (const harness of ['claude-code', 'codex', 'opencode'] as const) {
  test(`${harness} preserves disabled-mode refusal parity`, async t => {
    const f = await fixture(t, harness, { FAKE_LOGIN_ENABLED: '0' });
    assert.equal((await f.run(harness === 'codex' ? ['logout'] : ['auth', 'logout'])).code, 1);
    if (harness === 'opencode') assert.equal((await f.run(['auth', 'login'])).code, 1);
  });
}
