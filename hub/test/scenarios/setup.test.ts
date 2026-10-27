// T3 scenario: setup provisions a scratch machine through the real CLI/PTY, starts the hub and Aide,
// opens a stand-in workbench, converges on rerun, and stops every owned process before removal.
// Rule coverage (T1/T2): hub/test/setup-flow.test.ts, hub/test/setup-hub.test.ts,
// hub/test/setup-hub-component.test.ts, hub/test/setup-cli.test.ts, hub/test/setup-accounts.test.ts,
// hub/test/setup-favourite.test.ts, hub/test/setup-trust.test.ts, hub/test/setup-handover.test.ts.
// Hub process starts: 1 detached scratch hub; the declined-install machine starts none.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmod, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';
import { parse } from 'smol-toml';
import { shellQuote } from '../../src/accounts/registry.ts';
import { CLI_ENTRY, eventually, isolateVerification, pidAlive, readDiscovery } from '../harness.ts';
import { gitIn, initIn, machineEnvironment } from '../init-machine.ts';
import { beforeDirectories, cleanupProcesses, ownDirectory, ownProcess } from '../process-cleanup.ts';
import { calls, profileEnvironment, setupMachine, signIn, type SetupMachine } from '../setup-machine.ts';

const brief = "Run the onboarding skill; project: empty; harnesses: claude-code, codex; human's harness: claude-code";
const allOk = [
  ['project', 'ok'], ['claude-code', 'ok'], ['codex', 'ok'], ['opencode', 'skip'],
  ['claude-code login', 'ok'], ['codex login', 'ok'], ['accounts', 'ok'],
  ['favourite', 'ok'], ['trust', 'ok'], ['hub', 'ok'], ['remote telegram', 'skip'], ['aide', 'ok'],
];

function stepLines(output: string): string[][] {
  return [...output.matchAll(/^(ok|done|skip|open|fail) +(.+?) {2}[^\n]*/gm)].map(m => [m[2]!, m[1]!]);
}

/** Answer only after the real prompt arrives; an unexpected question times out instead of being accepted. */
async function terminalSetup(t: TestContext, machine: SetupMachine, answers: Array<[string, string]>, args: string[] = []) {
  const command = [process.execPath, CLI_ENTRY, 'setup', ...args].map(shellQuote).join(' ')
    + '; status=$?; printf "\\nSETUP_EXIT:%s\\n" "$status"; exit "$status"';
  const argv = process.platform === 'darwin' ? ['-q', '/dev/null', 'sh', '-c', command] : ['-qefc', command, '/dev/null'];
  // BSD script accepts a POSIX pipe but rejects Node's socketpair stdin with tcgetattr.
  const pipe = 'while IFS= read -r line; do printf "%s\\n" "$line"; done | ';
  // cland-allow-child-env: setupMachine owns HOME/XDG; machineEnvironment preserves its intentionally unset Claude profile and scratch account inputs
  const child = spawn('sh', ['-c', pipe + ['script', ...argv].map(shellQuote).join(' ')], { cwd: machine.project, env: machineEnvironment(machine), stdio: ['pipe', 'pipe', 'pipe'], signal: t.signal });
  const stop = ownProcess(t, child.pid);
  let output = '', answered = 0, timedOut = false;
  child.stdin.on('error', () => {}); // A rejected or completed CLI may close before script drains.
  const consume = (chunk: Buffer) => {
    output += String(chunk).replaceAll('\r', '');
    if (output.includes('SETUP_EXIT:')) child.stdin.end();
    const next = answers[answered];
    if (next && output.includes(next[0])) {
      answered++;
      child.stdin.write(next[1] + '\n');
    }
  };
  child.stdout.on('data', consume);
  child.stderr.on('data', consume);
  const closed = new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', () => resolve());
  });
  const terminalDeadlineMs = 30_000;
  const timer = setTimeout(() => { timedOut = true; void stop(); }, terminalDeadlineMs);
  beforeDirectories(t, async () => { await stop(); await closed; });
  try { await closed; }
  finally { clearTimeout(timer); }
  assert.equal(timedOut, false, output);
  assert.equal(answered, answers.length, output);
  const receipt = /SETUP_EXIT:(\d+)/.exec(output);
  assert.ok(receipt, output);
  return { code: Number(receipt[1]), output };
}

async function ok(machine: SetupMachine, ...args: string[]) {
  const result = await initIn(machine, machine.project, ...args);
  assert.equal(result.code, 0, result.stdout + result.stderr);
  return result.stdout;
}

