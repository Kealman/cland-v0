import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cland, connectUi, eventually, fakeClaude, fakeCodex, killDaemon, pidAlive, spawnSpoke, startDaemon, tempProject } from './harness.ts';
import { copyPreparedProject } from './prepared-project.ts';
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
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
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

test('Codex native first turn carries the current crew rule for an Implementer pool', async t => {
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
  const { process } = launched.value as { process: HarnessProcessView };
  const inputs = await eventually('native input recorded', async () => {
    const text = await readFile(join(fake.home, 'log', `${process.pid}.inputs.jsonl`), 'utf8').catch(() => '');
    return text.includes('Sub-agent delegation is disabled') ? text : undefined;
  });
  const first = JSON.parse(inputs.split('\n')[0]!) as { text: string };
  assert.match(first.text, /you hold the role Implementer/);
  assert.match(first.text, /Sub-agent delegation is disabled/);
});

async function pooledHarness(t: TestContext, harness: string) {
  if (harness === 'claude-code') {
    const fake = await fakeClaude(t);
    return { env: fake.env, home: fake.home, log: (p: HarnessProcessView) => fake.log(p.harnessId!), live: fake.sessions };
  }
  if (harness === 'codex') {
    const fake = await fakeCodex(t);
    return { env: fake.env, home: fake.home, log: (p: HarnessProcessView) => fake.log(p.pid!), live: fake.servers };
  }
  const home = await tempProject(t, 'fake-pooled-opencode-');
  const live = async () => {
    const files = await readdir(join(home, 'servers')).catch(() => []);
    const rows = await Promise.all(files.map(async f => JSON.parse(await readFile(join(home, 'servers', f), 'utf8')) as { pid: number; cwd: string }));
    return rows.filter(row => pidAlive(row.pid));
  };
  t.after(async () => { for (const row of await live()) await killDaemon(row.pid); });
  return {
    home, live,
    env: { PATH: `${fileURLToPath(new URL('./fakes/opencode', import.meta.url))}:${process.env.PATH ?? ''}`, FAKE_OPENCODE_HOME: home, CLAND_ADAPTER_POLL_MS: '200' },
    log: (p: HarnessProcessView) => readFile(join(home, 'prompts', `${p.harnessSessionId}.log`), 'utf8').catch(() => ''),
  };
}

