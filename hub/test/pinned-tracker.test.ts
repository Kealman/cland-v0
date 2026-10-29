// T1: the fixed corpus retains its independently chosen shape inventory.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseItem } from '../src/tracker/item.ts';
import { parseCriteria } from '../src/tracker/criteria.ts';

test('pinned tracker retains representative shapes within a fixed count', async () => {
  const corpus = JSON.parse(await readFile(new URL('./fixtures/tracker-snapshot/items.json', import.meta.url), 'utf8')) as { items: Array<{name:string;text:string}> };
  assert.equal(corpus.items.length, 24);
  const rows = corpus.items.map(({name,text}) => parseItem(text,name));
  assert.equal(new Set(rows.map(r=>r.fm.id)).size, 24);
  assert.deepEqual([...new Set(rows.map(r=>r.fm.kind))].sort(), ['category','epic','map','question','release','spec','task']);
  assert.deepEqual([...new Set(rows.flatMap(r=>r.fm.status ? [r.fm.status] : []))].sort(), ['backlog','done','in progress','planned','qa','ready','review']);
  assert.deepEqual([...new Set(rows.map(r=>r.fm.state))].sort(), ['closed','open']);
  assert.ok(rows.some(r=>parseCriteria(r.body).criteria.some(c=>c.marks.length)));
  assert.ok(rows.some(r=>parseCriteria(r.body).criteria.some(c=>c.malformedMarks.length)));
  assert.ok(rows.some(r=>r.comments.some(c=>c.verdict)));
  assert.ok(rows.some(r=>r.comments.some(c=>!c.verdict)));
  for (const pattern of [/```yaml/, /^\|/m, /~~~md/, /🙂/, /`inline code`/]) assert.ok(rows.some(r=>pattern.test(r.body)), String(pattern));
  assert.ok(rows.some(r=>!/^## Summary/m.test(r.body)));
  assert.equal(rows.filter(r=>r.body.length>=20_000).length, 3, 'three largest baseline bodies');
  const ids = new Set(rows.map(r=>r.fm.id));
  assert.ok(rows.every(r=>!r.fm.parent||ids.has(r.fm.parent)), 'all parent chains are retained');
});
