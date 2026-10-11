// Public CLI/socket tests use tiny package fixtures, never the live project's full-suite queue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, stat, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, clandWithEnv, connectUi, eventually, startDaemon, spawnSpoke, tempProject, pidAlive, fakeCodex } from './harness.ts';
import { suiteSummary } from '../src/hub/suites.ts';
import { DatabaseSync } from 'node:sqlite';
import { ownProcess } from './process-cleanup.ts';
import type { Artifact } from '../src/protocol.ts';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

type ResultMessage = { id: string; from: string; fromRole?: string; text: string; to: string[]; artifacts: Array<{ id: string; path: string; creator: string }> };
async function fixture(t: import('node:test').TestContext, testScript: string, typecheck = 'node -e "process.exit(0)"', config = '', daemonEnv: Record<string, string> = {}, budget = 1) {
  const root = await tempProject(t, 'cland-suite-cli-');
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland', 'config.toml'), `${config}\n[verification]\nbudget = ${budget}\nlock_path = ${JSON.stringify(join(root, 'suite.lock'))}\n`);
  await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { typecheck, test: testScript } }));
  const { discovery } = await startDaemon(t, root, daemonEnv);
  const ui = await connectUi(t, discovery, 'cli');
  assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'reviewer' })).ok, true);
  const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'impl', sessionId: 'suite-caller', role: 'implementer' });
  t.after(() => spoke.close());
  await spoke.waitForPresence(['impl']);
  const env = { CLAND_SESSION_NAME: 'impl', CLAND_SESSION_ID: 'suite-caller', CLAND_ROLE: 'implementer' };
  const created = JSON.parse((await cland(root, 'task', 'create', 'fixture', '--assignee', 'impl', '--json')).stdout) as { item: { id: string } };
  const topicResult = await ui.request({ type: 'topic.create', title: 'Suite fixture', item: created.item.id });
  assert.equal(topicResult.ok, true, topicResult.error);
  const topic = (topicResult.value as { topic: { id: string } }).topic.id;
  const results = async () => {
    const history = await ui.request({ type: 'topic.history', topic });
    assert.equal(history.ok, true, history.error);
    return (history.value as { messages: ResultMessage[] }).messages.filter(m => m.text.startsWith('suite result '));
  };
  const launch = async (mode = 'all') => {
    const r = await clandWithEnv(root, env, 'suite', mode, '--report', topic, '--to', 'rev', '--to', 'impl', '--json');
    assert.equal(r.code, 0, r.stderr);
    const job = JSON.parse(r.stdout) as { id: string; pid: number | null; position: number };
    if (job.pid) ownProcess(t, job.pid);
    return job;
  };
  return { root, discovery, ui, env, topic, results, launch, spoke };
}

test('auto suite reports the fetched diff decision and transports it to the package; --all forces full', async t => {
  const f = await fixture(t, 'node -e "console.log(process.env.CLAND_SUITE_SELECTION)"');
  const exec = promisify(execFile);
  const git = async (...args: string[]) => exec('git', args, { cwd: f.root });
  const remote = join(f.root, 'origin.git');
  await git('init', '--initial-branch=dev');
  await git('config', 'user.name', 'Suite report test'); await git('config', 'user.email', 'suite@example.invalid');
  await writeFile(join(f.root, '.gitignore'), '.cland/\norigin.git/\n');
  await git('add', '.'); await git('commit', '-m', 'base');
  await git('init', '--bare', remote); await git('remote', 'add', 'origin', remote); await git('push', 'origin', 'dev');
  await git('checkout', '-b', 't/T-214');
  await mkdir(join(f.root, 'hub', 'src', 'tracker'), { recursive: true });
  await writeFile(join(f.root, 'hub', 'src', 'tracker', 'tracker.ts'), '// package-local change');
  await git('add', '.'); await git('commit', '-m', 'hub change');
  await f.launch('auto');
  const reduced = await eventually('auto result', async () => (await f.results())[0]);
  assert.match(reduced.text, /mode hub-only; package-local diff against fetched dev; deciding files \["hub\/src\/tracker\/tracker.ts"\]/);
  const log = await readFile(reduced.artifacts[0]!.path, 'utf8');
  assert.match(log, /"mode":"hub-only","files":\["hub\/src\/tracker\/tracker.ts"\]/);
  await f.launch('--all');
  const full = await eventually('forced full result', async () => (await f.results())[1]);
  assert.match(full.text, /mode full; --all \/ all forces full/);
  assert.match(full.text, /deciding files \["hub\/src\/tracker\/tracker.ts"\]/);
});

for (const cap of [768, 384]) {
test(`a broad deciding-file list publishes once below the ${cap}-byte cap and stays complete in the log`, async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"', undefined, `[hygiene]\nmax_text_bytes = ${cap}\n`);
  const exec = promisify(execFile);
  const git = async (...args: string[]) => exec('git', args, { cwd: f.root });
  const remote = join(f.root, 'origin.git');
  await git('init', '--initial-branch=dev');
  await git('config', 'user.name', 'Suite report test'); await git('config', 'user.email', 'suite@example.invalid');
  await writeFile(join(f.root, '.gitignore'), '.cland/\norigin.git/\n');
  await git('add', '.'); await git('commit', '-m', 'base');
  await git('init', '--bare', remote); await git('remote', 'add', 'origin', remote); await git('push', 'origin', 'dev');
  await git('checkout', '-b', 't/T-214');
  await mkdir(join(f.root, 'nvim', 'test'), { recursive: true });
  const names = Array.from({ length: 150 }, (_, n) => `nvim/test/${String(n).padStart(3, '0')}-${'界'.repeat(40)}.test.ts`);
  for (const name of names) await writeFile(join(f.root, name), '// local test');
  await f.launch('auto');
  const result = await eventually('bounded report publication', async () => (await f.results())[0]);
  assert.ok(Buffer.byteLength(result.text, 'utf8') <= cap);
  assert.match(result.text, /mode nvim-only/);
  assert.match(result.text, /package-local diff against fetched dev/);
  assert.match(result.text, /full list in log/);
  assert.ok(!result.text.includes('�'));
  const log = await readFile(result.artifacts[0]!.path, 'utf8');
  assert.ok(names.every(name => log.includes(name)), 'every deciding path remains in the log');
  await eventually('bounded report settled', async () => {
    const status = await f.ui.request({ type: 'hub.status' });
    return (status.value as { suites: Array<{ reported: boolean }> }).suites.every(job => job.reported) ? true : undefined;
  });
  assert.equal((await f.results()).length, 1);
});
}

