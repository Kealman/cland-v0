import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import type { EventsPage, Inbox } from '../src/protocol.ts';
import { FakeClock } from './fake-clock.ts';
import { connectUi, inProcessSpoke, projectHub, tempProject } from './harness.ts';

/** Same visibility assertions for representative rules and the separately tiered volume claim. */
export async function assertDefaultEventVisibility(t: TestContext, verdictCount: number) {
  const root = await tempProject(t);
  // Keep pushed idle states authoritative while testing notification visibility.
  const clock = new FakeClock();
  const { discovery, fakes } = await projectHub(t, root, { CLAND_IDLE_NOTIFY_MS: '40' }, { clock });
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const created = await ui.request({ size: 'M', type: 'task.create', title: 'Repeated verdict evidence' });
  const item = (created.value as { item: { id: string } }).item.id;
  for (let i = 0; i < verdictCount; i++) {
    const result = await ui.request({ type: 'task.comment', item, text: 'Evidence pending resolution.', verdict: { verdict: 'review', scope: 'full', result: i % 2 ? 'clear' : 'not clear', run: `storm-${i}` }, as: { name: 'rev', role: 'reviewer' } });
    assert.equal(result.ok, true, result.error);
  }
  const launched = await ui.request({ type: 'session.launch', name: 'impl-1', role: 'implementer', harness: 'claude-code' }, 30_000);
  assert.equal(launched.ok, true, launched.error);
  const peer = await inProcessSpoke(t, { discover: true, cwd: root, name: 'impl-1', sessionId: (launched.value as { process: { sessionId: string } }).process.sessionId, role: 'implementer' });
  await peer.waitForPresence(['impl-1']);
  fakes['claude-code']!.idle('impl-1');
  await clock.advance(101);
  await ui.waitFor(f => f.type === 'event' && (f.row as { text?: string })?.text?.includes('idle 1 min') === true);
  fakes['claude-code']!.crash('impl-1');
  const death = await ui.waitFor(f => f.type === 'event' && (f.row as { text?: string })?.text?.includes('impl-1 died') === true);
  assert.equal((death.row as { warning?: boolean }).warning, true);
  const events = (await ui.request({ type: 'events.list' })).value as EventsPage;
  assert.ok(events.rows.some(r => r.kind === 'verdict'));
  const ib = (await ui.request({ type: 'inbox.list' })).value as Inbox;
  assert.equal('notifications' in ib, false);
  assert.equal(ib.needsYou, 0);
  assert.equal(((await ui.request({ type: 'hub.status' })).value as { needsYou: number }).needsYou, 0);
}
