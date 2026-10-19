// T1: whole-skill provisioning and project-file doctor checks with injected process/Git readers;
// no sockets, child processes or clocks.
import assert from 'node:assert/strict';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { Report } from '../src/init/files.ts';
import { MANIFEST, provisionClaudeSkills, provisionSkills, readManifest } from '../src/init/skills.ts';

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
    const managed = provisionSkills(report, root, process.env.CLAND_SKILLS_SOURCE_OVERRIDE);
    provisionClaudeSkills(report, root, managed);
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

test('a dropped untouched skill is removed with the folders it leaves empty', t => {
  const f = fixture(t);
  f.put(f.source, 'tdd/SKILL.md', 'old');
  f.put(f.source, 'tdd/docs/nested/ref.md', 'reference');
  f.update();
  rmSync(join(f.source, 'tdd'), { recursive: true });
  assert.deepEqual(f.update().find(c => c.path === '.agents/skills/tdd'), {
    path: '.agents/skills/tdd', action: 'removed', note: "no longer in cland's set",
  });
  assert.equal(existsSync(join(f.target, 'tdd')), false);
  assert.equal(Object.hasOwn(f.manifest(), 'tdd'), false);
});

test('a dropped constructor skill follows whole-skill ownership', async t => {
  const f = fixture(t);
  const hash = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  const hashes = { 'SKILL.md': hash, 'docs/ref.md': hash };
  for (const name of ['constructor', 'grilling']) {
    f.put(f.source, `${name}/SKILL.md`, 'abc');
    f.put(f.source, `${name}/docs/ref.md`, 'abc');
  }
  f.update();
  const installed = { constructor: hashes, grilling: hashes };
  assert.deepEqual(f.manifest(), installed);
  for (const name of ['constructor', 'grilling']) {
    assert.equal(readFileSync(join(f.target, name, 'SKILL.md'), 'utf8'), 'abc');
    assert.equal(readFileSync(join(f.target, name, 'docs/ref.md'), 'utf8'), 'abc');
  }
  rmSync(join(f.source, 'constructor'), { recursive: true });
  for (const edited of [false, true]) {
    await t.test(edited ? 'edited' : 'untouched', () => {
      f.put(f.target, MANIFEST, JSON.stringify({ managed: 'managed by cland', skills: installed }));
      f.put(f.target, 'constructor/SKILL.md', edited ? 'project edit' : 'abc');
      f.put(f.target, 'constructor/docs/ref.md', 'abc');
      const before = f.snapshot(join(f.target, 'constructor'));
      assert.deepEqual(f.update().find(c => c.path === '.agents/skills/constructor'), {
        path: '.agents/skills/constructor', action: edited ? 'kept' : 'removed',
        note: edited ? "edited in the project; no longer in cland's set" : "no longer in cland's set",
      });
      if (edited) assert.deepEqual(f.snapshot(join(f.target, 'constructor')), before);
      else assert.equal(existsSync(join(f.target, 'constructor')), false);
      assert.deepEqual(f.manifest(), { grilling: hashes }, 'remove only the dropped install hashes');
      assert.equal(Object.hasOwn(f.manifest(), 'constructor'), false);
      assert.equal(f.update().some(c => c.path === '.agents/skills/constructor'), false);
    });
  }
});

test('invalid prototype skill names keep project bytes and manifest hashes untouched', t => {
  const f = fixture(t);
  const hash = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  f.put(f.source, 'grilling/SKILL.md', 'new release');
  for (const name of ['__proto__', 'toString']) {
    f.put(f.source, `${name}/SKILL.md`, 'new release');
    f.put(f.target, `${name}/SKILL.md`, 'project edit');
    f.put(f.target, 'grilling/SKILL.md', 'abc');
    const skills = Object.fromEntries([name, 'grilling'].map(key => [key, { 'SKILL.md': hash }]));
    f.put(f.target, MANIFEST, JSON.stringify({ managed: 'managed by cland', skills }));
    rmSync(join(f.source, name), { recursive: true });
    const before = f.snapshot(f.target);
    assert.deepEqual(readManifest(f.target), {
      kind: 'invalid', why: `skill name "${name}" is not [a-z0-9-]+`,
    });
    for (let attempt = 0; attempt < 2; attempt++) {
      const change = f.update().find(c => c.path === `.agents/skills/${MANIFEST}`);
      assert.equal(change?.action, 'kept');
      assert.match(change?.note ?? '', /an invalid manifest/);
      assert.deepEqual(f.snapshot(f.target), before, 'preserve all bytes, including the install hashes');
      assert.deepEqual(JSON.parse(readFileSync(join(f.target, MANIFEST), 'utf8')).skills, skills);
    }
  }
});

