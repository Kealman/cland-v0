// T3: real harness stop/relaunch and native cwd/thread/history migration during pool handoff;
// child hooks/native events including a Codex child before launch admission; usage re-publication
// after a hub-process restart, including held-progress recovery. Retained in T3 pending T-707/T-708 (T-695 Coordinator decision).
import { completeJournalLines } from './journal-lines.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nativeProjectHub as projectHub, spawnSpoke, clandWithEnv, withDiscoveredPid, cland, connectUi, eventually, fakeClaude, fakeCodex, killDaemon, pidAlive, startDaemon, tempProject, type FrameClient } from './harness.ts';
import { copyPreparedProject } from './prepared-project.ts';
import type { HarnessProcessView, SessionUsage } from '../src/protocol.ts';
const CODEX_LAUNCH_MS = 30_000;
// Shorten the existing publication window without changing usage/journal behavior.
function startUsageDaemon(t: TestContext, root: string, env: Record<string, string>, usageEventMs = 100, serve: typeof projectHub | typeof startDaemon = projectHub) {
  return serve(t, root, { ...env, CLAND_TEST_USAGE_EVENT_MS: String(usageEventMs) });
}

async function records(root: string, ui: FrameClient): Promise<Array<Record<string, unknown>>> {
  assert.equal((await ui.request({ type: 'hub.status', history: true, flushLogs: true })).ok, true);
  return completeJournalLines(await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).filter(Boolean).map(line => JSON.parse(line)).filter(r => ['session-launched', 'session-model', 'subagent-launched', 'session-usage'].includes(r.event));
}
async function usageRecords(root: string, ui: FrameClient) { return (await records(root, ui)).filter(r => r.event === 'session-usage'); }
async function pooledHarness(t: TestContext, harness: string) {
  if (harness === 'claude-code') {
    const fake = await fakeClaude(t);
    return { env: fake.env, home: fake.home, log: (p: HarnessProcessView) => fake.log(p.harnessId!), live: fake.sessions };
  }
  if (harness === 'codex') {
    const fake = await fakeCodex(t, { env: { FAKE_CODEX_SUBAGENT_AT_LAUNCH: '1' } });
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
    env: { PATH: `${fileURLToPath(new URL('./fakes/opencode', import.meta.url))}:${process.env.PATH ?? ''}`, FAKE_OPENCODE_HOME: home, FAKE_OPENCODE_TURN_MS: '30', CLAND_ADAPTER_POLL_MS: '50' },
    log: (p: HarnessProcessView) => readFile(join(home, 'prompts', `${p.harnessSessionId}.log`), 'utf8').catch(() => ''),
  };
}

