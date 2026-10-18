// T3: process lifecycle: doctor kills a hanging probe's whole process group at its deadline.
// Real doctor commands also prove text/JSON rendering, stdout schema and healthy/no-hub exit codes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { clandWithEnv, eventually, nativeProjectHub as projectHub, tempProject } from './harness.ts';
import { initialised, toolchain, check, notOk, NVIM_VERSION } from './doctor-fixture.ts';
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
    for (const name of ['claude-code', 'claude-code auth', 'codex', 'codex auth', 'opencode', 'opencode auth', 'gh', 'gh auth', 'neovim', 'hub', 'hub.json', 'secret', 'roles.toml', 'config.toml', 'skills', 'skills manifest', 'claude hooks', 'cland mod', 'docs/agents', 'AGENTS.md']) {
      assert.ok(names.includes(name), `the report checks ${name}`);
    }
    assert.match(check(r, 'claude-code').detail, /^2\.1\.294 at .*fakes\/claude-code\/claude \(tested >=2\.1\.294 <2\.2\.0\)$/);
    assert.match(check(r, 'neovim').detail, new RegExp(`^${NVIM_VERSION.replace(/\./g, '\\.')} at `));
    assert.match(check(r, 'hub').detail, /^running: pid \d+, holds the lock, answers hub\.status/);
  });

  await t.test('the text report is plain: one line per check, no ANSI escapes when stdout is not a terminal', async () => {
    const r = await doctor(root, tools.env);
    assert.equal(r.code, 0, r.stdout);
    assert.doesNotMatch(r.stdout, /\x1b\[/);
    const lines = r.stdout.trimEnd().split('\n');
    assert.match(lines[0] ?? '', /^cland doctor \S+ in /);
    assert.match(lines.at(-1) ?? '', /^22 ok, 0 warn, 0 fail$/);
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
