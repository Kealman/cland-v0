// T2: hub-owned composition, once across all production harness names. The adapters and spokes
// run in-process; real socket frames prove the launch/ack/delivery boundary without a harness binary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { envelope } from '../src/adapters/contract.ts';
import type { HarnessProcessView, Message } from '../src/protocol.ts';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { FakeClock } from './fake-clock.ts';
import { FAKE_FLAVOURS } from './fakes/harness.ts';
import { connectSocket, connectUi, eventually, inProcessSpoke, projectHub, tempProject } from './harness.ts';

test('the hub composes clause, launch brief, artifact envelope and Lead claim for every flavour', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock, harnesses: 'fake' });
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  for (const flavour of FAKE_FLAVOURS) {
    const fake = fakes[flavour]!;
    for (const preassigned of [false, true]) {
      const name = `${flavour}-${preassigned ? 'assigned' : 'explicit'}`;
      const brief = `Build from the ${name} brief.`;
      if (preassigned) assert.equal((await ui.request({ type: 'role.set', session: name, role: 'implementer' })).ok, true);
      const launched = await ui.request({ type: 'session.launch', name, harness: flavour, ...(preassigned ? {} : { role: 'implementer' }), brief });
      assert.equal(launched.ok, true, launched.error);
      const process = (launched.value as { process: HarnessProcessView }).process;
      const request = fake.spawns.at(-1)!;
      assert.match(request.clause!, /you hold the role Implementer/);
      assert.equal(request.brief!.text, `${brief}\n\nProject rules for your role\nNo project rules apply to your role.`);
      const peer = await connectSocket(discovery.socket);
      t.after(() => peer.close());
      peer.send({ type: 'hello', protocol: 2, secret: discovery.secret, name, sessionId: process.sessionId, cwd: root, launchToken: request.launchToken });
      assert.equal((await peer.next()).type, 'welcome');
      const inputs: Array<Record<string, unknown>> = [];
      do {
        const frame = await peer.next();
        assert.ok(frame.type === 'role' || frame.type === 'deliver');
        inputs.push(frame);
        peer.send({ type: 'ack', id: frame.id });
      } while (inputs.at(-1)!.id !== request.brief!.id);
      await ui.waitFor(f => f.type === 'delivery' && f.message === request.brief!.id && f.stage === 'injected');
      // Claude's actual adapter receipts show clause-before-brief order. Spawn-first adapters
      // get the two fields above; their native concatenation remains the binary contract's proof.
      if (!fake.clauseAtSpawn) {
        const injected = fake.injections.filter(i => i.process.name === name).map(i => i.message.text).join('\n');
        assert.ok(injected.indexOf('you hold the role Implementer') < injected.indexOf(brief));
        assert.equal(injected.split(brief).length - 1, 1);
      }
      assert.equal(fake.injections.filter(i => i.message.id === request.brief!.id).length, fake.clauseAtSpawn ? 0 : 1, 'spawn-carried brief is never injected twice');
      const history = await ui.request({ type: 'topic.history', topic: 'agents' });
      assert.equal((history.value as { messages: Array<Message & { stage: string }> }).messages.find(m => m.id === request.brief!.id)?.stage, 'injected');
      peer.close();
    }
    const name = `${flavour}-lead`;
    const created = await ui.request({ type: 'task.create', title: `${flavour} epic`, kind: 'epic' });
    assert.equal(created.ok, true, created.error);
    const item = (created.value as { item: { id: string } }).item.id;
    const launched = await ui.request({ type: 'session.launch', name, harness: flavour, role: 'lead', item });
    assert.equal(launched.ok, true, launched.error);
    const request = fake.spawns.at(-1)!;
    assert.equal(request.cwd, root);
    assert.equal(request.item, item);
    assert.match(request.clause!, /you hold the role Lead/);
    const peer = await connectSocket(discovery.socket);
    t.after(() => peer.close());
    peer.send({ type: 'hello', protocol: 2, secret: discovery.secret, name, sessionId: (launched.value as { process: HarnessProcessView }).process.sessionId, cwd: root, launchToken: request.launchToken });
    assert.equal((await peer.next()).type, 'welcome');
    const clause = await peer.next();
    assert.equal(clause.type, 'role');
    assert.equal(clause.role, 'lead');
    assert.match((clause as { clause: string }).clause, /You are a Lead/);
    peer.send({ type: 'ack', id: clause.id });
    const sent = await ui.request({ type: 'topic.send', topic: 'general', text: `@lead ${item} explain the epic` });
    assert.equal(sent.ok, true, sent.error);
    assert.deepEqual((sent.value as { message: Message }).message.to, [name]);
    let addressed;
    do { addressed = await peer.next(); peer.send({ type: 'ack', id: addressed.id }); } while (addressed.id !== (sent.value as { message: Message }).message.id);
    const viewed = await ui.request({ type: 'task.view', item });
    assert.equal((viewed.value as { item: { claim: { session: string; role: string } } }).item.claim.session, name);
    assert.equal((viewed.value as { item: { claim: { role: string } } }).item.claim.role, 'lead');
    const topicReply = await ui.request({ type: 'topic.create', title: `${flavour} work`, item });
    assert.equal(topicReply.ok, true, topicReply.error);
    const topic = (topicReply.value as { topic: { id: string } }).topic.id;
    const made = await ui.request({ type: 'artifact.create', kind: 'diagram', title: 'Merge flow', content: 'graph TD; A-->B', topic });
    assert.equal(made.ok, true, made.error);
    const artifact = (made.value as { artifact: { id: string; path: string } }).artifact;
    const shared = await ui.request({ type: 'topic.send', topic, to: [name], text: 'Use this shared artifact', artifacts: [artifact.id] });
    assert.equal(shared.ok, true, shared.error);
    let artifactFrame;
    do { artifactFrame = await peer.next(); peer.send({ type: 'ack', id: artifactFrame.id }); } while ((artifactFrame.message as Message | undefined)?.artifact?.id !== artifact.id);
    await ui.waitFor(f => f.type === 'delivery' && f.stage === 'injected' && fake.injections.some(i => i.message.id === f.message && i.message.artifact?.id === artifact.id));
    const input = fake.injections.find(i => i.message.artifact?.id === artifact.id)!;
    const prompt = envelope(input.message, input.topic);
    assert.ok(prompt.includes(`artifact_id="${artifact.id}"`));
    assert.ok(prompt.includes(`artifact_path="${artifact.path}"`));
    peer.close();
  }
});