test('a legacy manifest migrates once before project edits gain whole-skill protection', t => {
  const f = fixture(t);
  for (const name of ['tdd', 'grilling']) f.put(f.source, `${name}/SKILL.md`, 'abc');
  f.put(f.target, 'tdd/SKILL.md', 'project edit before hashes');
  f.put(f.target, 'tdd/local.md', 'project addition');
  f.put(f.target, 'grilling/SKILL.md', 'abc');
  f.put(f.target, 'dropped/SKILL.md', 'edited dropped skill');
  f.put(f.target, 'dropped-untouched/SKILL.md', 'old dropped skill');
  f.put(f.target, MANIFEST, JSON.stringify({ managed: 'managed by cland 0.1.3', skills: {
    tdd: ['SKILL.md'], grilling: ['SKILL.md'], dropped: ['SKILL.md'], 'dropped-untouched': ['SKILL.md'],
  } }));

  const first = f.update();
  const warnings = first.filter(c => c.note?.startsWith('warning:'));
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.path, `.agents/skills/${MANIFEST}`);
  assert.match(warnings[0]?.note ?? '', /no hashes/);
  assert.match(warnings[0]?.note ?? '', /overwrit.*this once/);
  assert.match(warnings[0]?.note ?? '', /edits.*lost/);
  assert.match(warnings[0]?.note ?? '', /differed.*dropped, dropped-untouched, tdd.*git/);
  assert.match(warnings[0]?.note ?? '', /from now on.*keeps.*edited in the project/i);
  assert.equal(readFileSync(join(f.target, 'tdd/SKILL.md'), 'utf8'), 'abc');
  assert.equal(readFileSync(join(f.target, 'tdd/local.md'), 'utf8'), 'project addition');
  for (const name of ['dropped', 'dropped-untouched']) assert.equal(existsSync(join(f.target, name)), false);
  const hash = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  const installed = { grilling: { 'SKILL.md': hash }, tdd: { 'SKILL.md': hash } };
  assert.deepEqual(f.manifest(), installed, 'record the written bytes, excluding project additions');

  f.put(f.target, 'grilling/SKILL.md', 'project edit after hashes');
  f.put(f.source, 'grilling/SKILL.md', 'new release');
  const second = f.update();
  assert.deepEqual(second.find(c => c.path === '.agents/skills/grilling'), {
    path: '.agents/skills/grilling', action: 'kept', note: 'edited in the project; cland ships a newer version',
  });
  assert.equal(second.some(c => c.note?.startsWith('warning:')), false);
  assert.equal(readFileSync(join(f.target, 'grilling/SKILL.md'), 'utf8'), 'project edit after hashes');
  assert.equal(readFileSync(join(f.target, 'tdd/local.md'), 'utf8'), 'project addition');
  assert.deepEqual(f.manifest(), installed, 'retain install hashes rather than adopting project edits');
});

test('doctor recommends migrating a legacy skill manifest without changing it', async t => {
  const f = fixture(t);
  mkdirSync(join(f.root, '.cland'));
  f.put(f.source, 'tdd/SKILL.md', 'abc');
  f.put(f.target, 'tdd/SKILL.md', 'project edit');
  f.put(f.target, MANIFEST, JSON.stringify({ managed: 'managed by cland 0.1.3', skills: { tdd: ['SKILL.md'] } }));
  const before = f.snapshot(f.target);
  const { checkProject } = await import('../src/doctor/project.ts');
  const check = async () => (await checkProject(f.root, { started: async () => null, territoryProblems: () => null }))
    .find(c => c.name === 'skills manifest');
  const legacy = await check();
  assert.equal(legacy?.verdict, 'warn');
  assert.match(legacy?.detail ?? '', /no hashes/);
  assert.equal(legacy?.fix, 'cland update');
  assert.deepEqual(f.snapshot(f.target), before, 'doctor is read-only');
  f.update();
  assert.equal((await check())?.verdict, 'ok');
});

