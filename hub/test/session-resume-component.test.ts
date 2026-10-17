// T2 component: resume restores only available work, using in-process harnesses and protocol peers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, inProcessSpoke, projectHub } from './harness.ts';
import { preparedProject } from './prepared-project.ts';
import { FakeClock } from './fake-clock.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

type Resumed = { found: boolean; process: HarnessProcessView; role: string | null; claim: string | null; notes: string[]; reason?: string; fresh?: { brief: string | null } };

test('native and fresh resumes report unavailable claims, closed work, exclusive roles and holds', async t => {
  const root = await preparedProject(t);
  const clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { harnesses: 'fake', clock });
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
    const entry = journal.split('\n').filter(Boolean).map(line => JSON.parse(line) as Record<string, unknown>).find(e => e.event === 'session-resumed' && e.session === name);
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
  const root = await preparedProject(t);
  const { discovery, fakes } = await projectHub(t, root, {}, { harnesses: 'fake', clock: new FakeClock() });
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