test('suite CLI exits before its worker, posts one artifact-backed result as caller, and rejects duplicate active runs', async t => {
  const f = await fixture(t, 'node -e "setTimeout(()=>{console.log(\'ℹ tests 2\\nℹ pass 2\\nℹ fail 0\')},1200)"');
  const job = await f.launch();
  assert.equal(job.position, 1);
  assert.equal((await f.results()).length, 0, 'caller exited while package command is still running');
  const duplicate = await clandWithEnv(f.root, f.env, 'suite', '--report', f.topic, '--to', 'rev');
  assert.notEqual(duplicate.code, 0);
  assert.match(duplicate.stderr, /already has a suite/);
  const result = await eventually('suite completion', async () => (await f.results())[0]);
  assert.equal(result.id, `suite:${job.id}`);
  assert.equal(result.from, 'impl'); assert.equal(result.fromRole, 'implementer');
  assert.deepEqual(result.to.sort(), ['impl', 'rev']);
  assert.match(result.text, /all exit 0/); assert.match(result.text, /tests 2; pass 2; fail 0/);
  const artifact = result.artifacts[0]!;
  assert.equal(artifact.creator, 'impl');
  assert.match(await readFile(artifact.path, 'utf8'), /\$ npm run typecheck/);
  assert.match(await readFile(artifact.path, 'utf8'), /\$ npm test/);
  assert.equal((await f.results()).length, 1);
});

test('suite worker SIGKILL produces one crash result with its log', async t => {
  const f = await fixture(t, 'node -e "setTimeout(()=>{},30000)"');
  const job = await f.launch();
  await eventually('package test started', async () => {
    const log = await readFile(join(f.root, '.cland', 'run', 'suites', job.id, 'suite.log'), 'utf8');
    return log.includes('$ npm test') ? true : undefined;
  });
  process.kill(job.pid!, 'SIGKILL');
  const result = await eventually('crash report', async () => (await f.results())[0]);
  assert.match(result.text, /worker killed by SIGKILL/);
  assert.equal(result.artifacts.length, 1);
  assert.equal((await f.results()).length, 1);
});

test('suite cancel defaults to the caller’s active run, stops its child and posts one cancelled result', async t => {
  const f = await fixture(t, 'node -e "require(\'fs\').writeFileSync(\'child-pid\',String(process.pid));setTimeout(()=>{},30000)"');
  const job = await f.launch();
  const child = await eventually('package child started', async () => readFile(join(f.root, 'child-pid'), 'utf8').then(Number, () => undefined));
  ownProcess(t, child);
  const cancelled = await clandWithEnv(f.root, f.env, 'suite', 'cancel', '--json');
  assert.equal(cancelled.code, 0, cancelled.stderr);
  assert.equal(JSON.parse(cancelled.stdout).id, job.id);
  const result = await eventually('cancelled result', async () => (await f.results())[0]);
  assert.equal(result.id, `suite:${job.id}`);
  assert.match(result.text, /exit 143; cancelled/);
  assert.equal(result.from, 'impl');
  assert.deepEqual(result.to.sort(), ['impl', 'rev']);
  await eventually('cancelled processes stopped', () => !pidAlive(job.pid!) && !pidAlive(child) ? true : undefined);
  const receipt = JSON.parse(await readFile(join(f.root, '.cland', 'run', 'suites', job.id, 'result.json'), 'utf8'));
  assert.equal(receipt.code, 143);
  assert.match(receipt.cause, /SIGTERM/);
  assert.equal((await f.results()).length, 1);
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  const history = await ui.request({ type: 'topic.history', topic: f.topic });
  assert.equal((history.value as { messages: ResultMessage[] }).messages.filter(m => m.id === `suite:${job.id}`).length, 1);
});

test('suite cancel refuses another session’s run while the human can cancel it by id', async t => {
  const f = await fixture(t, 'node -e "setTimeout(()=>{},30000)"', undefined, '[hygiene]\nmax_text_bytes = 384\n');
  const rev = await spawnSpoke({ discover: true, cwd: f.root, name: 'rev', sessionId: 'suite-reviewer', role: 'reviewer' });
  t.after(() => rev.close());
  await rev.waitForPresence(['rev']);
  const job = await f.launch();
  const refused = await clandWithEnv(f.root, { CLAND_SESSION_NAME: 'rev', CLAND_SESSION_ID: 'suite-reviewer' }, 'suite', 'cancel', job.id);
  assert.notEqual(refused.code, 0);
  assert.match(refused.stderr, /cannot cancel another session’s suite/);
  assert.equal(pidAlive(job.pid!), true);
  assert.equal((await f.results()).length, 0);
  const cancelled = await cland(f.root, 'suite', 'cancel', job.id, '--json');
  assert.equal(cancelled.code, 0, cancelled.stderr);
  const result = await eventually('human cancellation report', async () => (await f.results())[0]);
  assert.equal(result.from, 'impl');
  assert.deepEqual(result.to.sort(), ['impl', 'rev']);
  assert.match(result.text, /exit 143; cancelled/);
  assert.ok(Buffer.byteLength(result.text, 'utf8') <= 384);
  const repeated = await cland(f.root, 'suite', 'cancel', job.id);
  assert.equal(repeated.code, 0, repeated.stderr);
  assert.equal((await f.results()).length, 1);
  const missing = await clandWithEnv(f.root, f.env, 'suite', 'cancel');
  assert.notEqual(missing.code, 0);
  assert.match(missing.stderr, /no suite queued or running/);
});

test('verify cancel removes a pid-null queued job while an unrelated submission is held, preserving the holder’s lock', async t => {
  const bin = await tempProject(t, 'cland-suite-held-git-');
  const git = (await promisify(execFile)('which', ['git'])).stdout.trim();
  await writeFile(join(bin, 'git'), `#!${process.execPath}
import { existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
if (existsSync('hold-git')) { writeFileSync('git-held', 'held'); while (!existsSync('release-git')) await pause(25); }
const result = spawnSync(${JSON.stringify(git)}, process.argv.slice(2), { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
`, { mode: 0o700 });
  const f = await fixture(t, 'node queued.mjs', undefined, '', { PATH: `${bin}:${process.env.PATH ?? ''}` });
  const lock = join(f.root, 'suite.lock');
  await mkdir(lock);
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  await writeFile(join(f.root, 'queued.mjs'), `import { runSuite } from ${JSON.stringify(runner)}; process.exitCode = await runSuite([['-e', "require('fs').writeFileSync('admitted','yes')"]], { lockDir: ${JSON.stringify(lock)}, cwd: ${JSON.stringify(f.root)} });`);
  const job = await f.launch();
  assert.equal(job.pid, null);
  const other = join(f.root, 'other');
  await mkdir(other);
  await writeFile(join(other, 'hold-git'), 'hold');
  await writeFile(join(other, 'package.json'), JSON.stringify({ scripts: { typecheck: 'node -e "process.exit(0)"', test: 'node -e "process.exit(0)"' } }));
  const submission = f.ui.request({ type: 'suite.start', mode: 'all', cwd: other, report: f.topic, to: ['impl', 'rev'] }, 15000);
  await eventually('unrelated submission held in git', async () => stat(join(other, 'git-held')).then(() => true, () => undefined));
  const cancellation = clandWithEnv(f.root, f.env, 'verify', 'cancel', job.id);
  let cancelled;
  try {
    await eventually('queued cancellation reported before unrelated submission resumes', async () => (await f.results()).find(m => m.id === `suite:${job.id}`), 5000);
    cancelled = await cancellation;
  } finally {
    await writeFile(join(other, 'release-git'), 'release');
    const submitted = await submission;
    assert.equal(submitted.ok, true, submitted.error);
    const pid = (submitted.value as { pid: number | null }).pid;
    if (pid) ownProcess(t, pid);
    await cancellation;
  }
  assert.equal(cancelled.code, 0, cancelled.stderr);
  const status = await f.ui.request({ type: 'hub.status' });
  const queued = (status.value as { suites: Array<{ id: string; pid: number | null; state: string }> }).suites.find(s => s.id === job.id)!;
  assert.equal(queued.pid, null);
  assert.equal(queued.state, 'finished');
  const result = await eventually('queued cancellation result', async () => (await f.results()).find(m => m.id === `suite:${job.id}`));
  assert.match(result.text, /exit 143; cancelled/);
  assert.equal((await stat(lock)).isDirectory(), true, 'manual holder lock remains intact');
  await assert.rejects(stat(join(f.root, 'admitted')), { code: 'ENOENT' });
  await assert.rejects(stat(join(f.root, '.cland', 'run', 'suites', job.id, 'result.json')), { code: 'ENOENT' });
  assert.equal((await f.results()).filter(m => m.id === `suite:${job.id}`).length, 1);
});

