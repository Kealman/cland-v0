import test from 'node:test';
import assert from 'node:assert/strict';
import { cland, clandWithEnv, connectUi, eventually, fakeClaude, fakeCodex, spawnSpoke, startDaemon, tempProject, testWaitMs } from './harness.ts';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { HarnessProcessView } from '../src/protocol.ts';

test('Lead launches and stops only sessions serving its live subtree', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  const create = async (title: string, kind = 'task', parent?: string) => (await coord.call<{ item: { id: string } }>('task.create', { title, kind, parent })).item.id;
  const epic = await create('Own epic', 'epic');
  const other = await create('Other epic', 'epic');
  const own = await create('Own task', 'task', epic);
  const foreign = await create('Foreign task', 'task', other);
  const launched = await coord.call<{ ok: boolean; process: HarnessProcessView }>('session.launch', { name: 'lead-1', role: 'lead', item: epic, harness: 'claude-code' });
  assert.equal(launched.ok, true);
  const lead = await spawnSpoke({ cwd: root, discover: true, name: 'lead-1', sessionId: launched.process.sessionId, assignRole: false });
  t.after(() => lead.close());
  const stop = (name: string) => clandWithEnv(root, { CLAND_SESSION_NAME: 'lead-1', CLAND_SESSION_ID: launched.process.sessionId }, 'session', 'stop', name);
  await lead.waitForPresence(['coord', 'lead-1']);
  const launch = (name: string, item?: string) => lead.call<{ ok: boolean; code?: string; reason?: string; process: HarnessProcessView }>('session.launch', { name, role: 'implementer', harness: 'claude-code', item });
  const worker = await launch('own-worker', own);
  assert.equal(worker.ok, true, worker.reason);
  assert.equal(worker.process.item, own);
  for (const [name, item] of [['foreign-worker', foreign], ['unbound-worker', undefined]]) {
    const denied = await launch(name!, item);
    assert.equal(denied.ok, false);
    assert.equal(denied.code, 'forbidden');
    assert.match(denied.reason!, new RegExp(`Lead.*epic ${epic}.*subtree`));
  }
  const elsewhere = await coord.call<{ ok: boolean }>('session.launch', { name: 'foreign-worker', role: 'implementer', item: foreign, harness: 'claude-code' });
  assert.equal(elsewhere.ok, true);
  const stopForeign = await ui.request({ type: 'session.stop', session: 'foreign-worker', as: { name: 'lead-1' } });
  assert.equal(stopForeign.ok, false);
  assert.match(stopForeign.error!, /subtree/);
  assert.equal((await stop('own-worker')).code, 0);
  // Reparenting takes effect on the next request; launch history grants nothing.
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: foreign, parent: epic })).ok, true);
  assert.equal((await stop('foreign-worker')).code, 0);
  assert.equal((await fake.sessions()).some(s => s.name === 'unbound-worker'), false);
  const unscheduled = await lead.call<{ ok: boolean; reason: string }>('merge', { item: own });
  assert.equal(unscheduled.ok, false);
  assert.match(unscheduled.reason, /root level.*Coordinator.*unscheduled/);
  const foreignAgain = await create('Foreign verification', 'task', other);
  const verifier = await lead.call<{ ok: boolean; process: HarnessProcessView }>('session.launch', { name: 'qa-pool', role: 'qa', item: own, harness: 'claude-code' });
  assert.equal(verifier.ok, true);
  const qa = await spawnSpoke({ cwd: root, discover: true, name: 'qa-pool', sessionId: verifier.process.sessionId, assignRole: false });
  t.after(() => qa.close());
  await qa.waitForPresence(['qa-pool']);
  for (const item of [own, foreignAgain]) {
    const hold = await qa.call<{ ok: boolean; error?: string }>('task.hold', { id: item });
    assert.equal(hold.ok, true, hold.error);
  }
  const held = await coord.call<{ items: Array<{ id: string; holds: Array<{ sessionId: string }> }> }>('task.list', {});
  assert.equal(held.items.find(i => i.id === foreignAgain)?.holds[0]?.sessionId, verifier.process.sessionId, JSON.stringify(held));
  const mixed = await stop('qa-pool');
  assert.notEqual(mixed.code, 0);
  assert.match(mixed.stderr, /subtree/);
  assert.equal((await qa.call<{ ok: boolean }>('task.hold', { id: foreignAgain, release: true })).ok, true);
  assert.equal((await stop('qa-pool')).code, 0);
  const path = join(root, '.cland/roles.toml');
  await writeFile(path, (await readFile(path, 'utf8')).replace('[lead.permissions]\ntools = [', '[lead.permissions]\ntools = ["release", "sync", "push", "hub.stop", "session.resume", '));
  for (const type of ['release', 'sync', 'push', 'hub.stop', 'session.resume']) {
    const denied = await ui.request({ type, session: 'own-worker', as: { name: 'lead-1' } });
    assert.equal(denied.ok, false);
    assert.match(denied.error!, /root level.*Coordinator/);
  }
  const newLead = await lead.call<{ ok: boolean; reason: string }>('session.launch', { name: 'lead-2', role: 'lead', item: other, harness: 'claude-code' });
  assert.equal(newLead.ok, false);
  assert.match(newLead.reason, /root level.*Coordinator launches Leads/);
  assert.equal((await ui.request({ type: 'task.claim', item: epic, release: true, force: true })).ok, true);
  const unclaimed = await launch('claimless-worker', own);
  assert.equal(unclaimed.ok, false);
  assert.match(unclaimed.reason!, /Lead level.*no live container claim/);
});

