// Stage QA through the daemon, real verifier spokes, CLI and local-territory merges.
import { fixtureEnvironment } from './fixture-environment.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify } from 'yaml';
import type { ItemView } from '../src/tracker/tracker.ts';
import type { EpicPlan } from '../src/tracker/plan.ts';
import { nativeProjectHub as projectHub, cland, connectUi, eventually, fakeClaude, spawnSpoke, startDaemon, tempProject } from './harness.ts';
import { copyPreparedProject } from './prepared-project.ts';
import { taskWriteGate } from './tracker-write-gate.ts';
import { seedStageCover } from './stage-cover-fixture.ts';

export const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { env: fixtureEnvironment(cwd, process.env), cwd, encoding: 'utf8' }).trim();
export async function fixture(t: test.TestContext, gated = false, count = 3, launchLead = false, ancestryFailure = false, serve: typeof projectHub | typeof startDaemon = projectHub) {
  const root = await tempProject(t);
  await copyPreparedProject(root);
  const gate = gated ? await taskWriteGate(t, root) : undefined;
  const fake = launchLead ? await fakeClaude(t) : undefined;
  const failAncestry = join(root, '.cland', 'fail-ancestry');
  const bin = join(root, '.cland', 'ancestry-bin');
  if (ancestryFailure) {
    await mkdir(bin);
    await writeFile(join(bin, 'git'), '#!/bin/sh\nif [ "$1" = "merge-base" ] && [ "$2" = "--is-ancestor" ] && [ -f "$CLAND_TEST_ANCESTRY_FAIL" ]; then kill -TERM "$$"; fi\nexec /usr/bin/git "$@"\n', { mode: 0o755 });
  }
  const env = { ...gate?.env, ...fake?.env,
    ...(ancestryFailure ? { PATH: `${bin}:${process.env.PATH}`, CLAND_TEST_ANCESTRY_FAIL: failAncestry } : {}) };
  let hub = await serve(t, root, env);
  let ui = await connectUi(t, hub.discovery);
  let rev = await spawnSpoke({ discover: true, cwd: root, name: 'rev', role: 'reviewer', sessionId: 'review-session' });
  let qa = await spawnSpoke({ discover: true, cwd: root, name: 'qa-one', role: 'qa', sessionId: 'qa-session' });
  t.after(async () => { await rev.close(); await qa.close(); });
  const create = async (title: string, kind = 'task', parent?: string, body?: string) => {
    const r = await ui.request({ ...(['task'].includes(kind) ? { size: 'M' } : {}), type: 'task.create', title, kind, parent, body }); assert.equal(r.ok, true, r.error);
    return (r.value as { item: ItemView }).item;
  };
  const epic = await create('Stage demo', 'epic', undefined, '## Definition of done\n- [ ] C1. The integrated demo works');
  const items = await Promise.all(['First', 'Second', 'Third'].slice(0, count).map(title => create(title, 'task', epic.id)));
  const plan: EpicPlan = { stages: [{ name: 'Stage 1', qa: { scope: 'affected', when: 'after-stage' }, lanes: count === 1 ? [[items[0]!.id]] : [[items[0]!.id, items[1]!.id], [items[2]!.id]] }] };
  const set = async () => { const r = await ui.request({ type: 'task.plan', item: epic.id, op: 'set', yaml: stringify(plan) }); assert.equal(r.ok, true, r.error); };
  await set();
  const read = async (id = epic.id) => ((await ui.request({ type: 'task.view', item: id })).value as { item: ItemView }).item;
  const land = async () => {
    for (const [i, item] of items.entries()) {
      const r = await ui.request({ type: 'task.claim', item: item.id }); assert.equal(r.ok, true, r.error);
      const work = (r.value as { worktree: { path: string } }).worktree.path;
      await writeFile(join(work, `feature-${i}`), `feature ${i}\n`); git(work, 'add', `feature-${i}`); git(work, 'commit', '-qm', `Feature ${i}`);
      assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id: item.id, verdict: 'review', scope: 'full', result: 'clear', run: `review-${i}` })).ok, true);
      await eventually('review makes after-stage item ready', async () => (await read(item.id)).status === 'ready' ? true : undefined);
      const merged = await ui.request({ type: 'merge', item: item.id }, 30_000); assert.equal(merged.ok, true, merged.error);
      assert.equal((await read(item.id)).verdicts.some(v => v.verdict === 'qa'), false);
    }
    // These tests exercise QA/plan provenance with completed platform receipts
    // already present, as they would be before the stage QA request.
    await rev.close(); await qa.close(); ui.close();
    if ('stop' in hub) await hub.stop();
    else assert.equal((await cland(root, 'hub', 'stop')).code, 0);
    await seedStageCover(root);
    hub = await serve(t, root, env);
    ui = await connectUi(t, hub.discovery);
    rev = await spawnSpoke({ discover: true, cwd: root, name: 'rev', role: 'reviewer', sessionId: 'review-session' });
    qa = await spawnSpoke({ discover: true, cwd: root, name: 'qa-one', role: 'qa', sessionId: 'qa-session' });
    await eventually('platform tree resolved before stage QA', async () => {
      const cover = (await read()).stages?.[0]?.cover;
      return cover?.linux && cover.macos && cover.missing.length === 0 && !cover.pending?.length ? true : undefined;
    });
  };
  const verdict = (result = 'clear', extra: Record<string, unknown> = {}) => qa.call<{ ok: boolean; error?: string; item?: ItemView }>('task.comment', { id: epic.id, verdict: 'qa', result, stage: 'Stage 1', run: `stage-${result}`, ...extra });
  return { root, fake, stop: async () => { if ('stop' in hub) await hub.stop(); else assert.equal((await cland(root, 'hub', 'stop')).code, 0); }, get ui() { return ui; }, get rev() { return rev; }, get qa() { return qa; }, epic, items, plan, set, read, land, verdict, gate, failAncestry };
}
