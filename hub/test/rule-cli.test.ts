import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { readFile, rename, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { cland, clandWithEnv, connectUi, eventually, isolateVerification, startDaemon, tempProject } from './harness.ts';
import { serveProject } from '../src/hub/daemon.ts';
import { onCleanup } from './process-cleanup.ts';
import type { Rule } from '../src/rules/rulebook.ts';

test('human rule CLI adds numbered rules, edits and retires without changing another entry', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const run = async (...args: string[]) => {
    const result = await cland(root, 'rule', ...args, '--json');
    assert.equal(result.code, 0, result.stderr);
    return JSON.parse(result.stdout) as { rule: Rule; rules: Rule[] };
  };
  const one = (await run('add', 'Run one suite.', '--title', 'One suite', '--scope', 'implementer', '--reason', 'contention')).rule;
  assert.deepEqual(one, { number: 1, title: 'One suite', scope: ['implementer'], date: new Date().toISOString().slice(0, 10), status: 'active', origin: 'shell', reason: 'contention', text: 'Run one suite.' });
  assert.equal((await run('add', 'Be clear.', '--scope', 'coordinator', '--reason', 'readability')).rule.number, 2);
  const path = join(root, '.cland/RULES.md');
  const original = await readFile(path, 'utf8');
  assert.match(original, /## 1 One suite\nScope: implementer\nDate: .+\nStatus: active\nOrigin: shell\nReason: contention\n\nRun one suite\./);
  await run('edit', '1', '--scope', 'all', '--text', 'Run serially.');
  const retired = (await run('retire', '1', '--reason', 'superseded')).rule;
  assert.equal(retired.origin, 'shell');
  assert.equal(retired.status, 'retired');
  assert.equal(retired.reason, 'contention; superseded');
  assert.equal(retired.retired, retired.date);
  const edited = await readFile(path, 'utf8');
  assert.equal(edited.slice(edited.indexOf('## 2')), original.slice(original.indexOf('## 2')));
  assert.deepEqual((await run('list')).rules.map(r => r.number), [2]);
  assert.deepEqual((await run('list', '--all', '--role', 'implementer')).rules.map(r => r.number), [1]);
  assert.equal((await run('list', '--all')).rules.length, 2);
  const show = await cland(root, 'rule', 'show', '1');
  assert.equal(show.code, 0, show.stderr);
  assert.match(show.stdout, /rule 1/);
  assert.doesNotMatch(show.stdout, /R-1/);
  assert.equal((await run('add', 'Next rule.', '--scope', 'all', '--reason', 'next')).rule.number, 3);
});

test('rule shell writes use the held identity: only human and Aide write, with restricted origins', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  for (const [name, role] of [['assistant', 'aide'], ['impl', 'implementer'], ['coord', 'coordinator']] as const) {
    assert.equal((await ui.request({ type: 'role.set', session: name, role })).ok, true);
  }
  const aide = async (...args: string[]) => clandWithEnv(root, { CLAND_SESSION_NAME: 'assistant', CLAND_ROLE: 'implementer' }, 'rule', ...args, '--json');
  const added = await aide('add', 'Seed rule.', '--scope', 'all', '--reason', 'seed', '--origin', 'memory:/planning/rules.md');
  assert.equal(added.code, 0, added.stderr);
  assert.equal(JSON.parse(added.stdout).rule.origin, 'memory:/planning/rules.md');
  const direct = await aide('add', 'Aide decision.', '--scope', 'aide', '--reason', 'human delegate');
  assert.equal(direct.code, 0, direct.stderr);
  assert.equal(JSON.parse(direct.stdout).rule.origin, 'session:assistant');
  const edited = await aide('edit', '1', '--reason', 'clarified');
  assert.equal(edited.code, 0, edited.stderr);
  assert.equal(JSON.parse(edited.stdout).rule.origin, 'memory:/planning/rules.md');
  const path = join(root, '.cland/RULES.md');
  const before = await readFile(path, 'utf8');
  for (const name of ['impl', 'coord', 'unknown-session']) {
    for (const args of [['add', 'Invented.', '--scope', 'all', '--reason', 'invented'], ['edit', '1', '--text', 'Invented.'], ['retire', '1', '--reason', 'invented']]) {
      const refused = await clandWithEnv(root, { CLAND_SESSION_NAME: name, CLAND_ROLE: 'aide' }, 'rule', ...args);
      assert.equal(refused.code, 1);
      assert.match(refused.stderr, /forbidden.*rule\.(add|edit|retire).*human.*Aide/);
    }
    const read = await clandWithEnv(root, { CLAND_SESSION_NAME: name }, 'rule', 'list', '--all', '--json');
    assert.equal(read.code, 0, read.stderr);
  }
  for (const origin of ['shell', 'workbench', 'session:other', 'message:general/fake']) {
    const refused = await aide('add', 'Spoofed.', '--scope', 'all', '--reason', 'spoof', '--origin', origin);
    assert.equal(refused.code, 1);
    assert.match(refused.stderr, /origin.*memory/);
  }
  assert.equal(await readFile(path, 'utf8'), before);
  assert.equal((await aide('retire', '1', '--reason', 'finished')).code, 0);
});

