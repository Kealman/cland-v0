// T2: authenticated human answer outcomes through real frames and sealed fake adapters.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { cland, frameClient, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { sessionUi } from './session-credential-fixture.ts';
import type { Inbox, ApprovalRecord, TopicMessage } from '../src/protocol.ts';

for (const users of [false, true]) test(`answers retain authenticated attribution in ${users ? 'users' : 'single'} mode`, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Answer users');
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const journal: Record<string, unknown>[] = [];
  const hub = await projectHub(t, root, {}, { git: async args => args.includes('user.name') ? 'Jane Doe\n' : '', log: row => { journal.push(row); } });
  const local = await sessionUi(t, hub.discovery);
  if (users) { const switched = await cland(root, 'auth', 'mode', 'users'); assert.equal(switched.code, 0, switched.stderr); }
  const link = (await local.request({ type: 'web.link' })).value as { url: string };
  const response = await fetch(link.url, { redirect: 'manual' });
  let cookie = response.headers.get('set-cookie')!.split(';')[0]!;
  if (users) {
    const db = new DatabaseSync(join(root, '.cland/hub.db'));
    try {
      db.prepare('insert into users values (?,?,?,?,?,?)').run('alex-id', 'alex', 'Alex Smith', 'admin', 'active', Date.now());
      db.prepare('insert into web_sessions (id,cookie_hash,created_at,last_used_at,user_id) values (?,?,?,?,?)')
        .run('alex-session', createHash('sha256').update('alex-cookie').digest('hex'), Date.now(), Date.now(), 'alex-id');
    } finally { db.close(); }
    cookie = `${cookie.split('=')[0]}=alex-cookie`;
  }
  const origin = new URL(link.url).origin;
  const ws = new WebSocket(`${origin.replace('http:', 'ws:')}/ws`, { origin, headers: { Cookie: cookie } });
  t.after(() => ws.terminate());
  const web = frameClient(line => ws.send(line.trim()), fn => ws.on('message', data => fn(`${data}\n`)), () => ws.terminate());
  await once(ws, 'open', { signal: AbortSignal.timeout(3000) });
  const welcome = web.waitFor(f => f.type === 'welcome');
  web.send({ type: 'hello', protocol: 2, client: 'web' });
  await welcome;
  assert.equal((await web.request({ type: 'subscribe' })).ok, true);
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', sessionId: 'coord-session', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const asked = await coord.call<{ ask: string }>('ask', { topic: 'general', question: 'Proceed?', options: ['Yes'] });
  assert.ok(asked.ask, JSON.stringify(asked));
  const answered = await web.request({ type: 'topic.answer', ask: asked.ask, option: 1, userId: 'forged' });
  assert.equal(answered.ok, true, answered.error);
  const archived = (await local.request({ type: 'inbox.list', archive: true })).value as Inbox;
  const outcome = archived.archive!.find(row => row.id === asked.ask)!.outcome!;
  assert.equal(outcome.by, users ? 'alex' : 'human');
  assert.equal((outcome as { userId?: string }).userId, users ? 'alex-id' : undefined);
  const posted = (answered.value as { message: TopicMessage }).message;
  assert.equal(posted.from, outcome.by);
  assert.equal(posted.userId, (outcome as { userId?: string }).userId);
  const history = (await local.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] };
  const savedAnswer = history.messages.find(row => row.id === posted.id)!;
  assert.equal(savedAnswer.userDisplayName, users ? 'Alex Smith' : undefined);
  assert.equal(savedAnswer.from, outcome.by);
  assert.equal(savedAnswer.userId, (outcome as { userId?: string }).userId);
  const second = await local.request({ type: 'topic.answer', ask: asked.ask, option: 1 });
  assert.equal(second.ok, false);
  if (users) assert.match(second.error!, /alex/);
  assert.equal(journal.find(row => row.event === 'ask-answered' && row.id === asked.ask)?.userId, users ? 'alex-id' : undefined);
  const departure = journal.find(row => row.event === 'inbox-departure' && row.id === asked.ask)!;
  assert.equal((departure.outcome as { userId?: string }).userId, users ? 'alex-id' : undefined);
  assert.equal((await local.request({ type: 'session.launch', name: 'worker', harness: 'opencode', role: 'implementer' })).ok, true);
  const raised = web.waitFor(f => f.type === 'approval');
  hub.fakes.opencode!.raiseApproval('worker', { id: 'native', kind: 'command', subject: { command: 'echo test' }, choices: ['once', 'deny'] });
  const record = (await raised).approval as ApprovalRecord;
  const approved = await web.request({ type: 'approval.answer', approval: record.id, choice: 'once', userId: 'forged' });
  assert.equal(approved.ok, true, approved.error);
  const approval = (approved.value as { approval: ApprovalRecord }).approval;
  assert.equal(approval.outcome!.by, users ? 'alex' : 'human');
  assert.equal((approval.outcome as { userId?: string }).userId, users ? 'alex-id' : undefined);
  const approvalDeparture = journal.find(row => row.event === 'inbox-departure' && row.id === record.id)!;
  assert.equal((approvalDeparture.outcome as { userId?: string }).userId, users ? 'alex-id' : undefined);
  await web.close();
  await local.close();
});