test('suite cancel cleans a running lock runner’s children and temporary root before publishing', async t => {
  const f = await fixture(t, 'node running.mjs');
  const lock = join(f.root, 'suite.lock');
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  await writeFile(join(f.root, 'running.mjs'), `import { runSuite } from ${JSON.stringify(runner)}; process.exitCode = await runSuite([['--test', 'holding.mjs']], { lockDirs: ${JSON.stringify([lock, `${lock}-nvim`])}, cwd: ${JSON.stringify(f.root)} });`);
  await writeFile(join(f.root, 'holding.mjs'), `import test from 'node:test'; import { writeFile } from 'node:fs/promises'; test('holding', async () => { await writeFile(${JSON.stringify(join(f.root, 'holder.json'))}, JSON.stringify({ pid: process.pid, root: process.env.TMPDIR })); await new Promise(r => setTimeout(r, 30000)); });`);
  const job = await f.launch();
  const holder = await eventually('runner child started', async () => readFile(join(f.root, 'holder.json'), 'utf8').then(text => JSON.parse(text) as { pid: number; root: string }, () => undefined));
  ownProcess(t, holder.pid);
  const cancelled = await clandWithEnv(f.root, f.env, 'suite', 'cancel', job.id);
  assert.equal(cancelled.code, 0, cancelled.stderr);
  const result = await eventually('running runner cancellation result', async () => (await f.results())[0]);
  assert.match(result.text, /exit 143; cancelled/);
  assert.equal(pidAlive(holder.pid), false);
  await assert.rejects(stat(lock), { code: 'ENOENT' });
  await assert.rejects(stat(holder.root), { code: 'ENOENT' });
  assert.deepEqual(await readdir(`${lock}.queue`), []);
  assert.equal((await f.results()).length, 1);
});

test('cancelled results held by reporting permissions survive restart and publish once', async t => {
  const f = await fixture(t, 'node -e "setTimeout(()=>{},30000)"');
  const job = await f.launch();
  await eventually('worker test started', async () => (await readFile(join(f.root, '.cland', 'run', 'suites', job.id, 'suite.log'), 'utf8')).includes('$ npm test') ? true : undefined);
  assert.equal((await f.ui.request({ type: 'role.clear', session: 'impl' })).ok, true);
  const cancelled = await clandWithEnv(f.root, f.env, 'suite', 'cancel', job.id);
  assert.equal(cancelled.code, 0, cancelled.stderr);
  await eventually('cancellation report held', async () => {
    const status = await f.ui.request({ type: 'hub.status' });
    return (status.value as { suites: Array<{ error: string | null }> }).suites[0]?.error?.includes('forbidden') ? true : undefined;
  });
  assert.equal((await f.results()).length, 0);
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  const result = await eventually('cancelled result after restart', async () => {
    const history = await ui.request({ type: 'topic.history', topic: f.topic });
    return (history.value as { messages: ResultMessage[] }).messages.find(m => m.id === `suite:${job.id}`);
  });
  assert.match(result.text, /exit 143; cancelled/);
  assert.deepEqual(result.to.sort(), ['impl', 'rev']);
  const repeated = await cland(f.root, 'suite', 'cancel', job.id);
  assert.equal(repeated.code, 0, repeated.stderr);
  const history = await ui.request({ type: 'topic.history', topic: f.topic });
  assert.equal((history.value as { messages: ResultMessage[] }).messages.filter(m => m.id === `suite:${job.id}`).length, 1);
});

test('a worker killed while the hub is down is reported after restart and its package children are cleaned', async t => {
  const f = await fixture(t, 'node -e "require(\'fs\').writeFileSync(\'child-pid\',String(process.pid));setTimeout(()=>{},30000)"');
  const job = await f.launch();
  const child = await eventually('package child identity', async () => readFile(join(f.root, 'child-pid'), 'utf8').then(Number, () => undefined));
  ownProcess(t, child);
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  process.kill(job.pid!, 'SIGKILL');
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  const result = await eventually('recovered crash report', async () => {
    const r = await ui.request({ type: 'topic.history', topic: f.topic });
    return (r.value as { messages: ResultMessage[] }).messages.find(m => m.id === `suite:${job.id}`);
  });
  assert.match(result.text, /worker disappeared \(killed or crashed without an exit receipt\)/);
  await eventually('package child stopped', () => !pidAlive(child) ? true : undefined);
});

test('typecheck failure stops before tests and reports the failure', async t => {
  const f = await fixture(t, 'node -e "console.log(\'should not run\')"', 'node -e "console.error(\'typecheck failed\');process.exit(7)"');
  await f.launch();
  const result = await eventually('failure report', async () => (await f.results())[0]);
  assert.match(result.text, /all exit 7/);
  const log = await readFile(result.artifacts[0]!.path, 'utf8');
  assert.match(log, /typecheck failed/); assert.doesNotMatch(log, /\$ npm test/);
});

test('submission requires caller artifact and send permissions before spawning', async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"');
  const refused = await clandWithEnv(f.root, f.env, 'suite', '--report', 'general', '--to', 'rev');
  assert.notEqual(refused.code, 0); assert.match(refused.stderr, /own item topic/);
  const human = await clandWithEnv(f.root, f.env, 'suite', '--report', f.topic);
  assert.notEqual(human.code, 0); assert.match(human.stderr, /forbidden.*send/);
  assert.equal((await f.results()).length, 0);
});