test('a verifier spawned while its item leaves the Lead subtree is refused and cleaned up', async t => {
  const root = await tempProject(t);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'Test');
  git('config', 'user.email', 'test@example.com');
  git('config', 'commit.gpgsign', 'false');
  git('commit', '--allow-empty', '-qm', 'Initial');
  assert.equal((await cland(root, 'init')).code, 0);
  const fake = await fakeClaude(t);
  const bin = join(root, '.cland/gated-bin');
  await mkdir(bin, { recursive: true });
  const marker = join(bin, 'spawned');
  const proceed = join(bin, 'proceed');
  // This starts a worktree and a complete harness before publishing the marker; 15 s is too short under load.
  const spawnWindowMs = testWaitMs(30_000);
  const realClaude = join(fake.env.PATH!.split(':')[0]!, 'claude');
  await writeFile(join(bin, 'claude'), `#!/usr/bin/env node\nimport { spawnSync } from 'node:child_process';\nimport { existsSync, writeFileSync } from 'node:fs';\nimport { setTimeout } from 'node:timers/promises';\nconst args = process.argv.slice(2);\nconst result = spawnSync(${JSON.stringify(realClaude)}, args, { env: process.env, encoding: 'utf8' });\nif (args.includes('--bg') && args.includes('late-verifier')) {\n  writeFileSync(${JSON.stringify(marker)}, 'ready');\n  while (!existsSync(${JSON.stringify(proceed)})) await setTimeout(10);\n}\nprocess.stdout.write(result.stdout ?? '');\nprocess.stderr.write(result.stderr ?? '');\nprocess.exit(result.status ?? 1);\n`, { mode: 0o755 });
  const { discovery } = await startDaemon(t, root, { ...fake.env, PATH: `${bin}:${fake.env.PATH}` });
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  const { item: epic } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Own epic', kind: 'epic' });
  const { item: other } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Other epic', kind: 'epic' });
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Verifier work', parent: epic.id });
  const launched = await coord.call<{ process: HarnessProcessView }>('session.launch', { name: 'lead-1', role: 'lead', item: epic.id, harness: 'claude-code' });
  const lead = await spawnSpoke({ cwd: root, discover: true, name: 'lead-1', sessionId: launched.process.sessionId, assignRole: false });
  t.after(() => lead.close());
  const launching = lead.call<{ ok: boolean; code: string; reason: string }>('session.launch', { name: 'late-verifier', role: 'reviewer', item: item.id, harness: 'claude-code' });
  await eventually('fake verifier has spawned but its adapter has not returned', () => existsSync(marker) ? true : undefined, spawnWindowMs);
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
  await writeFile(proceed, 'go');
  const result = await launching;
  assert.equal(result.ok, false);
  assert.equal(result.code, 'forbidden');
  assert.match(result.reason, /Lead level.*subtree/);
  await eventually('refused verifier process is no longer alive', async () => !(await fake.sessions()).some(s => s.name === 'late-verifier') || undefined);
  const listed = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
  assert.equal(listed.processes.some(p => p.name === 'late-verifier' && p.status === 'running'), false);
  assert.equal((await coord.call<{ item: { claim: unknown } }>('task.view', { id: item.id })).item.claim, null);
});

