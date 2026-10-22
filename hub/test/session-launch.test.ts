// T2: launch role/brief policy through an in-process adapter and MCP peer; CLI forwarding is the CLI subject.
// Native first-turn hook ordering and environment-free MCP identity live in session-launch-lifecycle.test.ts.
import { completeJournalLines } from './journal-lines.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

test('in-process launch carries the Implementer clause and brief exactly once', async t => {
  const root = await tempProject(t);
  const { discovery, fakes } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const fake = fakes['claude-code']!;
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  await coord.waitForPresence(['coord']);
  const tool = (await coord.client.listTools()).tools.find(tool => tool.name === 'session.launch');
  const briefSchema = tool?.inputSchema.properties?.brief;
  assert.ok(briefSchema && 'type' in briefSchema);
  assert.equal(briefSchema.type, 'string');
  assert.ok(!tool?.inputSchema.required?.includes('brief'));
  const brief = 'Implement the launch brief without another message.';
  const launched = await coord.call<{ ok: boolean; error?: string; process: HarnessProcessView }>('session.launch', {
    name: 'impl-brief', role: 'implementer', harness: 'claude-code', brief,
  });
  assert.equal(launched.ok, true, launched.error);
  const input = fake.spawns[0]!;
  assert.ok(input.clause!.includes('you hold the role Implementer'));
  assert.ok(input.brief!.text.includes(brief));
  assert.equal(fake.spawns.length, 1, 'one first input carries clause and brief');
  const peer = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl-brief', sessionId: launched.process.sessionId, launchToken: input.launchToken! });
  await peer.waitForPresence(['impl-brief']);
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const journal = completeJournalLines(await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).map(line => JSON.parse(line) as { event: string; id?: string; from?: string; to?: string[] });
  const sent = journal.find(event => event.event === 'send' && event.from === 'hub' && event.to?.includes('impl-brief'))!;
  assert.ok(sent);
  assert.ok(journal.some(event => event.event === 'acked' && event.id === sent.id));
  fake.idle('impl-brief');
  const followup = await ui.request({ type: 'topic.send', topic: 'general', to: ['impl-brief'], text: 'A later turn.' });
  assert.equal(followup.ok, true, followup.error);
  await peer.waitForEvent(e => e.params.content.includes('A later turn.'));
  fake.busy('impl-brief');
  fake.idle('impl-brief');
  assert.equal(fake.spawns.filter(spawn => spawn.brief?.text.includes(brief)).length, 1);
  assert.equal(fake.injections.filter(inject => inject.message.text === brief).length, 0, 'carried brief is not resubmitted');
});

test('launch CLI resolves text and artifact briefs through an injected harness', async t => {
  const root = await tempProject(t);
  const { discovery, fakes } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  const content = 'Start on the CLI artifact brief.';
  const made = await ui.request({ type: 'artifact.create', kind: 'note', title: 'CLI brief', topic: 'general', content });
  assert.equal(made.ok, true, made.error);
  const artifact = (made.value as { artifact: { id: string } }).artifact;
  for (const [name, brief, expected] of [['cli-text', 'Start on the CLI text brief.', 'Start on the CLI text brief.'], ['cli-artifact', artifact.id, content]]) {
    const launched = await cland(root, 'session', 'launch', name!, '--role', 'implementer', '--harness', 'claude-code', '--brief', brief!, '--json');
    assert.equal(launched.code, 0, launched.stderr);
    const process = (JSON.parse(launched.stdout) as { process: HarnessProcessView }).process;
    assert.equal(process.name, name);
    assert.ok(fakes['claude-code']!.spawns.at(-1)!.brief!.text.includes(expected!));
  }
});
