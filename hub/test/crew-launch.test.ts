import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, eventually, fakeClaude, fakeCodex, spawnSpoke, startDaemon, tempProject } from './harness.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

test('retained Reviewer pool reuses an idle member for review, caps busy and pending launches, and releases failed admissions', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t, { turnMs: 1000 });
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ cwd: root, discover: true, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  assert.equal((await ui.request({ type: 'crew.set', key: 'reviewer.size', value: 2 })).ok, true);
  const create = async () => (await coord.call<{ item: { id: string } }>('task.create', { title: 'Review build' })).item.id;
  const firstItem = await create();
  const secondItem = await create();
  const launch = (name: string, item?: string, brief?: string) => coord.call<{ ok: boolean; error?: string; process: HarnessProcessView }>('session.launch', { name, role: 'reviewer', harness: 'claude-code', ...(item ? { item } : {}), ...(brief ? { brief } : {}) });
  // Failed admission leaves capacity available for the next two launches.
  const invalid = await coord.call<{ ok: boolean }>('session.launch', { name: 'bad', role: 'reviewer', harness: 'claude-code', cwd: 'missing' });
  assert.equal(invalid.ok, false);
  const [one, two] = await Promise.all([launch('rev-one', firstItem), launch('rev-two')]);
  assert.equal(one.ok, true, one.error);
  assert.equal(two.ok, true, two.error);
  const third = await launch('rev-three');
  assert.equal(third.ok, false);
  assert.match(third.error!, /crew.reviewer.*pool size 2/);
  const processes = async () => (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
  await eventually('reviewer idle with its first clause delivered', async () => {
    const row = (await processes()).processes.find(p => p.name === 'rev-one');
    return row?.state === 'idle' && (await fake.log(one.process.harnessId!)).includes('hooks Stop done') ? true : undefined;
  });
  // A verifier hold reserves the other reviewer even between native turns.
  assert.equal((await ui.request({ type: 'task.hold', item: firstItem, as: { name: 'rev-two' } })).ok, true);
  const brief = `review request ${secondItem}\nReview the committed build.`;
  const reused = await launch('rev-new-name', secondItem, brief);
  assert.equal(reused.ok, true, reused.error);
  assert.equal(reused.process.name, 'rev-one');
  assert.equal(reused.process.sessionId, one.process.sessionId);
  assert.equal(reused.process.harnessId, one.process.harnessId);
  assert.equal(reused.process.cwd, root);
  assert.equal(reused.process.item, secondItem);
  assert.equal((await fake.sessions()).length, 2);
  await eventually('review brief reaches retained harness', async () => (await fake.log(one.process.harnessId!)).includes(brief) ? true : undefined);
  const journal = await readFile(join(root, '.cland/journal.jsonl'), 'utf8');
  assert.match(journal, /"event":"session-reused"/);
  await eventually('retained reviewer finishes its review turn', async () => (await processes()).processes.find(p => p.name === 'rev-one')?.state === 'idle' ? true : undefined);
  const handoff = await launch('next-handoff', firstItem);
  assert.equal(handoff.ok, true, handoff.error);
  assert.equal(handoff.process.name, 'rev-one');
  const overlap = await launch('overlapping-handoff', secondItem);
  assert.equal(overlap.ok, false, 'an unbriefed handoff remains reserved for its requester');
  assert.equal((await coord.call<{ ok: boolean }>('send', { to: ['rev-one'], text: `review request ${firstItem}\nContinue on this build.` })).ok, true);
  // A keep_context=false pool never hands out its idle members.
  assert.equal((await ui.request({ type: 'crew.set', key: 'reviewer.keep_context', value: false })).ok, true);
  const refused = await launch('rev-four', firstItem);
  assert.equal(refused.ok, false);
  assert.match(refused.error!, /size 2/);
});