for (const harness of ['claude-code', 'codex', 'opencode']) for (const keepContext of [true, false])
test(`an Implementer pool moves to the next task worktree after merge (${harness}, keep_context=${keepContext})`, async t => {
  const root = await tempProject(t);
  const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  await copyPreparedProject(root);
  const fake = await pooledHarness(t, harness);
  const { discovery } = await startDaemon(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  for (const [key, value] of [['implementer.policy', 'pool'], ['implementer.keep_context', keepContext]] as const)
    assert.equal((await ui.request({ type: 'crew.set', key, value })).ok, true);
  const create = async (title: string) => ((await ui.request({ type: 'task.create', title })).value as { item: { id: string } }).item.id;
  const first = await create('First pooled item');
  const second = await create('Second pooled item');
  type Launch = { process: HarnessProcessView; claim: { sessionId: string; session: string }; worktree: { path: string; branch: string } };
  const launched = await ui.request({ type: 'session.launch', name: 'pooled-impl', role: 'implementer', harness, item: first });
  assert.equal(launched.ok, true, launched.error);
  const one = launched.value as Launch;
  const held = await ui.request({ type: 'session.launch', name: 'too-early', role: 'implementer', harness, item: second });
  assert.equal(held.ok, false, 'a current claim prevents reuse');
  assert.match(held.error!, /pool size 1/);
  await writeFile(join(one.worktree.path, 'shipped.txt'), 'first item\n');
  git(one.worktree.path, 'add', 'shipped.txt'); git(one.worktree.path, 'commit', '-qm', 'Ship first');
  const merged = await ui.request({ type: 'merge', item: first, override: 'Exercise pooled handoff' }, 30_000);
  assert.equal(merged.ok, true, merged.error);
  await eventually('pool member idle after merge', async () => {
    const rows = ((await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] }).processes;
    return rows.find(p => p.name === one.process.name)?.state === 'idle' && (harness !== 'claude-code' || (await fake.log(one.process)).includes('hooks Stop done')) ? true : undefined;
  });
  assert.equal(git(one.worktree.path, 'status', '--porcelain'), '');
  const invalid = await ui.request({ type: 'session.launch', name: 'invalid-brief', role: 'implementer', harness, item: second, brief: 'A-999999' });
  assert.equal(invalid.ok, false);
  assert.match(invalid.error!, /unknown or unavailable brief/);
  assert.equal((await fake.live()).find(p => p.pid === one.process.pid)?.cwd, one.worktree.path, 'invalid brief leaves the original harness running');
  const brief = `Implement ${second} in its task worktree. Second item brief.`;
  let briefSource = brief;
  if (!keepContext) {
    const made = await ui.request({ type: 'artifact.create', kind: 'prompt', title: 'Next item brief', topic: 'general', content: brief, status: 'draft' });
    assert.equal(made.ok, true, made.error);
    briefSource = (made.value as { artifact: { id: string } }).artifact.id;
  }
  const delayed = harness === 'codex' && keepContext;
  if (delayed) await writeFile(join(fake.home, 'hold-thread-resume'), 'hold');
  const pending = ui.request({ type: 'session.launch', name: 'requested-next', role: 'implementer', harness, item: second, brief: briefSource }, 30_000);
  if (delayed) {
    try {
      await eventually('native resume is pending', async () => existsSync(join(fake.home, 'thread-resume-running')) ? true : undefined);
      for (const type of ['session.stop', 'session.resume']) {
        const overlapping = await ui.request({ type, session: one.process.name, relaunch: true });
        assert.equal(overlapping.ok, false);
        assert.match(overlapping.error!, /reserved for a pool handoff/);
      }
      const capped = await ui.request({ type: 'session.launch', name: 'overlap', role: 'implementer', harness });
      assert.equal(capped.ok, false);
      assert.match(capped.error!, /pool size 1/);
    } finally { await writeFile(join(fake.home, 'release-thread-resume'), 'release'); }
  }
  const handoff = await pending;
  assert.equal(handoff.ok, true, handoff.error);
  const two = handoff.value as Launch;
  assert.equal(two.process.name, one.process.name);
  assert.notEqual(two.process.sessionId, one.process.sessionId, 'new launch owns a fresh cland identity');
  if (keepContext) assert.equal(two.process.harnessSessionId, one.process.harnessSessionId, 'native context survives');
  else assert.notEqual(two.process.harnessSessionId, one.process.harnessSessionId, 'native context is reset');
  assert.notEqual(two.process.pid, one.process.pid);
  assert.equal(two.process.cwd, two.worktree.path);
  assert.notEqual(two.worktree.path, one.worktree.path);
  assert.equal(two.process.item, second);
  assert.equal(two.claim.sessionId, two.process.sessionId);
  assert.equal(two.claim.session, two.process.name);
  assert.equal(git(two.worktree.path, 'branch', '--show-current'), two.worktree.branch);
  await eventually('clean merged worktree is released by the handoff', () => !existsSync(one.worktree.path) ? true : undefined);
  await eventually('second brief reaches moved harness', async () => (await fake.log(two.process)).includes(brief) ? true : undefined);
  const native = (await fake.live()).find(p => p.pid === two.process.pid);
  assert.equal(native?.cwd, two.worktree.path);
  assert.equal((await fake.live()).length, 1, 'pool cap is preserved');
  if (harness === 'opencode') {
    const session = JSON.parse(await readFile(join(fake.home, 'sessions', `${two.process.harnessSessionId}.json`), 'utf8')) as { directory: string };
    assert.equal(session.directory, two.worktree.path, 'stored native location moves before brief delivery');
  }
  if (harness === 'codex') {
    await eventually('second native turn finishes', async () => {
      const rows = ((await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] }).processes;
      return rows.find(p => p.sessionId === two.process.sessionId)?.state === 'idle' ? true : undefined;
    });
    const thread = JSON.parse(await readFile(join(fake.home, 'threads', `${two.process.harnessSessionId}.json`), 'utf8')) as { cwd: string; turns: number };
    assert.equal(thread.cwd, two.worktree.path);
    assert.equal(thread.turns > 1, keepContext, 'resumed history survives the native handoff');
  }
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
  await copyPreparedProject(root);
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
