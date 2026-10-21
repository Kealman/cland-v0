// T3: the real pinned LuaJIT/Neovim binary is the independent port oracle.
// No hub starts; all tracker parsing and child state belong to a disposable root.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findNvim } from '../bin/nvim-path.ts';
import { assertTestAdmission } from '../../test-support/admission.ts';
import { fixtureEnvironment } from '../../test-support/fixture-environment.ts';
import { parseItem, idNumber } from '../../hub/src/tracker/item.ts';
import type { LayoutOptions } from '../../web/src/graph-layout.ts';
import { fromItems, rows, route, fitWindow } from '../../web/src/graph-layout.ts';

const nvim = findNvim();
const repo = fileURLToPath(new URL('../../', import.meta.url));
type Case = { name?: string; items: { id: string; blocked_by?: string[] }[]; opts?: LayoutOptions; room?: number };
const entries = (value: object) => Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
async function compare(input: Case[] | ((root: string) => Case[])) {
  await assertTestAdmission();
  assert.ok(nvim, 'pinned Neovim missing; run verification prepare before the differential test');
  const root = mkdtempSync(join(tmpdir(), 'cland-graph-'));
  try {
    const env = fixtureEnvironment(root, process.env);
    const cases = typeof input === 'function' ? input(root) : input;
    cpSync(join(repo, 'nvim/lua/cland/graph_layout.lua'), join(root, 'graph.lua'));
    cpSync(join(repo, 'nvim/test/web-graph-layout.lua'), join(root, 'oracle.lua'));
    writeFileSync(join(root, 'input.json'), JSON.stringify(cases));
    const run = spawnSync(nvim, ['--clean', '--headless', '-l', join(root, 'oracle.lua'), join(root, 'graph.lua'), join(root, 'input.json'), join(root, 'output.json')], { cwd: root, env, encoding: 'utf8', timeout: 30_000, maxBuffer: 8 * 1024 * 1024 });
    assert.equal(run.error, undefined);
    assert.equal(run.status, 0, run.stderr + run.stdout);
    const expected = JSON.parse(readFileSync(join(root, 'output.json'), 'utf8'));
    const actual = cases.map(({ items, opts, room }) => {
      const original = fromItems(items, opts);
      const fitted = room === undefined ? undefined : fitWindow(original, room, 6, 24);
      const L = fitted?.layout ?? original;
      return { ...(fitted ? { fit: { width: fitted.width, origin: fitted.origin } } : {}), ...L, layer: entries(L.layer), succ: entries(L.succ), pred: entries(L.pred), via: entries(L.via),
        routes: [false, true].map(vertical => {
          const pos = rows(L, () => vertical ? 26 : 2);
          return { pos: entries(pos), ...route(L, pos, { orient: vertical ? 'vertical' : 'horizontal', width: 24, top: 3, left: 5, height: () => 2, labelWidth: id => id.length }) };
        }),
      };
    });
    assert.equal(actual.length, expected.length);
    actual.forEach((result, i) => assert.deepEqual(result, expected[i], cases[i]?.name ?? `case ${i}`));
  } finally { rmSync(root, { recursive: true, force: true }); }
}
test('TypeScript graph equals Lua layers, order and edge routes on GRAPH-001', () => {
  const fixture = JSON.parse(readFileSync(join(repo, 'qa/cases/GRAPH-001.items.json'), 'utf8')) as Case;
  return compare([fixture]);
});

test('TypeScript graph equals Lua on every epic and release in a scratch live tracker copy', t => {
  return compare(root => {
    const tasks = join(root, '.cland/tasks');
    cpSync(join(repo, '.cland/tasks'), tasks, { recursive: true });
    const items = readdirSync(tasks).filter(name => name.endsWith('.md')).map(name => parseItem(readFileSync(join(tasks, name), 'utf8'), name).fm);
    const containers = items.filter(item => item.kind === 'epic' || item.kind === 'release');
    assert.ok(containers.some(item => item.kind === 'epic'));
    assert.ok(containers.some(item => item.kind === 'release'));
    t.diagnostic(`${items.length} copied items; ${containers.length} epic/release sibling graphs, including closed and empty containers`);
    return containers.map(container => ({ name: container.id, items: items.filter(item => item.parent === container.id).sort((a, b) => (a.rank ?? idNumber(a.id) * 10) - (b.rank ?? idNumber(b.id) * 10) || idNumber(a.id) - idNumber(b.id)) }));
  });
});

// Seeded topologies cover cycles/self-loops, duplicates, external blockers,
// reduction off, given ranks, included tray nodes and both block-order branches.
test('TypeScript graph equals Lua on cyclic, ranked and dense sibling graphs', () => {
  let seed = 1072;
  const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const cases: Case[] = [];
  for (let n = 0; n < 30; n++) {
    const items = Array.from({ length: 3 + n % 10 }, (_, i) => ({ id: `T-${i + 1}`, blocked_by: [] as string[] }));
    for (const item of items) {
      for (const blocker of items) if (next() < 0.2) item.blocked_by.push(blocker.id);
      if (next() < 0.3) item.blocked_by.push('outside');
      if (item.blocked_by[0]) item.blocked_by.push(item.blocked_by[0]);
    }
    const opts: LayoutOptions = n % 3 === 0 ? { reduce: false } : n % 3 === 1 ? {
      rank: Object.fromEntries(items.map(item => [item.id, 1 + Math.floor(next() * 4)])), keep_order: true,
      include: Object.fromEntries(items.map(item => [item.id, true])),
    } : { sweeps: 3 };
    cases.push({ name: `seeded ${n}`, items, opts });
  }
  const sources = Array.from({ length: 14 }, (_, i) => ({ id: `S-${i}`, blocked_by: [] as string[] }));
  const targets = sources.map((_, i) => ({ id: `D-${i}`, blocked_by: [sources[13 - i]!.id, sources[i]!.id] }));
  cases.push({ name: 'more than twelve source blocks', items: [...sources, ...targets], opts: { reduce: false, keep_order: true } });
  return compare(cases);
});

test('TypeScript graph equals Lua when wide bands wrap to the available room', () => {
  const fixture = JSON.parse(readFileSync(join(repo, 'qa/cases/GRAPH-001.items.json'), 'utf8')) as Case;
  return compare([20, 40, 80, 160, 500].map(room => ({ ...fixture, name: `room ${room}`, room })));
});
