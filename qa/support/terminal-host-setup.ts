import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import { fixture } from '../../hub/test/host-create-fixture.ts';
import { CLI_ENTRY, startDaemon, clandWithEnv, pidAlive, eventually } from '../../hub/test/harness.ts';
import { ownProcess, beforeDirectories } from '../../hub/test/process-cleanup.ts';
import { fixtureEnvironment } from '../../hub/test/fixture-environment.ts';
import { shellQuote } from '../../hub/src/accounts/registry.ts';
import { privateInviteCapture } from './invite-capture.ts';
import { setFakeLogin } from '../../hub/test/fakes/setup-profile.ts';
import type { JourneyScope } from './native-journey.ts';

export async function terminalHostSetup(t: TestContext, scope: JourneyScope) {
  const { f, env } = await scope.setup('complete terminal fixture acquisition', async () => {
    // The prepared fake pool has no login. Setup's real hosts step must add its first.
    const f = await fixture(t, { cardSignIn: {}, loginRoles: true });
    scope.adoptRoot(f.root);
    await f.hub.stop();
    // A terminal login is executed by the client, after the daemon created a host.
    // Refresh only this owned fixture's fake roster at the SSH process boundary.
    const ssh = join(f.root, 'bin/ssh');
    await unlink(ssh);
    await writeFile(ssh, `#!${process.execPath}\nimport {readdirSync} from 'node:fs';\nimport {dirname} from 'node:path';\nimport {hostDirectory} from ${JSON.stringify(new URL('../../shared/fake-host-directory.ts', import.meta.url).href)};\nimport {fixtureEnvironment} from ${JSON.stringify(new URL('../../hub/test/fixture-environment.ts', import.meta.url).href)};\nconst root=${JSON.stringify(f.root)};\nconst hosts=readdirSync(dirname(hostDirectory(root,'fake-probe'))).filter(n=>n.startsWith('fake-'));\nconst env=fixtureEnvironment(root,process.env,{CLAND_FAKE_HOST_ROOT:root,CLAND_FAKE_HOSTS:hosts.join(',')});\nprocess.execve(process.execPath,[process.execPath,${JSON.stringify(new URL('../../hub/test/fakes/fake-ssh.ts', import.meta.url).pathname)},...process.argv.slice(2)],env);\n`, { mode: 0o700 });
    const env = fixtureEnvironment(f.root, process.env, { ...f.env, CLAND_TEST_SKIP_ORPHAN_SWEEP: '1' }) as Record<string, string>;
    for (const key of ['HOME', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'XDG_CACHE_HOME']) await mkdir(env[key]!, { recursive: true });
    for (const harness of ['claude-code', 'codex', 'opencode'] as const) setFakeLogin(harness, true, env);
    for (const directory of [env.CLAUDE_CONFIG_DIR!, env.CODEX_HOME!, dirname(env.OPENCODE_DB || join(env.XDG_DATA_HOME!, 'opencode/opencode.db')), join(env.XDG_DATA_HOME!, 'cland/opencode')]) {
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, 'login.json'), JSON.stringify({ name: 'setup-local', token: 'fixture-control', generation: 0, signIn: { at: new Date().toISOString(), host: 'setup' }, lastRotation: null, dead: false, turns: [] }));
    }
    await promisify(execFile)('git', ['config', 'user.name', 'Fixture Admin'], { cwd: f.root, env: fixtureEnvironment(f.root, process.env, env) });
    const daemon = await startDaemon(t, f.root, env);
    f.stops.push(async () => {
      const result = await clandWithEnv(f.root, env, 'hub', 'stop');
      assert.equal(result.code, 0, result.stderr);
      await eventually('setup scratch hub reaped', () => !pidAlive(daemon.discovery.pid) || undefined, 15000);
      assert.equal(pidAlive(daemon.discovery.pid), false);
    });
    const configPath = join(f.root, '.cland/config.toml');
    await writeFile(configPath, '# managed by cland\n' + await readFile(configPath, 'utf8'));
    return { f, env };
  });
  await scope.step('complete scripted terminal and durable outcomes', async () => {
    const command = [process.execPath, CLI_ENTRY, 'setup', '--no-aide', '--no-accounts', '--harness', 'opencode'].map(shellQuote).join(' ')
      + '; status=$?; printf "\\nSETUP_EXIT:%s\\n" "$status"; exit "$status"';
    const args = process.platform === 'darwin' ? ['-q', '/dev/null', 'sh', '-c', command] : ['-qefc', command, '/dev/null'];
    const capture = privateInviteCapture();
    const answers: Array<[string, string]> = [
      ['Let several people sign in to the web (users mode)? [y/N]', 'y'],
      ['Continue? [y/N]', 'y'],
      ['Register a passkey on the invite page; Enter skips waiting.', ''],
      ['Set up Telegram remote now? [y/N]', ''],
      ['Set up Discord remote now? [y/N]', ''],
      ['Set up ElevenLabs transcription now? [y/N]', ''],
      ['cland login add opencode --pool agents: may boot a host', 'y'],
    ];
    let pending = '', answered = 0, timedOut = false;
    const child = spawn('sh', ['-c', 'while IFS= read -r line; do printf "%s\\n" "$line"; done | ' + ['script', ...args].map(shellQuote).join(' ')], { cwd: f.root, env: fixtureEnvironment(f.root, process.env, env), stdio: ['pipe', 'pipe', 'pipe'] });
    const stop = ownProcess(t, child.pid);
    let stopWork: Promise<void> | undefined;
    const stopTerminal = () => stopWork ??= stop();
    const close = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
      child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal }));
    });
    child.stdin.on('error', () => {});
    let captureError: unknown;
    const consume = (bytes: Buffer) => {
      try {
        const chunk = bytes.toString().replaceAll('\r', '');
        capture.write(chunk);
        pending = (pending + chunk).slice(-16384);
        const next = answers[answered];
        if (next && pending.includes(next[0])) { answered++; pending = ''; child.stdin.write(next[1] + '\n'); }
        if (pending.includes('SETUP_EXIT:')) child.stdin.end();
      } catch (error) {
        captureError ??= error;
        void stopTerminal().catch(() => {}); // Joined below and by the cleanup owner.
      }
    };
    child.stdout.on('data', consume); child.stderr.on('data', consume);
    const timer = setTimeout(() => { timedOut = true; void stopTerminal().catch(() => {}); }, 30000);
    beforeDirectories(t, async () => {
      const results = await Promise.allSettled([stopTerminal(), close]);
      const errors = results.flatMap(result => result.status === 'rejected' ? [result.reason] : []);
      if (errors.length) throw new AggregateError(errors, 'terminal closure incomplete');
    });
    let receipt;
    try { receipt = await close; } finally { clearTimeout(timer); }
    const stopResult = stopWork ? await Promise.allSettled([stopWork]) : [];
    const stopErrors = stopResult.flatMap(result => result.status === 'rejected' ? [result.reason] : []);
    if (stopErrors.length) t.diagnostic(JSON.stringify({ secondaryStopFailures: stopErrors.length, nativeReceipt: receipt }));
    if (captureError) throw new AggregateError([captureError, ...stopErrors], 'private terminal capture failed', { cause: captureError });
    const result = capture.finish();
    assert.equal(timedOut, false, result.text);
    assert.equal(receipt.signal, null, result.text);
    assert.equal(answered, answers.length, result.text);
    // Enter intentionally leaves the first user awaiting a passkey: setup reports open (exit 1).
    assert.match(result.text, /open +sign-in mode +users mode/);
    assert.match(result.text, /done +agent hosts opencode login/);
    assert.match(result.text, /SETUP_EXIT:1/);
    assert.equal(receipt.code, 1);
    if (stopErrors.length) throw new AggregateError(stopErrors, 'terminal stop failed after native close');
    assert.ok(result.links > 0);
    const users = await clandWithEnv(f.root, env, 'user', 'list');
    const logins = await clandWithEnv(f.root, env, 'login', 'list', '--json');
    assert.equal(users.code, 0); assert.equal(logins.code, 0);
    assert.match(users.stdout, /admin +(active|invited)/);
    assert.ok(JSON.parse(logins.stdout).some((row: { state: string }) => row.state === 'ready'));
    const config = await readFile(join(f.root, '.cland/config.toml'), 'utf8');
    capture.assertAbsent([result.text, users.stdout, logins.stdout, config]);
    t.diagnostic(JSON.stringify({ transcript: result.text, users: users.stdout, readyLogins: JSON.parse(logins.stdout).length, positiveControl: result.positiveControl, linksWithheld: result.links, nativeExit: receipt, configuredFakePool: true, limitation: 'Prepared fake pool; new DigitalOcean pool creation and first-login transport is T-2019' }));
  });
}
