// T3: real local and delivered remote workers supply OS receipts across a stage merge.
// This is the single two-platform stage frame proof; cache permutations live in suite-stage-rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { integrated } from './close-run-fixture.ts';
import { cland, eventually, nativeProjectHub as projectHub, inProcessSpoke, tempProject } from './harness.ts';
import type { ItemView } from '../src/tracker/tracker.ts';

const exec = promisify(execFile);

async function linuxMachines(f: Awaited<ReturnType<typeof integrated>>) {
  const node = join(f.api.stateRoot, 'bin/node');
  await writeFile(node, `#!/bin/sh\nif [ "$1" = "-e" ]; then\ncase "$2" in *'os:os.platform()'*) shift; program="$1"; shift; exec '${process.execPath}' -e "require('os').platform=()=> 'linux';$program" "$@";; esac\nfi\nexec '${process.execPath}' "$@"\n`, { mode: 0o700 });
}

test('after-stage gates require Mac and sharded Linux at one tree, retain history and advance the next stage', async t => {
  // Fake machines still run the real uploaded shell and receipt collection. Only
  // their measured OS is simulated, so this proof also runs on either host OS.
  const settings = await tempProject(t);
  const preload = join(settings, 'platform.cjs');
  await writeFile(preload, `if(process.argv.some(a=>a.endsWith('suite-worker.ts'))){require('node:os').platform=()=> 'darwin';require('node:module').syncBuiltinESMExports()}\n`);
  const f = await integrated(t, '[hygiene]\nloop_breaker_max=2\n', 2, undefined, { hub: projectHub, territory: true, env: { NODE_OPTIONS: `--require=${preload}` } });
  await linuxMachines(f);
  const create = async (kind: string, title: string, parent?: string) => {
    const response = await f.ui.request({ type: 'task.create', kind, title, parent, ...(kind === 'task' ? { size: 'S' } : {}) });
    assert.equal(response.ok, true, response.error);
    return (response.value as { item: ItemView }).item;
  };
  const epic = await create('epic', 'Two-platform stage');
  const item = await create('task', 'Land feature', epic.id);
  const next = await create('task', 'Next stage', epic.id);
  const beforeStage = await f.git('rev-parse', 'dev');
  const setPlan = async (scope: 'none' | 'affected') => {
    const response = await f.ui.request({ type: 'task.plan', item: epic.id, op: 'set', yaml: JSON.stringify({ stages: [
      { name: 'build', qa: { scope, when: 'after-stage' }, lanes: [[item.id]] },
      { name: 'next', qa: { scope: 'none', when: 'per-item' }, lanes: [[next.id]] },
    ] }) });
    assert.equal(response.ok, true, response.error);
  };
  await setPlan('none');
  const claimed = await f.ui.request({ type: 'task.claim', item: item.id });
  assert.equal(claimed.ok, true, claimed.error);
  const work = (claimed.value as { worktree: { path: string } }).worktree.path;
  await writeFile(join(work, 'feature'), 'stage feature\n');
  for (const args of [['add', 'feature'], ['commit', '-qm', 'Stage feature']]) await exec('git', args, { cwd: work });
  const reviewer = await inProcessSpoke(t, { discover: true, cwd: f.root, name: 'stage-rev', role: 'reviewer' });
  t.after(() => reviewer.close());
  assert.equal((await reviewer.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'clear', run: 'source' })).ok, true);
  const read = async (id = epic.id) => ((await f.ui.request({ type: 'task.view', item: id })).value as { item: ItemView }).item;
  await eventually('review makes task ready', async () => (await read(item.id)).status === 'ready' ? true : undefined);
  const merged = await f.ui.request({ type: 'merge', item: item.id }, 30_000);
  assert.equal(merged.ok, true, merged.error);
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const run = async (executor: 'local' | 'droplet', fresh = true, beforeReport?: (id: string) => Promise<void>) => {
    const submission = await f.spoke.call<{ ok: boolean; id: string; cached?: { run: string }; error?: string }>('verify', { mode: 'all', cwd: f.root, report: f.topic, to: ['stage-rev'], occasion: 'stage', executor, fresh });
    assert.equal(submission.ok, true, submission.error);
    await beforeReport?.(submission.id);
    const result = await f.result(submission.id);
    assert.match(result.text, /all exit 0/);
    return { ...submission, text: result.text };
  };
  const mac = await run('local');
  assert.match(mac.text, /stage cover missing Linux droplet.*tree [0-9a-f]{40}/);
  const macOnly = await eventually('Mac cover is visible in plan', async () => {
    const stage = (await read()).stages![0]!;
    return stage.cover?.macos === mac.id ? stage : undefined;
  });
  assert.equal(macOnly.state, 'open');
  assert.deepEqual(macOnly.cover!.missing, ['Linux droplet']);
  assert.equal((await read(next.id)).status, 'backlog');
  const shown = await cland(f.root, 'task', 'plan', 'show', epic.id);
  assert.match(shown.stdout, new RegExp(`missing Linux droplet; tree ${macOnly.cover!.tree}`));
  await writeFile(join(f.root, 'feature'), 'new integrated tree\n');
  await f.git('add', 'feature'); await f.git('commit', '-qm', 'New tree');
  const pushed = await cland(f.root, 'push'); assert.equal(pushed.code, 0, pushed.stderr);
  const linux = await run('droplet', false);
  assert.equal(linux.cached, undefined, 'a Mac cache cannot supply Linux proof');
  assert.match(linux.text, /stage cover missing macOS.*tree [0-9a-f]{40}/);
  assert.equal((await read()).stages![0]!.state, 'open', 'different green trees cannot close a stage');
  // The first two result deliveries fill this pair's loop-breaker window.
  const both = await run('local', false, async id => {
    await eventually('completed Mac run waits for its report to be deliverable', async () => {
      const status = (await f.ui.request({ type: 'hub.status', history: true })).value as { suites: Array<{ id: string; error: string | null }> };
      return status.suites.find(job => job.id === id)?.error ? true : undefined;
    });
    assert.equal((await read()).stages![0]!.state, 'open', 'an undelivered result is not stage evidence');
    assert.equal((await f.ui.request({ type: 'hygiene.unmute', a: 'impl', b: 'stage-rev' })).ok, true);
  });
  assert.equal(both.cached, undefined, 'a Linux cache cannot supply Mac proof');
  assert.match(both.text, /stage cover complete/);
  await eventually('both platform receipts close the stage', async () => (await read()).stages![0]!.state === 'closed' ? true : undefined);
  await eventually('the next stage advances after both receipts', async () => (await read(next.id)).status === 'planned' ? true : undefined);
  const cached = await run('droplet', false);
  assert.equal(cached.cached?.run, linux.id);
  assert.match(cached.text, /stage cover complete/);
  assert.equal(f.api.requests.filter(request => request.method === 'POST' && request.path === '/v2/droplets').length, 2);
  await setPlan('affected');
  assert.equal((await read()).stages![0]!.state, 'open', 'suite proof does not replace required stage QA');
  const qa = await inProcessSpoke(t, { discover: true, cwd: f.root, name: 'stage-qa', role: 'qa' });
  t.after(() => qa.close());
  const verdict = await qa.call<{ ok: boolean; error?: string }>('task.comment', { id: epic.id, verdict: 'qa', result: 'clear', stage: 'build', run: 'stage-demo' });
  assert.equal(verdict.ok, true, verdict.error);
  await eventually('QA and both receipts close scoped stage', async () => (await read()).stages![0]!.state === 'closed' ? true : undefined);
  await writeFile(join(f.root, 'later'), 'later stage work\n');
  await f.git('add', 'later'); await f.git('commit', '-qm', 'Later stage work');
  const later = await f.git('rev-parse', 'dev');
  await f.git('update-ref', 'refs/heads/dev', beforeStage, later);
  await eventually('rollback removes the tested build from dev ancestry', async () => (await read()).stages![0]!.state === 'open' ? true : undefined);
  await f.git('update-ref', 'refs/heads/dev', later, beforeStage);
  await eventually('restored descendant keeps the historical tested tree', async () => (await read()).stages![0]!.state === 'closed' ? true : undefined);
  assert.deepEqual(f.api.droplets, []);
});