async function prepare(t: TestContext): Promise<SetupMachine> {
  const machine = await setupMachine(t, { installed: ['claude-code'] });
  machine.env.CLAND_TEST_SKIP_ORPHAN_SWEEP = '1';
  // macOS's default temp path plus HOME/tmp exceeds sockaddr_un's path limit.
  machine.env.TMPDIR = await mkdtemp('/tmp/cland-setup-');
  ownDirectory(t, machine.env.TMPDIR);
  const config = join(machine.project, '.cland/config.toml');
  const header = (await readFile(config, 'utf8')).split('\n')[0];
  await isolateVerification(machine.project);
  // The generic isolation helper serializes TOML, so retain setup's managed-file mark.
  await writeFile(config, header + '\n' + (await readFile(config, 'utf8')).replace(/^declined_installs = .*$/m, 'declined_installs = ["opencode"]'));
  await signIn(machine, 'codex'); // The installed-on-demand Codex already has a scratch login.
  const fixtureIdentity = await stat(machine.root);
  beforeDirectories(t, async () => {
    // Vendor logs are historical observations, never authority to acquire a live PID.
    // The private root's inode plus each live process's cwd/ancestry proves ownership,
    // including a detached Aide whose launch failed before session.list returned.
    const current = await stat(machine.root);
    assert.equal(current.dev, fixtureIdentity.dev);
    assert.equal(current.ino, fixtureIdentity.ino);
    await cleanupProcesses(machine.root);
  });
  return machine;
}

