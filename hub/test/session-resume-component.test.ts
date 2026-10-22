// T2 component: resume restores only available work, using in-process harnesses and protocol peers.
import { completeJournalLines } from './journal-lines.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { fakeHarness, FAKE_FLAVOURS, type FakeHarness } from './fakes/harness.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

type Resumed = { found: boolean; process: HarnessProcessView; role: string | null; claim: string | null; notes: string[]; reason?: string; fresh?: { brief: string | null } };

test('restart keeps an undiscoverable live harness tracked and stoppable for every flavour', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const fakePids = FAKE_FLAVOURS.map((_, i) => 400 + i);
  const observedPids = new Set<number>();
  // These identities belong to the in-process adapter, so ownership observation must use its
  // synthetic facts too. Native UI clients retain the default OS-backed teardown collector.
  const observeProcesses = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if ('pid' in value && typeof value.pid === 'number') {
      assert.ok(fakePids.includes(value.pid), `unexpected process identity ${value.pid}`);
      observedPids.add(value.pid);
    }
    for (const child of Object.values(value)) if (typeof child === 'object') observeProcesses(child);
  };
  const first = await projectHub(t, root, {}, { clock, adapters: FAKE_FLAVOURS.map((flavour, i) => host => {
    const fake = fakeHarness(flavour, { host, clock });
    const spawn = fake.spawn.bind(fake);
    fake.spawn = async (...args) => ({ ...await spawn(...args), pid: fakePids[i]!, pidStarted: 'fixture-owned-process' });
    return fake;
  }) });
  const ui = await connectUi(t, first.discovery, 'ui', observeProcesses);
  const launched: HarnessProcessView[] = [];
  for (const harness of FAKE_FLAVOURS) {
    const result = await ui.request({ type: 'session.launch', name: harness, harness });
    assert.equal(result.ok, true, result.error);
    launched.push((result.value as { process: HarnessProcessView }).process);
  }
  ui.close();
  await first.stop();
  const fakes: FakeHarness[] = [];
  const restarted = await projectHub(t, root, {}, { clock, adapters: FAKE_FLAVOURS.map(flavour => host => {
    const fake = fakeHarness(flavour, { host, clock });
    // The native directory/socket cannot recover its conversation, but its process survived.
    fake.resume = async () => ({ found: false, reason: 'native discovery unavailable', alive: true });
    fakes.push(fake);
    return fake;
  }) });
  const next = await connectUi(t, restarted.discovery, 'ui', observeProcesses);
  // Serialize with startup recovery before inspecting the persisted rows.
  for (const before of launched) {
    const result = await next.request({ type: 'session.resume', session: before.name });
    assert.equal(result.ok, true, result.error);
    const after = result.value as Resumed;
    assert.equal(after.found, false, 'native discovery remains unavailable');
    assert.equal(after.reason, 'native discovery unavailable');
    assert.equal(after.process.status, 'running', 'a discovery miss is not a process exit');
    assert.equal(after.process.sessionId, before.sessionId);
    assert.equal(after.process.pid, before.pid);
    assert.ok(after.process.pid, 'the recorded fake PID survives recovery');
    const stopped = await next.request({ type: 'session.stop', session: before.name });
    assert.equal(stopped.ok, true, stopped.error);
    assert.equal((stopped.value as { process: HarnessProcessView }).process.status, 'stopped');
    assert.equal(fakes.find(f => f.harness === before.harness)!.stops.at(-1)?.sessionId, before.sessionId);
  }
  assert.deepEqual([...observedPids].sort(), fakePids, 'all three synthetic ownership facts were observed');
});

