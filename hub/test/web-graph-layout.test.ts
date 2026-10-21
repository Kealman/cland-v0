// T1: public geometry seam, using the Lua's small worked graphs as literals.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fromItems, rows, route } from '../../web/src/graph-layout.ts';

test('graph keeps sibling dependencies, reduces shortcuts and separates tray/outside edges', () => {
  const L = fromItems([
    { id: 'a' }, { id: 'b', blocked_by: ['a', 'a'] },
    { id: 'c', blocked_by: ['a', 'b'] }, { id: 'tray', blocked_by: ['external'] },
  ]);
  assert.deepEqual(L.layers, [['a'], ['b'], ['c']]);
  assert.deepEqual(L.hidden, [['a', 'c']]);
  assert.deepEqual(L.tray, ['tray']);
  assert.deepEqual(L.outside, [['external', 'tray']]);
  assert.equal(L.edges, 3);
  assert.equal(L.crossings, 0);
  const pos = rows(L);
  assert.deepEqual(Object.entries(pos), [['a', 0], ['b', 0], ['c', 0]]);
  assert.deepEqual(route(L, pos, { orient: 'vertical', width: 24, height: () => 1, labelWidth: () => 1 }), {
    segments: [['p', 1, 0, 3, 1], ['p', 3, 0, 3, 2]], bounds: { y: [0, 2, 4], bottom: 6 },
  });
});

test('graph preserves cyclic membership and supplied rank diagnostics', () => {
  const items = [{ id: 'a', blocked_by: ['b'] }, { id: 'b', blocked_by: ['a'] }, { id: 'c' }];
  const cyclic = fromItems(items);
  assert.deepEqual(cyclic.layers, [['a'], ['b']]);
  assert.deepEqual(cyclic.cycles, [['b', 'a']]);
  assert.deepEqual(cyclic.tray, ['c']);
  const ranked = fromItems(items, { rank: { a: 2, b: 1, c: 1 }, include: { c: true }, keep_order: true });
  assert.deepEqual(ranked.layers, [['b', 'c'], ['a']]);
  assert.deepEqual(ranked.against, [['a', 'b']]);
});

test('graph dictionaries accept prototype-shaped identifiers without losing vertices', () => {
  const L = fromItems([{ id: '__proto__' }, { id: 'constructor', blocked_by: ['__proto__'] }, { id: 'toString', blocked_by: ['constructor'] }]);
  assert.deepEqual(L.layers, [['__proto__'], ['constructor'], ['toString']]);
  assert.equal(L.chains.length, 2);
});
