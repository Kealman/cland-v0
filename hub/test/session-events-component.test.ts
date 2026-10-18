// T2: same-title hub rules through real socket/MCP edges and in-process peers; native flow in scenarios/message-tracer and crew-launch.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectWsUi, inProcessSpoke, startHub } from './harness.ts';
import type { Presence } from '../src/protocol.ts';

const presence = (f: Record<string, unknown>): Presence[] => f.sessions as Presence[];

test('presence events follow hello, status, role, rename and the last spoke leaving', async (t) => {
  const hub = await startHub();
  t.after(() => hub.close());
  const ui = await connectWsUi(t, hub);
  await ui.request({ type: 'subscribe' });
  const spoke = await inProcessSpoke(t, { hub, name: 'manual', sessionId: 'manual-id', role: 'coordinator' });
  t.after(() => spoke.close());
  await spoke.waitForPresence(['manual']);
  await ui.waitFor((f) => f.type === 'presence' && presence(f).some((s) => s.name === 'manual' && s.role === 'coordinator'));
  await spoke.call('status', { text: 'working on T-71' });
  await ui.waitFor((f) => f.type === 'presence' && presence(f).some((s) => s.status === 'working on T-71'));
  await ui.request({ type: 'role.set', session: 'manual', role: 'reviewer' });
  await ui.waitFor((f) => f.type === 'presence' && presence(f).some((s) => s.name === 'manual' && s.role === 'reviewer'));
  await ui.request({ type: 'role.set', session: 'manual', role: 'coordinator' });
  await spoke.call('rename', { name: 'renamed' });
  await ui.waitFor((f) => f.type === 'presence' && presence(f).some((s) => s.name === 'renamed' && s.sessionId === 'manual-id'));
  const second = await inProcessSpoke(t, { hub, name: 'renamed', sessionId: 'manual-id' });
  t.after(() => second.close());
  await second.waitForPresence(['renamed']);
  const mark = ui.frames.length;
  await spoke.close();
  await second.call('who');
  assert.equal(ui.frames.slice(mark).filter((f) => f.type === 'presence').length, 0, 'another spoke keeps the session present');
  await second.close();
  await ui.waitFor((f) => f.type === 'presence' && presence(f).length === 0);
});
