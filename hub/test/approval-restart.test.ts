// T3: three live fake harnesses survive actual hub-process restarts. Native replay,
// HTTP snapshots and Claude's polled waiting state must recover the same approval identities.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ApprovalOutcome, HarnessProcessView, Inbox } from '../src/protocol.ts';
import { OpenCodeClient } from '../src/adapters/opencode/client.ts';
import { clandWithEnv, connectUi, eventually, fakeClaude, pidAlive, startDaemon, tempProject, withDiscoveredPid } from './harness.ts';
import { completeJournalLines } from './journal-lines.ts';
import { ownProcess } from './process-cleanup.ts';

test('hub restarts retain three pending approval ids, deliver a replayed answer and archive off-stream outcomes', async t => {
  const root = await tempProject(t);
  const claude = await fakeClaude(t, { awaitSignals: true });
  const codexHome = join(root, 'fake-codex'), opencodeHome = join(root, 'fake-opencode');
  await mkdir(codexHome); await mkdir(opencodeHome);
  const env = { ...claude.env,
    PATH: [fileURLToPath(new URL('./fakes/codex', import.meta.url)), fileURLToPath(new URL('./fakes/opencode', import.meta.url)), claude.env.PATH].join(delimiter),
    FAKE_CODEX_HOME: codexHome, FAKE_OPENCODE_HOME: opencodeHome,
    FAKE_CODEX_TURN_MS: '20', FAKE_OPENCODE_TURN_MS: '20',
  };
  const first = await startDaemon(t, root, env);
  let ui = await connectUi(t, first.discovery);
  await ui.request({ type: 'subscribe' });
  const processes: HarnessProcessView[] = [];
  for (const [name, harness] of [['cx', 'codex'], ['oc', 'opencode'], ['cc', 'claude-code']] as const) {
    const result = await ui.request({ type: 'session.launch', name, harness, role: 'implementer' }, 30_000);
    assert.equal(result.ok, true, result.error);
    const process = await withDiscoveredPid(ui, (result.value as { process: HarnessProcessView }).process);
    ownProcess(t, process.pid);
    processes.push(process);
    await eventually(`${name} initial native turn finished`, async () => {
      const listed = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
      return listed.processes.find(p => p.name === name && p.state === 'idle');
    });
  }
  const inbox = async (client = ui) => (await client.request({ type: 'inbox.list', archive: true })).value as Inbox;
  async function ask(name: string) {
    const mark = ui.frames.length;
    const pending = ui.waitFor(frame => {
      if (frame.type !== 'approval' || ui.frames.indexOf(frame) < mark) return false;
      const record = frame.approval as Inbox['approvals'][number];
      return record.session === name && record.state === 'pending' && record.kind === 'command' && (name === 'cc' || record.answerIn === 'hub');
    });
    const result = await ui.request({ type: 'topic.send', topic: 'general', to: [name], text: 'needs approval shell approval' });
    assert.equal(result.ok, true, result.error);
    return (await pending).approval as Inbox['approvals'][number];
  }
  const original: Inbox['approvals'] = [];
  for (const name of ['cx', 'oc', 'cc']) original.push(await ask(name));
  assert.equal((await inbox()).approvals.length, 3);
  async function stopHub(pid: number) {
    ui.close();
    const stopped = await clandWithEnv(root, env, 'hub', 'stop');
    assert.equal(stopped.code, 0, stopped.stderr);
    await eventually('scratch hub PID reaped', () => !pidAlive(pid) || undefined);
    assert.equal(pidAlive(pid), false);
  }
  await stopHub(first.discovery.pid);
  await writeFile(join(codexHome, 'hold-thread-resume'), '');
  const second = await startDaemon(t, root, env);
  assert.notEqual(second.discovery.pid, first.discovery.pid);
  ui = await connectUi(t, second.discovery);
  await ui.request({ type: 'subscribe' });
  await eventually('Codex recovery is held before replay', async () => await stat(join(codexHome, 'thread-resume-running')).then(() => true, () => undefined));
  const restored = await eventually('all native reconnects restore the approval records', async () => {
    const rows = (await inbox()).approvals;
    assert.deepEqual(rows.map(a => a.id).sort(), original.map(a => a.id).sort(), JSON.stringify({ approvals: rows, archive: (await inbox()).archive }));
    return rows;
  });
  assert.deepEqual(restored.map(a => a.id).sort(), original.map(a => a.id).sort());
  for (const record of restored) assert.deepEqual(record.subject, original.find(a => a.id === record.id)!.subject);
  const codex = original.find(a => a.session === 'cx')!;
  const rebuilt = async () => {
    await ui.request({ type: 'hub.status', flushLogs: true });
    const log = await readFile(join(root, '.cland/journal.jsonl'), 'utf8');
    return completeJournalLines(log).filter(Boolean).map(line => JSON.parse(line) as { event: string; approval?: string; answerIn?: string })
      .some(entry => entry.event === 'approval-rebuilt' && entry.approval === codex.id && entry.answerIn === 'hub');
  };
  assert.equal(await rebuilt(), false, 'disk-restored metadata does not prove native replay readiness');
  const ready = eventually('validated native replay admitted before the single answer', async () => await rebuilt() || undefined);
  await writeFile(join(codexHome, 'release-thread-resume'), '');
  await ready;
  assert.equal(await rebuilt(), true);
  const ran = eventually('Codex ran the replayed approved command', async () => await stat(join(root, 'approved')).then(() => true, () => undefined));
  const answer = await ui.request({ type: 'approval.answer', approval: codex.id, choice: 'once' });
  assert.equal(answer.ok, true, answer.error);
  await ran;
  const approved = (await inbox()).archive!.find(a => a.id === codex.id)!;
  assert.equal((approved.outcome as ApprovalOutcome)?.choice, 'once');
  assert.equal(approved.outcome?.by, 'human');
  await eventually('first approved Codex turn finished', async () => {
    const listed = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
    return listed.processes.find(p => p.name === 'cx' && p.state === 'idle');
  });
  const offstreamCodex = await ask('cx');
  await stopHub(second.discovery.pid);
  await writeFile(join(codexHome, 'approve'), '');
  const cx = processes.find(p => p.name === 'cx')!;
  await eventually('fake Codex TUI answer durably logged', async () => {
    const log = await readFile(join(codexHome, 'log', `${cx.pid}.log`), 'utf8');
    return log.includes(`approval ${offstreamCodex.id.slice(offstreamCodex.sessionId.length + 1)}: accept`) || undefined;
  });
  // The attached OpenCode client answers while the hub is absent. Its native reply receipt
  // precedes restart; a snapshot can report disappearance, not invent the unobserved choice.
  const oc = processes.find(p => p.name === 'oc')!;
  const permission = original.find(a => a.session === 'oc')!;
  const password = (await readFile(join(root, '.cland/opencode/oc/password'), 'utf8')).trim();
  const native = new OpenCodeClient(oc.harnessId!, password);
  await native.request('POST', `/api/session/${oc.harnessSessionId}/permission/${permission.id.slice(permission.sessionId.length + 1)}/reply`, { decision: 'reject' });
  await eventually('attached client reply durably logged', async () => {
    const log = await readFile(join(opencodeHome, 'prompts', `${oc.harnessSessionId}.log`), 'utf8');
    return log.includes('"decision":"reject"') || undefined;
  });
  const third = await startDaemon(t, root, env);
  assert.notEqual(third.discovery.pid, second.discovery.pid);
  ui = await connectUi(t, third.discovery);
  const after = await eventually('off-stream permission closes after snapshot', async () => {
    const value = await inbox();
    return value.archive?.some(a => a.id === permission.id) && value.archive.some(a => a.id === offstreamCodex.id) ? value : undefined;
  });
  assert.deepEqual(after.archive!.find(a => a.id === codex.id)?.outcome, approved.outcome);
  assert.equal((after.archive!.find(a => a.id === permission.id)?.outcome as ApprovalOutcome)?.choice, 'answered in the harness');
  assert.equal((after.archive!.find(a => a.id === permission.id)?.outcome as ApprovalOutcome)?.via, 'harness');
  assert.equal(after.approvals.some(a => a.id === permission.id), false);
  assert.equal((after.archive!.find(a => a.id === offstreamCodex.id)?.outcome as ApprovalOutcome)?.choice, 'answered in the harness');
  assert.deepEqual(after.approvals.map(a => a.id), [original.find(a => a.session === 'cc')!.id]);
  for (const process of processes) {
    const stopped = await ui.request({ type: 'session.stop', session: process.name }, 15_000);
    assert.equal(stopped.ok, true, stopped.error);
    await eventually(`${process.name} PID reaped`, () => !pidAlive(process.pid!) || undefined);
  }
});
