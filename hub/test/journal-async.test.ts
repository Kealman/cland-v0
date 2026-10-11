import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { open, readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { join } from 'node:path';
import { Journal, readJournal } from '../src/hub/journal.ts';
import { HubCore } from '../src/hub/core.ts';
import { serveProject } from '../src/hub/daemon.ts';
import { BUDGET_MS, RequestGuard } from '../src/hub/budget.ts';
import { eventually, tempProject } from './harness.ts';

test('Core journals released digest membership, message kinds and batch control transitions', async t => {
  const root = await tempProject(t);
  const path = join(root, 'journal.jsonl');
  const journal = new Journal(path);
  t.after(() => journal.close());
  const core = new HubCore({ log: journal.tap(() => {}) });
  t.after(() => core.store.close());
  core.store.ensureTopic('reports', 'Reports', false, new Date().toISOString());
  const receiver = core.hello({ type: 'hello', protocol: 2, sessionId: 'receiver', name: 'receiver', role: 'coordinator', cwd: '/' }, () => true);
  assert.ok(receiver.ok);
  const note = core.sendFromSession('sender', ['receiver'], 'private note text', undefined, undefined, undefined, { role: 'implementer' }, undefined, 'progress').message;
  const trigger = core.sendFromSession('sender', ['receiver'], 'private report text', undefined, 'reports', undefined, { role: 'implementer' }).message;
  core.ack(receiver.connection, trigger.id);
  core.markUncertain(trigger.id, 'receiver', 'no answer');
  core.retryUncertain(trigger.id, 'receiver');
  core.deleteTopic('reports');
  const next = core.sendFromSession('sender', ['receiver'], 'next report', undefined, undefined, undefined, { role: 'implementer' }).message;
  core.ack(receiver.connection, next.id);
  core.markInjected(next.id, 'receiver');
  await journal.flush();
  const records = readJournal(path);
  const released = records.find(r => r.event === 'digest-released');
  assert.equal(released?.trigger, trigger.id);
  assert.deepEqual(released?.notes, [note.id]);
  assert.deepEqual(released?.reheld, [note.id]);
  assert.equal(records.find(r => r.event === 'send' && r.id === note.id)?.kind, 'progress');
  assert.equal(records.find(r => r.event === 'send' && r.id === trigger.id)?.kind, 'report');
  for (const id of [note.id, trigger.id]) {
    assert.ok(records.some(r => r.event === 'acked' && r.id === id));
    assert.ok(records.some(r => r.event === 'inject-uncertain' && r.id === id));
  }
  assert.ok(records.some(r => r.event === 'inject-retry' && r.id === trigger.id));
  for (const id of [note.id, next.id]) assert.ok(records.some(r => r.event === 'injected' && r.id === id));
  assert.equal(JSON.stringify(records).includes('private note text'), false);
});

test('concurrent producers preserve call order and timestamps through short async appends and close', async t => {
  const root = await tempProject(t);
  const path = join(root, 'journal.jsonl');
  const journal = new Journal(path, () => new Date('2026-10-09T00:00:00Z'), { open: async path => {
    const file = await open(path, 'a+');
    const write = file.write.bind(file);
    t.mock.method(file, 'write', async (buffer: Buffer, offset: number, length: number) => write(buffer, offset, Math.min(length, 3)));
    return file;
  } });
  await Promise.all(Array.from({ length: 20 }, async (_, i) => {
    await Promise.resolve();
    const record = { event: 'send', id: i, text: 'original' };
    journal.write(record);
    record.text = 'changed after acceptance';
  }));
  const closing = journal.close();
  assert.equal(journal.close(), closing, 'all closers share the same drain');
  journal.write({ event: 'after-close' });
  await closing;
  assert.deepEqual(readJournal(path).map(r => [r.id, r.ts, r.text]), Array.from({ length: 20 }, (_, i) => [i, '2026-10-09T00:00:00.000Z', 'original']));
});

test('a partial write failure is reported once, rejects close, and a restart repairs the tail before later records', async t => {
  const root = await tempProject(t);
  const path = join(root, 'journal.jsonl');
  const reports: Array<Record<string, unknown>> = [];
  const journal = new Journal(path, undefined, { log: entry => reports.push(entry), open: async path => {
    const file = await open(path, 'a+');
    const write = file.write.bind(file);
    let calls = 0;
    t.mock.method(file, 'write', async (buffer: Buffer, offset: number, length: number) => {
      if (++calls > 1) throw new Error('disk full');
      return write(buffer, offset, Math.min(length, 8));
    });
    return file;
  } });
  journal.write({ event: 'incomplete' });
  journal.write({ event: 'must-not-follow-fragment' });
  await assert.rejects(journal.flush(), /disk full/);
  await assert.rejects(journal.close(), /disk full/);
  assert.deepEqual(reports.map(r => r.event), ['journal-failed']);
  assert.equal(await readFile(path, 'utf8'), '{"ts":"2');
  const restarted = new Journal(path);
  restarted.write({ event: 'recovered' });
  await restarted.close();
  assert.deepEqual(readJournal(path).map(r => r.event), ['recovered']);
  assert.equal((await readFile(path, 'utf8')).split('\n')[0], '{"ts":"2');
});

test('SIGKILL loses accepted records still queued behind an unfinished append; a restart keeps completed lines', async t => {
  const root = await tempProject(t);
  const path = join(root, 'journal.jsonl');
  const source = `
    import { open } from 'node:fs/promises';
    import { Journal } from ${JSON.stringify(new URL('../src/hub/journal.ts', import.meta.url).href)};
    const journal = new Journal(${JSON.stringify(path)}, undefined, { open: async path => {
      const file = await open(path, 'a+');
      const nativeWrite = file.write.bind(file);
      file.write = async (buffer, offset, length) => {
        if (buffer.toString().includes('pending')) {
          process.stdout.write('blocked\\n');
          await new Promise(() => {});
        }
        return nativeWrite(buffer, offset, length);
      };
      return file;
    } });
    journal.write({ event: 'completed' });
    journal.write({ event: 'pending' });
    journal.write({ event: 'queued' });
    setInterval(() => {}, 1000);
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', source], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => child.kill('SIGKILL'));
  let output = '';
  let errors = '';
  child.stdout.on('data', bytes => { output += String(bytes); });
  child.stderr.on('data', bytes => { errors += String(bytes); });
  await eventually('child blocked after accepting all records', () => output.includes('blocked') ? true : undefined);
  const exited = once(child, 'exit');
  child.kill('SIGKILL');
  await exited;
  assert.equal(errors, '');
  assert.deepEqual(readJournal(path).map(r => r.event), ['completed']);
  const restarted = new Journal(path);
  restarted.write({ event: 'restarted' });
  await restarted.close();
  assert.deepEqual(readJournal(path).map(r => r.event), ['completed', 'restarted']);
});

test('a delayed journal append is outside request blocking time, and daemon stop drains accepted audits and hub-stopped', async t => {
  const root = await tempProject(t);
  const records: Array<Record<string, unknown>> = [];
  let release!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const writing = new Promise<void>(resolve => { entered = resolve; });
  t.after(() => release());
  const daemon = await serveProject(root, { listen: 'never', log: entry => records.push(entry), journalOpen: async path => {
    const file = await open(path, 'a+');
    const write = file.write.bind(file);
    t.mock.method(file, 'write', async (buffer: Buffer, offset: number, length: number) => {
      if (buffer.toString().includes('"event":"audit"')) { entered(); await gate; }
      return write(buffer, offset, length);
    });
    return file;
  } });
  t.after(() => daemon.stop());
  const answers: Array<Record<string, unknown>> = [];
  const conversation = daemon.hub.dispatcher.open({ send: frame => answers.push(frame), close: () => {}, isOpen: () => true }, { authenticated: false, edge: 'stdio' });
  conversation.receive(JSON.stringify({ type: 'hello', protocol: 2, secret: (await readFile(daemon.layout.secret, 'utf8')).trim(), client: 'timed' }));
  const began = performance.now();
  conversation.receive(JSON.stringify({ type: 'role.list', id: 'first' }));
  await writing;
  assert.equal(answers.find(frame => frame.id === 'first')?.ok, true);
  conversation.receive(JSON.stringify({ type: 'hub.status', id: 'other' }));
  const other = await eventually('status answers while the journal disk operation waits', () => answers.find(frame => frame.id === 'other'));
  assert.equal(other.ok, true, 'another request answers while the journal disk operation waits');
  assert.ok(performance.now() - began < BUDGET_MS, 'enqueuing two audit records stays inside the request budget');
  assert.deepEqual(records.filter(r => r.event === 'slow-request'), []);
  conversation.closed();
  let stopped = false;
  const stopping = daemon.stop().then(() => { stopped = true; });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(stopped, false, 'the lock and stopped result await journal drain');
  release();
  await stopping;
  const lines = readJournal(join(root, '.cland', 'journal.jsonl'));
  assert.deepEqual(lines.filter(r => r.event === 'audit').map(r => r.tool), ['role.list', 'hub.status']);
  assert.equal(lines.at(-1)?.event, 'hub-stopped');
});

test('daemon stop releases its project lock even when the journal cannot flush', async t => {
  const root = await tempProject(t);
  const daemon = await serveProject(root, { listen: 'never', journalOpen: async () => { throw new Error('cannot open journal'); } });
  await assert.rejects(daemon.stop(), /cannot open journal/);
  const successor = await serveProject(root, { listen: 'never' });
  await successor.stop();
});

test('a deferred append failure logger is timed once as resumed request work, excluding disk wait', async () => {
  let clock = 0;
  const records: Array<Record<string, unknown>> = [];
  const guard = new RequestGuard({ now: () => clock, log: entry => records.push(entry) });
  let fail!: (error: Error) => void;
  let entered!: () => void;
  const writing = new Promise<void>(resolve => { entered = resolve; });
  const journal = new Journal('/memory', undefined, { guard, log: entry => { clock += 400; records.push(entry); }, open: async () => ({
    stat: async () => ({ size: 0 }), read: async () => ({ bytesRead: 0 }), close: async () => {},
    write: async () => { entered(); return new Promise<{ bytesWritten: number }>((_, reject) => { fail = reject; }); },
  }) });
  guard.measure('task.list', 'timed-client', () => journal.write({ event: 'audit' }));
  await writing;
  clock += 10_000;
  assert.equal(guard.counters.slow, 0, 'waiting on disk does not charge the event loop');
  fail(new Error('disk full'));
  await assert.rejects(journal.close(), /disk full/);
  assert.equal(guard.counters.slow, 1);
  assert.deepEqual(records.filter(entry => entry.event === 'slow-request').map(entry => [entry.tool, entry.client, entry.phase, entry.ms]), [['task.list', 'timed-client', 'resumed', 400]]);
});

test('the daemon shares journal continuation costs with dispatch counters shown by hub.status', async t => {
  const root = await tempProject(t);
  const records: Array<Record<string, unknown>> = [];
  const daemon = await serveProject(root, { listen: 'never', log: entry => {
    records.push(entry);
    if (entry.event === 'journal-failed') {
      const until = performance.now() + 400;
      while (performance.now() < until) { /* the review's slow failure consumer */ }
    }
  }, journalOpen: async path => {
    const file = await open(path, 'a+');
    const nativeWrite = file.write.bind(file);
    t.mock.method(file, 'write', async (buffer: Buffer, offset: number, length: number) => {
      if (buffer.toString().includes('"event":"audit"')) throw new Error('disk full');
      return nativeWrite(buffer, offset, length);
    });
    return file;
  } });
  t.after(async () => { await assert.rejects(daemon.stop(), /disk full/); });
  const answers: Array<Record<string, unknown>> = [];
  const conversation = daemon.hub.dispatcher.open({ send: frame => answers.push(frame), close: () => {}, isOpen: () => true }, { authenticated: false, edge: 'stdio' });
  t.after(() => conversation.closed());
  conversation.receive(JSON.stringify({ type: 'hello', protocol: 2, secret: (await readFile(daemon.layout.secret, 'utf8')).trim(), client: 'review-probe' }));
  conversation.receive(JSON.stringify({ type: 'role.list', id: 'first' }));
  await eventually('failure continuation timed', () => records.some(entry => entry.event === 'slow-request' && entry.tool === 'role.list') ? true : undefined);
  const slow = records.filter(entry => entry.event === 'slow-request' && entry.tool === 'role.list');
  assert.equal(slow.length, 1);
  assert.equal(slow[0]?.phase, 'resumed');
  assert.equal(slow[0]?.client, 'review-probe');
  conversation.receive(JSON.stringify({ type: 'hub.status', id: 'status' }));
  const result = await eventually('status exposes journal continuation counters', () => answers.find(frame => frame.id === 'status'));
  assert.ok((result?.value as { requests: { slow: number } }).requests.slow >= 1);
});

test('a synchronous close initiation error and its failure report share one resumed scope', async () => {
  let clock = 0;
  const guard = new RequestGuard({ now: () => clock });
  const journal = new Journal('/memory', undefined, { guard, log: () => { clock += 150; }, open: async () => ({
    stat: async () => ({ size: 0 }), read: async () => ({ bytesRead: 0 }), write: async (_, __, length) => ({ bytesWritten: length }),
    close: () => { clock += 150; throw new Error('cannot close'); },
  }) });
  await assert.rejects(journal.close(), /cannot close/);
  assert.equal(clock, 300);
  assert.equal(guard.counters.slow, 1);
  assert.equal(guard.counters.lastSlow?.ms, 300);
});

for (const boundary of ['open', 'stat', 'read', 'write', 'short-write'] as const) {
  test(`a synchronous ${boundary} initiation error and its failure report share one resumed scope`, async () => {
    let clock = 0;
    let writes = 0;
    let reports = 0;
    const guard = new RequestGuard({ now: () => clock });
    const fail = (): never => { clock += 150; throw new Error(`cannot ${boundary}`); };
    const journal = new Journal('/memory', undefined, { guard, log: () => { clock += 150; reports++; }, open: () => {
      if (boundary === 'open') fail();
      return Promise.resolve({
        stat: () => boundary === 'stat' ? fail() : Promise.resolve({ size: boundary === 'read' ? 1 : 0 }),
        read: () => fail(), close: async () => {},
        write: (_, __, length) => {
          if (boundary === 'write' || ++writes > 1) fail();
          return Promise.resolve({ bytesWritten: Math.min(length, 1) });
        },
      });
    } });
    guard.measure('task.list', 'timed-client', () => journal.write({ event: 'audit' }));
    await assert.rejects(journal.close(), new RegExp(`cannot ${boundary}`));
    assert.equal(clock, 300);
    assert.equal(reports, 1);
    assert.equal(guard.counters.slow, 1);
    assert.equal(guard.counters.lastSlow?.ms, 300);
  });
}
