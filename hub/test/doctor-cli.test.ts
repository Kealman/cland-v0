// T3: process lifecycle: doctor kills a hanging probe's whole process group at its deadline.
// Real doctor commands also prove text/JSON rendering, stdout schema and healthy/no-hub exit codes.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createHook } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import cp from 'node:child_process';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { dirname, join } from 'node:path';
import { clandWithEnv, eventually, nativeProjectHub as projectHub, tempProject } from './harness.ts';
import { initialised, toolchain, check, notOk, NVIM_VERSION } from './doctor-fixture.ts';
import { run, type RunResult } from '../src/doctor/report.ts';
import { withoutExecutorCredentials } from '../../shared/executor-credentials.ts';
import { beforeDirectories, ownProcess } from './process-cleanup.ts';
const doctor = (root: string, env: Record<string, string>, ...args: string[]) => clandWithEnv(root, env, 'doctor', ...args);
const report = async (root: string, env: Record<string, string>) => {
  const result = await doctor(root, env, '--json');
  return { code: result.code, report: JSON.parse(result.stdout) as { root: string; version: string; checks: Array<{ name: string; verdict: 'ok' | 'warn' | 'fail'; detail: string; fix?: string }>; summary: { ok: number; warn: number; fail: number } } };
};

test('doctor CLI renders healthy text and JSON with exit 0', async (t) => {
  const tools = await toolchain(t, true);
  const root = await initialised(t, tools.env);
  await projectHub(t, root);

  let healthy: Awaited<ReturnType<typeof report>>['report'];
  await t.test('every check is ok and the exit code is 0', async () => {
    const { code, report: r } = await report(root, tools.env);
    healthy = r;
    assert.deepEqual(notOk(r), []);
    assert.equal(code, 0);
    const names = r.checks.map((c) => c.name);
    for (const name of ['claude-code', 'claude-code auth', 'codex', 'codex auth', 'opencode', 'opencode auth', 'gh', 'neovim', 'hub', 'hub.json', 'secret', 'roles.toml', 'config.toml', 'skills', 'skills manifest', 'claude hooks', 'cland mod', 'docs/agents', 'AGENTS.md', 'web bundle', 'tracker conflicts']) {
      assert.ok(names.includes(name), `the report checks ${name}`);
    }
    assert.match(check(r, 'claude-code').detail, /^2\.1\.294 at .*fakes\/claude-code\/claude \(tested with 2\.1\.294\)$/);
    assert.match(check(r, 'neovim').detail, new RegExp(`^${NVIM_VERSION.replace(/\./g, '\\.')} at `));
    assert.match(check(r, 'hub').detail, /^running: pid \d+, holds the lock, answers hub\.status/);
  });

  await t.test('the text report is plain: one line per check, no ANSI escapes when stdout is not a terminal', async () => {
    const r = await doctor(root, tools.env);
    assert.equal(r.code, 0, r.stdout);
    assert.doesNotMatch(r.stdout, /\x1b\[/);
    const lines = r.stdout.trimEnd().split('\n');
    assert.match(lines[0] ?? '', /^cland doctor \S+ in /);
    assert.equal(lines.at(-1), `${healthy.checks.length} ok, 0 warn, 0 fail`);
    assert.equal(lines.slice(1, -1).length, healthy.checks.length);
    for (const line of lines.slice(1, -1)) assert.match(line, /^ok {4}\S/);
  });

  await t.test('--json: root, version, checks of name/verdict/detail, the summary', async () => {
    const r = healthy;
    assert.equal(r.root, root);
    assert.equal(typeof r.version, 'string');
    assert.deepEqual(r.summary, { ok: r.checks.length, warn: 0, fail: 0 });
    for (const c of r.checks) assert.deepEqual(Object.keys(c).sort(), ['detail', 'name', 'verdict']);
  });

});
test('doctor CLI reports a startable no-hub warning with exit 0', async (t) => {
  const tools = await toolchain(t, true);
  const root = await initialised(t, tools.env);
  const { code, report: r } = await report(root, tools.env);
  assert.equal(check(r, 'hub').verdict, 'warn');
  assert.equal(check(r, 'hub').fix, 'cland hub start');
  assert.equal(check(r, 'hub.json').verdict, 'ok');
  assert.equal(code, 0);

});
/** An executable that never answers: it records its own pid and a grandchild's, which holds its stdout open. */
async function hanging(dir: string, name: string, pids: string): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, `#!/bin/sh\necho $$ >> '${pids}'\nsleep 60 &\necho $! >> '${pids}'\nwait\n`);
  await chmod(path, 0o755);
  return path;
}

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** Observe the native handles created synchronously by the probe's spawn, excluding the test runner's own pipes.
 * These probes never unref their handles: hasRef() becomes falsy when the native handle closes,
 * before async_hooks delivers its deferred destroy notification. */
