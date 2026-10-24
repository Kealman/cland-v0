// T1: rulebook writes, reload and numbering on the module with a fake clock; no hub or transport.
import assert from 'node:assert/strict';
import fs, { readFile, rename, writeFile, readdir } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import test, { type TestContext } from 'node:test';
import { RulebookFile } from '../src/rules/file.ts';
import { RULEBOOK_HEADER } from '../src/rules/rulebook.ts';
import { FakeClock } from './fake-clock.ts';

async function fixture(t: TestContext, beforeStop: () => void = () => {}) {
  const root = await mkdtemp(join(tmpdir(), 'cland-rulebook-'));
  const path = join(root, 'RULES.md');
  const records: Record<string, unknown>[] = [];
  const clock = new FakeClock();
  let onLog = (_entry: Record<string, unknown>) => {};
  const book = new RulebookFile(path, () => ['coordinator', 'implementer'], entry => { records.push(entry); onLog(entry); }, work => work(), clock);
  await writeFile(path, RULEBOOK_HEADER);
  t.after(async () => { beforeStop(); await book.stop(); await rm(root, { recursive: true }); });
  const add = (text = 'Numbered.') => book.add({ text, scope: 'all', reason: 'numbering', origin: 'shell' });
  return { path, root, book, clock, records, add, observe: (listener: typeof onLog) => { onLog = listener; } };
}

for (const operation of ['add', 'edit', 'retire'] as const) {
  test(`rulebook ${operation} writes exactly one final newline`, async t => {
    const { path, book, add } = await fixture(t);
    await add('First rule.');
    await add('Last sibling.');
    // Legacy rulebooks carry blank lines even when the last rule is untouched.
    await writeFile(path, (await readFile(path, 'utf8')) + '\n\n');
    if (operation === 'add') await add('New rule.');
    else if (operation === 'edit') await book.edit(1, { text: 'Edited rule.' });
    else await book.retire(1, 'superseded');
    const written = await readFile(path);
    assert.deepEqual(written.subarray(-2), Buffer.from('.\n'));
  });
}