test('hub restart recovers a worker that outlives it, without replaying the result', async t => {
  const f = await fixture(t, 'node -e "setTimeout(()=>{console.log(\'ℹ tests 1\\nℹ pass 1\')},1800)"');
  const job = await f.launch();
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const { discovery } = await startDaemon(t, f.root);
  const ui = await connectUi(t, discovery);
  const history = async () => {
    const r = await ui.request({ type: 'topic.history', topic: f.topic });
    return (r.value as { messages: ResultMessage[] }).messages.filter(m => m.id === `suite:${job.id}`);
  };
  const results = await eventually('restart result', async () => { const r = await history(); return r.length ? r : undefined; });
  assert.equal(results.length, 1); assert.match(results[0]!.text, /all exit 0/);
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const next = await startDaemon(t, f.root);
  const nextUi = await connectUi(t, next.discovery);
  const r = await nextUi.request({ type: 'topic.history', topic: f.topic });
  assert.equal((r.value as { messages: ResultMessage[] }).messages.filter(m => m.id === `suite:${job.id}`).length, 1);
});

test('revoked report permissions hold the result until restored, without a duplicate', async t => {
  const f = await fixture(t, 'node -e "const fs=require(\'fs\');const p=setInterval(()=>{if(fs.existsSync(\'finish\'))clearInterval(p)},50)"');
  await f.launch();
  assert.equal((await f.ui.request({ type: 'role.clear', session: 'impl' })).ok, true);
  await writeFile(join(f.root, 'finish'), 'ready');
  await eventually('report held by permissions', async () => {
    const status = await f.ui.request({ type: 'hub.status' });
    const jobs = (status.value as { suites: Array<{ error: string | null }> }).suites;
    return jobs.some(job => job.error?.includes('forbidden')) ? true : undefined;
  });
  assert.equal((await f.results()).length, 0);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  await eventually('report after restoring permissions', async () => (await f.results())[0]);
  assert.equal((await f.results()).length, 1);
});

test('a muted named recipient keeps the single result pending across restart until all recipients can receive it', async t => {
  const f = await fixture(t, 'node -e "const fs=require(\'fs\');const p=setInterval(()=>{if(fs.existsSync(\'finish\'))clearInterval(p)},50)"', undefined, '[hygiene]\nloop_breaker_max = 2\n');
  for (let n = 0; n < 3; n++) await f.spoke.call('send', { to: ['rev'], topic: f.topic, text: `seed ${n}` });
  const job = await f.launch();
  await writeFile(join(f.root, 'finish'), 'ready');
  await eventually('recipient refusal retained', async () => {
    const status = await f.ui.request({ type: 'hub.status' });
    const record = (status.value as { suites: Array<{ reported: boolean; error: string | null }> }).suites[0]!;
    return !record.reported && record.error?.includes('loop breaker') ? true : undefined;
  });
  assert.equal((await f.results()).length, 0, 'no partial topic post or caller delivery');
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  assert.equal((await ui.request({ type: 'hygiene.unmute', a: 'impl', b: 'rev' })).ok, true);
  const result = await eventually('complete recipient delivery after restart', async () => {
    const r = await ui.request({ type: 'topic.history', topic: f.topic });
    return (r.value as { messages: ResultMessage[] }).messages.find(m => m.id === `suite:${job.id}`);
  });
  assert.deepEqual(result.to.sort(), ['impl', 'rev']);
  const history = await ui.request({ type: 'topic.history', topic: f.topic });
  assert.equal((history.value as { messages: ResultMessage[] }).messages.filter(m => m.id === `suite:${job.id}`).length, 1);
  const artifacts = await ui.request({ type: 'artifact.list', topic: f.topic });
  assert.equal((artifacts.value as { artifacts: unknown[] }).artifacts.length, 1);
});

test('a muted suite report follows its moved log after unmute and publishes once', async t => {
  const f = await fixture(t, 'node -e "console.log(\'ℹ tests 1\\nℹ pass 1\\nℹ fail 0\')"', undefined, '[hygiene]\nloop_breaker_max = 2\n');
  for (let n = 0; n < 3; n++) await f.spoke.call('send', { to: ['rev'], topic: f.topic, text: `seed ${n}` });
  const job = await f.launch();
  await eventually('suite report paused after log registration', async () => {
    const status = await f.ui.request({ type: 'hub.status' });
    const record = (status.value as { suites: Array<{ reported: boolean; error: string | null }> }).suites[0]!;
    return !record.reported && record.error?.includes('loop breaker') ? true : undefined;
  });
  assert.equal((await f.results()).length, 0);
  const listed = await f.ui.request({ type: 'artifact.list', topic: f.topic });
  assert.equal(listed.ok, true, listed.error);
  const logs = (listed.value as { artifacts: Artifact[] }).artifacts;
  assert.equal(logs.length, 1, 'the pending report has registered one log');
  const log = logs[0]!;
  const original = await readFile(log.path, 'utf8');
  const created = await f.ui.request({ type: 'artifact.create', kind: 'file', title: 'Suite logs', topic: f.topic, folder: true });
  assert.equal(created.ok, true, created.error);
  const folder = (created.value as { artifact: Artifact }).artifact;
  const moved = await f.ui.request({ type: 'artifact.move', artifact: log.id, folder: folder.id, name: 'suite.log' });
  assert.equal(moved.ok, true, moved.error);
  const path = join(folder.path, 'suite.log');
  assert.equal(await readFile(path, 'utf8'), original);
  await assert.rejects(stat(log.path), { code: 'ENOENT' });
  assert.equal((await f.ui.request({ type: 'hygiene.unmute', a: 'impl', b: 'rev' })).ok, true);
  const result = await eventually('suite publication with moved log', async () => (await f.results())[0]);
  assert.equal(result.id, `suite:${job.id}`);
  assert.deepEqual(result.to.sort(), ['impl', 'rev']);
  assert.match(result.text, /all exit 0/);
  assert.match(result.text, /tests 1; pass 1; fail 0/);
  assert.ok(result.text.includes(`Log ${log.id}: ${path}`));
  assert.equal(result.artifacts.length, 1);
  assert.equal(result.artifacts[0]!.id, log.id);
  assert.equal(result.artifacts[0]!.path, path);
  assert.equal(await readFile(result.artifacts[0]!.path, 'utf8'), original);
  await eventually('suite report receipt settled', async () => {
    const status = await f.ui.request({ type: 'hub.status' });
    return (status.value as { suites: Array<{ reported: boolean }> }).suites.every(record => record.reported) ? true : undefined;
  });
  assert.equal((await f.results()).length, 1);
  const artifacts = await f.ui.request({ type: 'artifact.list', topic: f.topic });
  assert.equal((artifacts.value as { artifacts: Artifact[] }).artifacts.length, 1, 'only the destination folder is listed; no replacement log was created');
});

