// T2: runUpdate's real text/JSON boundary with a scratch HOME/XDG and simulated curated set.
// No Git repository, subprocess, hub, provider or global state is needed.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Change } from '../src/init/files.ts';

test('update reports whole-skill decisions consistently in text and JSON', async t => {
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

  const { readManifest, MANIFEST } = await import('../src/init/skills.ts');
  const target = join(root, '.agents/skills');
  const hash = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  const expectedHashes = { grilling: { 'SKILL.md': hash }, tdd: { 'SKILL.md': hash } };
  let textWarning = '';
  for (const args of [[], ['--json']]) {
    // Hand-written pre-hash manifest, not one produced by the new provisioner.
    writeFileSync(join(target, MANIFEST), JSON.stringify({ managed: 'managed by cland 0.1.3', skills: {
      tdd: ['SKILL.md'], grilling: ['SKILL.md'],
    } }));
    for (const name of ['tdd', 'grilling']) writeFileSync(join(source, name, 'SKILL.md'), 'abc');
    writeFileSync(join(target, 'grilling/SKILL.md'), 'abc');
    writeFileSync(join(target, 'tdd/SKILL.md'), 'legacy edit');
    output = '';
    assert.equal(await runUpdate(args, root, text => { output += text; }), 0);
    const migrated = readManifest(target);
    assert.equal(migrated.kind, 'ok');
    if (migrated.kind !== 'ok') throw new Error('missing migrated manifest');
    assert.deepEqual(migrated.manifest.skills, expectedHashes);
    assert.equal(readFileSync(join(target, 'tdd/SKILL.md'), 'utf8'), 'abc');
    if (args.length === 0) {
      const lines = output.split('\n').filter(line => line.includes('warning:'));
      assert.equal(lines.length, 1);
      assert.match(lines[0] ?? '', /\.cland-manifest\.json/);
      textWarning = /\((warning:.*)\)$/.exec(lines[0] ?? '')?.[1] ?? '';
      assert.match(textWarning, /no hashes/);
      assert.match(textWarning, /differed from cland's current set: tdd \(recover prior copies from git\)/);
    } else {
      const changes = (JSON.parse(output) as { changes: Change[] }).changes;
      const warnings = changes.filter(c => c.note?.startsWith('warning:'));
      assert.deepEqual(warnings, [{ path: `.agents/skills/${MANIFEST}`, action: 'updated', note: textWarning }]);
    }
    const installed = readFileSync(join(target, MANIFEST));
    writeFileSync(join(target, 'grilling/SKILL.md'), 'new project edit');
    writeFileSync(join(source, 'grilling/SKILL.md'), 'newer release');
    output = '';
    assert.equal(await runUpdate(args, root, text => { output += text; }), 0);
    assert.equal(output.includes('warning:'), false);
    assert.match(output, /edited in the project/);
    assert.equal(readFileSync(join(target, 'grilling/SKILL.md'), 'utf8'), 'new project edit');
    assert.deepEqual(readFileSync(join(target, MANIFEST)), installed, 'second run retains the install hashes');
  }
});