test('Claude resumes take permission policy from the current roles file', { timeout: 2000 }, async t => {
  const root = await tempProject(t);
  const { discovery, fakes } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  const fake = fakes['claude-code']!;
  const setPermissions = (value: string) => writeFile(join(root, '.cland/roles.toml'), `[coordinator.launch]\nharness = "claude-code"\npermissions = "${value}"\n`);
  await setPermissions('skip');
  const launched = await ui.request({ type: 'session.launch', name: 'coord', role: 'coordinator' });
  assert.equal(launched.ok, true, launched.error);
  assert.equal(fake.spawns.at(-1)!.permissions, 'skip');
  for (const mode of ['relaunch', 'fresh'] as const) {
    assert.equal((await ui.request({ type: 'session.stop', session: 'coord' })).ok, true);
    await setPermissions('auto');
    const result = await ui.request({ type: 'session.resume', session: 'coord', ...(mode === 'relaunch' ? { relaunch: true } : { fresh: true }) });
    assert.equal(result.ok, true, result.error);
    if (mode === 'fresh') assert.equal(fake.spawns.at(-1)!.permissions, 'auto');
    else assert.equal(fake.resumes.at(-1)!.options?.policy?.permissions, 'auto');
    // Change away before each next operation, so a cached policy would be detectable.
    await setPermissions('');
    assert.equal((await ui.request({ type: 'session.stop', session: 'coord' })).ok, true);
    const reset = await ui.request({ type: 'session.resume', session: 'coord', relaunch: true });
    assert.equal(reset.ok, true, reset.error);
    assert.equal(fake.resumes.at(-1)!.options?.policy?.permissions, undefined);
  }
});

test('native and fresh resumes report unavailable claims, closed work, exclusive roles and holds', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { harnesses: 'fake', probes: 'fake', clock });
  const ui = await connectUi(t, discovery);
  const fake = fakes['claude-code']!;
  for (const fresh of [false, true]) for (const loss of ['claim', 'closed', 'exclusive', 'hold'] as const) {
    const name = `${fresh ? 'fresh' : 'native'}-${loss}`;
    const role = loss === 'exclusive' ? 'coordinator' : loss === 'hold' ? 'reviewer' : 'implementer';
    const created = await ui.request({ size: 'M', type: 'task.create', title: name });
    assert.equal(created.ok, true, created.error);
    const item = (created.value as { item: { id: string } }).item.id;
    const launch = await ui.request({ type: 'session.launch', name, role, harness: 'claude-code', model: 'claude-fake-1', ...(['claim', 'closed'].includes(loss) ? { item } : {}) });
    assert.equal(launch.ok, true, launch.error);
    const before = (launch.value as { process: HarnessProcessView }).process;
    const peer = await inProcessSpoke(t, { discover: true, cwd: before.cwd, name, role, sessionId: before.sessionId, launchToken: fake.spawns.at(-1)!.launchToken! });
    await peer.waitForPresence([name]);
    await peer.waitForEvent(e => e.params.meta?.kind === 'role' && e.params.content.includes('you hold the role'));
    if (loss === 'hold') {
      const held = await peer.call<{ ok: boolean; error?: string }>('task.hold', { item });
      assert.equal(held.ok, true, held.error);
    }
    assert.equal((await ui.request({ type: 'session.stop', session: name })).ok, true);
    await peer.close();
    let other: Awaited<ReturnType<typeof inProcessSpoke>> | undefined;
    const otherName = `other-${name}`;
    if (loss === 'claim' || loss === 'exclusive') {
      other = await inProcessSpoke(t, { discover: true, cwd: root, name: otherName, sessionId: `${otherName}-id`, role: loss === 'exclusive' ? 'coordinator' : 'implementer' });
      await other.waitForPresence([otherName]);
      if (loss === 'claim') {
        assert.equal((await ui.request({ type: 'task.edit', item, assignee: otherName })).ok, true);
        const take = await other.call<{ ok: boolean; error?: string }>('task.claim', { item, force: true });
        assert.equal(take.ok, true, take.error);
      }
    }
    if (loss === 'closed') assert.equal((await ui.request({ type: 'task.close', item })).ok, true);
    const resumed = await ui.request({ type: 'session.resume', session: name, relaunch: !fresh, fresh });
    assert.equal(resumed.ok, true, resumed.error);
    const value = resumed.value as Resumed;
    assert.equal(value.found, true);
    assert.equal(value.claim, null);
    assert.equal(value.role, loss === 'exclusive' ? null : role);
    assert.match(value.notes.join(' '), loss === 'exclusive' ? /coordinator role was not restored/ : loss === 'hold' ? /retake the hold/ : new RegExp(`${item} claim was not restored`));
    const view = (await ui.request({ type: 'task.view', item })).value as { item: { claim: { sessionId: string } | null; holds: unknown[] } };
    assert.equal(view.item.claim?.sessionId ?? null, loss === 'claim' ? `${otherName}-id` : null);
    assert.deepEqual(view.item.holds, []);
    assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
    const journal = await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8');
    const entry = completeJournalLines(journal).map(line => JSON.parse(line) as Record<string, unknown>).find(e => e.event === 'session-resumed' && e.session === name);
    assert.ok(entry);
    assert.deepEqual(entry.notes, value.notes);
    assert.equal(entry.relaunched, true);
    assert.equal((await ui.request({ type: 'session.stop', session: name })).ok, true);
    if (other) {
      assert.equal((await ui.request({ type: 'role.clear', session: otherName })).ok, true);
      await other.close();
    }
  }
});

