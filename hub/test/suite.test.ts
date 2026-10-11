// Public CLI/socket tests use tiny package fixtures, never the live project's full-suite queue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, stat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, clandWithEnv, connectUi, eventually, startDaemon, spawnSpoke, tempProject, pidAlive } from './harness.ts';
import { suiteSummary } from '../src/hub/suites.ts';
import { DatabaseSync } from 'node:sqlite';
import { ownProcess } from './process-cleanup.ts';
import type { Artifact } from '../src/protocol.ts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

type ResultMessage = { id: string; from: string; fromRole?: string; text: string; to: string[]; artifacts: Array<{ id: string; path: string; creator: string }> };
async function fixture(t: import('node:test').TestContext, testScript: string, typecheck = 'node -e "process.exit(0)"', config = '', daemonEnv: Record<string, string> = {}) {
  const root = await tempProject(t, 'cland-suite-cli-');
  if (config) { await mkdir(join(root, '.cland')); await writeFile(join(root, '.cland', 'config.toml'), config); }
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
    const job = JSON.parse(r.stdout) as { id: string; pid: number; position: number };
    ownProcess(t, job.pid);
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
  process.kill(job.pid, 'SIGKILL');
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
  await eventually('cancelled processes stopped', () => !pidAlive(job.pid) && !pidAlive(child) ? true : undefined);
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
  assert.equal(pidAlive(job.pid), true);
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

test('suite cancel removes its FIFO ticket while an unrelated submission is held, preserving the holder’s lock', async t => {
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
  await eventually('runner queued', async () => {
    const log = await readFile(join(f.root, '.cland', 'run', 'suites', job.id, 'suite.log'), 'utf8');
    return log.includes('waiting for the suite lock') ? true : undefined;
  });
  assert.equal((await readdir(`${lock}.queue`)).length, 1);
  const other = join(f.root, 'other');
  await mkdir(other);
  await writeFile(join(other, 'hold-git'), 'hold');
  await writeFile(join(other, 'package.json'), JSON.stringify({ scripts: { typecheck: 'node -e "process.exit(0)"', test: 'node -e "process.exit(0)"' } }));
  const submission = f.ui.request({ type: 'suite.start', mode: 'all', cwd: other, report: f.topic, to: ['impl', 'rev'] }, 15000);
  await eventually('unrelated submission held in git', async () => stat(join(other, 'git-held')).then(() => true, () => undefined));
  const cancellation = clandWithEnv(f.root, f.env, 'suite', 'cancel', job.id);
  let cancelled;
  try {
    await eventually('cancelled FIFO ticket removed before unrelated submission resumes', async () => (await readdir(`${lock}.queue`)).length === 0 ? true : undefined, 5000);
    cancelled = await cancellation;
  } finally {
    await writeFile(join(other, 'release-git'), 'release');
    const submitted = await submission;
    assert.equal(submitted.ok, true, submitted.error);
    ownProcess(t, (submitted.value as { pid: number }).pid);
    await cancellation;
  }
  assert.equal(cancelled.code, 0, cancelled.stderr);
  await eventually('cancelled FIFO ticket removed', async () => (await readdir(`${lock}.queue`)).length === 0 ? true : undefined);
  const result = await eventually('queued cancellation result', async () => (await f.results()).find(m => m.id === `suite:${job.id}`));
  assert.match(result.text, /exit 143; cancelled/);
  assert.equal((await stat(lock)).isDirectory(), true, 'manual holder lock remains intact');
  await assert.rejects(stat(join(f.root, 'admitted')), { code: 'ENOENT' });
  const receipt = JSON.parse(await readFile(join(f.root, '.cland', 'run', 'suites', job.id, 'result.json'), 'utf8'));
  assert.equal(receipt.code, 143);
  assert.equal((await f.results()).filter(m => m.id === `suite:${job.id}`).length, 1);
});

test('suite cancel cleans a running lock runner’s children and temporary root before publishing', async t => {
  const f = await fixture(t, 'node running.mjs');
  const lock = join(f.root, 'suite.lock');
  const runner = fileURLToPath(new URL('./run-suite.ts', import.meta.url));
  await writeFile(join(f.root, 'running.mjs'), `import { runSuite } from ${JSON.stringify(runner)}; process.exitCode = await runSuite([['--test', 'holding.mjs']], { lockDir: ${JSON.stringify(lock)}, cwd: ${JSON.stringify(f.root)} });`);
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
  process.kill(job.pid, 'SIGKILL');
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
  assert.equal(pidAlive(job.pid), true);
  const initial = await ui.request({ type: 'topic.history', topic: f.topic });
  assert.equal((initial.value as { messages: ResultMessage[] }).messages.filter(m => m.id === `suite:${job.id}`).length, 0);
  await writeFile(join(f.root, 'finish'), 'ready');
  await eventually('worker naturally completed', () => !pidAlive(job.pid) ? true : undefined);
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