test('setup provisions a scratch machine, reuses its hub and Aide, and remembers declined installs', { timeout: 120_000 }, async t => {
  const machine = await prepare(t);
  // Remove the generic init fixture's seed README to represent the ticket's empty project.
  const removed = await gitIn(machine, machine.project, 'rm', 'README.md');
  assert.equal(removed.code, 0, removed.stderr);
  const other = { ...machine, env: profileEnvironment(machine, 'claude-code', join(machine.home, '.claude-work')) };
  await signIn(other, 'claude-code', true, { email: 'work@example.test' });
  // Exercise the default scratch ~/.claude.json, rather than an explicit profile override.
  delete machine.env.CLAUDE_CONFIG_DIR;

  const launcher = join(machine.home, 'launcher');
  const launchLog = join(machine.home, 'launcher.jsonl');
  await writeFile(launcher, `#!${process.execPath}\nimport { appendFileSync } from 'node:fs';\nappendFileSync(${JSON.stringify(launchLog)}, JSON.stringify({ session: process.env.CLAND_OPEN_SESSION, root: process.argv[2] }) + '\\n');\n`);
  await chmod(launcher, 0o755);
  machine.env.CLAND_LAUNCHER = launcher;

  // Observe the actual detached spawn before discovery, including failed startup, so cleanup
  // owns it even if setup never returns. This observer only records; it changes no decisions.
  const observer = join(machine.home, 'observe.mjs');
  const starts = join(machine.home, 'hub-starts.jsonl');
  await writeFile(observer, `
    import childProcess from 'node:child_process';
    import { appendFileSync } from 'node:fs';
    import { syncBuiltinESMExports } from 'node:module';
    const spawn = childProcess.spawn;
    childProcess.spawn = function(command, args, options) {
      const child = spawn.call(this, command, args, options);
      if (args?.[1] === 'hub' && args?.[2] === 'serve' && child.pid) appendFileSync(${JSON.stringify(starts)}, JSON.stringify(child.pid) + '\\n');
      return child;
    };
    syncBuiltinESMExports();
  `);
  machine.env.NODE_OPTIONS = `--import=${pathToFileURL(observer).href}`;


  const first = await terminalSetup(t, machine, [
    ['Install Codex now? [y/N]', 'y'], ['Sign in to Claude Code now? [Y/n]', 'y'],
    ['Write them to ~/.config/cland/accounts.toml? [y/N]', ''], ['Which harness do you talk to? [1]', '1'], ['Set up Telegram remote now? [y/N]', ''],
  ]);
  assert.equal(first.code, 0, first.output);
  assert.deepEqual(stepLines(first.output), [
    ['project', 'ok'], ['claude-code', 'ok'], ['codex', 'done'], ['opencode', 'skip'],
    ['claude-code login', 'done'], ['codex login', 'ok'], ['accounts', 'skip'],
    ['favourite', 'done'], ['trust', 'done'], ['hub', 'done'], ['remote telegram', 'skip'], ['aide', 'done'],
  ]);
  await assert.rejects(readFile(join(machine.env.XDG_CONFIG_HOME!, 'cland/accounts.toml')), { code: 'ENOENT' });
  const roles = parse(await readFile(join(machine.project, '.cland/roles.toml'), 'utf8')) as { aide: { launch: { harness: string } } };
  assert.equal(roles.aide.launch.harness, 'claude-code');
  const claude = JSON.parse(await readFile(join(machine.home, '.claude.json'), 'utf8'));
  assert.equal(claude.projects[machine.project].hasTrustDialogAccepted, true);
  const codex = parse(await readFile(join(machine.home, '.codex/config.toml'), 'utf8')) as { projects: Record<string, { trust_level: string }> };
  assert.equal(codex.projects[machine.project]?.trust_level, 'trusted');
  const discovery = await readDiscovery(machine.project);
  const stopHub = ownProcess(t, discovery.pid);
  assert.equal(pidAlive(discovery.pid), true);
  const status = JSON.parse(await ok(machine, 'hub', 'status', '--json'));
  assert.equal(status.pid, discovery.pid);
  const list = JSON.parse(await ok(machine, 'session', 'list', '--json'));
  const aide = list.processes.find((p: { name: string }) => p.name === 'aide-1');
  assert.equal(aide?.status, 'running');
  assert.equal(aide.role, 'aide');
  assert.equal(aide.harness, 'claude-code');
  assert.equal(typeof aide.pid, 'number');
  const stopAide = ownProcess(t, aide.pid);
  // The fake harness's native job log proves the brief reached the real launched process.
  await eventually('onboarding brief reached the fake Aide', async () => {
    const log = await readFile(join(machine.env.FAKE_CLAUDE_HOME!, 'jobs', `${aide.harnessId}.log`), 'utf8');
    return log.includes(brief) || undefined;
  }, 10_000);
  assert.deepEqual(JSON.parse((await readFile(launchLog, 'utf8')).trim()), { session: 'aide-1', root: machine.project });

  const second = await terminalSetup(t, machine, [['Set up Telegram remote now? [y/N]', '']]);
  assert.equal(second.code, 0, second.output);
  assert.deepEqual(stepLines(second.output), allOk);
  const third = await ok(machine, 'setup'); // Pipes, no answers and no --no-aide escape hatch.
  assert.deepEqual(stepLines(third), allOk);
  assert.match(third, /without a terminal/);
  assert.doesNotMatch(third, /\[[Yy]\/N\]|\[Y\/n\]|Which harness do you talk to\?/);
  assert.match(second.output, /Set up Telegram remote now\? \[y\/N\]/);
  assert.equal((await readFile(launchLog, 'utf8')).trim().split('\n').length, 2, 'only terminal runs open the launcher');
  assert.deepEqual((await readFile(starts, 'utf8')).trim().split('\n').map(Number), [discovery.pid]);
  assert.equal((await readDiscovery(machine.project)).pid, discovery.pid);
  const codexPids = [...new Set((await calls(machine)).filter(c => c.harness === 'codex').map(c => c.pid))];
  await eventually('all short-lived fake Codex processes exited', () => codexPids.every(pid => !pidAlive(pid)) || undefined, 5000);
  assert.ok(codexPids.every(pid => !pidAlive(pid)));

  // The second machine proves the remembered decline and explicit retry without a second hub.
  const declined = await prepare(t);
  await signIn(declined, 'claude-code');
  const no = await terminalSetup(t, declined, [['Install Codex now? [y/N]', ''], ['Set up Telegram remote now? [y/N]', '']], ['--no-aide']);
  assert.equal(no.code, 0, no.output);
  const again = await terminalSetup(t, declined, [['Set up Telegram remote now? [y/N]', '']], ['--no-aide']);
  assert.equal(again.code, 0, again.output);
  assert.doesNotMatch(again.output, /Install Codex now\?/);
  assert.match(again.output, /skip +codex +declined earlier/);
  assert.equal((await calls(declined)).filter(c => c.harness === 'curl').length, 0);
  const retry = await ok(declined, 'setup', '--install', 'codex', '--yes', '--no-aide');
  assert.match(retry, /done +codex /);
  assert.equal((await calls(declined)).filter(c => c.harness === 'curl').length, 1);
  await assert.rejects(readFile(join(declined.project, '.cland/hub.json')), { code: 'ENOENT' });

  const vendorCalls = [...await calls(machine), ...await calls(declined)];
  const census = Object.fromEntries(['claude-code', 'codex', 'curl'].map(harness => [harness,
    new Set(vendorCalls.filter(call => call.harness === harness).map(call => call.pid)).size]));
  t.diagnostic(`setup spawn census: 1 observed detached hub, 1 running Aide; unique vendor invocation PIDs across both machines ${JSON.stringify(census)}`);

  await ok(machine, 'session', 'stop', 'aide-1');
  await eventually('Aide PID gone after stop acknowledgement', () => !pidAlive(aide.pid) || undefined, 5000);
  assert.equal(pidAlive(aide.pid), false);
  await stopAide();
  await ok(machine, 'hub', 'stop');
  await eventually('hub PID gone after stop acknowledgement', () => !pidAlive(discovery.pid) || undefined, 5000);
  assert.equal(pidAlive(discovery.pid), false);
  await stopHub();
});
