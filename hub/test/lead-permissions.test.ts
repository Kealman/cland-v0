// T3: native Git worktree creation/pruning and merge callback barriers preserve Lead authority.
// Component authority cases live in lead-permissions-component.test.ts.
import { fixtureEnvironment } from './fixture-environment.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import childProcess, { execFileSync } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { connectUi, inProcessSpoke, nativeProjectHub as projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { copyPreparedProject } from './prepared-project.ts';
import { pushDev } from '../src/territory-push.ts';
import type { HarnessProcessView } from '../src/protocol.ts';
import { heldOperations } from './lead-permissions-support.ts';

test('a verifier spawned while its item leaves the Lead subtree is refused and cleaned up', async t => {
  const work = heldOperations(t);
  const root = await tempProject(t);
  await copyPreparedProject(root);
  const { discovery, fakes } = await projectHub(t, root, {}, { harnesses: 'fake', clock: new FakeClock() });
  const fake = fakes['claude-code']!;
  const gate = work.gate();
  const spawn = fake.spawn.bind(fake);
  fake.spawn = async (...args) => {
    const process = await spawn(...args);
    if (args[0].name === 'late-verifier') { gate.enter(); await gate.released; }
    return process;
  };
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  const { item: epic } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Own epic', kind: 'epic' });
  const { item: other } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Other epic', kind: 'epic' });
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Verifier work', parent: epic.id });
  const launched = await coord.call<{ process: HarnessProcessView }>('session.launch', { name: 'lead-1', role: 'lead', item: epic.id, harness: 'claude-code' });
  const lead = await inProcessSpoke(t, { cwd: root, discover: true, name: 'lead-1', sessionId: launched.process.sessionId, assignRole: false });
  t.after(() => lead.close());
  const launching = work.track(lead.call<{ ok: boolean; code: string; reason: string }>('session.launch', { name: 'late-verifier', role: 'reviewer', item: item.id, harness: 'claude-code' }));
  await gate.entered;
  assert.equal((await coord.call<{ ok: boolean }>('task.edit', { id: item.id, state: 'closed' })).ok, true);
  const pruned = await ui.request({ type: 'worktree.prune', items: [item.id] });
  assert.equal(pruned.ok, true);
  const outcome = pruned.value as { removed: unknown[]; failed: Array<{ item: string; error: string }> };
  assert.deepEqual(outcome.removed, []);
  assert.equal(outcome.failed.length, 1);
  assert.equal(outcome.failed[0]!.item, item.id);
  // The spawned verifier may register its presence before the gated adapter returns.
  assert.ok([
    `${item.id}: a session is being launched in its worktree`,
    `${item.id}: late-verifier still stands inside its worktree`,
  ].includes(outcome.failed[0]!.error), outcome.failed[0]!.error);
  assert.equal(existsSync(join(root, '.cland/worktrees', item.id)), true);
  assert.equal((await coord.call<{ ok: boolean }>('task.edit', { id: item.id, state: 'open' })).ok, true);
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: item.id, parent: other.id })).ok, true);
  gate.release();
  const result = await launching;
  assert.equal(result.ok, false);
  assert.equal(result.code, 'forbidden');
  assert.match(result.reason, /Lead level.*subtree/);
  assert.equal(fake.stops.some(p => p.name === 'late-verifier'), true, 'the refused spawned verifier is stopped');
  const listed = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
  assert.equal(listed.processes.some(p => p.name === 'late-verifier' && p.status === 'running'), false);
  assert.equal((await coord.call<{ item: { claim: unknown } }>('task.view', { id: item.id })).item.claim, null);
});

