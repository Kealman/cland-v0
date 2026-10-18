// T1: init/update reject unsafe roots before provisioning, using only scratch filesystem markers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { runInit, runUpdate } from '../src/cli/init.ts';
import { scratchMachine, filesFolder, snapshot } from './init-machine.ts';
import { captureCli } from './cli-in-process.ts';

test('init/update refuse an ancestor root without changing the scratch machine', { timeout: 5000 }, async t => {
  const machine = await scratchMachine(t, { identity: false });
  const oldHome = process.env.HOME;
  process.env.HOME = machine.home;
  t.after(() => { if (oldHome === undefined) delete process.env.HOME; else process.env.HOME = oldHome; });
  const folder = await filesFolder(machine);
  await mkdir(join(machine.home, '.cland', 'executor'), { recursive: true });
  await writeFile(join(machine.home, '.cland', 'executor', 'spend.json'), '{"version":1,"entries":[]}');
  const before = await snapshot(machine.root);
  for (const command of [runInit, runUpdate]) {
    for (const args of [[], [folder], [relative(machine.root, folder)]]) {
      const cwd = args.length ? machine.root : folder;
      const result = await captureCli(write => command(args, cwd, write));
      assert.equal(result.code, 1, 'an ancestor must never be provisioned');
      assert.ok(result.stderr.includes(folder), result.stderr);
      assert.ok(result.stderr.includes(machine.home), result.stderr);
      assert.deepEqual(await snapshot(machine.root), before, 'refusal writes nothing, including outside the target');
    }
  }
});

test('init/update refuse HOME through a directory alias', { timeout: 5000 }, async t => {
  const machine = await scratchMachine(t, { identity: false });
  const oldHome = process.env.HOME;
  process.env.HOME = machine.home;
  t.after(() => { if (oldHome === undefined) delete process.env.HOME; else process.env.HOME = oldHome; });
  const alias = join(machine.root, 'home-alias');
  await symlink(machine.home, alias);
  const before = await snapshot(machine.root);
  for (const command of [runInit, runUpdate]) {
    for (const args of [[], [machine.home], [alias]]) {
      const result = await captureCli(write => command(args, machine.home, write));
      assert.equal(result.code, 1);
      assert.match(result.stderr, /HOME/);
      assert.deepEqual(await snapshot(machine.root), before);
    }
  }
});

test('init/update reject repository subfolders and linked worktrees', { timeout: 5000 }, async t => {
  const machine = await scratchMachine(t, { identity: false });
  const root = await filesFolder(machine);
  const subfolder = join(root, 'src');
  const admin = join(root, '.git', 'worktrees', 'linked');
  await mkdir(admin, { recursive: true });
  await writeFile(join(admin, 'commondir'), '../..');
  const linked = await filesFolder(machine);
  await writeFile(join(linked, '.git'), `gitdir: ${admin}\n`);
  const before = await snapshot(machine.root);
  for (const command of [runInit, runUpdate]) {
    for (const target of [subfolder, linked]) {
      for (const args of [[], [target]]) {
        const result = await captureCli(write => command(args, target, write));
        assert.equal(result.code, 1);
        assert.ok(result.stderr.includes(target), result.stderr);
        assert.ok(result.stderr.includes(root), result.stderr);
        assert.deepEqual(await snapshot(machine.root), before);
      }
    }
  }
});

test('update accepts an explicit project root through an alias from a subfolder', { timeout: 5000 }, async t => {
  const machine = await scratchMachine(t, { identity: false });
  const root = await filesFolder(machine);
  await mkdir(join(root, '.cland'));
  const alias = join(machine.root, 'project-alias');
  await symlink(root, alias);
  const before = await snapshot(machine.root, { except: root });
  const result = await captureCli(write => runUpdate([alias, '--json'], join(root, 'src'), write));
  assert.equal(result.code, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).root, root);
  assert.deepEqual(await snapshot(machine.root, { except: root }), before);
});
