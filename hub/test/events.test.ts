// T2: same-title hub rules through real socket/MCP edges and in-process peers; native flow in scenarios/message-tracer and crew-launch.
import { completeJournalLines } from './journal-lines.ts';
import assert from 'node:assert/strict';
import { mkdir, open, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import type { EventRow, EventsPage } from '../src/protocol.ts';
import { connectUi, inProcessSpoke, projectHub, tempProject } from './harness.ts';

test('a real spoke verdict produces one event on pushes and journal pages, including after restart', async t => {
  let stop = async () => {};
  t.after(() => stop());
  const root = await tempProject(t);
  let daemon = await projectHub(t, root, {}, { log: () => {} });
  stop = () => daemon.stop();
  let ui = await connectUi(t, daemon.discovery!);
  stop = async () => { ui.close(); await daemon.stop(); };
  await ui.request({ type: 'subscribe' });
  const created = await ui.request({ size: 'M', type: 'task.create', title: 'One verdict, one row' });
  const item = (created.value as { item: { id: string } }).item.id;
  const spoke = await inProcessSpoke(t, { discover: true, cwd: root, name: 'rev', role: 'reviewer' });
  t.after(() => spoke.close());
  await spoke.waitForPresence(['rev']);
  for (const result of ['not clear', 'clear'] as const) {
    const start = ui.frames.length;
    const verdict = await spoke.call<{ ok: boolean }>('task.comment', { id: item, text: 'Check the fold.', verdict: 'review', scope: 'full', result, run: `one-row-${result.replace(' ', '-')}` });
    assert.equal(verdict.ok, true, JSON.stringify(verdict));
    assert.equal((await ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
    const pushed = ui.frames.slice(start).filter(f => f.type === 'event' && (f.row as EventRow)?.kind === 'verdict');
    assert.equal(pushed.length, 1, JSON.stringify(pushed.map(f => f.row)));
    const page = (await ui.request({ type: 'events.list', filter: { kinds: ['verdict'] } })).value as EventsPage;
    assert.equal(page.rows.filter(r => r.text.includes(`review ${result} ·`)).length, 1, JSON.stringify(page.rows));
  }
  // Keep both durable source records: other subscribers still receive the task announcement.
  const journal = completeJournalLines(await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).filter(Boolean).map(line => JSON.parse(line));
  assert.equal(journal.filter(r => r.event === 'notification' && r.kind === 'verdict').length, 2);
  assert.equal(journal.filter(r => r.event === 'event-announced' && r.text?.includes('verdict posted')).length, 2);
  const before = (await ui.request({ type: 'events.list', filter: { kinds: ['verdict'] } })).value as EventsPage;
  assert.equal(before.rows.length, 2);
  assert.equal(before.rows.filter(r => r.warning).length, 1);
  await spoke.close();
  await stop();
  daemon = await projectHub(t, root, {}, { log: () => {} });
  stop = () => daemon.stop();
  ui = await connectUi(t, daemon.discovery!);
  stop = async () => { ui.close(); await daemon.stop(); };
  const after = (await ui.request({ type: 'events.list', filter: { kinds: ['verdict'] } })).value as EventsPage;
  assert.deepEqual(after.rows, before.rows);
  const warnings = (await ui.request({ type: 'events.list', filter: { warnings: true } })).value as EventsPage;
  assert.equal(warnings.rows.filter(r => r.kind === 'verdict').length, 1);
});

test('old paired verdict records count once across filtered pages while file-authored verdicts remain visible', async t => {
  let stop = async () => {};
  t.after(() => stop());
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const records: Record<string, unknown>[] = ['first', 'second', 'clear'].flatMap(run => {
    const result = run === 'clear' ? 'clear' : 'not clear';
    return [
      { event: 'event-announced', kind: 'task', subject: { item: 'T-5' }, verdict: { verdict: 'review', result, run }, text: `T-5 verdict posted review ${result} · ${run}` },
      { event: 'notification', kind: 'verdict', item: 'T-5', session: 'rev', result, text: `T-5 review ${result} · rev [reviewer] · run ${run}` },
    ];
  });
  records.push({ event: 'event-announced', kind: 'task', subject: { item: 'T-5' }, verdict: { verdict: 'review', result: 'not clear', run: 'file', source: 'file' }, text: 'T-5 verdict posted review not clear · file' });
  await writeFile(join(root, '.cland/journal.jsonl'), records.map(r => JSON.stringify({ ts: '2026-10-12T10:00:00Z', ...r })).join('\n') + '\n');
  const daemon = await projectHub(t, root, {}, { log: () => {} });
  stop = () => daemon.stop();
  const ui = await connectUi(t, daemon.discovery!);
  stop = async () => { ui.close(); await daemon.stop(); };
  const page = (await ui.request({ type: 'events.list', filter: { kinds: ['verdict'] } })).value as EventsPage;
  assert.equal(page.rows.length, 4);
  assert.ok(page.rows.every(r => !r.count), 'paired records are one verdict, not a burst of two');
  const warnings = (await ui.request({ type: 'events.list', filter: { warnings: true } })).value as EventsPage;
  assert.equal(warnings.rows.length, 3);
  const paged: EventRow[] = [];
  let before: string | undefined;
  do {
    const p = (await ui.request({ type: 'events.list', limit: 1, before, filter: { kinds: ['verdict'] } })).value as EventsPage;
    paged.push(...p.rows);
    before = p.more ? p.before! : undefined;
  } while (before);
  assert.deepEqual(paged, page.rows);
});

// Seed at the filesystem boundary, before the real hub starts. Never extend the shared harness.
async function seedJournal(root: string, count: number) {
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/journal.jsonl'), Array.from({ length: count }, (_, i) => JSON.stringify({ ts: new Date(Date.parse('2026-10-12T10:00:00Z') - (count - i) * 61000).toISOString(), event: 'task-claimed', item: 'T-1', session: `worker-${i}` }) + '\n').join(''));
}

test('events.list reads the tail and pages without repeats or gaps while a real spoke appends events', async t => {
  // Stop the in-process hub before the fixture removes its live directory,
  // including when an assertion or UI connection fails.
  let stop = async () => {};
  t.after(() => stop());
  const root = await tempProject(t);
  await seedJournal(root, 135000);
  let bytes = 0;
  const daemon = await projectHub(t, root, {}, { log: () => {}, journalOpen: async path => {
    const file = await open(path, 'a+');
    return { stat: () => file.stat(), close: () => file.close(), write: (b, o, l) => file.write(b, o, l), read: async (b, o, l, p) => { const r = await file.read(b, o, l, p); bytes += r.bytesRead; return r; } };
  } });
  stop = () => daemon.stop();
  const ui = await connectUi(t, daemon.discovery!);
  stop = async () => { ui.close(); await daemon.stop(); };
  await ui.request({ type: 'subscribe' });
  bytes = 0;
  const start = performance.now();
  const result = await ui.request({ type: 'events.list' });
  assert.equal(result.ok, true, result.error);
  const page = result.value as EventsPage;
  assert.equal(page.rows.length, 200);
  assert.equal(page.rows[0]?.text, 'T-1 claimed by worker-134999');
  assert.equal(page.more, true);
  assert.ok(bytes < 128 * 1024, `tail read ${bytes} bytes`);
  assert.ok(performance.now() - start < 1000);
  const spoke = await inProcessSpoke(t, { discover: true, cwd: root, name: 'worker', role: 'implementer' });
  t.after(() => spoke.close());
  await spoke.waitForPresence(['worker']);
  await spoke.call('status', { text: 'ready for events' });
  const pushed = await ui.waitFor(f => f.type === 'event' && (f.row as { subject?: { id: string } })?.subject?.id === 'worker');
  assert.equal((pushed.row as { kind: string }).kind, 'session');
  const older = (await ui.request({ type: 'events.list', before: page.before, limit: 200 })).value as EventsPage;
  assert.equal(older.rows.length, 200);
  assert.equal(older.rows[0]?.text, 'T-1 claimed by worker-134799');
  assert.equal(older.rows[199]?.text, 'T-1 claimed by worker-134600');
  assert.equal(new Set([...page.rows, ...older.rows].map(r => r.id)).size, 400);
  const lower = (await ui.request({ type: 'events.list', limit: 2 })).value as EventsPage;
  assert.equal(lower.rows.length, 2);
});

test('events.list maps all eight kinds and usable legacy records, and persists a spoke artifact without subscribers', async t => {
  // Stop the in-process hub before the fixture removes its live directory,
  // including when an assertion or UI connection fails.
  let stop = async () => {};
  t.after(() => stop());
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const records = [
    { event: 'session-launched', session: 'legacy' },
    { event: 'session-stopped', session: 'legacy' },
    { event: 'harness-exited', session: 'dead' },
    { event: 'role-handover', from: 'old', to: 'new', role: 'coordinator' },
    { event: 'notification', kind: 'role', session: 'new-no-note', text: 'old handed the Coordinator role over to new-no-note, with no note.' },
    { event: 'task-claimed', id: 'T-2', session: 'legacy' },
    { event: 'task-merged', id: 'T-2', session: 'legacy', base: 'dev' },
    { event: 'topic-created', topic: 'topic-old', title: 'Legacy topic' },
    { event: 'topic-status', topic: 'topic-old', from: 'open', to: 'closed' },
    { event: 'notification', kind: 'verdict', item: 'T-2', session: 'rev', result: 'not clear', text: 'review not clear' },
    { event: 'released', version: '0.1.1' },
    { event: 'suite-result', branch: 't/T-2', item: 'T-2', mode: 'full', outcome: { code: 1 }, counts: 'tests 10; pass 9; fail 1' },
    { event: 'verification-timing', branch: 'dev' }, // older suites lack their result
    { event: 'event-announced', kind: 'usage', subject: { session: 'legacy' }, text: 'legacy cost threshold 25 crossed' },
    { event: 'event-announced', kind: 'artifact', subject: { topic: 'general' }, artifact: 'A-99', topic: 'general', text: 'A-99 created · notes' },
    { event: 'send', text: 'ordinary messages stay in topics' },
  ];
  await writeFile(join(root, '.cland/journal.jsonl'), records.map(r => JSON.stringify({ ts: '2026-10-12T10:00:00Z', ...r })).join('\n') + '\n');
  const daemon = await projectHub(t, root, {}, { log: () => {} });
  stop = () => daemon.stop();
  const ui = await connectUi(t, daemon.discovery!);
  stop = async () => { ui.close(); await daemon.stop(); };
  const initial = (await ui.request({ type: 'events.list' })).value as EventsPage;
  assert.deepEqual(new Set(initial.rows.map(r => r.kind)), new Set(['session', 'task', 'topic', 'verdict', 'release', 'suite', 'usage', 'artifact']));
  assert.equal(initial.rows.length, 14);
  assert.equal(initial.rows.find(r => r.subject.id === 'dead')?.glyph, '⚠');
  assert.equal(initial.rows.find(r => r.text === 'review not clear')?.glyph, '⚠');
  assert.match(initial.rows.find(r => r.kind === 'suite')!.text, /t\/T-2 · failed · tests 10; pass 9; fail 1/);
  assert.equal(initial.rows.find(r => r.subject.id === 'new')?.glyph, '⇄');
  assert.equal(initial.rows.find(r => r.subject.id === 'new-no-note')?.glyph, '⇄');
  assert.match(initial.rows.find(r => r.text.includes('topic-old closed'))!.text, /closed/);
  const spoke = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => spoke.close());
  await spoke.waitForPresence(['coord']);
  const result = await spoke.call<{ ok: boolean; id: string }>('artifact.create', { kind: 'note', title: 'Journal evidence', topic: 'general', content: 'persistent content' });
  assert.equal(result.ok, true, JSON.stringify(result));
  const after = (await ui.request({ type: 'events.list', limit: 500 })).value as EventsPage;
  const created = after.rows.filter(r => r.kind === 'artifact' && r.subject.id === result.id);
  assert.equal(created.filter(r => r.text.includes(' created ')).length, 1, JSON.stringify(created));
  assert.equal(created[0]?.topic, 'general');
  await ui.request({ type: 'subscribe' });
  await spoke.call('artifact.create', { kind: 'note', title: 'Live journal evidence', topic: 'general', content: 'live' });
  const live = (await ui.waitFor(f => f.type === 'event' && (f.row as { text?: string })?.text?.includes('Live journal evidence') === true)).row as import('../src/protocol.ts').EventRow;
  const listed = (await ui.request({ type: 'events.list' })).value as EventsPage;
  assert.deepEqual(listed.rows.find(r => r.id === live.id), live, 'push and journal page have the same row identity and shape');
});

test('events pages clamp limits, cross UTF-8 block boundaries and terminate at the first row, skipping damaged records', async t => {
  // Stop the in-process hub before the fixture removes its live directory,
  // including when an assertion or UI connection fails.
  let stop = async () => {};
  t.after(() => stop());
  const root = await tempProject(t);
  await seedJournal(root, 205);
  const file = await open(join(root, '.cland/journal.jsonl'), 'a');
  await file.write('damaged journal line\n' + JSON.stringify({ ts: '2026-10-12T12:00:00Z', event: 'event-announced', kind: 'task', subject: { item: 'T-3' }, text: 'boundary ' + '✓'.repeat(16000) }) + '\n');
  await file.close();
  const daemon = await projectHub(t, root, {}, { log: () => {} });
  stop = () => daemon.stop();
  const ui = await connectUi(t, daemon.discovery!);
  stop = async () => { ui.close(); await daemon.stop(); };
  const page = (await ui.request({ type: 'events.list', limit: 900 })).value as EventsPage;
  assert.equal(page.rows.length, 200);
  assert.equal(page.rows[0]?.text, 'boundary ' + '✓'.repeat(16000));
  const end = (await ui.request({ type: 'events.list', before: page.before })).value as EventsPage;
  assert.equal(end.rows.length, 6);
  assert.equal(end.rows.at(-1)?.text, 'T-1 claimed by worker-0');
  assert.equal(end.more, false);
  const empty = (await ui.request({ type: 'events.list', before: end.before })).value as EventsPage;
  assert.deepEqual(empty, { rows: [], before: null, more: false });
  assert.equal((await ui.request({ type: 'events.list', before: '900000000' })).ok, false);
});

test('inbox retires notifications and dismissal frames while verdicts and role changes remain events', async t => {
  const { projectHub, cland } = await import('./harness.ts');
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const created = await ui.request({ size: 'M', type: 'task.create', title: 'Events replace notifications' });
  const item = (created.value as { item: { id: string } }).item.id;
  for (const result of ['clear', 'not clear']) {
    const verdict = await ui.request({ type: 'task.comment', item, text: `Review ${result}.`, verdict: { verdict: 'review', scope: 'full', result, run: `retired-${result.replace(' ', '-')}` }, as: { name: 'rev', role: 'reviewer' } });
    assert.equal(verdict.ok, true, verdict.error);
  }
  const page = (await ui.request({ type: 'events.list' })).value as EventsPage;
  assert.ok(page.rows.some(r => r.kind === 'session' && r.text.includes('coord is Coordinator')));
  assert.ok(page.rows.some(r => r.kind === 'verdict' && r.text.includes('review clear') && !r.warning));
  assert.ok(page.rows.some(r => r.kind === 'verdict' && r.text.includes('review not clear') && r.warning));
  const inbox = await ui.request({ type: 'inbox.list' });
  assert.equal('notifications' in (inbox.value as object), false);
  assert.equal((inbox.value as { needsYou: number }).needsYou, 0);
  for (const type of ['inbox.dismiss', 'inbox.dismiss_all']) {
    const refused = await ui.request({ type, notification: 'legacy' });
    assert.equal(refused.ok, false);
    assert.match(refused.error!, /events view.*events.list/);
  }
  // A legacy refusal keeps the connection usable and never clears journal rows.
  assert.equal((await ui.request({ type: 'events.list' })).ok, true);
  const cli = await cland(root, 'inbox');
  assert.equal(cli.code, 0, cli.stderr);
  assert.doesNotMatch(cli.stdout, /notification:/);
  assert.ok(ui.frames.filter(f => f.type === 'inbox').every(f => !('notifications' in (f.inbox as object))));
});


test('subscription warning filter covers its first page and live rows without affecting other clients', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/journal.jsonl'), [
    { event: 'notification', kind: 'verdict', item: 'T-8', result: 'not clear', text: 'Historical warning' },
    { event: 'notification', kind: 'verdict', item: 'T-9', result: 'clear', text: 'Historical clear' },
  ].map(record => JSON.stringify({ ts: '2026-10-12T10:00:00Z', ...record }) + '\n').join(''));
  const { discovery } = await projectHub(t, root);
  const filtered = await connectUi(t, discovery);
  const all = await connectUi(t, discovery);
  assert.deepEqual((await all.request({ type: 'subscribe' })).value, { subscribed: true });
  for (const filter of [{ warnings: 'yes' }, { kinds: ['unknown'] }, { subject: { kind: 'topic', id: '' } }, null]) {
    assert.equal((await filtered.request({ type: 'subscribe', filter })).ok, false);
  }
  const subscribed = await filtered.request({ type: 'subscribe', filter: { warnings: true } });
  assert.equal(subscribed.ok, true, subscribed.error);
  const first = (subscribed.value as { events: EventsPage }).events;
  assert.deepEqual(first.rows.map(row => row.text), ['Historical warning']);
  const item = ((await all.request({ type: 'task.create', title: 'Live warnings', size: 'S' })).value as { item: { id: string } }).item.id;
  const mark = filtered.frames.length;
  for (const result of ['clear', 'not clear'] as const) {
    const received = all.waitFor(frame => frame.type === 'event' && (frame.row as EventRow).text.includes(`review ${result} ·`));
    const verdict = await all.request({ type: 'task.comment', item, text: 'Filter fixture', verdict: { verdict: 'review', scope: 'full', result, run: `filter-${result}` }, as: { name: 'rev', role: 'reviewer' } });
    assert.equal(verdict.ok, true, verdict.error);
    await received;
  }
  const warning = await filtered.waitFor(frame => frame.type === 'event' && (frame.row as EventRow).text.includes('review not clear ·'));
  await filtered.request({ type: 'topic.list' });
  assert.deepEqual(filtered.frames.slice(mark).filter(frame => frame.type === 'event'), [warning]);
  assert.equal((warning.row as EventRow).warning, true);
  const page = (await filtered.request({ type: 'events.list' })).value as EventsPage;
  assert.ok(page.rows.length >= 2);
  assert.ok(page.rows.every(row => row.warning));
  const override = (await filtered.request({ type: 'events.list', filter: {} })).value as EventsPage;
  assert.ok(override.rows.some(row => row.text === 'Historical clear'));
  const unfiltered = (await all.request({ type: 'events.list' })).value as EventsPage;
  assert.ok(unfiltered.rows.some(row => row.text === 'Historical clear'));
  assert.ok(unfiltered.rows.some(row => row.kind === 'verdict' && !row.warning));
});