test('hub refusals and adapterless delivery need no harness process', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock, harnesses: 'fake' });
  const ui = await connectUi(t, discovery);
  const unknown = await ui.request({ type: 'session.launch', name: 'x', harness: 'nope' });
  assert.equal(unknown.ok, false);
  assert.match(unknown.error ?? '', /no adapter for harness "nope"/);
  assert.match((await ui.request({ type: 'session.launch', name: 'x', role: 'boss' })).error ?? '', /unknown role "boss"/);
  assert.match((await ui.request({ type: 'session.attach', session: 'nobody' })).error ?? '', /no session "nobody" was launched by this hub/);
  assert.deepEqual((await ui.request({ type: 'session.signal', session: 'nobody', event: 'turn-start' })).value, { applied: false });
  const plain = await inProcessSpoke(t, { cwd: root, discover: true, name: 'plain', role: 'implementer', sessionId: 'sess-plain' });
  await plain.waitForPresence(['plain']);
  const status = (await ui.request({ type: 'hub.status' })).value as { sessions: Array<{ name: string; state: string }> };
  assert.equal(status.sessions.find(s => s.name === 'plain')?.state, 'unknown');
  await ui.request({ type: 'subscribe' });
  const sent = await ui.request({ type: 'topic.send', topic: 'general', text: 'hi', to: ['plain'] });
  const id = (sent.value as { message: Message }).message.id;
  await plain.waitForEvent(e => e.params.meta?.msg_id === id);
  await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'delivered');
  await clock.advance(30_000);
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<Message & { stage: string }> };
  assert.equal(history.messages.find(m => m.id === id)?.stage, 'delivered');
  assert.ok(!ui.frames.some(f => f.type === 'delivery' && f.message === id && f.stage === 'injected'));
  assert.ok(Object.values(fakes).every(fake => fake.injections.length === 0));
});

test('rejected injection stays delivered across idle observations and retries on the next busy-to-idle', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, {}, { clock, harnesses: 'fake' });
  const fake = fakes['claude-code']!;
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const launched = await ui.request({ type: 'session.launch', harness: 'claude-code', name: 'coord', role: 'coordinator' });
  assert.equal(launched.ok, true, launched.error);
  const peer = await connectSocket(discovery.socket);
  t.after(() => peer.close());
  peer.send({ type: 'hello', protocol: 2, secret: discovery.secret, name: 'coord', sessionId: (launched.value as { process: HarnessProcessView }).process.sessionId, cwd: root, launchToken: fake.spawns[0]!.launchToken });
  assert.equal((await peer.next()).type, 'welcome');
  const role = await peer.next();
  peer.send({ type: 'ack', id: role.id });
  fake.idle('coord');
  await ui.request({ type: 'session.list' });
  fake.scriptInject('coord', 'reject');
  const sent = await ui.request({ type: 'topic.send', topic: 'general', text: 'retry me' });
  const id = (sent.value as { message: Message }).message.id;
  let delivery;
  do { delivery = await peer.next(); } while (delivery.id !== id);
  peer.send({ type: 'ack', id });
  await eventually('the rejected inject completes', async () => {
    await ui.request({ type: 'hub.status', flushLogs: true });
    return (await readFile(join(root, '.cland/log/hub.log'), 'utf8')).includes(`"inject-unconfirmed","session":"coord","id":"${id}"`) || undefined;
  });
  const count = fake.injections.length;
  for (let i = 0; i < 5; i++) { await clock.advance(100); fake.idle('coord'); await ui.request({ type: 'session.list' }); }
  assert.equal(fake.injections.length, count, 'idle observations alone do not retry an unconfirmed input');
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<Message & { stage: string }> };
  assert.equal(history.messages.find(m => m.id === id)?.stage, 'delivered');
  fake.busy('coord');
  fake.idle('coord');
  await ui.waitFor(f => f.type === 'delivery' && f.message === id && f.stage === 'injected');
  assert.equal(fake.injections.at(-1)!.message.id, id);
});