test('Codex native first turn carries the current crew rule and an Implementer pool explains its worktree boundary', async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'crew.set', key: 'implementer.policy', value: 'pool' })).ok, true);
  assert.equal((await ui.request({ type: 'crew.set', key: 'implementer.keep_context', value: true })).ok, true);
  const made = await ui.request({ type: 'task.create', title: 'Native pool boundary' });
  const item = (made.value as { item: { id: string } }).item.id;
  const launched = await ui.request({ type: 'session.launch', name: 'native-impl', role: 'implementer', harness: 'codex', item });
  assert.equal(launched.ok, true, launched.error);
  const { process, note } = launched.value as { process: HarnessProcessView; note: string };
  assert.match(note, /fresh session.*native harness cwd/);
  const inputs = await eventually('native input recorded', async () => {
    const text = await readFile(join(fake.home, 'log', `${process.pid}.inputs.jsonl`), 'utf8').catch(() => '');
    return text.includes('Sub-agent delegation is disabled') ? text : undefined;
  });
  const first = JSON.parse(inputs.split('\n')[0]!) as { text: string };
  assert.match(first.text, /you hold the role Implementer/);
  assert.match(first.text, /Sub-agent delegation is disabled/);
});

test('singleton and per-item caps survive concurrent launch requests; crew clauses reload on live sessions', async t => {
  const root = await tempProject(t);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const launch = (name: string, role: string) => ui.request({ type: 'session.launch', name, role, harness: 'claude-code' });
  for (const role of ['qa', 'implementer']) {
    if (role === 'implementer') assert.equal((await ui.request({ type: 'crew.set', key: 'implementer.size', value: 1 })).ok, true);
    const results = await Promise.all([launch(`${role}-one`, role), launch(`${role}-two`, role)]);
    assert.equal(results.filter(r => r.ok).length, 1, JSON.stringify(results));
    assert.match(results.find(r => !r.ok)!.error!, /size 1/);
  }
  const coordinator = await launch('coord-native', 'coordinator');
  assert.equal(coordinator.ok, true, coordinator.error);
  const process = (coordinator.value as { process: HarnessProcessView }).process;
  await eventually('default staffing clause', async () => (await fake.log(process.harnessId!)).includes('leads = []') ? true : undefined);
  assert.equal((await ui.request({ type: 'crew.set', key: 'leads', value: ['epic'] })).ok, true);
  await eventually('new lead levels delivered', async () => (await fake.log(process.harnessId!)).includes('Launch Leads for these container levels: epic') ? true : undefined);
  assert.equal((await ui.request({ type: 'crew.set', key: 'coordinator.subagents', value: false })).ok, true);
  await eventually('delegation disabled live', async () => (await fake.log(process.harnessId!)).includes('Sub-agent delegation is disabled') ? true : undefined);
});

test('merge stops per-item implementers before cleanup, while stop_after never and pools remain running', async t => {
  const root = await tempProject(t);
  const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'commit.gpgsign', 'false');
  await writeFile(join(root, 'README.md'), 'project\n');
  git(root, 'add', '.'); git(root, 'commit', '-qm', 'Initial');
  assert.equal((await cland(root, 'init')).code, 0);
  const fake = await fakeClaude(t);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const list = async () => ((await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] }).processes;
  for (const stopAfter of ['merge', 'never']) {
    assert.equal((await ui.request({ type: 'crew.set', key: 'implementer.stop_after', value: stopAfter })).ok, true);
    const created = await ui.request({ type: 'task.create', title: `Merge ${stopAfter}` });
    const item = (created.value as { item: { id: string } }).item;
    const launched = await ui.request({ type: 'session.launch', name: `impl-${stopAfter}`, role: 'implementer', harness: 'claude-code', item: item.id });
    assert.equal(launched.ok, true, launched.error);
    const { process, worktree } = launched.value as { process: HarnessProcessView; worktree: { path: string; branch: string } };
    await writeFile(join(worktree.path, `${stopAfter}.txt`), 'shipped\n');
    git(worktree.path, 'add', '.'); git(worktree.path, 'commit', '-qm', 'Ship');
    const merged = await ui.request({ type: 'merge', item: item.id, override: 'Exercise staffing lifecycle' }, 30_000);
    assert.equal(merged.ok, true, merged.error);
    assert.equal((merged.value as { followUp?: unknown }).followUp, undefined, JSON.stringify(merged));
    assert.equal((await list()).find(p => p.sessionId === process.sessionId)!.status, stopAfter === 'merge' ? 'stopped' : 'running');
    const view = await ui.request({ type: 'task.view', item: item.id });
    assert.equal((view.value as { item: { status: string } }).item.status, 'done');
  }
});