test('failure cleanup preserves a live worker whose recorded start identity is unavailable', async t => {
  const f = await fixture(t, 'node -e "const fs=require(\'fs\');const p=setInterval(()=>{if(fs.existsSync(\'finish\'))clearInterval(p)},50)"');
  const job = await f.launch();
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const db = new DatabaseSync(join(f.root, '.cland', 'hub.db'));
  try {
    const value = db.prepare("select value from meta where key = 'suite-jobs'").get() as { value: string };
    const records = JSON.parse(value.value) as Array<{ started: string | null; outcome: { code: number; cause: string } | null }>;
    records[0]!.started = null;
    records[0]!.outcome = { code: 1, cause: 'fixture admission failed without a readable identity' };
    db.prepare("update meta set value = ? where key = 'suite-jobs'").run(JSON.stringify(records));
  } finally { db.close(); }
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  await eventually('unverified cleanup preserved', async () => {
    const status = await ui.request({ type: 'hub.status' });
    return (status.value as { suites: Array<{ error: string | null }> }).suites[0]?.error?.includes('process preserved') ? true : undefined;
  });
  assert.equal(pidAlive(job.pid!), true);
  const initial = await ui.request({ type: 'topic.history', topic: f.topic });
  assert.equal((initial.value as { messages: ResultMessage[] }).messages.filter(m => m.id === `suite:${job.id}`).length, 0);
  await writeFile(join(f.root, 'finish'), 'ready');
  await eventually('worker naturally completed', () => !pidAlive(job.pid!) ? true : undefined);
});

test('restart recognizes a committed result even if its run receipt did not settle', async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"');
  const job = await f.launch();
  await eventually('initial result', async () => (await f.results())[0]);
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  // Storage boundary: reconstruct the checkpoint immediately before the report's receipt update.
  const db = new DatabaseSync(join(f.root, '.cland', 'hub.db'));
  try {
    const value = db.prepare("select value from meta where key = 'suite-jobs'").get() as { value: string };
    const jobs = JSON.parse(value.value) as Array<{ reported: boolean; artifact: string | null }>;
    for (const record of jobs) { record.reported = false; record.artifact = null; }
    db.prepare("update meta set value = ? where key = 'suite-jobs'").run(JSON.stringify(jobs));
  } finally { db.close(); }
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  await eventually('receipt reconciled', async () => {
    const status = await ui.request({ type: 'hub.status' });
    return (status.value as { suites: Array<{ reported: boolean }> }).suites.every(job => job.reported) ? true : undefined;
  });
  const history = await ui.request({ type: 'topic.history', topic: f.topic });
  assert.equal((history.value as { messages: ResultMessage[] }).messages.filter(m => m.id === `suite:${job.id}`).length, 1);
  const artifacts = await ui.request({ type: 'artifact.list', topic: f.topic });
  assert.equal((artifacts.value as { artifacts: unknown[] }).artifacts.length, 1);
});

test('suite summary adds both phases and bounds failure excerpts', () => {
  assert.equal(suiteSummary('ℹ tests 2\nℹ pass 1\nℹ fail 1\n✖ broken\n# tests 3\n# pass 3\n# fail 0\n'), 'tests 5; pass 4; fail 1\nFailures:\n✖ broken');
});