for (const harness of ['claude-code', 'codex', 'opencode']) for (const keepContext of [true, false])
test(`an Implementer pool moves to the next task worktree after merge (${harness}, keep_context=${keepContext})`, async t => {
  const root = await tempProject(t);
  const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { env: fixtureEnvironment(cwd, process.env), cwd, encoding: 'utf8' }).trim();
  await copyPreparedProject(root);
  const fake = await pooledHarness(t, harness);
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  for (const [key, value] of [['implementer.policy', 'pool'], ['implementer.keep_context', keepContext]] as const)
    assert.equal((await ui.request({ type: 'crew.set', key, value })).ok, true);
  const create = async (title: string) => ((await ui.request({ size: 'M', type: 'task.create', title })).value as { item: { id: string } }).item.id;
  const first = await create('First pooled item');
  const second = await create('Second pooled item');
  type Launch = { process: HarnessProcessView; claim: { sessionId: string; session: string }; worktree: { path: string; branch: string } };
  const launched = await ui.request({ type: 'session.launch', name: 'pooled-impl', role: 'implementer', harness, item: first, brief: keepContext ? 'spawn subagents' : undefined });
  assert.equal(launched.ok, true, launched.error);
  const one = launched.value as Launch;
  const launchModel = one.process.model;
  one.process = await withDiscoveredPid(ui, one.process);
  if (keepContext) {
    const journal = await eventually('native child parsing receipts', async () => {
      const rows = await records(root, ui);
      return rows.filter(r => r.event === 'subagent-launched' && r.sessionId === one.process.sessionId && r.agentId !== 'early-child').length === 2
        && (harness !== 'claude-code' || rows.some(r => r.event === 'session-model')) ? rows : undefined;
    });
    const children = journal.filter(r => r.event === 'subagent-launched' && r.sessionId === one.process.sessionId);
    assert.deepEqual(children.filter(r => r.agentId !== 'early-child').sort((a, b) => String(a.agentId).localeCompare(String(b.agentId))).map(r => [r.session, r.sessionId, r.harness, r.role, r.item, r.agentId, r.model]), [
      ['pooled-impl', one.process.sessionId, harness, 'implementer', first, 'known-child', harness === 'claude-code' ? 'claude-child-1' : harness === 'codex' ? 'gpt-child-1' : 'opencode/child-1'],
      ['pooled-impl', one.process.sessionId, harness, 'implementer', first, 'unknown-child', 'unreported'],
    ]);
    if (harness === 'claude-code') assert.deepEqual(children.map(r => r.agentType), ['Explore', 'Explore']);
    const model = harness === 'claude-code' ? 'claude-fake-1' : harness === 'codex' ? 'gpt-fake-1' : 'opencode/fake-free';
    assert.equal(launchModel, harness === 'claude-code' ? null : model);
    assert.equal(journal.find(r => r.event === 'session-launched')?.model, harness === 'claude-code' ? null : model);
    if (harness !== 'claude-code') assert.deepEqual(children.filter(r => r.agentId !== 'early-child').map(r => r.agentId), ['known-child', 'unknown-child']);
    assert.deepEqual(journal.filter(r => r.event === 'session-model').map(r => r.model), harness === 'claude-code' ? [model] : []);
    if (harness === 'codex') {
      const inputs = await readFile(join(fake.home, 'log', `${one.process.pid}.inputs.jsonl`), 'utf8');
      const firstInput = JSON.parse(inputs.split('\n')[0]!) as { text: string };
      assert.match(firstInput.text, /you hold the role Implementer/);
      assert.match(firstInput.text, /Sub-agent delegation is disabled/);
      assert.deepEqual(journal.filter(r => r.event !== 'session-usage').slice(0, 2).map(r => [r.event, r.model]), [['session-launched', model], ['subagent-launched', 'gpt-early-child']]);
      await eventually('native child turn completed before legacy input', async () => {
        const list = await ui.request({ type: 'session.list' });
        return (list.value as { processes: HarnessProcessView[] }).processes.find(p => p.sessionId === one.process.sessionId)?.state === 'idle' || undefined;
      });
      // The claimed item queued a task event. Flush that digest in its own turn so
      // the fake's legacy parser observes the requested native message, not its first digest member.
      const flushMark = ui.frames.length;
      assert.equal((await ui.request({ type: 'topic.send', topic: 'general', to: ['pooled-impl'], text: '@pooled-impl flush startup events' })).ok, true);
      await ui.waitFor(f => ui.frames.indexOf(f) >= flushMark && f.type === 'session.state' && f.sessionId === one.process.sessionId && f.state === 'idle');
      assert.equal((await ui.request({ type: 'topic.send', topic: 'general', to: ['pooled-impl'], text: '@pooled-impl spawn legacy subagent' })).ok, true);
      const legacy = await eventually('legacy child parsed', async () => (await records(root, ui)).find(r => r.agentId === 'legacy-child'));
      assert.equal(legacy.model, 'gpt-legacy-1');
      assert.equal((await records(root, ui)).filter(r => r.agentId === 'legacy-child').length, 1);
    }
    if (harness === 'claude-code') {
      const viewed = await cland(root, 'task', 'view', first, '--json');
      assert.equal(viewed.code, 0, viewed.stderr);
      const usage = JSON.parse(viewed.stdout).item.usage;
      assert.deepEqual(usage.subagents.sort((a: Record<string, unknown>, b: Record<string, unknown>) => String(a.agentId).localeCompare(String(b.agentId))).map((r: Record<string, unknown>) => [r.session, r.sessionId, r.harness, r.agentId, r.model]), [
        ['pooled-impl', one.process.sessionId, harness, 'known-child', 'claude-child-1'],
        ['pooled-impl', one.process.sessionId, harness, 'unknown-child', 'unreported'],
      ]);
      const human = await cland(root, 'task', 'view', first);
      assert.equal(human.code, 0, human.stderr);
      assert.match(human.stdout, /usage:[\s\S]*sub-agent known-child.*claude-child-1/);
      assert.match(human.stdout, /sub-agent unknown-child.*unreported/);
      const unrelated = await ui.request({ type: 'task.view', item: second });
      assert.deepEqual((unrelated.value as { item: { usage: { subagents: unknown[] } } }).item.usage.subagents, []);
    }
  }
  const held = await ui.request({ type: 'session.launch', name: 'too-early', role: 'implementer', harness, item: second });
  assert.equal(held.ok, false, 'a current claim prevents reuse');
  assert.match(held.error!, /pool size 1/);
  await writeFile(join(one.worktree.path, 'README.md'), 'first item\n');
  git(one.worktree.path, 'add', 'README.md'); git(one.worktree.path, 'commit', '-qm', 'Ship first');
  const merged = await ui.request({ type: 'merge', item: first, override: 'Exercise pooled handoff' }, 30_000);
  assert.equal(merged.ok, true, merged.error);
  // OpenCode can report idle before its spoke connects and installs the role clause.
  // The durable instruction entry distinguishes that startup snapshot from a reusable member.
  const roleInstruction = async () => {
    try {
      const session = JSON.parse(await readFile(join(fake.home, 'sessions', `${one.process.harnessSessionId}.json`), 'utf8')) as { instructions?: Record<string, string> };
      return session.instructions?.['cland-role'];
    } catch { return undefined; }
  };
  await eventually('pool member installed its role and released its claim after merge', async () => {
    const rows = ((await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] }).processes;
    const row = rows.find(p => p.sessionId === one.process.sessionId);
    const roleReady = harness !== 'opencode' || (await roleInstruction())?.includes('you hold the role Implementer');
    return row?.state === 'idle' && row.holds?.length === 0 && roleReady
      && (harness !== 'claude-code' || (await fake.log(one.process)).includes('hooks Stop done')) ? true : undefined;
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
  two.process = await withDiscoveredPid(ui, two.process);
  assert.equal(two.process.name, one.process.name);
  assert.notEqual(two.process.sessionId, one.process.sessionId, 'new launch owns a fresh cland identity');
  if (keepContext) assert.equal(two.process.harnessSessionId, one.process.harnessSessionId, 'native context survives');
  else assert.notEqual(two.process.harnessSessionId, one.process.harnessSessionId, 'native context is reset');
  assert.notEqual(two.process.pid, one.process.pid);
  assert.equal(two.process.cwd, two.worktree.path);
  assert.notEqual(two.process.cwd, root, 'the native Git handoff owns a task worktree');
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

test('the first publication after hub restart is recorded again without replaying history', async t => {
  const root = await tempProject(t);
  const fake = await fakeCodex(t);
  // Publish tokens first, then release limits across an observed coalescing boundary.
  await writeFile(join(fake.home, 'hold-rate-limits-read'), '');
  const { discovery } = await startUsageDaemon(t, root, fake.env, undefined, startDaemon);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', name: 'restart', harness: 'codex' }, CODEX_LAUNCH_MS);
  assert.equal(launched.ok, true, launched.error);
  const p = (launched.value as { process: HarnessProcessView }).process;
  const initial = await ui.waitFor(f => f.type === 'session.usage' && f.sessionId === p.sessionId && (f.usage as SessionUsage).total?.totalTokens === 12);
  const initialUsage = initial.usage as SessionUsage;
  assert.equal(initialUsage.rateLimits, undefined);
  const first = await usageRecords(root, ui);
  assert.equal(first.length, 1);
  assert.deepEqual(first[0]!.total, initialUsage.total);
  await writeFile(join(fake.home, 'release-rate-limits-read'), '');
  const published = await ui.waitFor(f => f.type === 'session.usage' && f.sessionId === p.sessionId && !!(f.usage as SessionUsage).rateLimits);
  const publishedUsage = published.usage as SessionUsage;
  assert.deepEqual(publishedUsage.total, initialUsage.total);
  const before = await usageRecords(root, ui);
  assert.deepEqual(before.map(r => [r.total, r.rateLimits, r.final]), [
    [initialUsage.total, undefined, false], [initialUsage.total, publishedUsage.rateLimits, false],
  ]);
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  const next = await startUsageDaemon(t, root, fake.env, undefined, startDaemon);
  const nextUi = await connectUi(t, next.discovery);
  await nextUi.request({ type: 'subscribe' });
  await eventually('first restarted publication journalled', async () => (await usageRecords(root, nextUi)).length > before.length || undefined);
  const after = await usageRecords(root, nextUi);
  assert.equal(after.length, before.length + 1);
  assert.deepEqual(after.slice(0, before.length), before, 'restart preserves the previous journal without replay');
  assert.deepEqual(after.slice(before.length).map(r => [r.sessionId, r.total, r.rateLimits, r.final]), [
    [p.sessionId, undefined, publishedUsage.rateLimits, false],
  ]);
  const stopped = await cland(root, 'session', 'stop', p.name);
  assert.equal(stopped.code, 0, stopped.stderr);
  assert.equal((await usageRecords(root, nextUi)).filter(r => r.final).length, 1);
});


const read = (path: string) => readFile(path, 'utf8').catch(() => '');
type Process = { pid: number; sessionId: string; harnessId: string; harnessSessionId: string };
const idle = (ui: FrameClient) => eventually('coord idle', async () => {
  const r = await ui.request({ type: 'hub.status', history: true });
  return (r.value as { harnesses: Array<{ name: string; state: string }> }).harnesses.some(p => p.name === 'coord' && p.state === 'idle') ? true : undefined;
});
{ const harness = 'codex';
  test(`${harness}: three progress notes start no turn, one ordered digest reaches the next report, including across restart`, async (t) => {
    const root = await tempProject(t);
    const fake = await fakeCodex(t, { pollMs: 10_000 });
    const home = fake.home;
    const env = fake.env;
    const first = await startDaemon(t, root, env);
    let ui = await connectUi(t, first.discovery);
    await ui.request({ type: 'subscribe' });
    const launch = await ui.request({ type: 'session.launch', name: 'coord', role: 'coordinator', harness }, 30_000);
    assert.equal(launch.ok, true, launch.error);
    const p = await withDiscoveredPid(ui, (launch.value as { process: Process }).process);
    t.after(() => killDaemon(p.pid));
    const inputLog = () => read(join(home, 'log', `${p.pid}.log`));
    await idle(ui);
    const sender = await spawnSpoke({ cwd: root, discover: true, name: 'impl', sessionId: 'sender' });
    t.after(() => sender.close());
    await sender.waitForPresence(['impl', 'coord']);
    for (const restart of [false, true]) {
      const notes = [1, 2, 3].map(i => `${restart ? 'durable' : 'initial'} progress ${i}`);
      for (const text of notes) await sender.call('send', { to: ['coord'], text, kind: 'progress' });
      await sender.call('who'); // ordered receipt after the queued sends
      await ui.request({ type: 'hub.status', history: true, flushLogs: true });
      assert.equal((await inputLog()).includes(notes[0]!), false, 'no progress reaches the harness alone');
      if (restart) {
        ui.close();
        assert.equal((await clandWithEnv(root, env, 'hub', 'stop')).code, 0);
        const second = await startDaemon(t, root, env);
        ui = await connectUi(t, second.discovery);
        await ui.request({ type: 'subscribe' });
        await sender.waitForPresence(['impl', 'coord']);
        await eventually('session resumed', async () => (await read(join(root, '.cland', 'log', 'hub.log'))).includes('"event":"session-resumed","session":"coord"') ? true : undefined);
        await idle(ui);
        await sender.call('who'); // ordered receipt after the queued sends
      await ui.request({ type: 'hub.status', history: true, flushLogs: true });
        assert.equal((await inputLog()).includes(notes[0]!), false, 'reconnect and role clauses leave progress held');
      }
      const report = `${restart ? 'durable' : 'initial'} report finished`;
      await sender.call('send', { to: ['coord'], text: report, kind: 'report' });
      const batch = await eventually('digest admitted by the harness', async () => {
        const log = await inputLog();
        const at = log.indexOf(`Progress digest (3 notes, oldest first):\n`);
        const start = restart ? log.indexOf(`Progress digest (3 notes, oldest first):\n`, at + 1) : at;
        return start >= 0 && log.slice(start).includes(report) ? log.slice(start) : undefined;
      });
      assert.ok(batch.indexOf(notes[0]!) < batch.indexOf(notes[1]!) && batch.indexOf(notes[1]!) < batch.indexOf(notes[2]!) && batch.indexOf(notes[2]!) < batch.indexOf(report), 'digest preserves send order before the report');
      const history = await eventually('all digest members injected', async () => {
        const r = await ui.request({ type: 'topic.history', topic: 'agents' });
        const messages = (r.value as { messages: Array<{ id: string; text: string; stage?: string }> }).messages;
        return [...notes, report].every(text => messages.some(m => m.text === text && m.stage === 'injected')) ? messages : undefined;
      });
      assert.equal(history.filter(m => m.text === report).length, 1);
      // T-360: the fake answers the last delivery, preserving the report's routing.
      await ui.waitFor(f => {
        if (f.type !== 'message') return false;
        const message = f.message as { text: string; topic: string; replyTo?: string };
        return message.text === `pong: ${report}` && message.topic === 'agents'
          && message.replyTo === history.find(m => m.text === report)!.id;
      });
      await idle(ui);
      // Count consumed inputs, not duplicate control-RPC logging when a role turn is steered.
      const inputs = (await readFile(join(home, 'log', `${p.pid}.inputs.jsonl`), 'utf8')).trim().split('\n').map(line => JSON.parse(line) as { text: string });
      assert.equal(inputs.filter(input => input.text.includes('Progress digest (3 notes, oldest first):')).length, restart ? 2 : 1, 'one harness input per digest');
    }
    for (const kind of ['question', 'decision']) {
      const text = `${harness} ${kind} starts a turn`;
      await sender.call('send', { to: ['coord'], text, kind });
      await ui.waitFor(f => f.type === 'message' && (f.message as { text: string }).text === `pong: ${text}`, 15_000);
      await idle(ui);
    }
    assert.equal((await ui.request({ type: 'hub.status', history: true, flushLogs: true })).ok, true);
    const journal = await read(join(root, '.cland', 'journal.jsonl'));
    assert.match(journal, /"event":"send"[^\n]*"kind":"progress"/);
    assert.match(journal, /"event":"send"[^\n]*"kind":"report"/);
  });
}


test('merge stops per-item implementers before cleanup, while stop_after never and pools remain running', async t => {
  const root = await tempProject(t);
  const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { env: fixtureEnvironment(cwd, process.env), cwd, encoding: 'utf8' }).trim();
  await copyPreparedProject(root);
  const fake = await fakeClaude(t);
  const { discovery } = await projectHub(t, root, fake.env);
  const ui = await connectUi(t, discovery);
  const list = async () => ((await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] }).processes;
  for (const stopAfter of ['merge', 'never']) {
    assert.equal((await ui.request({ type: 'crew.set', key: 'implementer.stop_after', value: stopAfter })).ok, true);
    const created = await ui.request({ size: 'M', type: 'task.create', title: `Merge ${stopAfter}` });
    const item = (created.value as { item: { id: string } }).item;
    const launched = await ui.request({ type: 'session.launch', name: `impl-${stopAfter}`, role: 'implementer', harness: 'claude-code', item: item.id });
    assert.equal(launched.ok, true, launched.error);
    const { process, worktree } = launched.value as { process: HarnessProcessView; worktree: { path: string; branch: string } };
    await writeFile(join(worktree.path, stopAfter === 'merge' ? 'README.md' : 'GLOSSARY.md'), 'shipped\n');
    git(worktree.path, 'add', '.'); git(worktree.path, 'commit', '-qm', 'Ship');
    const merged = await ui.request({ type: 'merge', item: item.id, override: 'Exercise staffing lifecycle' }, 30_000);
    assert.equal(merged.ok, true, merged.error);
    assert.equal((merged.value as { followUp?: unknown }).followUp, undefined, JSON.stringify(merged));
    assert.equal((await list()).find(p => p.sessionId === process.sessionId)!.status, stopAfter === 'merge' ? 'stopped' : 'running');
    const view = await ui.request({ type: 'task.view', item: item.id });
    assert.equal((view.value as { item: { status: string } }).item.status, 'done');
  }
});