test('lead-1 requests verifiers and merges its scheduled item through the ordinary gate; other levels refuse', async t => {
  const work = heldOperations(t);
  const root = await tempProject(t);
  const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { env: fixtureEnvironment(cwd, process.env), cwd, encoding: 'utf8' }).trim();
  await copyPreparedProject(root, 'native-territory');
  await writeFile(join(root, 'feature.txt'), 'initial\n');
  git(root, 'add', 'feature.txt');
  git(root, 'commit', '-qm', 'Initial feature');
  await pushDev(root, work => work(), () => {});
  let gateKind = '';
  let writeTrees = 0;
  let gate = work.gate();
  const nativeExec = childProcess.execFile;
  const mock = t.mock.method(childProcess, 'execFile', ((file: string, args: string[], options: unknown, callback: (...args: unknown[]) => void) => {
    // cland-allow-child-env: native Git spy forwards product options unchanged to preserve the permission race boundary
    return nativeExec(file, args, options as childProcess.ExecFileOptions, (...result: unknown[]) => {
      const waiting = file === 'git' && ((gateKind === 'preparation' && args[0] === 'merge-tree' && args.includes('--name-only'))
        || (gateKind === 'landing' && args[0] === 'write-tree' && writeTrees++ === 1)
        || (gateKind === 'recovery' && args[0] === 'rev-parse' && args.some(a => a.endsWith('^'))));
      if (!waiting) { callback(...result); return; }
      gate.enter();
      void gate.released.then(() => callback(...result));
    });
  }) as typeof childProcess.execFile);
  syncBuiltinESMExports();
  t.after(() => { mock.mock.restore(); syncBuiltinESMExports(); });
  const { discovery, fakes } = await projectHub(t, root, {}, { harnesses: 'fake', clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  // The direct verdict writer and the launched verifier each occupy a Reviewer slot.
  assert.equal((await ui.request({ type: 'crew.set', key: 'reviewer.size', value: 2 })).ok, true);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator' });
  const rev = await inProcessSpoke(t, { cwd: root, discover: true, name: 'rev', role: 'reviewer' });
  t.after(async () => { await coord.close(); await rev.close(); });
  const create = async (title: string, kind = 'task', parent?: string) => (await coord.call<{ item: { id: string } }>('task.create', { ...(['task'].includes(kind) ? { size: 'M' } : {}), title, kind, parent })).item.id;
  const release = await create('Release', 'release');
  const epic = await create('Own epic', 'epic', release);
  const other = await create('Other epic', 'epic', release);
  const own = await create('Own task', 'task', epic);
  const foreign = await create('Other task', 'task', other);
  const launched = await coord.call<{ process: HarnessProcessView }>('session.launch', { name: 'lead-1', role: 'lead', item: epic, harness: 'claude-code' });
  const lead = await inProcessSpoke(t, { cwd: root, discover: true, name: 'lead-1', sessionId: launched.process.sessionId, assignRole: false });
  t.after(() => lead.close());
  const stop = async (name: string) => ({ code: (await ui.request({ type: 'session.stop', session: name, as: { name: 'lead-1' } })).ok ? 0 : 1 });
  const claimed = await ui.request({ type: 'task.claim', item: own });
  assert.equal(claimed.ok, true, claimed.error);
  const worktree = (claimed.value as { worktree: { path: string; branch: string } }).worktree;
  await writeFile(join(worktree.path, 'feature.txt'), 'shipped\n');
  git(worktree.path, 'add', 'feature.txt');
  git(worktree.path, 'commit', '-qm', 'Implement own item');
  git(worktree.path, 'push', 'origin', worktree.branch);
  for (const role of ['reviewer', 'qa']) {
    const verifier = await lead.call<{ ok: boolean; reason?: string; error?: string; claim: unknown; process: HarnessProcessView }>('session.launch', { name: `${role}-pool`, role, item: own, harness: 'claude-code' });
    assert.equal(verifier.ok, true, verifier.error ?? verifier.reason);
    assert.equal(verifier.claim, null);
    assert.equal(verifier.process.item, own);
    const request = await lead.call<{ ok: boolean }>('send', { to: [`${role}-pool`], text: `${role === 'qa' ? 'qa' : 'review'} request ${own}\nCheck the build.` });
    assert.equal(request.ok, true);
    const denied = await lead.call<{ ok: boolean; code: string; reason: string }>('send', { to: [`${role}-pool`], text: `${role === 'qa' ? 'qa' : 'review'} request ${foreign}\nCheck the build.` });
    assert.equal(denied.ok, false);
    assert.match(denied.reason, /subtree/);
    assert.equal((await stop(`${role}-pool`)).code, 0);
  }
  const before = git(root, 'rev-parse', 'dev');
  const outside = await lead.call<{ ok: boolean; code: string; reason: string }>('merge', { item: foreign });
  assert.equal(outside.ok, false);
  assert.equal(outside.code, 'forbidden');
  assert.match(outside.reason, new RegExp(`epic ${epic}.*${foreign}.*subtree`));
  const gated = await lead.call<{ ok: boolean; code: string }>('merge', { item: own });
  assert.equal(gated.ok, false);
  assert.equal(gated.code, 'review-missing');
  assert.equal(git(root, 'rev-parse', 'dev'), before);
  // A disjoint dev change keeps real Git mergeable; the callback barrier controls preparation exactly.
  await writeFile(join(root, 'dev.txt'), 'dev version\n');
  git(root, 'add', 'dev.txt');
  git(root, 'commit', '-qm', 'Dev changes another file');
  await pushDev(root, work => work(), () => {});
  gateKind = 'preparation';
  assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id: own, verdict: 'review', scope: 'full', result: 'clear', run: 'lead-demo' })).ok, true);
  const refs = git(root, 'show-ref');
  let preparationResult: unknown;
  const preparing = work.track(lead.call<{ ok: boolean; code: string; reason: string }>('merge', { item: own }).then(result => { preparationResult = result; return result; }));
  await gate.entered;
  assert.equal(preparationResult, undefined, 'the merge has not finished before reparenting');
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: own, parent: other })).ok, true);
  gate.release();
  const moved = await preparing;
  assert.equal(moved.ok, false);
  assert.equal(moved.code, 'forbidden');
  assert.match(moved.reason, /Lead level.*subtree/);
  assert.equal(git(root, 'show-ref'), refs);
  assert.equal(await readFile(join(root, 'feature.txt'), 'utf8'), 'initial\n');
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: own, parent: epic })).ok, true);
  gateKind = 'landing';
  gate = work.gate();
  writeTrees = 0;
  let landingResult: unknown;
  const landing = work.track(lead.call<{ ok: boolean; code: string; reason: string }>('merge', { item: own }).then(result => { landingResult = result; return result; }));
  await gate.entered;
  assert.equal(landingResult, undefined, 'the index changed but the ref has not moved');
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: own, parent: other })).ok, true);
  gate.release();
  const late = await landing;
  assert.equal(late.ok, false);
  assert.equal(late.code, 'forbidden');
  assert.match(late.reason, /Lead level.*subtree/);
  assert.equal(git(root, 'show-ref'), refs);
  assert.equal(await readFile(join(root, 'feature.txt'), 'utf8'), 'initial\n');
  gateKind = '';
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: own, parent: epic })).ok, true);
  const obstruction = join(root, '.cland/tasks', `.${own}-own-task.md.${discovery.pid}.tmp`);
  await mkdir(obstruction);
  const merged = await lead.call<{ ok: boolean; error?: string; commit: string; followUp?: { step: string; error: string } }>('merge', { item: own });
  assert.equal(merged.ok, true, merged.error);
  assert.equal(merged.followUp?.step, 'close');
  assert.equal(git(root, 'rev-parse', 'dev'), merged.commit);
  assert.equal(await readFile(join(root, 'feature.txt'), 'utf8'), 'shipped\n');
  await rm(obstruction, { recursive: true });
  gateKind = 'recovery';
  gate = work.gate();
  const recovering = work.track(lead.call<{ ok: boolean; commit: string; followUp?: { error: string } }>('merge', { item: own }));
  await gate.entered;
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: own, parent: other })).ok, true);
  gate.release();
  const recovery = await recovering;
  assert.equal(recovery.commit, merged.commit);
  assert.match(recovery.followUp?.error ?? '', /Lead level.*subtree/);
  assert.equal((await coord.call<{ item: { state: string } }>('task.view', { id: own })).item.state, 'open');
  assert.equal(git(root, 'rev-parse', 'dev'), merged.commit);
  gateKind = '';
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: own, parent: epic })).ok, true);
  const finished = await lead.call<{ ok: boolean; followUp?: unknown }>('merge', { item: own });
  assert.equal(finished.ok, true);
  assert.equal(finished.followUp, undefined);
  const closed = await coord.call<{ item: { state: string } }>('task.view', { id: own });
  assert.equal(closed.item.state, 'closed');
  for (const type of ['release', 'sync', 'push', 'hub.stop']) {
    const denied = await ui.request({ type, as: { name: 'lead-1' } });
    assert.equal(denied.ok, false);
    assert.match(denied.error!, /root level.*Coordinator/);
  }
});
