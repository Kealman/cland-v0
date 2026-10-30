// Publication tests supply a completed verification receipt; execution is proved by Suites tests.
import { Store } from '../src/hub/store.ts';
import type { SuiteJob } from '../src/hub/suites.ts';
import { join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

export function recordReleaseCover(root: string, head: string, tree: string, overrides: Partial<SuiteJob> = {}, existing?: Store) {
  const id = 'release-cover-fixture';
  const job: SuiteJob = { id, mode: 'all', cwd: root, topic: 'general', to: ['coordinator'], actor: null,
    head, tree, branch: 'dev', executor: 'droplet',
    integrated: true, occasion: 'dev-t3', selection: { mode: 'full', tiers: ['T3'], files: [], reason: 'fixture receipt' },
    log: join(root, '.cland/run/release-cover.log'), result: join(root, '.cland/run/release-cover-result.json'), gate: join(root, '.cland/run/release-cover-ready'), pid: null, started: null,
    outcome: { code: 0, cause: 'completed' }, state: 'finished', artifact: 'A-fixture', reported: true, error: null, ...overrides };
  const store = existing ?? new Store(join(root, '.cland/hub.db'));
  try {
    mkdirSync(join(root, '.cland/run'), { recursive: true });
    writeFileSync(job.log, '# tests 1\n# pass 1\n');
    const artifact = store.registerArtifact(artifactId => ({ id: artifactId, title: id, kind: 'file', path: job.log,
      creator: 'hub', time: '2026-10-19T00:00:00.000Z', topic: 'general', status: 'shared' }), () => {});
    job.artifact = artifact.id;
    store.setMeta(`suite-job:${id}`, JSON.stringify({ position: 0, job }));
  }
  finally { if (!existing) store.close(); }
  return job;
}