test('lead-1 requests verifiers and merges its scheduled item through the ordinary gate; other levels refuse', async t => {
  const root = await tempProject(t);
  const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'commit.gpgsign', 'false');
  await writeFile(join(root, 'README.md'), 'project\n');
  await writeFile(join(root, 'feature.txt'), 'initial\n');
  await writeFile(join(root, '.gitattributes'), 'feature.txt merge=cland-test\n');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'Initial');
  assert.equal((await cland(root, 'init')).code, 0);
  const fake = await fakeClaude(t);
  const gateBin = join(root, '.cland/git-gate');
  await mkdir(gateBin);
  const gateKind = join(gateBin, 'kind');
  const gateCount = join(gateBin, 'count');
  const gateMarker = join(gateBin, 'waiting');
  const gateProceed = join(gateBin, 'proceed');
  await writeFile(join(gateBin, 'gate.mjs'), `#!/usr/bin/env node\nimport { spawnSync } from 'node:child_process';\nimport { existsSync, readFileSync, writeFileSync } from 'node:fs';\nimport { setTimeout } from 'node:timers/promises';\nconst args = process.argv.slice(2);\nconst result = spawnSync('/usr/bin/git', args, { env: process.env, encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'] });\nconst kind = existsSync(${JSON.stringify(gateKind)}) ? readFileSync(${JSON.stringify(gateKind)}, 'utf8') : '';\nlet gate = kind === 'recovery' && args.includes('rev-parse') && args.some(a => a.endsWith('^'));\nif (kind === 'landing' && args.includes('write-tree')) {\n  const count = existsSync(${JSON.stringify(gateCount)}) ? Number(readFileSync(${JSON.stringify(gateCount)}, 'utf8')) : 0;\n  writeFileSync(${JSON.stringify(gateCount)}, String(count + 1));\n  gate = count === 1;\n}\nif (gate) {\n  writeFileSync(${JSON.stringify(gateMarker)}, 'ready');\n  const deadline = Date.now() + 20000;\n  while (!existsSync(${JSON.stringify(gateProceed)}) && Date.now() < deadline) await setTimeout(10);\n}\nprocess.stdout.write(result.stdout ?? '');\nprocess.stderr.write(result.stderr ?? '');\nprocess.exit(result.status ?? 1);\n`, { mode: 0o755 });
  // Ordinary Git commands stay native; only the two controlled await boundaries start a gate process.
  await writeFile(join(gateBin, 'git'), `#!/bin/sh\nfor arg in \"$@\"; do\n  case \"$arg\" in\n    write-tree|*^) exec \"${process.execPath}\" \"${join(gateBin, 'gate.mjs')}\" \"$@\" ;;\n  esac\ndone\nexec /usr/bin/git \"$@\"\n`, { mode: 0o755 });
  const { discovery } = await startDaemon(t, root, { ...fake.env, PATH: `${gateBin}:${fake.env.PATH}` });
  const ui = await connectUi(t, discovery);
  // The direct verdict writer and the launched verifier each occupy a Reviewer slot.
  assert.equal((await ui.request({ type: 'crew.set', key: 'reviewer.size', value: 2 })).ok, true);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator' });
  const rev = await spawnSpoke({ cwd: root, discover: true, name: 'rev', role: 'reviewer' });
  t.after(async () => { await coord.close(); await rev.close(); });
  const create = async (title: string, kind = 'task', parent?: string) => (await coord.call<{ item: { id: string } }>('task.create', { title, kind, parent })).item.id;
  const release = await create('Release', 'release');
  const epic = await create('Own epic', 'epic', release);
  const other = await create('Other epic', 'epic', release);
  const own = await create('Own task', 'task', epic);
  const foreign = await create('Other task', 'task', other);
  const launched = await coord.call<{ process: HarnessProcessView }>('session.launch', { name: 'lead-1', role: 'lead', item: epic, harness: 'claude-code' });
  const lead = await spawnSpoke({ cwd: root, discover: true, name: 'lead-1', sessionId: launched.process.sessionId, assignRole: false });
  t.after(() => lead.close());
  const stop = (name: string) => clandWithEnv(root, { CLAND_SESSION_NAME: 'lead-1', CLAND_SESSION_ID: launched.process.sessionId }, 'session', 'stop', name);
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
  await writeFile(join(root, 'feature.txt'), 'dev version\n');
  git(root, 'add', 'feature.txt');
  git(root, 'commit', '-qm', 'Dev changes the same file');
  assert.equal((await cland(root, 'push')).code, 0);
  const marker = join(root, '.cland/merge-running');
  const proceed = join(root, '.cland/merge-proceed');
  const driver = join(root, '.cland/merge-driver.mjs');
  await writeFile(driver, `import { existsSync, writeFileSync } from 'node:fs';\nimport { setTimeout } from 'node:timers/promises';\nwriteFileSync(${JSON.stringify(marker)}, 'ready');\nconst deadline = Date.now() + 20000;\nwhile (!existsSync(${JSON.stringify(proceed)}) && Date.now() < deadline) await setTimeout(10);\nwriteFileSync(process.argv[2], 'shipped\\n');\n`);
  git(root, 'config', 'merge.cland-test.driver', `"${process.execPath}" "${driver}" %A`);
  assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id: own, verdict: 'review', result: 'clear', run: 'lead-demo' })).ok, true);
  const refs = git(root, 'show-ref');
  let preparationResult: unknown;
  const preparing = lead.call<{ ok: boolean; code: string; reason: string }>('merge', { item: own }).then(result => { preparationResult = result; return result; });
  await eventually('real merge preparation is waiting', () => {
    if (preparationResult) throw new Error(`Merge returned before the driver: ${JSON.stringify(preparationResult)}`);
    return existsSync(marker) ? true : undefined;
  }, 30_000);
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: own, parent: other })).ok, true);
  await writeFile(proceed, 'go');
  const moved = await preparing;
  assert.equal(moved.ok, false);
  assert.equal(moved.code, 'forbidden');
  assert.match(moved.reason, /Lead level.*subtree/);
  assert.equal(git(root, 'show-ref'), refs);
  assert.equal(await readFile(join(root, 'feature.txt'), 'utf8'), 'dev version\n');
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: own, parent: epic })).ok, true);
  await writeFile(gateKind, 'landing');
  let landingResult: unknown;
  const landing = lead.call<{ ok: boolean; code: string; reason: string }>('merge', { item: own }).then(result => { landingResult = result; return result; });
  await eventually('Git has updated the index but admission precedes the ref move', () => {
    if (landingResult) throw new Error(`Merge returned before landing gate: ${JSON.stringify(landingResult)}`);
    return existsSync(gateMarker) ? true : undefined;
  }, 30_000);
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: own, parent: other })).ok, true);
  await writeFile(gateProceed, 'go');
  const late = await landing;
  assert.equal(late.ok, false);
  assert.equal(late.code, 'forbidden');
  assert.match(late.reason, /Lead level.*subtree/);
  assert.equal(git(root, 'show-ref'), refs);
  assert.equal(await readFile(join(root, 'feature.txt'), 'utf8'), 'dev version\n');
  await writeFile(gateKind, '');
  await rm(gateMarker);
  await rm(gateProceed);
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: own, parent: epic })).ok, true);
  const obstruction = join(root, '.cland/tasks', `.${own}-own-task.md.${discovery.pid}.tmp`);
  await mkdir(obstruction);
  const merged = await lead.call<{ ok: boolean; error?: string; commit: string; followUp?: { step: string; error: string } }>('merge', { item: own });
  assert.equal(merged.ok, true, merged.error);
  assert.equal(merged.followUp?.step, 'close');
  assert.equal(git(root, 'rev-parse', 'dev'), merged.commit);
  assert.equal(await readFile(join(root, 'feature.txt'), 'utf8'), 'shipped\n');
  await rm(obstruction, { recursive: true });
  await writeFile(gateKind, 'recovery');
  const recovering = lead.call<{ ok: boolean; commit: string; followUp?: { error: string } }>('merge', { item: own });
  await eventually('recovery is awaiting a real Git probe', () => existsSync(gateMarker) ? true : undefined, 30_000);
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: own, parent: other })).ok, true);
  await writeFile(gateProceed, 'go');
  const recovery = await recovering;
  assert.equal(recovery.commit, merged.commit);
  assert.match(recovery.followUp?.error ?? '', /Lead level.*subtree/);
  assert.equal((await coord.call<{ item: { state: string } }>('task.view', { id: own })).item.state, 'open');
  assert.equal(git(root, 'rev-parse', 'dev'), merged.commit);
  await writeFile(gateKind, '');
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


