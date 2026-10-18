// T2: runUpdate's real text/JSON boundary with a scratch HOME/XDG and simulated curated set.
// No Git repository, subprocess, hub, provider or global state is needed.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Change } from '../src/init/files.ts';

test('update reports each kept skill with the same note in text and JSON', async t => {
  const scratch = mkdtempSync(join(tmpdir(), 'cland-skill-report-'));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const home = join(scratch, 'home');
  const root = join(scratch, 'project');
  const source = join(scratch, 'source');
  mkdirSync(home);
  mkdirSync(join(root, '.cland'), { recursive: true });
  for (const [key, value] of Object.entries({ HOME: home, XDG_CONFIG_HOME: join(home, '.config'),
    XDG_DATA_HOME: join(home, '.local/share'), XDG_STATE_HOME: join(home, '.local/state'), XDG_CACHE_HOME: join(home, '.cache'),
    CLAND_SKILLS_SOURCE_OVERRIDE: source })) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  for (const name of ['tdd', 'grilling']) {
    mkdirSync(join(source, name), { recursive: true });
    writeFileSync(join(source, name, 'SKILL.md'), `${name} v1`);
  }
  // Import only after installing the scratch environment: the source override is a module constant.
  const { runUpdate } = await import('../src/cli/init.ts');
  assert.equal(await runUpdate(['--json'], root, () => {}), 0);
  for (const name of ['tdd', 'grilling']) writeFileSync(join(root, '.agents/skills', name, 'SKILL.md'), 'project edit');
  writeFileSync(join(source, 'tdd/SKILL.md'), 'tdd v2');
  const manifest = readFileSync(join(root, '.agents/skills/.cland-manifest.json'));
  let output = '';
  assert.equal(await runUpdate([], root, text => { output += text; }), 0);
  const kept = output.split('\n').filter(line => /kept\s+\.agents\/skills\//.test(line));
  assert.deepEqual(kept.map(line => line.trim()).sort(), [
    'kept      .agents/skills/grilling  (edited in the project)',
    'kept      .agents/skills/tdd  (edited in the project; cland ships a newer version)',
  ]);
  output = '';
  assert.equal(await runUpdate(['--json'], root, text => { output += text; }), 0);
  const report = JSON.parse(output) as { changes: Change[] };
  assert.deepEqual(report.changes.filter(c => c.path === '.agents/skills/tdd' || c.path === '.agents/skills/grilling'), [
    { path: '.agents/skills/grilling', action: 'kept', note: 'edited in the project' },
    { path: '.agents/skills/tdd', action: 'kept', note: 'edited in the project; cland ships a newer version' },
  ]);
  assert.deepEqual(readFileSync(join(root, '.agents/skills/.cland-manifest.json')), manifest);
});
