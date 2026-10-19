// T1: refreshDurations preserves partial-tier baselines directly, with no CLI process.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { refreshDurations } from './durations.ts';
import type { DurationManifest } from '../src/suite-durations.ts';

test('partial logs refresh each observed file without erasing other tiers', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'duration-refresh-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await mkdir(join(cwd, 'hub/test'), { recursive: true });
  const t1 = 'hub/test/unit.test.ts', t2 = 'hub/test/component.test.ts', t3 = 'hub/test/integration.test.ts';
  const allowance = { seconds: 12, owner: 'T-1', added: '2026-10-19', expires: '2026-10-25', reason: 'Real lifecycle.' };
  const previous: DurationManifest = { version: 1, source: { artifacts: ['A-1'], commit: 'base' }, budget: { testSeconds: 5, fileSeconds: 60 },
    files: { [t1]: { seconds: 3, tests: 2 }, [t2]: { seconds: 4, tests: 1 }, [t3]: { seconds: 8, tests: 1 } },
    tests: { [`${t1}::keep`]: 1, [`${t1}::gone`]: 2, [`${t2}::keep`]: 4, [`${t3}::keep`]: 8 }, allow: { [`${t3}::keep`]: allowance } };
  await writeFile(join(cwd, 'hub/test/durations.json'), JSON.stringify(previous));
  const logs: string[] = [];
  for (const [i, records] of [
    [{ file: t1, name: 'keep', seconds: 2 }, { file: t1, name: 'gone', seconds: 2 }],
    [{ file: t1, name: 'keep', seconds: 4 }],
    [{ file: t2, name: 'keep', seconds: 2 }],
  ].entries()) {
    const path = join(cwd, `A-${i + 2}-partial.log`);
    await writeFile(path, 'Head latest\n' + records.map(record => `suite timing ${JSON.stringify(record)}\n`).join('') + 'Finished: exit 0\n');
    logs.push(path);
  }
  const refreshed = await refreshDurations(cwd, logs);
  assert.deepEqual(refreshed.tests, { [`${t1}::keep`]: 3, [`${t2}::keep`]: 2, [`${t3}::keep`]: 8 });
  assert.deepEqual(refreshed.files, { [t1]: { seconds: 3, tests: 1 }, [t2]: { seconds: 2, tests: 1 }, [t3]: previous.files[t3] });
  assert.deepEqual(refreshed.allow, previous.allow);
});

test('ordinary empty-file completions prune the last baseline identity', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'duration-empty-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await mkdir(join(cwd, 'hub/test'), { recursive: true });
  const file = 'hub/test/empty.test.ts', other = 'hub/test/other.test.ts';
  const previous = { version: 1, source: { artifacts: ['A-1'], commit: 'base' }, budget: { testSeconds: 5, fileSeconds: 60 },
    files: { [file]: { seconds: 1, tests: 1 } }, tests: { [`${file}::gone`]: 1 }, allow: {} };
  const path = join(cwd, 'A-2-empty.log');
  for (const timed of [true, false]) {
    await writeFile(join(cwd, 'hub/test/durations.json'), JSON.stringify(previous));
    const progress = { event: 'finish', id: 'ordinary:1', file, name: file, nesting: 0, type: 'file', outcome: 'pass', at: 1, seconds: 0.01 };
    await writeFile(path, 'Head latest\n' + (timed ? `suite timing ${JSON.stringify({ file: other, name: 'keep', seconds: 1 })}\n` : '')
      + `suite progress ${JSON.stringify(progress)}\nFinished: exit 0\n`);
    const result = await refreshDurations(cwd, [path]);
    assert.equal(result.tests[`${file}::gone`], undefined);
    assert.deepEqual(result.files[file], { seconds: 0, tests: 0 });
  }
});

test('unobserved allowances retain their provenance without a timing baseline', async t => {
  const cwd = await mkdtemp(join(tmpdir(), 'duration-allowance-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await mkdir(join(cwd, 'hub/test'), { recursive: true });
  const file = 'hub/test/setup-machine.test.ts';
  const allowance = { seconds: 12, owner: 'T-1', added: '2026-10-19', expires: '2026-10-25', reason: 'Real lifecycle.' };
  const previous = { version: 1, source: { artifacts: ['A-1'], commit: 'base' }, budget: { testSeconds: 5, fileSeconds: 60 },
    files: {}, tests: {}, allow: { [`${file}::new`]: allowance, [file]: { ...allowance, file: true } } };
  await writeFile(join(cwd, 'hub/test/durations.json'), JSON.stringify(previous));
  const path = join(cwd, 'A-2-partial.log');
  // A repetition's file envelope does not mean the ordinary phase ran this file.
  const progress = { event: 'finish', id: 'repeat:1', file, name: file, nesting: 0, type: 'file', outcome: 'pass', scope: 'load-gate', at: 1, seconds: 0.01 };
  await writeFile(path, 'Head latest\nsuite timing {"file":"hub/test/other.test.ts","name":"keep","seconds":1}\n'
    + `suite progress ${JSON.stringify(progress)}\nFinished: exit 0\n`);
  const result = await refreshDurations(cwd, [path]);
  assert.deepEqual(result.allow, previous.allow);
  assert.deepEqual(result.source, { artifacts: ['A-1', 'A-2'], commit: 'latest' });
});
