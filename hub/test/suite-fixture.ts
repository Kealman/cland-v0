// Real CLI/socket fixture shared with its subprocess teardown regression.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, clandWithEnv, connectUi, projectHub, startDaemon, spawnSpoke, tempProject } from './harness.ts';
import { onCleanup, ownProcess } from './process-cleanup.ts';

export type ResultMessage = { id: string; from: string; fromRole?: string; text: string; to: string[]; artifacts: Array<{ id: string; path: string; creator: string }> };
export async function fixture(t: import('node:test').TestContext, testScript: string, typecheck = 'node -e "process.exit(0)"', config = '', daemonEnv: Record<string, string> = {}, budget = 1, cacheAgeMinutes = 1440, serve: typeof projectHub | typeof startDaemon = projectHub) {
  const root = await tempProject(t, 'cland-suite-cli-');
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland', 'config.toml'), `${config}\n[verification]\nbudget = ${budget}\ncache_max_age_minutes = ${cacheAgeMinutes}\nlock_path = ${JSON.stringify(join(root, 'suite.lock'))}\n`);
  await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { typecheck, test: testScript } }));
  const { discovery } = await serve(t, root, daemonEnv);
  const ui = await connectUi(t, discovery, 'cli');
  onCleanup(t, () => ui.close());
  assert.equal((await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' })).ok, true);
  assert.equal((await ui.request({ type: 'role.set', session: 'rev', role: 'reviewer' })).ok, true);
  const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'impl', sessionId: 'suite-caller', role: 'implementer' });
  // Native after hooks stop at the first failure; share ownership teardown instead.
  onCleanup(t, () => spoke.close());
  await spoke.waitForPresence(['impl']);
  const env = { CLAND_SESSION_NAME: 'impl', CLAND_SESSION_ID: 'suite-caller', CLAND_ROLE: 'implementer' };
  const created = JSON.parse((await cland(root, 'task', 'create', '--size', 'M', 'fixture', '--assignee', 'impl', '--json')).stdout) as { item: { id: string } };
  const topicResult = await ui.request({ type: 'topic.create', title: 'Suite fixture', item: created.item.id });
  assert.equal(topicResult.ok, true, topicResult.error);
  const topic = (topicResult.value as { topic: { id: string } }).topic.id;
  const results = async () => {
    const history = await ui.request({ type: 'topic.history', topic });
    assert.equal(history.ok, true, history.error);
    return (history.value as { messages: ResultMessage[] }).messages.filter(m => m.text.startsWith('suite result '));
  };
  const launch = async (mode = 'all', ...options: string[]) => {
    const r = await clandWithEnv(root, env, 'suite', mode, '--report', topic, '--to', 'rev', '--to', 'impl', '--json', ...options);
    assert.equal(r.code, 0, r.stderr);
    const job = JSON.parse(r.stdout) as { id: string; pid: number | null; position: number; cached?: { run: string; head: string; tree: string } };
    if (job.pid) ownProcess(t, job.pid);
    return job;
  };
  return { root, discovery, ui, env, topic, results, launch, spoke };
}