// These tiny workers use project-local compatibility locks, including when run inside the full suite.
for (const budget of [1, 2]) test(`verify queues a second requester without a waiting worker (configured budget ${budget})`, async t => {
  const f = await fixture(t, 'node -e "const fs=require(\'fs\');const p=setInterval(()=>{if(fs.existsSync(\'finish\'))clearInterval(p)},50)"', undefined, '', {}, budget);
  const first = await f.launch();
  assert.equal((await f.ui.request({ type: 'role.set', session: 'other', role: 'implementer' })).ok, true);
  const other = await spawnSpoke({ discover: true, cwd: f.root, name: 'other', sessionId: 'other-caller', role: 'implementer' });
  t.after(() => other.close());
  await other.waitForPresence(['other']);
  await f.spoke.call('send', { to: ['other'], topic: f.topic, text: 'Verify this fixture' });
  await other.waitForEvent(e => e.params.content.includes('Verify this fixture'));
  // Human fixtures can address an existing topic; each request still has a distinct session identity.
  const queued = await clandWithEnv(f.root, { CLAND_SESSION_NAME: 'other', CLAND_SESSION_ID: 'other-caller', CLAND_ROLE: 'implementer' }, 'verify', 'all', '--report', f.topic, '--to', 'rev', '--json');
  assert.equal(queued.code, 0, queued.stderr);
  const second = JSON.parse(queued.stdout) as { id: string; pid: number | null; position: number };
  assert.equal(second.pid, null);
  assert.equal(second.position, 1);
  if (budget > 1) assert.match(await readFile(join(f.root, '.cland', 'log', 'hub.log'), 'utf8'), /verification-budget-capped.*\"configured\":2.*\"effective\":1.*T-215/);
  await writeFile(join(f.root, 'finish'), 'ready');
  await eventually('both admitted in order', async () => (await f.results()).length === 2 ? true : undefined);
  assert.deepEqual((await f.results()).map(r => r.id), [`suite:${first.id}`, `suite:${second.id}`]);
});

test('the compatibility lease spans typecheck and tests, so a hand runner waits for both', async t => {
  const waiting = `node -e "const fs=require('fs');fs.writeFileSync('typecheck-entered','');const p=setInterval(()=>{if(fs.existsSync('typecheck-finish'))clearInterval(p)},25)"`;
  const f = await fixture(t, `node -e "const fs=require('fs');fs.writeFileSync('tests-entered','');const p=setInterval(()=>{if(fs.existsSync('finish'))clearInterval(p)},25)"`, waiting);
  await f.launch();
  await eventually('typecheck entered', () => stat(join(f.root, 'typecheck-entered')).then(() => true, () => undefined));
  const locks = [join(f.root, 'suite.lock'), join(f.root, 'suite.lock-nvim')];
  assert.ok(await stat(locks[0]!).then(() => true, () => false), 'typecheck holds the compatibility lock');
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const hand = spawn(process.execPath, ['--input-type=module', '-e', `import { runSuite } from ${JSON.stringify(runner)};process.exitCode=await runSuite([['-e', ${JSON.stringify("require('fs').writeFileSync('hand-entered','')")}]], {cwd:${JSON.stringify(f.root)},lockDirs:${JSON.stringify(locks)}})`], {cwd:f.root, stdio:['ignore','ignore','pipe']});
  ownProcess(t, hand.pid!);
  let output = ''; hand.stderr.on('data', b => { output += String(b); });
  const done = new Promise(resolve => hand.once('exit', resolve));
  await eventually('hand run waiting', () => output.includes('waiting for the suite lock') ? true : undefined);
  await writeFile(join(f.root, 'typecheck-finish'), '');
  await eventually('tests entered', () => stat(join(f.root, 'tests-entered')).then(() => true, () => undefined));
  assert.equal(await stat(join(f.root, 'hand-entered')).then(() => true, () => false), false);
  await writeFile(join(f.root, 'finish'), '');
  await eventually('hand admitted after verification', () => stat(join(f.root, 'hand-entered')).then(() => true, () => undefined));
  assert.equal(await done, 0);
});

test('a dead queued requester is cancelled with one posted note even after its role is vacated', async t => {
  const fake = await fakeCodex(t);
  const f = await fixture(t, 'node -e "process.exit(0)"', undefined, '', fake.env);
  const git = async (...args: string[]) => promisify(execFile)('git', args, { cwd: f.root });
  await git('init', '--initial-branch=dev');
  await git('config', 'user.name', 'Verification test'); await git('config', 'user.email', 'verify@example.invalid');
  await writeFile(join(f.root, '.gitignore'), '.cland/\nsuite.lock*\n');
  await git('add', '.'); await git('commit', '-m', 'fixture');
  const created = JSON.parse((await cland(f.root, 'task', 'create', 'doomed verification', '--assignee', 'doomed', '--json')).stdout) as {item:{id:string}};
  const topicResult = await f.ui.request({type:'topic.create', title:'Doomed run', item:created.item.id});
  const topic = (topicResult.value as {topic:{id:string}}).topic.id;
  const launched = await f.ui.request({type:'session.launch', name:'doomed', role:'implementer', harness:'codex', item:created.item.id}, 30000);
  assert.equal(launched.ok, true, launched.error);
  const actor = (launched.value as {process:{pid:number; sessionId:string}}).process;
  await mkdir(join(f.root, 'suite.lock'));
  const submission = await clandWithEnv(f.root, {CLAND_SESSION_NAME:'doomed', CLAND_SESSION_ID:actor.sessionId, CLAND_ROLE:'implementer'}, 'verify', '--report', topic, '--to', 'rev', '--json');
  assert.equal(submission.code, 0, submission.stderr);
  assert.equal(JSON.parse(submission.stdout).pid, null);
  process.kill(actor.pid, 'SIGKILL');
  const history = async (ui = f.ui) => {
    const result = await ui.request({type:'topic.history', topic});
    return (result.value as {messages:ResultMessage[]}).messages.filter(m => m.text.startsWith('suite result '));
  };
  const result = await eventually('cancelled requester report', async () => (await history())[0]);
  assert.match(result.text, /cancelled: requester died before admission/);
  assert.deepEqual(result.to, ['rev']);
  assert.equal(result.from, 'hub');
  await cland(f.root, 'hub', 'stop');
  const next = await startDaemon(t, f.root, fake.env);
  const ui = await connectUi(t, next.discovery);
  assert.equal((await history(ui)).length, 1);
});

test('priority admits integrated dev first, then item rank, preserving the queue through restart', async t => {
  const f = await fixture(t, `node -e "const fs=require('fs');const p=setInterval(()=>{if(fs.existsSync('finish')){fs.unlinkSync('finish');clearInterval(p)}},25)"`);
  const git = async (...args: string[]) => promisify(execFile)('git', args, {cwd:f.root});
  await git('init', '--initial-branch=dev');
  await git('config', 'user.name', 'Priority test'); await git('config', 'user.email', 'priority@example.invalid');
  await writeFile(join(f.root, '.gitignore'), '.cland/\nsuite.lock*\nfinish\n');
  await git('add', '.'); await git('commit', '-m', 'base');
  const head = (await git('rev-parse', 'HEAD')).stdout.trim();
  await mkdir(join(f.root, 'suite.lock'));
  const low = await f.launch();
  assert.equal(low.pid, null, 'a hand lock blocks worker admission');
  const created = JSON.parse((await cland(f.root, 'task', 'create', 'higher priority', '--assignee', 'high', '--json')).stdout) as {item:{id:string}};
  await cland(f.root, 'task', 'rank', created.item.id, '--top');
  const topicResult = await f.ui.request({type:'topic.create', title:'High priority run', item:created.item.id});
  const highTopic = (topicResult.value as {topic:{id:string}}).topic.id;
  const submit = async (name: string, role: string, topic: string) => {
    assert.equal((await f.ui.request({type:'role.set', session:name, role})).ok, true);
    const spoke = await spawnSpoke({discover:true, cwd:f.root, name, sessionId:`${name}-identity`, role});
    t.after(() => spoke.close()); await spoke.waitForPresence([name]);
    const r = await clandWithEnv(f.root, {CLAND_SESSION_NAME:name, CLAND_SESSION_ID:`${name}-identity`, CLAND_ROLE:role}, 'verify', 'all', '--report', topic, '--to', 'rev', '--json');
    assert.equal(r.code, 0, r.stderr);
    return JSON.parse(r.stdout) as {id:string;pid:number|null};
  };
  const high = await submit('high', 'implementer', highTopic);
  const integrated = await submit('coord', 'coordinator', f.topic);
  assert.equal(high.pid, null); assert.equal(integrated.pid, null);
  await cland(f.root, 'hub', 'stop');
  const next = await startDaemon(t, f.root);
  const ui = await connectUi(t, next.discovery);
  type Job = {id:string; state:string; head:string; priority:number};
  const jobs = async () => (await ui.request({type:'hub.status'})).value as {suites:Job[]};
  assert.equal((await jobs()).suites.filter(j => j.state === 'queued').length, 3);
  await rm(join(f.root, 'suite.lock'), {recursive:true});
  const running = async (id: string) => {
    await eventually('priority run admitted', async () => (await jobs()).suites.find(j => j.id === id && j.state === 'running'));
    const records = (await jobs()).suites;
    assert.equal(records.filter(j => j.state === 'running').length, 1);
    assert.equal(records.find(j => j.id === id)!.head, head);
    await writeFile(join(f.root, 'finish'), '');
    await eventually('priority result settled', async () => (await jobs()).suites.find(j => j.id === id && j.state === 'finished'));
  };
  await running(integrated.id);
  await running(high.id);
  await running(low.id);
  for (const topic of [f.topic, highTopic]) {
    const history = await ui.request({type:'topic.history', topic});
    const results = (history.value as {messages:ResultMessage[]}).messages.filter(m => m.text.startsWith('suite result '));
    assert.equal(results.length, topic === f.topic ? 2 : 1);
    for (const result of results) assert.ok(result.text.includes(`head ${head}`));
  }
});

test('a hand-run package holding the old lock occupies admission until it exits', async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"');
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const locks = [join(f.root, 'suite.lock'), join(f.root, 'suite.lock-nvim')];
  const code = "const fs=require('fs');fs.writeFileSync('hand-entered','');const p=setInterval(()=>{if(fs.existsSync('hand-finish'))clearInterval(p)},25)";
  const hand = spawn(process.execPath, ['--input-type=module', '-e', `import {runSuite} from ${JSON.stringify(runner)};process.exitCode=await runSuite([['-e',${JSON.stringify(code)}]], {cwd:${JSON.stringify(f.root)},lockDirs:${JSON.stringify(locks)}})`], {cwd:f.root,env:{...process.env,CLAND_TEST_SKIP_LOCK:'0'},stdio:'ignore'});
  ownProcess(t, hand.pid!); const done = new Promise(resolve => hand.once('exit',resolve));
  await eventually('hand holds package lock', () => stat(join(f.root,'hand-entered')).then(() => true,() => undefined));
  const job = await f.launch();
  assert.equal(job.pid,null);
  const log = await readFile(join(f.root,'.cland','run','suites',job.id,'suite.log'),'utf8');
  assert.doesNotMatch(log,/\$ npm/,'not even typecheck starts beside a hand run');
  await writeFile(join(f.root,'hand-finish'),''); assert.equal(await done,0);
  const result = await eventually('verify admitted after hand exit',async () => (await f.results())[0]);
  assert.match(result.text,/all exit 0/);
});

