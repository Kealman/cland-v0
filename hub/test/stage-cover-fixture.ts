// Historical suite receipts are prerequisites for stage-QA tests. Seed the real
// persistence boundary only while the hub is stopped; platform execution itself
// is covered through the fake provider in suite-stage-cover.test.ts.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { committedTree } from '../src/verification-tree.ts';
import { Store } from '../src/hub/store.ts';
import type { SuiteJob } from '../src/hub/suites.ts';

export async function seedStageCover(root: string): Promise<void> {
  const head = execFileSync('git', ['rev-parse', 'dev'], { cwd: root, encoding: 'utf8' }).trim();
  const tree = await committedTree(root, head);
  assert.ok(tree);
  const base: SuiteJob = {
    id: `mac-${head}`, mode: 'all', cwd: root, topic: 'general', to: [], actor: null,
    head, tree, branch: 'dev', integrated: true, executor: 'local', occasion: 'stage',
    selection: { mode: 'full', reason: 'historical integrated stage cover', files: [], soak: true, loadGate: true },
    log: '', result: '', gate: '', pid: null, started: null, outcome: { code: 0, cause: '' },
    artifact: null, reported: true, error: null, state: 'finished', finished: new Date().toISOString(),
    platform: { os: 'darwin', arch: 'arm64', release: 'fixture', node: process.version, nvim: 'fixture' },
  };
  const linux: SuiteJob = { ...base, id: `linux-${head}`, executor: 'droplet', occasion: 'stage', platform: { ...base.platform!, os: 'linux' } };
  linux.shards = [1, 2].map(index => ({ ...linux, id: `${linux.id}-${index}`, parentRun: linux.id }));
  const store = new Store(join(root, '.cland/hub.db'));
  try {
    const jobs = JSON.parse(store.meta('suite-jobs') ?? '[]') as SuiteJob[];
    store.setMeta('suite-jobs', JSON.stringify([...jobs, base, linux]));
  } finally { store.close(); }
}
