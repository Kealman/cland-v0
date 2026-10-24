// T2: injected hub inbox classification; screen assertions live in nvim/test/needs-you.test.ts.
import { sessionUi as connectUi } from './session-credential-fixture.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Inbox, EventsPage } from '../src/protocol.ts';
import { FakeClock } from './fake-clock.ts';
import { STUB_NOW } from '../../nvim/test/fixtures/clock.ts';
import { Store } from '../src/hub/store.ts';
import { inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { cases } from '../../nvim/test/needs-you-fixture.ts';

for (const scenario of cases) {
  test(`needs-you chip and both inbox views agree: ${scenario.name}`, async t => {
    const root = await tempProject(t);
    const clock = new FakeClock(new Date(STUB_NOW));
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), `[visibility]\n${scenario.config}`);
    // Reproduce a topic left waiting by an earlier hub, without an open ask (as in asks.test.ts).
    const store = new Store(join(root, '.cland/hub.db'));
    store.createTopic('waiting', 'Left waiting', null, clock.now().toISOString());
    store.setTopicStatus('waiting', 'waiting for human');
    store.record({ id: 'waiting-report', from: 'legacy', fromKind: 'agent', via: 'session', to: ['coord'], kind: 'report', text: 'Waiting for your response', topic: 'waiting', ts: clock.now().toISOString() }, [], clock.now().getTime());
    store.close();
    const { discovery, fakes } = await projectHub(t, root, {}, { clock });
    const ui = await connectUi(t, discovery);
    const request = async <T>(frame: { type: string } & Record<string, unknown>): Promise<T> => {
      const result = await ui.request(frame);
      assert.equal(result.ok, true, `${frame.type}: ${result.error}`);
      return result.value as T;
    };
    await request({ type: 'subscribe' });
    const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator', clock });
    t.after(() => coord.close());
    await coord.waitForPresence(['coord']);
    const asking = await coord.call<{ ok: boolean; error?: string }>('ask', { topic: 'general', question: 'Choose direction?', options: ['Continue'], free: true });
    assert.equal(asking.ok, true, asking.error);
    await request({ type: 'session.launch', name: 'worker', role: 'implementer', harness: 'claude-code' });
    fakes['claude-code']!.idle('worker');
    assert.equal((await request<{ processes: Array<{ name: string; state: string }> }>({ type: 'session.list' })).processes.find(s => s.name === 'worker')?.state, 'idle');
    await request({ type: 'session.signal', session: 'worker', event: 'permission', at: clock.now().getTime(), payload: { tool_name: 'Bash' } });
    const { item } = await request<{ item: { id: string } }>({ size: 'M', type: 'task.create', title: 'Count evidence' });
    for (const result of ['clear', 'not clear']) {
      await request({ type: 'task.comment', item: item.id, text: `Review ${result}.`, verdict: { verdict: 'review', scope: 'full', result, run: `count-${result.replace(' ', '-')}` }, as: { name: 'rev', role: 'reviewer' } });
    }
    const check = async (expected: number, layers: string[]) => {
      const inbox = await request<Inbox>({ type: 'inbox.list' });
      assert.equal(inbox.needsYou, expected);
      assert.equal((await request<{ needsYou: number }>({ type: 'hub.status' })).needsYou, expected);
      assert.deepEqual([inbox.asks.length, inbox.approvals.length, inbox.waiting.length], [1, 1, 1], 'the ask topic is not counted twice as waiting');
      assert.deepEqual([inbox.asks[0]?.layer, inbox.approvals[0]?.layer, inbox.waiting[0]?.layer], layers);
      assert.equal('notifications' in inbox, false);
      const events = await request<EventsPage>({ type: 'events.list' });
      assert.ok(events.rows.some(r => r.kind === 'session' && r.text.includes('is Coordinator')));
      assert.ok(events.rows.some(r => r.kind === 'verdict' && r.text.includes('review clear')));
      assert.ok(events.rows.some(r => r.kind === 'verdict' && r.text.includes('review not clear') && r.warning));
    };

    await check(scenario.count, scenario.layers);
    const set = (surface: string, target: string, mode: string) => request({ type: 'visibility.set', surface, target, mode });
    const muted = scenario.layers.map(layer => ({ now: 'watch', watch: 'background', background: 'archive', archive: 'archive' })[layer]!);
    // Muting required topics/session removes their contributions, even while their inbox rows remain.
    await set('topics', 'general', 'mute');
    await check(scenario.count === 3 ? 2 : 0, [muted[0]!, scenario.layers[1]!, scenario.layers[2]!]);
    await set('topics', 'waiting', 'mute');
    await check(scenario.count === 3 ? 1 : 0, [muted[0]!, scenario.layers[1]!, muted[2]!]);
    await set('sessions', 'worker', 'mute');
    await check(0, muted);
    // Pins replace mutes and restore all three responses to Now, including an archived waiting topic.
    await set('topics', 'general', 'pin');
    await check(1, ['now', muted[1]!, muted[2]!]);
    await set('topics', 'waiting', 'pin');
    await check(2, ['now', muted[1]!, 'now']);
    await set('sessions', 'worker', 'pin');
    await check(3, ['now', 'now', 'now']);
    // Repeating the choice resets it; both live inbox and cold snapshots return to project defaults.
    await set('topics', 'general', 'pin');
    await set('topics', 'waiting', 'pin');
    await set('sessions', 'worker', 'pin');
    await check(scenario.count, scenario.layers);
  });
}