test('a worker lease retains phase place and publishes recovery metadata for both package phases', async t => {
  const f = await fixture(t, `${process.execPath} package.mjs`);
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const locks = {hub:join(f.root,'suite.lock'),nvim:join(f.root,'suite.lock-nvim')};
  const file = join(f.root,'phases.test.mjs');
  await writeFile(file, `import test from 'node:test'; import assert from 'node:assert/strict'; import {existsSync,writeFileSync,readFileSync} from 'node:fs';test('phase',async()=>{const phase=existsSync('hub-entered')?'nvim':'hub';const owner=JSON.parse(readFileSync(${JSON.stringify(locks.hub+'.owner')},'utf8'));const lease=JSON.parse(process.env.CLAND_SUITE_LEASE);assert.equal(owner.pid,lease.pid);assert.equal(owner.runner.pid,process.ppid);assert.equal(owner.root,process.env.TMPDIR);writeFileSync(phase+'-entered','');while(!existsSync(phase+'-finish'))await new Promise(r=>setTimeout(r,25));});`);
  await writeFile(join(f.root,'package.mjs'), `import {runPackageSuite} from ${JSON.stringify(runner)};process.exitCode=await runPackageSuite('all',[${JSON.stringify(file)}],${JSON.stringify({cwd:f.root,lockDirs:locks})});`);
  const job = await f.launch();
  await eventually('hub phase entered',()=>stat(join(f.root,'hub-entered')).then(()=>true,()=>undefined));
  const hand = spawn(process.execPath,['--input-type=module','-e',`import {runSuite} from ${JSON.stringify(runner)};process.exitCode=await runSuite([['-e',"require('fs').writeFileSync('hand-entered','')"]],${JSON.stringify({cwd:f.root,lockDirs:Object.values(locks)})});`],{cwd:f.root,env:{...process.env,CLAND_TEST_SKIP_LOCK:'0'},stdio:['ignore','ignore','pipe']});
  ownProcess(t,hand.pid!);let log='';hand.stderr.on('data',b=>{log+=String(b)});const done=new Promise(resolve=>hand.once('exit',resolve));
  await eventually('hand waits behind both phases',()=>log.includes('waiting for the suite lock')?true:undefined);
  await writeFile(join(f.root,'hub-finish'),'');
  await eventually('Neovim phase entered',()=>stat(join(f.root,'nvim-entered')).then(()=>true,()=>undefined));
  assert.equal(await stat(join(f.root,'hand-entered')).then(()=>true,()=>false),false);
  await writeFile(join(f.root,'nvim-finish'),'');
  const result=await eventually('both phases finished',async()=>(await f.results())[0]);
  assert.equal(result.id,`suite:${job.id}`);assert.match(result.text,/all exit 0/);assert.match(result.text,/tests 2; pass 2/);
  assert.equal(await done,0);
});

test('pre-V1 package runners acquire their own compatibility locks without a self-deadlock',async t=>{
  const f=await fixture(t,`${process.execPath} legacy.mjs`);
  const runner=fileURLToPath(new URL('./run-suite.ts',import.meta.url));
  await mkdir(join(f.root,'hub','test'),{recursive:true});
  await writeFile(join(f.root,'hub','test','run-suite.ts'),'// legacy package runner: no worker lease support');
  await writeFile(join(f.root,'legacy.mjs'),`import assert from 'node:assert/strict';import {runSuite} from ${JSON.stringify(runner)};assert.equal(process.env.CLAND_SUITE_LEASE,undefined);process.exitCode=await runSuite([['-e',"console.log('legacy package passed')"]],${JSON.stringify({cwd:f.root,lockDirs:[join(f.root,'suite.lock'),join(f.root,'suite.lock-nvim')]})});`);
  await f.launch();const result=await eventually('legacy result',async()=>(await f.results())[0]);
  assert.match(result.text,/all exit 0/);assert.match(await readFile(result.artifacts[0]!.path,'utf8'),/legacy package passed/);
});

test('a queued request cannot pass for a different head after its worktree advances', async t => {
  const f = await fixture(t, 'node -e "require(\'fs\').writeFileSync(\'admitted\',\'yes\')"');
  const git = (...args: string[]) => promisify(execFile)('git', args, { cwd: f.root });
  await git('init', '-b', 'dev');
  await git('config', 'user.name', 'Head test');
  await git('config', 'user.email', 'head@example.invalid');
  await git('add', '.'); await git('commit', '-m', 'original build');
  const head = (await git('rev-parse', 'HEAD')).stdout.trim();
  const lock = join(f.root, 'suite.lock');
  await mkdir(lock);
  const job = await f.launch();
  assert.equal(job.pid, null);
  await git('commit', '--allow-empty', '-m', 'advanced build');
  await rm(lock, { recursive: true });
  const result = await eventually('changed-head rejection', async () => (await f.results())[0]);
  assert.match(result.text, /queued head changed/);
  assert.ok(result.text.includes(head));
  assert.match(result.text, /exit 1/);
  await assert.rejects(stat(join(f.root, 'admitted')), { code: 'ENOENT' });
  assert.equal((await f.results()).length, 1);
});

test('worker cleanup removes a borrowed root when its package runner dies during mkdir', async t => {
  const f = await fixture(t, `${process.execPath} borrowed-crash.mjs`);
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const locks = [join(f.root, 'suite.lock'), join(f.root, 'suite.lock-nvim')];
  const marker = join(f.root, 'created-root.json');
  await writeFile(join(f.root, 'borrowed-crash.mjs'), `import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const mkdir = fs.mkdir;
fs.mkdir = async (...args) => {
  const result = await mkdir(...args);
  const root = String(args[0]);
  if (root.split('/').at(-1).startsWith('cland-suite-') && !existsSync(${JSON.stringify(marker)})) {
    await fs.writeFile(${JSON.stringify(marker)}, JSON.stringify({ root, pid: process.pid }));
    process.kill(process.pid, 'SIGKILL');
  }
  return result;
};
syncBuiltinESMExports();
const { runSuite } = await import(${JSON.stringify(runner)});
process.exitCode = await runSuite([], ${JSON.stringify({ cwd: f.root, lockDirs: locks })});
`);
  const job = await f.launch();
  const created = await eventually('borrowed root creation crashed', async () => readFile(marker, 'utf8').then(text => JSON.parse(text) as { root: string; pid: number }, () => undefined));
  t.after(() => rm(created.root, { recursive: true, force: true }));
  const result = await eventually('worker reports package crash after cleanup', async () => (await f.results()).find(m => m.id === `suite:${job.id}`));
  assert.doesNotMatch(result.text, /all exit 0/);
  assert.equal(pidAlive(created.pid), false);
  await assert.rejects(stat(created.root), { code: 'ENOENT' });
  for (const lock of locks) {
    await assert.rejects(stat(lock), { code: 'ENOENT' });
    await assert.rejects(stat(`${lock}.owner`), { code: 'ENOENT' });
  }
  const next = await f.launch();
  const passed = await eventually('successor borrows a clean lease', async () => (await f.results()).find(m => m.id === `suite:${next.id}`));
  assert.match(passed.text, /all exit 0/);
});