test('rulebook reloads atomic hand edits, logs invalid source with its line, and keeps the last good rules', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const path = join(root, '.cland/RULES.md');
  const added = await cland(root, 'rule', 'add', 'Initial.', '--scope', 'all', '--reason', 'initial');
  assert.equal(added.code, 0, added.stderr);
  const initial = await readFile(path, 'utf8');
  const changed = initial.replace('## 1 Initial.', '## 8 Hand edit').replace('Initial.\n', 'Changed by hand.\n').replace(/Date: \S+/, 'Date: 2020-01-01');
  const list = async () => {
    const result = await cland(root, 'rule', 'list', '--all', '--json');
    assert.equal(result.code, 0, result.stderr);
    return JSON.parse(result.stdout).rules as Rule[];
  };
  await writeFile(`${path}.new`, changed);
  await rename(`${path}.new`, path);
  await eventually('hand edit reloaded without restart', async () => (await list())[0]?.text === 'Changed by hand.' ? true : undefined);
  const broken = changed.replace('Scope: all', 'Scope: unknown');
  await writeFile(path, broken);
  await eventually('invalid rulebook logged with line and reason', async () => {
    const log = await readFile(join(root, '.cland/log/hub.log'), 'utf8');
    return /"event":"rules-unreadable".*"line":5.*unknown role unknown/.test(log) ? true : undefined;
  });
  assert.equal((await list())[0]?.number, 8);
  assert.equal((await list())[0]?.text, 'Changed by hand.');
  const refused = await cland(root, 'rule', 'edit', '8', '--scope', 'all');
  assert.equal(refused.code, 1);
  assert.match(refused.stderr, /line 5.*unknown role/);
  assert.equal(await readFile(path, 'utf8'), broken, 'a write cannot overwrite malformed source');
  await writeFile(path, changed);
  const edit = await cland(root, 'rule', 'edit', '8', '--scope', 'implementer', '--json');
  assert.equal(edit.code, 0, edit.stderr);
  assert.equal(JSON.parse(edit.stdout).rule.date, new Date().toISOString().slice(0, 10));
  const next = await cland(root, 'rule', 'add', 'Next.', '--scope', 'all', '--reason', 'next', '--json');
  assert.equal(next.code, 0, next.stderr);
  assert.equal(JSON.parse(next.stdout).rule.number, 9);
});

test('concurrent rule CLI writes serialize numbers without losing rules; invalid input leaves the file intact', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const results = await Promise.all(['First', 'Second', 'Third'].map(text => cland(root, 'rule', 'add', text, '--scope', 'all', '--reason', text, '--json')));
  for (const result of results) assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(results.map(r => JSON.parse(r.stdout).rule.number).sort(), [1, 2, 3]);
  const path = join(root, '.cland/RULES.md');
  const before = await readFile(path, 'utf8');
  for (const args of [
    ['add', 'Bad', '--scope', 'unknown', '--reason', 'why'],
    ['add', 'Bad', '--scope', 'all', '--reason', ''],
    ['add', 'Bad', '--scope', 'all', '--reason', 'why', '--title', 'title\ninjection'],
    ['edit', '1'], ['show', 'R-1'], ['show', '99'], ['retire', '1'], ['list', '--role', 'unknown'],
  ]) {
    const result = await cland(root, 'rule', ...args);
    assert.notEqual(result.code, 0, JSON.stringify(args));
    assert.equal(await readFile(path, 'utf8'), before);
  }
});

