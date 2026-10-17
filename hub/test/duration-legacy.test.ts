// T2: lint runs in-process against real scratch Git histories; Git is the native boundary under test.
import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gitIn } from '../src/tracker/verdict-git.ts';
import { lintHubShards, lintHubShardTree } from '../src/suite-shards.ts';
import type { DurationManifest } from '../src/suite-durations.ts';

async function history(cwd: string) {
  const run = gitIn(cwd);
  const git = async (...args: string[]) => {
    const result = await run(['-c', 'user.name=Duration test', '-c', 'user.email=duration@example.invalid', '-c', 'commit.gpgsign=false', ...args]);
    assert.notEqual(result, null, args.join(' '));
    return result!;
  };
  await git('init', '-qb', 'dev');
  await mkdir(join(cwd, 'hub/test'), { recursive: true });
  await mkdir(join(cwd, '.cland/tasks'), { recursive: true });
  await writeFile(join(cwd, '.cland/tasks/E-677-fixture.md'), '---\nid: E-677\nkind: epic\ntitle: Allowance owner\nstate: open\n---\n');
  const key = 'hub/test/old.test.ts::old';
  const entry = { seconds: 6, owner: 'E-677', legacy: true as const, reason: 'Existing process lifecycle.' };
  const manifest: DurationManifest = { version: 1, source: { artifacts: [], commit: 'base' }, budget: { testSeconds: 5, fileSeconds: 60, T1: { testSeconds: 0.5, fileSeconds: 10, wallSeconds: 120 } }, files: {}, tests: {}, allow: { [key]: entry } };
  const write = () => writeFile(join(cwd, 'hub/test/durations.json'), JSON.stringify(manifest));
  await write(); await git('add', '.'); await git('commit', '-qm', 'legacy baseline');
  await git('branch', 'candidate');
  delete manifest.allow[key];
  await write(); await git('commit', '-qam', 'dev retires allowance');
  await git('update-ref', 'refs/remotes/origin/dev', 'HEAD');
  await git('checkout', '-q', 'candidate');
  manifest.allow[key] = entry;
  await writeFile(join(cwd, 'branch.txt'), 'unrelated work');
  await git('add', '.'); await git('commit', '-qm', 'branch work');
  return { cwd, git, manifest, entry, write };
}

async function withHistory(t: TestContext, check: (fixture: Awaited<ReturnType<typeof history>>) => Promise<void>) {
  const cwd = await mkdtemp(join(tmpdir(), 'cland-legacy-base-'));
  let work: Promise<void>;
  t.after(async () => {
    // Cancellation can run after hooks while the test body is still pending.
    // Join the whole scenario (including bounded Git calls) before removing
    // its root, so no writer or later continuation can race the removal.
    await Promise.allSettled([work]);
    await rm(cwd, { recursive: true, force: true });
  });
  work = (async () => check(await history(cwd)))();
  await work;
}

test('duration lint preserves untouched legacy allowances after dev removes them', t => withHistory(t, async ({ cwd, git }) => {
  await assert.doesNotReject(lintHubShards(cwd));
  await assert.doesNotReject(lintHubShardTree(cwd, 'HEAD'));
  // Immutable admission follows the submitted commit even from dev's checkout.
  await git('checkout', '-q', 'dev');
  await assert.doesNotReject(lintHubShardTree(cwd, 'candidate'));
  await assert.doesNotReject(lintHubShardTree(cwd, await git('rev-parse', 'candidate^{tree}'), process.env, { head: 'candidate', base: 'dev' }));
}));

test('duration lint refuses new legacy allowances against divergent dev history', t => withHistory(t, async ({ cwd, git, manifest, entry, write }) => {
  manifest.allow['hub/test/new.test.ts::new'] = entry;
  await write();
  await assert.rejects(lintHubShards(cwd), /new duration allowance cannot be legacy: hub\/test\/new.test.ts::new/);
  await git('commit', '-qam', 'new legacy allowance');
  await assert.rejects(lintHubShardTree(cwd, 'HEAD'), /new duration allowance cannot be legacy: hub\/test\/new.test.ts::new/);
  await git('checkout', '-q', 'dev');
  await assert.rejects(lintHubShardTree(cwd, await git('rev-parse', 'candidate^{tree}'), process.env, { head: 'candidate', base: 'dev' }), /new duration allowance cannot be legacy: hub\/test\/new.test.ts::new/);
}));