for (const holder of ['live', 'stale'] as const) test(`admission stays responsive and bounds a held ps probe for a ${holder} compatibility holder`, async t => {
  const bin = await tempProject(t, 'cland-held-admission-ps-');
  const ps = (await promisify(execFile)('which', ['ps'])).stdout.trim();
  const held = join(bin, 'held');
  const release = join(bin, 'release');
  const probe = join(bin, 'probe-pid');
  await writeFile(join(bin, 'ps'), `#!${process.execPath}
import { existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
if (existsSync(${JSON.stringify(held)})) {
  writeFileSync(${JSON.stringify(probe)}, String(process.pid));
  while (!existsSync(${JSON.stringify(release)})) await pause(25);
}
const result = spawnSync(${JSON.stringify(ps)}, process.argv.slice(2), { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
`, { mode: 0o700 });
  const f = await fixture(t, 'node -e "process.exit(0)"', undefined, '', { PATH: `${bin}:${process.env.PATH ?? ''}` });
  const lock = join(f.root, 'suite.lock');
  await mkdir(lock);
  const job = await f.launch();
  assert.equal(job.pid, null);
  const started = (await promisify(execFile)(ps, ['-o', 'lstart=', '-p', String(process.pid)])).stdout.trim().replace(/\s+/g, ' ');
  await writeFile(`${lock}.owner`, JSON.stringify({ pid: holder === 'live' ? process.pid : 2147483647, started, token: 'held-compatibility-probe', since: new Date().toISOString() }));
  await writeFile(held, 'hold');
  try {
    const pid = await eventually('admission probe held', async () => readFile(probe, 'utf8').then(Number, () => undefined));
    const status = await f.ui.request({ type: 'hub.status' }, 500);
    assert.equal(status.ok, true);
    const cancel = await f.ui.request({ type: 'suite.cancel', suite: job.id }, 500);
    assert.equal(cancel.ok, true, cancel.error);
    await eventually('held admission probe terminated at its deadline', () => !pidAlive(pid) ? true : undefined, 7000);
  } finally {
    await writeFile(release, 'release');
  }
});

test('admission recovers a borrowed planned root after the worker dies during package mkdir', async t => {
  const f = await fixture(t, `${process.execPath} paused-borrow.mjs`);
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  const locks = [join(f.root, 'suite.lock'), join(f.root, 'suite.lock-nvim')];
  const marker = join(f.root, 'planned-root');
  await writeFile(join(f.root, 'paused-borrow.mjs'), `import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const mkdir = fs.mkdir;
fs.mkdir = async (...args) => {
  const result = await mkdir(...args);
  const root = String(args[0]);
  if (root.split('/').at(-1).startsWith('cland-suite-') && !existsSync(${JSON.stringify(marker)})) {
    await fs.writeFile(${JSON.stringify(marker)}, root);
    await new Promise(resolve => setTimeout(resolve, 30000));
  }
  return result;
};
syncBuiltinESMExports();
const { runSuite } = await import(${JSON.stringify(runner)});
process.exitCode = await runSuite([], ${JSON.stringify({ cwd: f.root, lockDirs: locks })});
`);
  const job = await f.launch();
  const root = await eventually('borrowed planned root exists', async () => readFile(marker, 'utf8').catch(() => undefined));
  t.after(() => rm(root, { recursive: true, force: true }));
  process.kill(job.pid!, 'SIGKILL');
  const failed = await eventually('worker crash reported', async () => (await f.results()).find(m => m.id === `suite:${job.id}`));
  assert.doesNotMatch(failed.text, /all exit 0/);
  const next = await f.launch();
  const passed = await eventually('successor admitted after stale recovery', async () => (await f.results()).find(m => m.id === `suite:${next.id}`));
  assert.match(passed.text, /all exit 0/);
  await assert.rejects(stat(root), { code: 'ENOENT' });
  for (const lock of locks) await assert.rejects(stat(`${lock}.owner`), { code: 'ENOENT' });
});

test('cancel removes an admitted worker’s compatibility FIFO ticket without releasing a racing hand holder', async t => {
  const bin = await tempProject(t, 'cland-worker-lease-race-');
  const ps = (await promisify(execFile)('which', ['ps'])).stdout.trim();
  const hold = join(bin, 'hold-worker');
  const entered = join(bin, 'worker-held');
  const release = join(bin, 'release-worker');
  await writeFile(join(bin, 'ps'), `#!${process.execPath}
import { existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { setTimeout as pause } from 'node:timers/promises';
const args = process.argv.slice(2);
if (existsSync(${JSON.stringify(hold)}) && args.at(-1) === String(process.ppid)) {
  writeFileSync(${JSON.stringify(entered)}, String(process.ppid));
  while (!existsSync(${JSON.stringify(release)})) await pause(25);
}
const result = spawnSync(${JSON.stringify(ps)}, args, { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
`, { mode: 0o700 });
  const f = await fixture(t, 'node -e "require(\'fs\').writeFileSync(\'admitted\',\'yes\')"', undefined, '', { PATH: `${bin}:${process.env.PATH ?? ''}` });
  await writeFile(hold, 'hold');
  const job = await f.launch();
  assert.ok(job.pid);
  await eventually('worker paused before compatibility acquisition', async () => readFile(entered, 'utf8').then(pid => Number(pid) === job.pid ? true : undefined, () => undefined));
  const lock = join(f.root, 'suite.lock');
  try { await mkdir(lock); }
  finally { await writeFile(release, 'release'); }
  await eventually('admitted worker has a legacy FIFO ticket', async () => readdir(`${lock}.queue`).then(files => files.length === 1 ? true : undefined, () => undefined));
  const cancelled = await clandWithEnv(f.root, f.env, 'verify', 'cancel', job.id, '--json');
  assert.equal(cancelled.code, 0, cancelled.stderr);
  const result = await eventually('queued worker cancellation posted', async () => (await f.results()).find(m => m.id === `suite:${job.id}`));
  assert.match(result.text, /exit 143; cancelled/);
  assert.deepEqual(result.to.sort(), ['impl', 'rev']);
  assert.deepEqual(await readdir(`${lock}.queue`), []);
  assert.equal(pidAlive(job.pid), false);
  assert.equal((await stat(lock)).isDirectory(), true);
  await assert.rejects(stat(join(f.root, 'admitted')), { code: 'ENOENT' });
  assert.equal((await f.results()).filter(m => m.id === `suite:${job.id}`).length, 1);
});