async function probeResources(t: TestContext, start: (env: NodeJS.ProcessEnv) => Promise<RunResult>) {
  const root = await tempProject(t, 'cland-doctor-probe-');
  // Start from an allowlist, with no provider/account variables or inherited Git configuration.
  const env = withoutExecutorCredentials({
    PATH: '/usr/bin:/bin', HOME: root, TMPDIR: root,
    XDG_CONFIG_HOME: join(root, 'config'), XDG_DATA_HOME: join(root, 'data'),
    XDG_STATE_HOME: join(root, 'state'), XDG_CACHE_HOME: join(root, 'cache'),
    GIT_CONFIG_GLOBAL: join(root, '.gitconfig'), GIT_CONFIG_NOSYSTEM: '1',
  });
  await Promise.all([env.XDG_CONFIG_HOME, env.XDG_DATA_HOME, env.XDG_STATE_HOME, env.XDG_CACHE_HOME].map(dir => mkdir(dir)));
  await writeFile(env.GIT_CONFIG_GLOBAL, '');
  const nativeSpawn = cp.spawn;
  const launch = t.mock.method(cp, 'spawn', (bin: string, args: readonly string[], options: cp.SpawnOptions) => {
    // cland-allow-child-env: native CLI spy forwards product options under its owned root after the provider credential filter
    const child = nativeSpawn(bin, [...args], { ...options, cwd: root, env: withoutExecutorCredentials(options.env ?? {}), signal: t.signal, killSignal: 'SIGKILL' });
    let closed = false;
    child.once('close', () => { closed = true; });
    const stop = ownProcess(t, child.pid);
    beforeDirectories(t, async () => {
      await stop();
      await eventually('the owned probe closes before its fixture is removed', () => closed || undefined, 5000);
      assert.equal(closed, true);
    });
    return child;
  });
  syncBuiltinESMExports();
  const handles: Array<{ type: string; resource: { hasRef(): boolean } }> = [];
  const hook = createHook({
    init(_id, type, _trigger, resource) {
      if (type === 'PROCESSWRAP' || type === 'PIPEWRAP') handles.push({ type, resource: resource as { hasRef(): boolean } });
    },
  });
  hook.enable();
  let pending: Promise<RunResult>;
  try { pending = start(env); }
  finally { hook.disable(); launch.mock.restore(); syncBuiltinESMExports(); }
  const result = await pending;
  return { result, created: handles.map(h => h.type), open: handles.filter(h => h.resource.hasRef()).map(h => h.type) };
}

test('a probe timeout closes its native process and pipes before settling even when the child ignores SIGTERM', { timeout: 5000 }, async t => {
  const { result, created, open } = await probeResources(t, env => run(process.execPath, ['-e', `
    process.on('SIGTERM', () => {});
    process.stdout.write('ready');
    process.stderr.write('diagnostic');
    setInterval(() => {}, 1000);
  `], env, 1000));
  assert.deepEqual(result, { code: null, stdout: 'ready', stderr: 'diagnostic', error: 'no answer within 1 s' });
  assert.ok(created.includes('PROCESSWRAP'));
  assert.equal(created.filter(type => type === 'PIPEWRAP').length, 2);
  assert.deepEqual(open, [], 'probe-owned native handles are closed at promise settlement, without waiting afterwards');
});

test('a probe spawn error closes its native process and pipes before settling', { timeout: 5000 }, async t => {
  const { result, created, open } = await probeResources(t, env => run(join(dirname(process.execPath), `missing-probe-${randomUUID()}`), [], env, 1000));
  assert.equal(result.code, null);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
  assert.match(result.error!, /ENOENT/);
  assert.ok(created.includes('PROCESSWRAP'));
  assert.equal(created.filter(type => type === 'PIPEWRAP').length, 2);
  assert.deepEqual(open, [], 'spawn failure also waits for native handle cleanup');
});

test('a synchronous probe spawn error drains any allocated native handle before settling', { timeout: 5000 }, async t => {
  // ENOTDIR throws from spawn after allocating a native process handle, without returning a ChildProcess.
  const { result, created, open } = await probeResources(t, env => run(join(process.execPath, 'missing-probe'), [], env, 1000));
  assert.match(result.error!, /ENOTDIR/);
  assert.ok(created.includes('PROCESSWRAP'));
  assert.deepEqual(open, [], 'a thrown spawn error also drains its native handle');
});

test('a probe that never answers is cut at its deadline: the lock probe and a harness both, and their whole process group is killed', { timeout: 15_000 }, async (t) => {
  const tools = await toolchain(t, true);
  const root = await initialised(t, tools.env);
  await projectHub(t, root);
  const dir = await tempProject(t, 'cland-doctor-hang-');
  const pids = join(dir, 'pids');
  await hanging(dir, 'ps', pids);
  const claude = await hanging(dir, 'claude-hangs', pids);
  const { report: r } = await report(root, { ...tools.env, PATH: `${dir}:${tools.env.PATH}`, CLAND_CLAUDE_BIN: claude, CLAND_DOCTOR_PROBE_TIMEOUT_MS: '1000' });
  const c = check(r, 'claude-code');
  assert.equal(c.verdict, 'fail');
  assert.match(c.detail, /no answer within 1 s/);
  // `ps` could not tell the holder's start time: the live lock holder is still the hub
  assert.equal(check(r, 'hub').verdict, 'ok');
  const recorded = (await readFile(pids, 'utf8')).split('\n').filter(Boolean).map(Number);
  assert.ok(recorded.length >= 4, `the ps probe and the claude probe each ran, with a grandchild: ${recorded.join(' ')}`);
  await eventually('all timed-out probe processes are gone', () => {
    assert.deepEqual(recorded.filter(alive), []);
    return true;
  }, 5000);
  assert.deepEqual(recorded.filter(alive), [], 'every process of a probe that timed out is gone');
});
