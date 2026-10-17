// T2: executor permissions through the dispatcher, with no hub or spoke process.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dispatcherUi, frameClient, projectHub, tempProject } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import { FakeClock } from './fake-clock.ts';

test('executor CLI controls respect each caller role', async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root, { DIGITALOCEAN_TOKEN: '' }, { clock: new FakeClock(), harnesses: 'fake' });
  const ui = await dispatcherUi(t, hub.dispatcher, root);
  for (const [name, role] of [['coord', 'coordinator'], ['impl', 'implementer'], ['rev', 'reviewer'], ['qa-one', 'qa']] as const) {
    assert.equal((await ui.request({ type: 'role.set', session: name, role })).ok, true);
    let receive = (_line: string) => {};
    let open = true;
    const conversation = hub.dispatcher.open({ send: frame => receive(`${JSON.stringify(frame)}\n`), close: () => { open = false; }, isOpen: () => open }, { authenticated: true, edge: 'socket' });
    const peer = frameClient(line => conversation.receive(line.trimEnd()), fn => { receive = fn; }, () => { if (open) { open = false; conversation.closed(); } }, root);
    onCleanup(t, () => peer.close());
    peer.send({ type: 'hello', protocol: 2, name, sessionId: `${name}-id`, cwd: root });
    await peer.waitFor(frame => frame.type === 'welcome');
    const clause = await peer.waitFor(frame => frame.type === 'role');
    peer.send({ type: 'ack', id: clause.id });
    for (const sub of ['status', 'reap']) {
      const result = await ui.request({ type: `executor.${sub}`, as: { name, sessionId: `${name}-id`, shell: true } });
      if (role === 'coordinator') {
        assert.equal(result.ok, sub === 'status', result.error);
        assert.doesNotMatch(result.error ?? '', /forbidden/);
      } else {
        assert.equal(result.ok, false);
        assert.match(result.error!, new RegExp(`forbidden.*executor\\.${sub}`));
      }
    }
    peer.close();
  }
});
