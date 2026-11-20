// T2: isolated filesystem aliases and injected unlink failures; no native process.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { basename, dirname, join } from 'node:path';
import { mkdir, lstat, readFile, symlink } from 'node:fs/promises';
import { residueControl } from './fixture-residue-control.ts';
import { fixtureSocketPath, removeFixtureSockets } from '../../shared/fixture-sockets.ts';
import { readAliasClosure } from '../../shared/fixture-alias-closure.ts';
import { fixtureCleanupPlan, removeLiteralFixture } from '../bin/cleanup-native-fixtures.ts';

test('only a positively closed reciprocal alias can be unlinked from the reviewed dry run', t => residueControl(t).run(async c => {
  const root = await c.root(), storage = join(root, '.fixture-sockets');
  const alias = dirname(fixtureSocketPath(root, 'closed-control'));
  const original = fs.unlinkSync;
  c.restore(() => { fs.unlinkSync = original; syncBuiltinESMExports(); });
  fs.unlinkSync = ((path: fs.PathLike) => { if (path === alias) throw Object.assign(Error('planted unlink failure'), { code: 'EACCES' }); return original(path); }) as typeof fs.unlinkSync;
  syncBuiltinESMExports();
  await c.step('closed teardown with held unlink', () => assert.rejects(removeFixtureSockets(root), /planted unlink failure/));
  fs.unlinkSync = original; syncBuiltinESMExports();
  assert.ok(readAliasClosure(alias), 'teardown persisted positive closure before failed unlink');
  const plan = await c.step('dry run', () => fixtureCleanupPlan(dirname(alias), [], new Set([basename(alias)])));
  // The inventory may contain other fixtures; authority remains this exact row.
  const row = plan.rows.find(row => row.path === alias)!;
  assert.equal(row.eligible, true);
  const receipt = join(root, 'removal.jsonl');
  assert.throws(() => removeLiteralFixture(plan, alias, receipt), /outside fixture root/);
  const outer = await c.root();
  const receiptPath = join(outer, 'removal.jsonl');
  const changed = { ...plan, rows: plan.rows.map(value => ({ ...value, inode: value.inode + 1 })) };
  assert.throws(() => removeLiteralFixture(changed, alias, receiptPath), /changed closure proof/);
  assert.equal((await lstat(alias)).isSymbolicLink(), true, 'identity mismatch retained the alias');
  assert.throws(() => removeLiteralFixture({ ...plan, rows: [] }, alias, receiptPath), /changed closure proof/);
  removeLiteralFixture(plan, alias, receiptPath);
  await assert.rejects(lstat(alias), { code: 'ENOENT' });
  assert.equal((await lstat(storage)).isDirectory(), true, 'target storage retained');
  assert.deepEqual((await readFile(receiptPath, 'utf8')).trim().split('\n').map(line => JSON.parse(line).event), ['removing', 'removed']);
}));

test('reallocation invalidates closure and legacy aliases and inherited homes stay retained', t => residueControl(t).run(async c => {
  const root = await c.root(), parent = await c.root();
  const alias = dirname(fixtureSocketPath(root, 'live-control'));
  assert.equal(readAliasClosure(alias), null);
  for (const name of ['hc-live', 'cland-suite-live', 'cland-account-fixture-live', 'cland-h-' + 'a'.repeat(20)]) await mkdir(join(parent, name));
  await symlink(join(root, '.fixture-sockets'), join(parent, 'ct-' + 'b'.repeat(32)));
  const plan = await fixtureCleanupPlan(parent, [join(parent, 'hc-live', 'home', 'idle-descendant')]);
  assert.equal(plan.counts.eligible, 0);
  assert.equal(plan.rows.find(row => row.path.endsWith('/hc-live'))?.live, true);
  assert.ok(plan.rows.every(row => row.reason === 'no positive alias closure proof'));
  const original = fs.unlinkSync;
  c.restore(() => { fs.unlinkSync = original; syncBuiltinESMExports(); });
  fs.unlinkSync = ((path: fs.PathLike) => { if (path === alias) throw Error('held unlink'); return original(path); }) as typeof fs.unlinkSync;
  syncBuiltinESMExports();
  await assert.rejects(removeFixtureSockets(root), /held unlink/);
  fs.unlinkSync = original; syncBuiltinESMExports();
  assert.ok(readAliasClosure(alias));
  fixtureSocketPath(root, 'reopened');
  assert.equal(readAliasClosure(alias), null);
  await removeFixtureSockets(root);
}));