test('Codex fresh resume retains text, artifact and absent briefs after native refusal', async t => {
  const root = await tempProject(t);
  const { discovery, fakes } = await projectHub(t, root, {}, { harnesses: 'fake', probes: 'fake', clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  const fake = fakes.codex!;
  for (const artifact of [false, true, null]) {
    const name = artifact === null ? 'absent' : artifact ? 'artifact' : 'text';
    const created = await ui.request({ size: 'M', type: 'task.create', title: name });
    assert.equal(created.ok, true, created.error);
    const item = (created.value as { item: { id: string } }).item.id;
    const text = 'Implement the fresh work from this recorded brief.';
    let brief: string | null = artifact === null ? null : text;
    if (artifact) {
      const a = await ui.request({ type: 'artifact.create', kind: 'prompt', title: 'Fresh brief', topic: 'general', content: text });
      assert.equal(a.ok, true, a.error);
      brief = (a.value as { artifact: { id: string } }).artifact.id;
    }
    const launched = await ui.request({ type: 'session.launch', name, role: 'implementer', harness: 'codex', model: 'gpt-fake-1', effort: 'high', item, ...(brief === null ? {} : { brief }) });
    assert.equal(launched.ok, true, launched.error);
    const before = (launched.value as { process: HarnessProcessView }).process;
    assert.equal((await ui.request({ type: 'session.stop', session: name })).ok, true);
    fake.scriptResume(name, 'gone');
    const failed = await ui.request({ type: 'session.resume', session: name, relaunch: true });
    assert.equal(failed.ok, true, failed.error);
    const offer = failed.value as Resumed;
    assert.equal(offer.found, false);
    assert.match(offer.reason!, /fake conversation gone/);
    assert.deepEqual(offer.fresh, { brief });
    const fresh = await ui.request({ type: 'session.resume', session: name, fresh: true });
    assert.equal(fresh.ok, true, fresh.error);
    const after = fresh.value as Resumed;
    assert.equal(after.found, true);
    assert.equal(after.process.sessionId, before.sessionId);
    assert.equal(after.role, 'implementer');
    assert.equal(after.claim, item);
    assert.equal(after.process.model, before.model);
    assert.equal(after.process.cwd, before.cwd);
    const input = fake.spawns.at(-1)!;
    assert.equal(input.effort, 'high');
    assert.equal(input.resumeConversation, undefined, 'fresh launch requests a new native conversation');
    if (brief === null) {
      assert.ok(after.notes.includes('no brief recorded'));
      assert.equal(input.brief, undefined);
    } else assert.ok(input.brief!.text.includes(text));
    assert.equal((await ui.request({ type: 'session.stop', session: name })).ok, true);
  }
});
