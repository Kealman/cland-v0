// T3: native background first-turn MCP identity and hook ordering preserve the clause and single brief.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, eventually, fakeClaude, inProcessSpoke, nativeProjectHub as projectHub, tempProject } from './harness.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

test('a Coordinator launches an Implementer with a launch brief exactly once after its role clause, without inherited launch environment (explicit role)', async (t) => {
  const root = await tempProject(t);
  // The native background child loses ambient CLAND_*; identity must survive in MCP config.
  // Exercise a hello before --bg returns as well as the ordinary launch ordering.
  const fake = await fakeClaude(t, { lateBg: true });
  const { discovery } = await projectHub(t, root, fake.env);
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
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
  const input = await eventually('brief reaches the native harness', async () => {
    const log = await fake.log(launched.process.harnessId!);
    return log.includes(brief) ? log : undefined;
  });
  assert.ok(input.indexOf('you hold the role Implementer') < input.indexOf(brief));
  assert.equal(input.split('\n').filter(line => line.includes('submitted:')).length, 1, 'the first harness input includes clause and brief');
  const journal = await eventually('brief journalled as a message', async () => {
    const lines = (await readFile(join(root, '.cland', 'journal.jsonl'), 'utf8')).split('\n').filter(Boolean);
    const events = lines.map(line => JSON.parse(line) as { event: string; from?: string; to?: string[]; id?: string });
    const sent = events.find(event => event.event === 'send' && event.from === 'hub' && event.to?.includes('impl-brief'));
    return sent && events.some(event => event.event === 'acked' && event.id === sent.id) ? events : undefined;
  });
  const sent = journal.find(event => event.event === 'send' && event.from === 'hub' && event.to?.includes('impl-brief'))!;
  assert.ok(journal.some(event => event.event === 'acked' && event.id === sent.id));

  // A later turn must not submit the brief again when hooks report another idle boundary.
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const followup = await ui.request({ type: 'topic.send', topic: 'general', to: ['impl-brief'], text: 'A later turn.' });
  assert.equal(followup.ok, true, followup.error);
  const followupId = (followup.value as { message: { id: string } }).message.id;
  await ui.waitFor(frame => frame.type === 'message' && (frame.message as { replyTo?: string }).replyTo === followupId);
  const after = await fake.log(launched.process.harnessId!);
  assert.equal(after.split('\n').filter(line => line === brief).length, 1, 'one native submission of the brief across both turns');
});

