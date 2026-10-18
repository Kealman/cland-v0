// T1: whole-skill update decisions through filesystem provisioning; no processes or clocks.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { Report } from '../src/init/files.ts';
import { MANIFEST, provisionSkills, readManifest } from '../src/init/skills.ts';

function fixture(t: TestContext) {
  const scratch = mkdtempSync(join(tmpdir(), 'cland-skill-update-'));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const root = join(scratch, 'project');
  const source = join(scratch, 'source');
  const target = join(root, '.agents', 'skills');
  const home = join(scratch, 'home');
  const env = { HOME: home, XDG_CONFIG_HOME: join(home, '.config'), XDG_DATA_HOME: join(home, '.local/share'),
    XDG_STATE_HOME: join(home, '.local/state'), XDG_CACHE_HOME: join(home, '.cache'), CLAND_SKILLS_SOURCE_OVERRIDE: source };
  for (const [key, value] of Object.entries(env)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  mkdirSync(home);
  mkdirSync(root);
  mkdirSync(source);
  const put = (base: string, rel: string, text: string) => {
    const path = join(base, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  };
  const update = () => {
    const report = new Report(root);
    provisionSkills(report, root, process.env.CLAND_SKILLS_SOURCE_OVERRIDE);
    return report.changes;
  };
  const manifest = () => {
    const read = readManifest(target);
    assert.equal(read.kind, 'ok');
    if (read.kind !== 'ok') throw new Error('missing manifest');
    return read.manifest.skills;
  };
  const snapshot = (dir: string): Record<string, string> => Object.fromEntries(
    readdirSync(dir, { recursive: true, withFileTypes: true }).filter(e => e.isFile())
      .map(e => [join(e.parentPath, e.name).slice(dir.length + 1), readFileSync(join(e.parentPath, e.name)).toString('hex')]),
  );
  return { root, source, target, put, update, manifest, snapshot };
}

test('an edited skill stays whole across repeated updates until its edit is undone', t => {
  const f = fixture(t);
  f.put(f.source, 'tdd/SKILL.md', 'v1');
  f.put(f.source, 'tdd/docs/old.md', 'old reference');
  f.update();
  const installed = f.manifest();
  f.put(f.target, 'tdd/SKILL.md', 'project edit');
  const edited = f.snapshot(join(f.target, 'tdd'));
  f.put(f.source, 'tdd/SKILL.md', 'v2');
  rmSync(join(f.source, 'tdd/docs'), { recursive: true });
  f.put(f.source, 'tdd/docs/new.md', 'new reference');
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.deepEqual(f.update().find(c => c.path === '.agents/skills/tdd'), {
      path: '.agents/skills/tdd', action: 'kept', note: 'edited in the project; cland ships a newer version',
    });
    assert.deepEqual(f.snapshot(join(f.target, 'tdd')), edited);
    assert.deepEqual(f.manifest(), installed, 'keep the install hashes, not the edited bytes');
  }
  f.put(f.target, 'tdd/SKILL.md', 'v1');
  assert.equal(f.update().find(c => c.path === '.agents/skills/tdd')?.action, 'updated');
  assert.deepEqual(f.snapshot(join(f.target, 'tdd')), f.snapshot(join(f.source, 'tdd')));
  assert.notDeepEqual(f.manifest(), installed);
  assert.equal(f.update().find(c => c.path === '.agents/skills/tdd')?.action, 'unchanged');
  assert.ok(readFileSync(join(f.target, MANIFEST), 'utf8').includes('managed by cland'));
});

test('an untouched skill refreshes its complete file set and records the new hashes', t => {
  const f = fixture(t);
  f.put(f.source, 'tdd/SKILL.md', 'old');
  f.put(f.source, 'tdd/old/ref.md', 'obsolete');
  f.update();
  f.put(f.source, 'tdd/SKILL.md', 'abc');
  rmSync(join(f.source, 'tdd/old'), { recursive: true });
  f.put(f.source, 'tdd/new/ref.md', 'abc');
  assert.equal(f.update().find(c => c.path === '.agents/skills/tdd')?.action, 'updated');
  assert.deepEqual(f.snapshot(join(f.target, 'tdd')), f.snapshot(join(f.source, 'tdd')));
  assert.equal(readdirSync(join(f.target, 'tdd')).includes('old'), false, 'remove obsolete directories too');
  assert.deepEqual(f.manifest().tdd, {
    'SKILL.md': 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    'new/ref.md': 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  });
  const recorded = readFileSync(join(f.target, MANIFEST));
  assert.equal(f.update().find(c => c.path === '.agents/skills/tdd')?.action, 'unchanged');
  assert.deepEqual(readFileSync(join(f.target, MANIFEST)), recorded);
});

test('edited, deleted and added project files keep the skill with a version-sensitive note', t => {
  const f = fixture(t);
  f.put(f.source, 'tdd/SKILL.md', 'old');
  f.put(f.source, 'tdd/refs.md', 'old reference');
  f.put(f.source, 'tdd/retired.md', 'retired reference');
  f.update();
  const installed = f.manifest();
  for (const edit of ['edited', 'deleted', 'added']) {
    for (const release of ['same', 'edited', 'deleted', 'added']) {
      rmSync(join(f.target, 'tdd'), { recursive: true });
      rmSync(join(f.source, 'tdd'), { recursive: true });
      for (const base of [f.target, f.source]) {
        f.put(base, 'tdd/SKILL.md', 'old');
        f.put(base, 'tdd/refs.md', 'old reference');
        f.put(base, 'tdd/retired.md', 'retired reference');
      }
      if (edit === 'edited') f.put(f.target, 'tdd/SKILL.md', 'project edit');
      if (edit === 'deleted') rmSync(join(f.target, 'tdd/refs.md'));
      if (edit === 'added') f.put(f.target, 'tdd/local/notes.md', 'local');
      if (release === 'edited') f.put(f.source, 'tdd/SKILL.md', 'new');
      if (release === 'deleted') rmSync(join(f.source, 'tdd/retired.md'));
      if (release === 'added') f.put(f.source, 'tdd/new/ref.md', 'new reference');
      const before = f.snapshot(join(f.target, 'tdd'));
      const changes = f.update().filter(c => c.path === '.agents/skills/tdd');
      assert.deepEqual(changes, [{ path: '.agents/skills/tdd', action: 'kept',
        note: `edited in the project${release === 'same' ? '' : '; cland ships a newer version'}` }], `${edit}, ${release}`);
      assert.deepEqual(f.snapshot(join(f.target, 'tdd')), before);
      assert.deepEqual(f.manifest(), installed);
    }
  }
});

test('a project copy matching the current release adopts its hashes without rewriting it', t => {
  const f = fixture(t);
  f.put(f.source, 'tdd/SKILL.md', 'old');
  f.put(f.source, 'tdd/obsolete.md', 'obsolete');
  f.update();
  for (const base of [f.source, f.target]) {
    rmSync(join(base, 'tdd'), { recursive: true });
    f.put(base, 'tdd/SKILL.md', 'abc');
    f.put(base, 'tdd/new.md', 'abc');
  }
  const before = f.snapshot(join(f.target, 'tdd'));
  assert.deepEqual(f.update().find(c => c.path === '.agents/skills/tdd'), { path: '.agents/skills/tdd', action: 'unchanged' });
  assert.deepEqual(f.snapshot(join(f.target, 'tdd')), before);
  assert.deepEqual(f.manifest().tdd, {
    'SKILL.md': 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    'new.md': 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  });
});

test('an untouched skill refreshes when a release changes a file into a directory or back', t => {
  const f = fixture(t);
  f.put(f.source, 'tdd/SKILL.md', 'skill');
  f.put(f.source, 'tdd/references', 'old reference');
  f.update();
  rmSync(join(f.source, 'tdd/references'));
  f.put(f.source, 'tdd/references/ref.md', 'nested reference');
  assert.equal(f.update().find(c => c.path === '.agents/skills/tdd')?.action, 'updated');
  assert.deepEqual(f.snapshot(join(f.target, 'tdd')), f.snapshot(join(f.source, 'tdd')));
  rmSync(join(f.source, 'tdd/references'), { recursive: true });
  f.put(f.source, 'tdd/references', 'flat reference');
  assert.equal(f.update().find(c => c.path === '.agents/skills/tdd')?.action, 'updated');
  assert.deepEqual(f.snapshot(join(f.target, 'tdd')), f.snapshot(join(f.source, 'tdd')));
});

test('new skill names are installed unless the project already owns the folder', t => {
  const f = fixture(t);
  f.put(f.source, 'tdd/SKILL.md', 'old');
  f.update();
  f.put(f.source, 'new-skill/SKILL.md', 'new');
  f.put(f.source, 'project-skill/SKILL.md', 'shipped');
  f.put(f.target, 'project-skill/local.md', 'project-owned folder without a SKILL.md');
  const own = f.snapshot(join(f.target, 'project-skill'));
  const changes = f.update();
  assert.equal(changes.find(c => c.path === '.agents/skills/new-skill')?.action, 'created');
  assert.deepEqual(f.snapshot(join(f.target, 'new-skill')), f.snapshot(join(f.source, 'new-skill')));
  assert.equal(changes.find(c => c.path === '.agents/skills/project-skill')?.action, 'kept');
  assert.deepEqual(f.snapshot(join(f.target, 'project-skill')), own);
  assert.ok(f.manifest()['new-skill']);
  assert.equal(Object.hasOwn(f.manifest(), 'project-skill'), false);
});

test('a file of the human\'s inside a managed skill keeps the whole skill when cland ships that path', t => {
  const f = fixture(t);
  f.put(f.source, 'tdd/SKILL.md', 'old');
  f.update();
  const installed = f.manifest();
  f.put(f.target, 'tdd/NOTES.md', 'ours');
  const edited = f.snapshot(join(f.target, 'tdd'));
  f.put(f.source, 'tdd/SKILL.md', 'new');
  f.put(f.source, 'tdd/NOTES.md', 'cland notes');
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.deepEqual(f.update().find(c => c.path === '.agents/skills/tdd'), { path: '.agents/skills/tdd',
      action: 'kept', note: 'edited in the project; cland ships a newer version' });
    assert.deepEqual(f.snapshot(join(f.target, 'tdd')), edited);
    assert.deepEqual(f.manifest(), installed, 'added file is not adopted');
  }
  // Taking cland's version is the human's act: remove the whole skill first.
  rmSync(join(f.target, 'tdd'), { recursive: true });
  f.update();
  assert.deepEqual(f.snapshot(join(f.target, 'tdd')), f.snapshot(join(f.source, 'tdd')));
  assert.ok(!Array.isArray(f.manifest().tdd) && Object.hasOwn(f.manifest().tdd!, 'NOTES.md'));
});