test('a hand edit of another rule during the native temporary write survives a refused stale write', { timeout: 5000 }, async t => {
  const root = await tempProject(t);
  await isolateVerification(root);
  const daemon = await serveProject(root, { log: () => {} });
  const reached = Promise.withResolvers<void>(), proceed = Promise.withResolvers<void>();
  onCleanup(t, async () => { proceed.resolve(); t.mock.restoreAll(); syncBuiltinESMExports(); await daemon.stop(); });
  for (const text of ['First rule.', 'Second rule.']) {
    const added = await cland(root, 'rule', 'add', text, '--scope', 'all', '--reason', 'initial');
    assert.equal(added.code, 0, added.stderr);
  }
  const path = join(root, '.cland/RULES.md');
  const original = await readFile(path, 'utf8');
  const nativeWrite = fs.writeFile;
  let held = false;
  t.mock.method(fs, 'writeFile', async (...args: Parameters<typeof nativeWrite>) => {
    await nativeWrite(...args);
    if (!held && String(args[0]).startsWith(`${path}.`) && String(args[0]).endsWith('.tmp')) {
      held = true; reached.resolve(); await proceed.promise;
    }
  });
  syncBuiltinESMExports();
  const editing = cland(root, 'rule', 'edit', '1', '--text', 'Hub edit.');
  await reached.promise;
  const handEdit = original.replace('Second rule.\n', 'Human edit of second rule.\n');
  await writeFile(path, handEdit);
  proceed.resolve();
  const result = await editing;
  assert.equal(result.code, 1, result.stdout);
  assert.match(result.stderr, /RULES\.md changed.*retry/);
  assert.equal(await readFile(path, 'utf8'), handEdit, 'the intervening sibling edit is preserved exactly');
  assert.ok(!(await readdir(join(root, '.cland'))).some(name => name.startsWith('RULES.md.') && name.endsWith('.tmp')), 'refused write removes its temporary file');
  const retry = await cland(root, 'rule', 'edit', '1', '--text', 'Hub edit.');
  assert.equal(retry.code, 0, retry.stderr);
  const saved = await readFile(path, 'utf8');
  assert.match(saved, /Hub edit\./);
  assert.match(saved, /Human edit of second rule\./);
});

test('the rulebook high-water mark survives hand deletion; missing or low markers use the highest present number', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const add = async () => {
    const result = await cland(root, 'rule', 'add', 'Numbered.', '--scope', 'all', '--reason', 'numbering', '--json');
    assert.equal(result.code, 0, result.stderr);
    return JSON.parse(result.stdout).rule.number as number;
  };
  assert.equal(await add(), 1);
  assert.equal(await add(), 2);
  const path = join(root, '.cland/RULES.md');
  const retired = await cland(root, 'rule', 'retire', '2', '--reason', 'finished');
  assert.equal(retired.code, 0, retired.stderr);
  const initial = await readFile(path, 'utf8');
  assert.match(initial, /<!-- cland: rule high-water 2 -->/);
  await writeFile(path, initial.slice(0, initial.indexOf('## 2')));
  assert.equal(await add(), 3, 'deleting the highest retired entry cannot reuse its number');
  const marked = await readFile(path, 'utf8');
  await writeFile(path, marked.replace(/<!-- cland: rule high-water \d+ -->\n/, ''));
  assert.equal(await add(), 4, 'a missing marker falls back to highest present');
  const current = await readFile(path, 'utf8');
  await writeFile(path, current.replace('high-water 4', 'high-water 1'));
  await eventually('low high-water mark warning', async () => (await readFile(join(root, '.cland/log/hub.log'), 'utf8')).includes('rules-counter-behind') ? true : undefined);
  assert.equal(await add(), 5, 'a low marker cannot reuse a present number');
});

test('workbench writes record their own origin and push full rules, while session and CLI origins stay bounded', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery, 'nvim');
  await ui.request({ type: 'subscribe' });
  const added = await ui.request({ type: 'rule.add', text: 'Human decision.', scope: 'all', reason: 'direct', origin: 'message:general/forged' });
  assert.equal(added.ok, true, added.error);
  assert.equal((added.value as { rule: Rule }).rule.origin, 'workbench');
  const push = ui.frames.find(f => f.type === 'rules.changed');
  assert.equal((push?.rules as Rule[])[0]?.text, 'Human decision.');
  const shell = await cland(root, 'rule', 'add', 'Shell decision.', '--scope', 'all', '--reason', 'shell');
  assert.equal(shell.code, 0, shell.stderr);
  const cli = await connectUi(t, discovery, 'cli');
  const edit = await cli.request({ type: 'rule.edit', number: 2, text: 'CLI clarification.', origin: 'session:forged' });
  assert.equal(edit.ok, true, edit.error);
  assert.equal((edit.value as { rule: Rule }).rule.origin, 'shell', 'extra wire fields cannot forge edit provenance');
  const wbEdit = await ui.request({ type: 'rule.edit', number: 2, text: 'Workbench clarification.' });
  assert.equal(wbEdit.ok, true, wbEdit.error);
  assert.equal((wbEdit.value as { rule: Rule }).rule.origin, 'workbench');
  const retired = await ui.request({ type: 'rule.retire', number: 1, reason: 'replaced' });
  assert.equal(retired.ok, true, retired.error);
  assert.equal((retired.value as { rule: Rule }).rule.origin, 'workbench');
  const lastPush = ui.frames.filter(f => f.type === 'rules.changed').at(-1);
  assert.deepEqual((lastPush?.rules as Rule[]).map(r => [r.number, r.status]), [[1, 'retired'], [2, 'active']]);
  await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' });
  const refused = await ui.request({ type: 'rule.add', text: 'Invented.', scope: 'all', reason: 'invented', as: { name: 'impl', shell: true } });
  assert.equal(refused.ok, false);
  assert.match(refused.error!, /forbidden.*human.*Aide/);
});