test('rulebook writes preserve sibling bytes and retirement provenance', async t => {
  const { path, book, add } = await fixture(t);
  const one = await book.add({ text: 'Run one suite.', title: 'One suite', scope: 'implementer', reason: 'contention', origin: 'shell' });
  assert.deepEqual(one, { number: 1, title: 'One suite', scope: ['implementer'], date: '2026-10-16', status: 'active', origin: 'shell', reason: 'contention', text: 'Run one suite.' });
  assert.equal((await add('Be clear.')).number, 2);
  const original = await readFile(path, 'utf8');
  assert.match(original, /## 1 One suite\nScope: implementer\nDate: .+\nStatus: active\nOrigin: shell\nReason: contention\n\nRun one suite\./);
  await book.edit(1, { scope: 'all', text: 'Run serially.' });
  const retired = await book.retire(1, 'superseded', undefined, undefined, 'shell');
  assert.equal(retired.origin, 'shell'); assert.equal(retired.retired_origin, 'shell');
  assert.equal(retired.status, 'retired'); assert.equal(retired.reason, 'contention; superseded');
  assert.equal(retired.retired, retired.date);
  const edited = await readFile(path, 'utf8');
  assert.equal(edited.slice(edited.indexOf('## 2')), original.slice(original.indexOf('## 2')));
  assert.equal((await add('Next rule.')).number, 3);
});

test('rulebook reload keeps the last good rules on malformed source', async t => {
  const { path, book, add, clock, records, observe } = await fixture(t);
  await add('Initial.');
  const initial = await readFile(path, 'utf8');
  const changed = initial.replace('## 1 Initial.', '## 8 Hand edit').replace('Initial.\n', 'Changed by hand.\n').replace(/Date: \S+/, 'Date: 2020-01-01');
  await book.start();
  const reloaded = Promise.withResolvers<void>();
  book.subscribe(rules => { if (rules[0]?.text === 'Changed by hand.') reloaded.resolve(); });
  await writeFile(`${path}.new`, changed); await rename(`${path}.new`, path);
  await clock.advance(500); await reloaded.promise;
  const broken = changed.replace('Scope: all', 'Scope: unknown');
  const invalid = Promise.withResolvers<void>();
  observe(entry => { if (entry.event === 'rules-unreadable') invalid.resolve(); });
  await writeFile(path, broken); await clock.advance(500); await invalid.promise;
  assert.ok(records.some(entry => entry.event === 'rules-unreadable' && entry.line === 5 && /unknown role unknown/.test(String(entry.error))));
  assert.equal(book.get()[0]?.number, 8); assert.equal(book.get()[0]?.text, 'Changed by hand.');
  await assert.rejects(book.edit(8, { scope: 'all' }), /line 5.*unknown role/);
  assert.equal(await readFile(path, 'utf8'), broken);
  await writeFile(path, changed);
  assert.equal((await book.edit(8, { scope: 'implementer' })).date, '2026-10-16');
  assert.equal((await add('Next.')).number, 9);
});

test('a hand edit during the native temporary write survives refusal and retry', { timeout: 5000 }, async t => {
  const reached = Promise.withResolvers<void>(), proceed = Promise.withResolvers<void>();
  const release = () => { proceed.resolve(); t.mock.restoreAll(); syncBuiltinESMExports(); };
  const { root, path, book, add } = await fixture(t, release);
  for (const text of ['First rule.', 'Second rule.']) await add(text);
  const original = await readFile(path, 'utf8');
  const nativeWrite = fs.writeFile;
  let held = false;
  t.mock.method(fs, 'writeFile', async (...args: Parameters<typeof nativeWrite>) => {
    await nativeWrite(...args);
    if (!held && String(args[0]).startsWith(`${path}.`) && String(args[0]).endsWith('.tmp')) { held = true; reached.resolve(); await proceed.promise; }
  });
  syncBuiltinESMExports();
  const editing = book.edit(1, { text: 'Hub edit.' });
  void editing.catch(() => {}); // cleanup may release a stale write after an interrupted body
  try {
    await reached.promise;
    const handEdit = original.replace('Second rule.\n', 'Human edit of second rule.\n');
    await writeFile(path, handEdit); proceed.resolve();
    await assert.rejects(editing, /RULES\.md changed.*retry/);
    assert.equal(await readFile(path, 'utf8'), handEdit);
    assert.ok(!(await readdir(root)).some(name => name.startsWith('RULES.md.') && name.endsWith('.tmp')));
    await book.edit(1, { text: 'Hub edit.' });
    const saved = await readFile(path, 'utf8');
    assert.match(saved, /Hub edit\./); assert.match(saved, /Human edit of second rule\./);
  } finally {
    proceed.resolve();
    await editing.catch(() => {});
    release();
  }
});

test('rulebook high-water survives deletion and falls back to the highest present number', async t => {
  const { path, book, add, records, clock, observe } = await fixture(t);
  assert.equal((await add()).number, 1); assert.equal((await add()).number, 2);
  await book.retire(2, 'finished');
  const initial = await readFile(path, 'utf8');
  assert.match(initial, /<!-- cland: rule high-water 2 -->/);
  await writeFile(path, initial.slice(0, initial.indexOf('## 2')));
  assert.equal((await add()).number, 3);
  const marked = await readFile(path, 'utf8');
  await writeFile(path, marked.replace(/<!-- cland: rule high-water \d+ -->\n/, ''));
  assert.equal((await add()).number, 4);
  const current = await readFile(path, 'utf8');
  await book.start();
  const warned = Promise.withResolvers<void>();
  observe(entry => { if (entry.event === 'rules-counter-behind') warned.resolve(); });
  await writeFile(path, current.replace('high-water 4', 'high-water 1'));
  await clock.advance(500); await warned.promise;
  assert.ok(records.some(entry => entry.event === 'rules-counter-behind'));
  assert.equal((await add()).number, 5);
});
