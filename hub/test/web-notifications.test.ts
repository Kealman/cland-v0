// T1: reusable notification policy; browser delivery is covered at the Web seam.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inboxNotifications, shouldNotify, finishedNotification } from '../../web/src/notification-rules.ts';
import type { Inbox } from '../../shared/wire/index.ts';

test('a now ask names its session, item and question with a stable row target', () => {
  const inbox: Inbox = { asks: [{ id: 'ask-1', layer: 'now', from: 'worker', label: 'worker [Implementer]', topic: { id: 'topic-1', title: 'Build', item: 'T-8' }, question: 'Ship the plan?', options: [], free: true, ts: '', since: '' }], approvals: [], plans: [], requests: [], messages: [], waiting: [], needsYou: 1 };
  const [notice] = inboxNotifications(inbox);
  assert.deepEqual(notice, { kind: 'needsYou', tag: 'ask-1', title: 'worker · T-8', body: 'Ship the plan?', target: { area: 'Inbox', id: 'ask-1' }, layer: 'now' });
  assert.equal(shouldNotify(notice!, { needsYou: true, finished: false, permission: 'granted', visible: false, focused: true }), true);
});

test('notification policy suppresses looking, disabled, ungranted and non-now rows', () => {
  const notice = { kind: 'needsYou' as const, tag: 'a', title: 'worker · T-8', body: 'Ship?', target: { area: 'Inbox' as const, id: 'a' }, layer: 'now' as const };
  const enabled = { needsYou: true, finished: true, permission: 'granted', visible: false, focused: false };
  assert.equal(shouldNotify(notice, { ...enabled, visible: true, focused: true }), false);
  assert.equal(shouldNotify(notice, { ...enabled, needsYou: false }), false);
  for (const permission of ['default', 'denied']) assert.equal(shouldNotify(notice, { ...enabled, permission }), false);
  for (const layer of ['watch', 'background', 'archive', undefined] as const) assert.equal(shouldNotify({ ...notice, layer }, enabled), false);
  assert.equal(shouldNotify(notice, { ...enabled, visible: true, focused: false }), true);
});

test('approval, plan, request and message notifications name the available session and work facts', () => {
  const inbox: Inbox = { asks: [], approvals: [{ id: 'approval-1', layer: 'now', session: 'worker', sessionId: 'sid', label: 'worker', harness: 'codex', kind: 'command', subject: { command: 'npm test' }, choices: ['once', 'deny'], answerIn: 'hub', attach: null, since: '', topic: 'topic-1', state: 'pending' }], plans: [{ id: 'E-9', subject: 'E-9', title: 'Build plan', since: '', layer: 'now' }], requests: [{ id: 'request-1', layer: 'now', from: 'reviewer', request: 'review', subject: 'T-8', topic: { id: 'topic-1', title: 'Build', item: 'T-8' }, text: 'Review this change', ts: '', since: '' }], messages: [{ id: 'message-1', layer: 'now', from: 'coord', subject: 'T-8', topic: { id: 'topic-1', title: 'Build', item: 'T-8' }, text: 'Choose the branch', ts: '', since: '' }], waiting: [], needsYou: 4 };
  const notices = inboxNotifications(inbox, { topics: [{ id: 'topic-1', item: 'T-8' }], items: [{ id: 'E-9', claim: { session: 'planner' }, assignee: null }] });
  assert.deepEqual(notices.map(({ title, body, tag }) => ({ title, body, tag })), [
    { title: 'worker · T-8', body: 'npm test', tag: 'approval-1' },
    { title: 'planner · E-9', body: 'Plan approval · Build plan', tag: 'E-9' },
    { title: 'reviewer · T-8', body: 'Review this change', tag: 'request-1' },
    { title: 'coord · T-8', body: 'Choose the branch', tag: 'message-1' },
  ]);
});


test('finished uses the task pre-transition layer and session, never a container or an already done row', () => {
  const previous = { id: 'T-8', kind: 'task', title: 'Build', status: 'in progress', layer: 'now', claim: { session: 'worker' }, assignee: null } as const;
  const done = { ...previous, status: 'done', layer: 'background', claim: null } as const;
  assert.deepEqual(finishedNotification(previous, done), { kind: 'finished', tag: 'T-8', title: 'worker · T-8', body: 'Finished · Build', target: { area: 'Items', id: 'T-8' }, layer: 'now' });
  assert.equal(finishedNotification({ ...previous, layer: 'watch' }, done), undefined);
  assert.equal(finishedNotification(done, done), undefined);
  assert.equal(finishedNotification(undefined, done), undefined);
  assert.equal(finishedNotification({ ...previous, kind: 'epic' }, { ...done, kind: 'epic' }), undefined);
});

test('worker notification clicks focus and message a window or open the exact row without a fetch handler', async () => {
  const { readFile } = await import('node:fs/promises');
  const { runInNewContext } = await import('node:vm');
  const source = await readFile(new URL('../../web/public/sw.js', import.meta.url), 'utf8');
  const handlers = new Map<string, (event: unknown) => void>();
  const calls: unknown[] = [];
  let windows: unknown[] = [{ focus: async () => { calls.push('focus'); }, postMessage: (data: unknown) => calls.push(data) }];
  runInNewContext(source, { URL, self: {
    location: { origin: 'https://cland.example' },
    addEventListener: (type: string, handler: (event: unknown) => void) => handlers.set(type, handler),
    clients: { matchAll: async () => windows, openWindow: async (url: string) => calls.push(url) },
  } });
  assert.equal(handlers.has('fetch'), false);
  const target = { area: 'Inbox', id: 'ask 1/&' };
  let receipt: Promise<unknown> | undefined;
  const click = () => handlers.get('notificationclick')!({ notification: { data: target, close: () => calls.push('close') }, waitUntil: (work: Promise<unknown>) => { receipt = work; } });
  click(); await receipt;
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), ['close', 'focus', { type: 'notification-open', target }]);
  calls.length = 0; windows = [];
  click(); await receipt;
  assert.deepEqual(calls, ['close', 'https://cland.example/?area=inbox&row=ask+1%2F%26']);
});
