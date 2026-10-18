// T3 scenario: a Coordinator launches each native harness; each receives its clause and round-trips a message.
// Rule coverage (T1/T2): hub/test/crew-launch.test.ts, hub/test/adapter-composition.test.ts,
// hub/test/launch-admission.test.ts and hub/test/session-launch-component.test.ts.
// Hub process starts: 0; one projectHub, three sequential real harness launches/stops.
// Native launch/log steps come from crew-launch before T-695; correlated pong from the adapter contracts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectUi, eventually, fakeClaude, fakeCodex, nativeProjectHub as projectHub, spawnSpoke, tempProject, withDiscoveredPid } from '../harness.ts';
import type { HarnessProcessView } from '../../src/protocol.ts';

test('Coordinator launches the three harnesses with clauses and a correlated native reply', async t => {
  const root = await tempProject(t);
  const claude = await fakeClaude(t);
  const codex = await fakeCodex(t);
  const opencode = await tempProject(t, 'scenario-opencode-');
  const opencodeBin = fileURLToPath(new URL('../fakes/opencode', import.meta.url));
  const env = { ...claude.env, ...codex.env, PATH: `${opencodeBin}:${claude.env.PATH}:${codex.env.PATH}`, FAKE_OPENCODE_HOME: opencode, XDG_DATA_HOME: join(opencode, 'data'), FAKE_OPENCODE_TURN_MS: '30', CLAND_ADAPTER_POLL_MS: '50' };
  const hub = await projectHub(t, root, env);
  const ui = await connectUi(t, hub.discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const launcher = await spawnSpoke({ discover: true, cwd: root, name: 'launcher', role: 'coordinator' });
  t.after(() => launcher.close());
  await launcher.waitForPresence(['launcher']);
  for (const harness of ['claude-code', 'codex', 'opencode']) {
    // A human mention authorizes the native Implementer reply in General.
    const launch = await launcher.call<{ ok: boolean; error?: string; process: HarnessProcessView }>('session.launch', { name: 'native', harness, role: 'implementer' });
    assert.equal(launch.ok, true, launch.error);
    const process = await withDiscoveredPid(ui, launch.process);
    await ui.waitFor(f => f.type === 'session.usage' && f.sessionId === process.sessionId);
    const log = () => harness === 'claude-code' ? claude.log(process.harnessId!) : harness === 'codex' ? codex.log(process.pid!) : readFile(join(opencode, 'prompts', `${process.harnessSessionId}.log`), 'utf8');
    const first = await eventually('native role clause recorded', async () => { const text = await log(); return text.includes('you hold the role Implementer') ? text : undefined; });
    assert.match(first, /you hold the role Implementer/);
    assert.match(first, /Sub-agent delegation is disabled/);
    const sent = await ui.request({ type: 'topic.send', topic: 'general', to: ['native'], text: '@native Reply with the single word pong' });
    assert.equal(sent.ok, true, sent.error);
    const id = (sent.value as { message: { id: string } }).message.id;
    await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'injected');
    const reply = await ui.waitFor(f => f.type === 'message' && (f.message as { replyTo?: string }).replyTo === id);
    assert.equal(reply.type, 'message');
    if (reply.type !== 'message') throw new Error('expected native reply');
    const message = reply.message as { text: string; topic: string; replyTo?: string };
    assert.equal(message.text, 'pong: @native Reply with the single word pong');
    assert.equal(message.topic, 'general');
    assert.equal(message.replyTo, id);
    const stop = await ui.request({ type: 'session.stop', session: process.name });
    assert.equal(stop.ok, true, stop.error);
    await eventually('native spoke disconnected before next launch', async () => {
      const status = (await ui.request({ type: 'hub.status' })).value as { sessions: { name: string }[] };
      return !status.sessions.some(p => p.name === 'native') ? true : undefined;
    });
  }
});