test('a dropped edited skill becomes the project\'s own even if cland ships its name again', t => {
  const f = fixture(t);
  f.put(f.source, 'tdd/SKILL.md', 'old');
  f.put(f.source, 'tdd/docs/ref.md', 'reference');
  f.put(f.source, 'grilling/SKILL.md', 'abc');
  f.update();
  const installed = f.manifest();
  for (const edit of ['edited', 'deleted', 'added']) {
    f.put(f.target, MANIFEST, JSON.stringify({ managed: 'managed by cland', skills: installed }));
    rmSync(join(f.target, 'tdd'), { recursive: true });
    f.put(f.target, 'tdd/SKILL.md', 'old');
    f.put(f.target, 'tdd/docs/ref.md', 'reference');
    if (edit === 'edited') f.put(f.target, 'tdd/SKILL.md', 'project edit');
    if (edit === 'deleted') rmSync(join(f.target, 'tdd/SKILL.md'));
    if (edit === 'added') f.put(f.target, 'tdd/local/notes.md', 'project notes');
    rmSync(join(f.source, 'tdd'), { recursive: true, force: true });
    const own = f.snapshot(join(f.target, 'tdd'));
    assert.deepEqual(f.update().find(c => c.path === '.agents/skills/tdd'), {
      path: '.agents/skills/tdd', action: 'kept', note: "edited in the project; no longer in cland's set",
    }, edit);
    assert.deepEqual(f.snapshot(join(f.target, 'tdd')), own);
    assert.deepEqual(f.manifest(), { grilling: installed.grilling }, 'only the handed-over entry leaves the manifest');
    assert.equal(f.update().some(c => c.path.startsWith('.agents/skills/tdd')), false);
    f.put(f.source, 'tdd/SKILL.md', 'new release');
    assert.equal(f.update().find(c => c.path === '.agents/skills/tdd')?.action, 'kept');
    assert.deepEqual(f.snapshot(join(f.target, 'tdd')), own, 're-shipping cannot reclaim the skill');
    assert.deepEqual(f.manifest(), { grilling: installed.grilling });
  }
});

test('Claude links follow dropped skill removal or handover in the project\'s own skills folder', t => {
  const f = fixture(t);
  const claude = join(f.root, '.claude/skills');
  mkdirSync(claude, { recursive: true });
  for (const name of ['tdd', 'grilling']) f.put(f.source, `${name}/SKILL.md`, 'abc');
  f.update();
  const link = readlinkSync(join(claude, 'tdd'));
  f.put(f.target, 'tdd/SKILL.md', 'project edit');
  for (const name of ['tdd', 'grilling']) rmSync(join(f.source, name), { recursive: true });
  f.update();
  assert.equal(existsSync(join(claude, 'grilling')), false);
  assert.equal(readdirSync(claude).includes('grilling'), false, 'remove the link itself, not just its target');
  assert.ok(lstatSync(join(claude, 'tdd')).isSymbolicLink());
  assert.equal(readlinkSync(join(claude, 'tdd')), link);
  assert.equal(readFileSync(join(claude, 'tdd/SKILL.md'), 'utf8'), 'project edit');
  f.update();
  assert.equal(readlinkSync(join(claude, 'tdd')), link);
});

test('a link on a dropped skill path retains its install hashes without touching its target', t => {
  const f = fixture(t);
  for (const name of ['untouched', 'edited']) f.put(f.source, `${name}/SKILL.md`, 'abc');
  f.update();
  const installed = f.manifest();
  for (const name of ['untouched', 'edited']) {
    const outside = join(f.root, name);
    renameSync(join(f.target, name), outside);
    symlinkSync(outside, join(f.target, name));
    if (name === 'edited') f.put(outside, 'SKILL.md', 'project edit');
    rmSync(join(f.source, name), { recursive: true });
    const own = f.snapshot(outside);
    for (let attempt = 0; attempt < 2; attempt++) {
      const changes = f.update();
      assert.match(changes.find(c => c.path === `.agents/skills/${name}`)?.note ?? '', /^symlink:/);
      assert.equal(changes.find(c => c.path === `.agents/skills/${name}`)?.action, 'kept');
      assert.deepEqual(f.snapshot(outside), own);
      assert.deepEqual(f.manifest(), installed, 'a refused link retains the original hashes');
    }
  }
});

test('a link inside a dropped skill keeps the complete skill under cland ownership', t => {
  const f = fixture(t);
  f.put(f.source, 'tdd/SKILL.md', 'abc');
  f.put(f.source, 'tdd/docs/ref.md', 'abc');
  f.update();
  const installed = f.manifest();
  const outside = join(f.root, 'outside.md');
  f.put(f.root, 'outside.md', 'project reference');
  rmSync(join(f.target, 'tdd/docs/ref.md'));
  symlinkSync(outside, join(f.target, 'tdd/docs/ref.md'));
  rmSync(join(f.source, 'tdd'), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.match(f.update().find(c => c.path === '.agents/skills/tdd/docs/ref.md')?.note ?? '', /^symlink:/);
    assert.deepEqual(f.manifest(), installed, 'refused links retain all install hashes');
    assert.equal(readFileSync(join(f.target, 'tdd/SKILL.md'), 'utf8'), 'abc');
    assert.equal(readlinkSync(join(f.target, 'tdd/docs/ref.md')), outside);
    assert.equal(readFileSync(outside, 'utf8'), 'project reference');
  }
});

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