for (const boundary of ['version', 'thread-start']) {
  test(`Codex refuses lost Lead authority during ${boundary} before admitting native work`, async t => {
    const root = await tempProject(t);
    const claude = await fakeClaude(t);
    const codex = await fakeCodex(t);
    const { discovery } = await startDaemon(t, root, { ...claude.env, ...codex.env, PATH: `${codex.env.PATH!.split(':')[0]}:${claude.env.PATH}` });
    const ui = await connectUi(t, discovery);
    const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator' });
    t.after(() => coord.close());
    const create = async (title: string, kind = 'task', parent?: string) => (await coord.call<{ item: { id: string } }>('task.create', { title, kind, parent })).item.id;
    const epic = await create('Own epic', 'epic');
    const other = await create('Other epic', 'epic');
    const item = await create('Native work', 'task', epic);
    const launched = await coord.call<{ process: HarnessProcessView }>('session.launch', { name: 'lead-1', role: 'lead', item: epic, harness: 'claude-code' });
    const lead = await spawnSpoke({ cwd: root, discover: true, name: 'lead-1', sessionId: launched.process.sessionId, assignRole: false });
    t.after(() => lead.close());
    await writeFile(join(codex.home, `hold-${boundary}`), 'hold');
    const launching = lead.call<{ ok: boolean; code: string; reason: string }>('session.launch', { name: 'native-verifier', role: 'reviewer', item, harness: 'codex', brief: 'Review the native launch permission boundary.' });
    await eventually('Codex preparation is awaiting the harness boundary', () => existsSync(join(codex.home, `${boundary}-running`)) ? true : undefined);
    if (boundary === 'version') {
      assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: item, parent: other })).ok, true);
    } else {
      assert.equal((await ui.request({ type: 'task.claim', item: epic, release: true, force: true })).ok, true);
    }
    await writeFile(join(codex.home, `release-${boundary}`), 'go');
    const result = await launching;
    assert.equal(result.ok, false);
    assert.equal(result.code, 'forbidden');
    assert.match(result.reason, /Lead level.*(?:subtree|no live container claim)/);
    const logs = await readdir(join(codex.home, 'log'));
    if (boundary === 'version') assert.deepEqual(logs, [], 'no app-server is created after scope loss during version preparation');
    for (const log of logs) assert.doesNotMatch(await readFile(join(codex.home, 'log', log), 'utf8'), /turn\/start/, 'the role clause and brief never start a native turn after revocation');
    assert.deepEqual(await codex.servers(), [], 'refused launch leaves no live app-server');
    assert.equal((await coord.call<{ item: { claim: unknown } }>('task.view', { id: item })).item.claim, null);
  });
}
