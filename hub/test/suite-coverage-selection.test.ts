// T1: coverage decisions use fixed maps and git diff replies, without processes or clocks.
import assert from 'node:assert/strict';
import test from 'node:test';
import { legacyCoverageSelection } from './selection-replay-coverage.ts';
import { mkdtemp, mkdir, readFile, writeFile, rm, utimes, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { coverageSelection, coverageMaps, registerCoverageMap, mergeCoverageFiles, parseCoverageMap, mergeCoverageMaps, type CoverageMap } from '../src/suite-coverage.ts';

async function fixture(t: import('node:test').TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'cland-coverage-selection-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'hub/test'), { recursive: true });
  for (const file of ['first', 'second', 'changed']) await writeFile(join(root, `hub/test/${file}.test.ts`), '// test');
  const map: CoverageMap = { version: 1, head: 'a'.repeat(40), tree: 'b'.repeat(40), created: '2026-10-10T00:00:00Z',
    testFiles: ['hub/test/first.test.ts', 'hub/test/second.test.ts'], files: { 'hub/src/example.ts': { functions: [
      { name: 'first', start: 10, end: 30, startLine: 2, endLine: 4, tests: ['hub/test/first.test.ts'] },
      { name: 'second', start: 40, end: 60, startLine: 6, endLine: 8, tests: ['hub/test/second.test.ts'] },
      { name: 'untested', start: 70, end: 90, startLine: 10, endLine: 12, tests: [] },
    ] } } };
  const select = (change: string, intervening = '', age = 1000, ancestor = true) => coverageSelection(root,
    ['hub/src/example.ts', 'hub/test/changed.test.ts'], 'base', async (...args) => {
      if (args[0] === 'merge-base') { if (!ancestor) throw new Error('not ancestor'); return ''; }
      return args.includes(map.head) ? intervening : change;
    }, 172800000, { maps: [{ map, pointer: { artifact: 'A-fixture', path: 'fixture-map.json' } }], at: Date.parse(map.created) + age, nearest: false });
  return { root, map, select };
}

test('top-level insertions select every covering test in the file and name the widening', async t => {
  const { select } = await fixture(t);
  const selected = await select('@@ -0,0 +1 @@\n+const setting = true;');
  assert.ok(!('fallback' in selected));
  assert.deepEqual(selected.tests, ['hub/test/changed.test.ts', 'hub/test/first.test.ts', 'hub/test/second.test.ts']);
  assert.match(selected.notes.join('; '), /file covering tests.*top-level/);
});

test('untested function edits select the other covering tests in that file, with empty files falling back', async t => {
  const { map, select } = await fixture(t);
  const selected = await select('@@ -11 +11 @@\n-return 1;\n+return 2;');
  assert.ok(!('fallback' in selected));
  assert.deepEqual(selected.tests, ['hub/test/changed.test.ts', 'hub/test/first.test.ts', 'hub/test/second.test.ts']);
  assert.match(selected.notes.join('; '), /file covering tests.*untested function/);
  for (const fn of map.files['hub/src/example.ts']!.functions) fn.tests = [];
  assert.deepEqual(await select('@@ -0,0 +1 @@'), { fallback: 'coverage file has no covering tests: hub/src/example.ts' });
});

test('an old ancestor map selects translated hunks and reports its age, but unmappable hunks still fall back', async t => {
  const { select } = await fixture(t);
  const oldAge = 259200000;
  const selected = await select('@@ -9 +9 @@', '@@ -1,0 +2,2 @@', oldAge);
  assert.ok(!('fallback' in selected));
  assert.deepEqual(selected.tests, ['hub/test/changed.test.ts', 'hub/test/second.test.ts']);
  assert.match(selected.notes.join('; '), /age 259200s.*limit 172800s.*hunks map/);
  assert.deepEqual(await select('@@ -3 +3 @@', '@@ -1,0 +2,2 @@', oldAge), { fallback: 'coverage hunk changed since map: hub/src/example.ts:3' });
  assert.deepEqual(await select('@@ -7 +7 @@', '', oldAge, false), { fallback: 'coverage map has no ancestor of task merge base' });
});

// T1: tier maps must retain every covering test while refusing another candidate.
test('tier command coverage combines attribution at one admitted tree', () => {
  const first: CoverageMap = { version: 1, head: 'a'.repeat(40), tree: 'b'.repeat(40), created: '2026-10-19T00:00:00Z',
    testFiles: ['hub/test/unit.test.ts'], files: { 'hub/src/rule.ts': { functions: [
      { name: 'rule', start: 0, end: 30, startLine: 1, endLine: 2, tests: ['hub/test/unit.test.ts'] },
    ] } } };
  const second = structuredClone(first);
  second.testFiles = ['hub/test/component.test.ts'];
  second.files['hub/src/rule.ts']!.functions[0]!.tests = ['hub/test/component.test.ts'];
  const merged = mergeCoverageMaps(first, second);
  assert.deepEqual(merged.testFiles, ['hub/test/component.test.ts', 'hub/test/unit.test.ts']);
  assert.deepEqual(merged.files['hub/src/rule.ts']!.functions[0]!.tests, merged.testFiles);
  assert.deepEqual(first.testFiles, ['hub/test/unit.test.ts']);
  assert.throws(() => mergeCoverageMaps(first, { ...second, tree: 'c'.repeat(40) }), /provenance mismatch/);
});

// C1: map ownership is counted at the loader seam; no RSS/GC or timing assertions.
test('selection of 50 large maps stops at the newest ancestor and retains one parsed map', async t => {
  t.mock.method(Date, 'now', () => Date.parse('2026-10-11T00:00:00Z'));
  const { root, map } = await fixture(t);
  const dir = join(root, '.cland/run/coverage-maps');
  await mkdir(dir, { recursive: true });
  const heads: string[] = [];
  for (let i = 0; i < 50; i++) {
    const head = i.toString(16).padStart(40, '0');
    heads.push(head);
    const path = join(root, `map-${i}.json`);
    const created = new Date(Date.UTC(2026, 9, 10, 0, i)).toISOString();
    await writeFile(path, JSON.stringify({ ...map, head, created,
      files: { 'hub/src/example.ts': { functions: [{ ...map.files['hub/src/example.ts']!.functions[0]!, name: 'x'.repeat(262144) }] } } }));
    await writeFile(join(dir, `${i}.json`), JSON.stringify({ artifact: `A-${i}`, path, head, created }));
  }
  const parsed: string[] = [];
  const retained = new Set<CoverageMap>();
  let peak = 0;
  const selected = await coverageSelection(root, ['hub/src/example.ts'], 'base', async (...args) => {
    if (args[0] === 'merge-base') { if (args[2] !== heads[47]) throw new Error('not ancestor'); return ''; }
    return args.includes('base') && !args.includes(heads[47]!) ? '@@ -3 +3 @@' : '';
  }, 172800000, undefined, {
    async read(path: string) {
      const loaded = parseCoverageMap(await readFile(path, 'utf8'));
      parsed.push(loaded.head); retained.add(loaded); peak = Math.max(peak, retained.size);
      return loaded;
    },
    release(loaded: CoverageMap) { assert.ok(retained.delete(loaded)); },
  });
  assert.ok('tests' in selected);
  assert.deepEqual(selected.tests, ['hub/test/first.test.ts']);
  assert.equal(selected.map.head, heads[47]);
  assert.deepEqual(parsed, [heads[49], heads[48], heads[47]]);
  assert.equal(peak, 1);
  assert.equal(retained.size, 0);
});

// C2: pointers order without opening artifacts, including pointers predating metadata.
test('pointer metadata orders maps newest first with legacy mtime fallback', async t => {
  const { root } = await fixture(t);
  const dir = join(root, '.cland/run/coverage-maps');
  await mkdir(dir, { recursive: true });
  for (const [name, created, mtime] of [
    ['new', '2026-10-20T00:00:00Z', '2026-10-01T00:00:00Z'],
    ['legacy', undefined, '2026-10-19T00:00:00Z'],
    ['old', '2026-10-18T00:00:00Z', '2026-10-21T00:00:00Z'],
  ] as const) {
    const path = join(dir, `${name}.json`);
    await writeFile(path, JSON.stringify({ artifact: name, path: join(root, 'does-not-exist'), ...(created ? { created, head: 'a'.repeat(40) } : {}) }));
    await utimes(path, new Date(mtime), new Date(mtime));
  }
  assert.deepEqual((await coverageMaps(root)).map(entry => entry.pointer.artifact), ['new', 'legacy', 'old']);
});

// C2/C3: registration writes metadata; retention evicts only pointers with an event.
test('registration keeps the newest configured pointers and preserves all artifact copies', async t => {
  const { root, map } = await fixture(t);
  const events: Record<string, unknown>[] = [];
  for (let i = 0; i < 4; i++) {
    const path = join(root, `artifact-${i}.json`);
    const created = new Date(Date.UTC(2026, 9, 10 + i)).toISOString();
    await writeFile(path, JSON.stringify({ ...map, created }));
    await registerCoverageMap(root, `run-${i}`, { artifact: `A-${i}`, path, head: map.head, created }, 2, entry => events.push(entry));
  }
  const dir = join(root, '.cland/run/coverage-maps');
  assert.deepEqual((await readdir(dir)).sort(), ['run-2.json', 'run-3.json']);
  assert.deepEqual(JSON.parse(await readFile(join(dir, 'run-3.json'), 'utf8')), {
    artifact: 'A-3', path: join(root, 'artifact-3.json'), head: map.head, created: '2026-10-13T00:00:00.000Z',
  });
  assert.deepEqual(events.map(event => [event.event, event.pointer, event.artifact]), [
    ['coverage-pointer-expired', join(dir, 'run-0.json'), 'A-0'],
    ['coverage-pointer-expired', join(dir, 'run-1.json'), 'A-1'],
  ]);
  for (let i = 0; i < 4; i++) assert.ok(await readFile(join(root, `artifact-${i}.json`)), 'artifact retention remains with the artifact lifecycle');
});

// Shard aggregation may retain its result plus one incoming map, never all inputs.
test('shard merging reads and releases one map at a time and preserves attribution', async t => {
  const { root, map } = await fixture(t);
  const paths: string[] = [];
  for (let i = 0; i < 3; i++) {
    const path = join(root, `shard-${i}.json`); paths.push(path);
    const file = `hub/test/shard-${i}.test.ts`;
    await writeFile(path, JSON.stringify({ ...map, testFiles: [file], files: { 'hub/src/example.ts': {
      functions: [{ ...map.files['hub/src/example.ts']!.functions[0]!, tests: [file] }],
    } } }));
  }
  const retained = new Set<CoverageMap>();
  const reads: string[] = [];
  let peak = 0;
  const seed: CoverageMap = { ...map, testFiles: [], files: {} };
  const reader = {
    async read(path: string) {
      assert.equal(retained.size, 0, 'release the previous shard before reading another');
      reads.push(path);
      const loaded = parseCoverageMap(await readFile(path, 'utf8')); retained.add(loaded); peak = Math.max(peak, retained.size); return loaded;
    },
    release(loaded: CoverageMap) { assert.ok(retained.delete(loaded)); },
  };
  const merged = await mergeCoverageFiles(paths, seed, reader);
  assert.equal(merged, seed);
  assert.deepEqual(reads, paths);
  assert.equal(peak, 1);
  assert.equal(retained.size, 0);
  assert.deepEqual(merged.testFiles, ['hub/test/shard-0.test.ts', 'hub/test/shard-1.test.ts', 'hub/test/shard-2.test.ts']);
  assert.deepEqual(merged.files['hub/src/example.ts']!.functions[0]!.tests, merged.testFiles);
  const other = { ...map, head: 'c'.repeat(40) };
  await assert.rejects(mergeCoverageFiles(['other'], seed, {
    read: async () => { retained.add(other); return other; }, release: reader.release,
  }), /shard coverage provenance mismatch/);
  assert.equal(retained.size, 0, 'provenance failures also release their map');
});

// Older selector refs consume loaded maps. Replay adapts one candidate at a time.
test('legacy coverage replay receives one loaded candidate and keeps ancestor and nearest behaviour', async t => {
  const { root, map } = await fixture(t);
  const pointers = [];
  for (let i = 0; i < 3; i++) {
    const created = new Date(Date.UTC(2026, 9, 10 + i)).toISOString();
    const path = join(root, `legacy-${i}.json`);
    await writeFile(path, JSON.stringify({ ...map, head: String(i).repeat(40), created }));
    pointers.unshift({ pointer: { artifact: `A-${i}`, path, created }, created: Date.parse(created) });
  }
  const seen: string[] = [];
  let allowAncestor = true;
  const selector: typeof coverageSelection = async (_cwd, _files, _base, _git, _age, replay) => {
    assert.equal(replay!.maps.length, 1);
    const candidate = replay!.maps[0]!; assert.ok('map' in candidate);
    seen.push(candidate.pointer.artifact);
    return allowAncestor && candidate.pointer.artifact === 'A-1' || replay!.nearest
      ? { tests: [], functions: [], map: { ...candidate.pointer, head: candidate.map.head }, nvimFull: false, notes: [] }
      : { fallback: 'coverage map has no ancestor of task merge base' };
  };
  const args: [string, string[], string, () => Promise<string>, number] = [root, [], 'base', async () => '', 1000];
  const selected = await legacyCoverageSelection(selector, ...args, { maps: pointers, at: Date.parse('2026-10-20'), nearest: false });
  assert.ok('map' in selected); assert.equal(selected.map.artifact, 'A-1');
  assert.deepEqual(seen, ['A-2', 'A-1']);
  seen.length = 0; allowAncestor = false;
  const nearest = await legacyCoverageSelection(selector, ...args, { maps: pointers, at: Date.parse('2026-10-13'), nearest: true });
  assert.ok('map' in nearest); assert.equal(nearest.map.artifact, 'A-2');
  assert.deepEqual(seen, ['A-2', 'A-1', 'A-0', 'A-2']);
});
