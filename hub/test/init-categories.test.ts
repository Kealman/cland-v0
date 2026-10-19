// T1: provision and Tracker APIs prove category defaults in scratch HOME/XDG folders; no processes or hub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { provision } from '../src/init/provision.ts';
import { layout } from '../src/project.ts';
import { Tracker } from '../src/tracker/tracker.ts';
import { planMigration } from '../src/tracker/migrate.ts';
import { emptyFolder, scratchMachine } from './init-machine.ts';

test('init seeds the four open root categories with shared item numbers', async t => {
  const machine = await scratchMachine(t, { identity: false });
  const root = await emptyFolder(machine);
  const changes = await provision(root, { territory: false, categories: true, env: machine.env });
  const tracker = new Tracker({ root, db: layout(root).db, env: machine.env });
  try {
    tracker.rescan();
    assert.deepEqual(tracker.list({ kind: 'category' }).map(({ id, title, state, parent }) => ({ id, title, state, parent })), [
      { id: 'C-1', title: 'Bugs', state: 'open', parent: null },
      { id: 'C-2', title: 'Tech debt', state: 'open', parent: null },
      { id: 'C-3', title: 'Follow-ups', state: 'open', parent: null },
      { id: 'C-4', title: 'Ideas', state: 'open', parent: null },
    ]);
    assert.deepEqual(changes.filter(change => /tasks\/C-/.test(change.path)).map(({ action, note }) => ({ action, note })), [
      { action: 'created', note: 'category Bugs' },
      { action: 'created', note: 'category Tech debt' },
      { action: 'created', note: 'category Follow-ups' },
      { action: 'created', note: 'category Ideas' },
    ]);
  } finally { await tracker.stop(); }
});

test('repeat init preserves the item count and category bytes', async t => {
  const machine = await scratchMachine(t, { identity: false });
  const root = await emptyFolder(machine);
  await provision(root, { territory: false, categories: true, env: machine.env });
  const tracker = new Tracker({ root, db: layout(root).db, env: machine.env });
  try {
    tracker.rescan();
    const before = tracker.list();
    const bytes = await Promise.all(before.map(item => readFile(join(layout(root).tasks, item.file), 'utf8')));
    const changes = await provision(root, { territory: false, categories: true, env: machine.env });
    tracker.rescan();
    assert.deepEqual(tracker.list(), before);
    assert.deepEqual(await Promise.all(before.map(item => readFile(join(layout(root).tasks, item.file), 'utf8'))), bytes);
    assert.ok(!changes.some(change => change.path.startsWith('.cland/tasks/') && change.action === 'created'));
    assert.ok(changes.some(change => change.path === '.cland/tasks' && change.action === 'unchanged' && change.note === 'the four categories are present'));
  } finally { await tracker.stop(); }
});

test('init keeps an existing Ideas category byte-identical', async t => {
  const machine = await scratchMachine(t, { identity: false });
  const root = await emptyFolder(machine);
  await provision(root, { territory: false, env: machine.env });
  const tracker = new Tracker({ root, db: layout(root).db, env: machine.env });
  const actor = { id: 'fixture', name: 'fixture', role: null, human: true };
  try {
    const ideas = await tracker.create(actor, { kind: 'category', title: 'Ideas', body: 'Human notes stay here.', labels: ['custom'] });
    const before = await readFile(join(root, ideas.path), 'utf8');
    const changes = await provision(root, { territory: false, categories: true, env: machine.env });
    tracker.rescan();
    assert.equal(await readFile(join(root, ideas.path), 'utf8'), before);
    assert.deepEqual(tracker.list().map(item => [item.id, item.title]), [
      ['C-1', 'Ideas'], ['C-2', 'Bugs'], ['C-3', 'Tech debt'], ['C-4', 'Follow-ups'],
    ]);
    assert.deepEqual(changes.filter(change => change.path.startsWith('.cland/tasks/C-') && change.action === 'created').map(change => change.note), [
      'category Bugs', 'category Tech debt', 'category Follow-ups',
    ]);
  } finally { await tracker.stop(); }
});

test('init does not repurpose a different kind or a closed category', async t => {
  const machine = await scratchMachine(t, { identity: false });
  const root = await emptyFolder(machine);
  await provision(root, { territory: false, env: machine.env });
  const tracker = new Tracker({ root, db: layout(root).db, env: machine.env });
  const actor = { id: 'fixture', name: 'fixture', role: null, human: true };
  try {
    const question = await tracker.create(actor, { kind: 'question', title: 'Bugs' });
    const category = await tracker.create(actor, { kind: 'category', title: 'Tech debt' });
    await tracker.close(actor, category.id);
    const paths = [question.path, category.path];
    const before = await Promise.all(paths.map(path => readFile(join(root, path), 'utf8')));
    await provision(root, { territory: false, categories: true, env: machine.env });
    tracker.rescan();
    assert.deepEqual(await Promise.all(paths.map(path => readFile(join(root, path), 'utf8'))), before);
    assert.deepEqual(tracker.list({ kind: 'category', state: 'open' }).map(item => [item.id, item.title]), [
      ['C-3', 'Bugs'], ['C-4', 'Tech debt'], ['C-5', 'Follow-ups'], ['C-6', 'Ideas'],
    ]);
  } finally { await tracker.stop(); }
});

test('update provisioning leaves a project without categories', async t => {
  const machine = await scratchMachine(t, { identity: false });
  const root = await emptyFolder(machine);
  await provision(root, { territory: false, categories: false, env: machine.env });
  const tracker = new Tracker({ root, db: layout(root).db, env: machine.env });
  try {
    tracker.rescan();
    assert.deepEqual(tracker.list(), []);
  } finally { await tracker.stop(); }
});

test('migration seeds the same titles as init', async t => {
  const machine = await scratchMachine(t, { identity: false });
  const root = await emptyFolder(machine);
  await provision(root, { territory: false, categories: true, env: machine.env });
  const tracker = new Tracker({ root, db: layout(root).db, env: machine.env });
  try {
    tracker.rescan();
    assert.deepEqual(planMigration([], 1).categories.map(category => category.title).sort(), tracker.list({ kind: 'category' }).map(item => item.title).sort());
  } finally { await tracker.stop(); }
});

test('init skips categories when the configured ladder has no root category', async t => {
  const machine = await scratchMachine(t, { identity: false });
  const root = await emptyFolder(machine);
  await provision(root, { territory: false, env: machine.env });
  const configPath = layout(root).config;
  const original = await readFile(configPath, 'utf8');
  for (const levels of ['[]', '["initiative","feature"]', '["release","category"]']) {
    const custom = original.replace(/^levels = .*$/m, `levels = ${levels}`);
    await writeFile(configPath, custom);
    const changes = await provision(root, { territory: false, categories: true, env: machine.env });
    assert.equal(await readFile(configPath, 'utf8'), custom);
    assert.deepEqual(changes.filter(change => change.path.startsWith('.cland/tasks') && change.path !== '.cland/tasks/.gitkeep'), [
      { path: '.cland/tasks', action: 'unchanged', note: 'categories skipped: the ladder has no root category' },
    ]);
    const tracker = new Tracker({ root, db: layout(root).db, env: machine.env });
    try {
      tracker.rescan();
      assert.deepEqual(tracker.list(), []);
    } finally { await tracker.stop(); }
  }
});
