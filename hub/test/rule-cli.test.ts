// T2: CLI parsing/identity, concurrent CLI writers and workbench provenance use real socket frames.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { cland, clandWithEnv, connectUi, dispatcherUi, projectHub, tempProject } from './harness.ts';
import { value } from './validation-support.ts';
import type { Rule } from '../src/rules/rulebook.ts';

test('rule shell writes use the held identity: only human and Aide write, with restricted origins', async t => {
  const root = await tempProject(t);
  const { discovery, dispatcher } = await projectHub(t, root);
  const cli = await connectUi(t, discovery, 'cli');
  const ui = await dispatcherUi(t, dispatcher, root);
  for (const [name, role] of [['assistant', 'aide'], ['impl', 'implementer'], ['coord', 'coordinator']] as const) {
    assert.equal((await ui.request({ type: 'role.set', session: name, role })).ok, true);
  }
  const aide = (frame: { type: string } & Record<string, unknown>) => cli.request({ ...frame, as: { name: 'assistant', role: 'implementer', shell: true } });
  const added = await aide({ type: 'rule.add', text: 'Seed rule.', scope: 'all', reason: 'seed', origin: 'memory:/planning/rules.md' });
  assert.equal(added.ok, true, added.error);
  assert.equal((added.value as { rule: Rule }).rule.origin, 'memory:/planning/rules.md');
  const direct = await aide({ type: 'rule.add', text: 'Aide decision.', scope: 'aide', reason: 'human delegate' });
  assert.equal(direct.ok, true, direct.error);
  assert.equal((direct.value as { rule: Rule }).rule.origin, 'session:assistant');
  const edited = await aide({ type: 'rule.edit', number: 1, reason: 'clarified' });
  assert.equal(edited.ok, true, edited.error);
  assert.equal((edited.value as { rule: Rule }).rule.origin, 'memory:/planning/rules.md');
  const path = join(root, '.cland/RULES.md');
  const before = await readFile(path, 'utf8');
  for (const name of ['impl', 'coord', 'unknown-session']) {
    for (const fields of [{ type: 'rule.add', text: 'Invented.', scope: 'all', reason: 'invented' }, { type: 'rule.edit', number: 1, text: 'Invented.' }, { type: 'rule.retire', number: 1, reason: 'invented' }]) {
      const refused = await cli.request({ ...fields, as: { name, role: 'aide', shell: true } });
      assert.equal(refused.ok, false);
      assert.match(refused.error ?? '', /forbidden.*rule\.(add|edit|retire).*human.*Aide/);
    }
    const read = await cli.request({ type: 'rule.list', all: true, as: { name, shell: true } });
    assert.equal(read.ok, true, read.error);
  }
  for (const origin of ['shell', 'workbench', 'session:other', 'message:general/fake']) {
    const refused = await aide({ type: 'rule.add', text: 'Spoofed.', scope: 'all', reason: 'spoof', origin });
    assert.equal(refused.ok, false);
    assert.match(refused.error ?? '', /origin.*memory/);
  }
  assert.equal(await readFile(path, 'utf8'), before);
  const retired = await aide({ type: 'rule.retire', number: 1, reason: 'finished' });
  assert.equal(retired.ok, true, retired.error);
  assert.equal((retired.value as { rule: Rule }).rule.origin, 'memory:/planning/rules.md');
  assert.equal((retired.value as { rule: Rule }).rule.retired_origin, 'session:assistant');
});

test('concurrent rule CLI writes serialize numbers without losing rules; invalid input leaves the file intact', async t => {
  const root = await tempProject(t);
  const { dispatcher } = await projectHub(t, root);
  const ui = await dispatcherUi(t, dispatcher, root);
  const results = await Promise.all(['First', 'Second', 'Third'].map(text => cland(root, 'rule', 'add', text, '--scope', 'all', '--reason', text, '--json')));
  for (const result of results) assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(results.map(r => JSON.parse(r.stdout).rule.number).sort(), [1, 2, 3]);
  const path = join(root, '.cland/RULES.md');
  const before = await readFile(path, 'utf8');
  for (const frame of [
    { type: 'rule.add', text: 'Bad', scope: 'unknown', reason: 'why' },
    { type: 'rule.add', text: 'Bad', scope: 'all', reason: '' },
    { type: 'rule.add', text: 'Bad', scope: 'all', reason: 'why', title: 'title\ninjection' },
    { type: 'rule.edit', number: 1 }, { type: 'rule.retire', number: 1 }, { type: 'rule.list', role: 'unknown' },
  ]) {
    const result = await ui.request(frame);
    assert.equal(result.ok, false, JSON.stringify(frame));
    assert.equal(await readFile(path, 'utf8'), before);
  }

});

test('workbench writes record their own origin and push full rules, while session and CLI origins stay bounded', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery, 'nvim');
  await ui.request({ type: 'subscribe' });
  const added = await ui.request({ type: 'rule.add', text: 'Human decision.', scope: 'all', reason: 'direct', origin: 'message:general/forged' });
  assert.equal(added.ok, true, added.error);
  assert.equal((added.value as { rule: Rule }).rule.origin, 'workbench');
  const push = ui.frames.find(f => f.type === 'rules.changed');
  assert.equal((push?.rules as Rule[])[0]?.text, 'Human decision.');
  const cli = await connectUi(t, discovery, 'cli');
  await value(cli, { type: 'rule.add', text: 'Shell decision.', scope: 'all', reason: 'shell' });
  const edit = await cli.request({ type: 'rule.edit', number: 2, text: 'CLI clarification.', origin: 'session:forged' });
  assert.equal(edit.ok, true, edit.error);
  assert.equal((edit.value as { rule: Rule }).rule.origin, 'shell', 'extra wire fields cannot forge edit provenance');
  const wbEdit = await ui.request({ type: 'rule.edit', number: 2, text: 'Workbench clarification.' });
  assert.equal(wbEdit.ok, true, wbEdit.error);
  assert.equal((wbEdit.value as { rule: Rule }).rule.origin, 'workbench');
  const retired = await ui.request({ type: 'rule.retire', number: 1, reason: 'replaced' });
  assert.equal(retired.ok, true, retired.error);
  assert.equal((retired.value as { rule: Rule }).rule.origin, 'workbench');
  assert.equal((retired.value as { rule: Rule }).rule.retired_origin, 'workbench');
  const lastPush = ui.frames.filter(f => f.type === 'rules.changed').at(-1);
  assert.deepEqual((lastPush?.rules as Rule[]).map(r => [r.number, r.status]), [[1, 'retired'], [2, 'active']]);
  await ui.request({ type: 'role.set', session: 'impl', role: 'implementer' });
  const refused = await ui.request({ type: 'rule.add', text: 'Invented.', scope: 'all', reason: 'invented', as: { name: 'impl', shell: true } });
  assert.equal(refused.ok, false);
  assert.match(refused.error!, /forbidden.*human.*Aide/);
});

test('rule CLI renders numbered rules and filters retired entries', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const cli = await connectUi(t, discovery, 'cli');
  await value(cli, { type: 'rule.add', text: 'First.', scope: 'implementer', reason: 'first' });
  await value(cli, { type: 'rule.add', text: 'Second.', scope: 'coordinator', reason: 'second' });
  const show = await cland(root, 'rule', 'show', '1');
  assert.equal(show.code, 0, show.stderr); assert.match(show.stdout, /rule 1/); assert.doesNotMatch(show.stdout, /R-1/);
  await value(cli, { type: 'rule.retire', number: 1, reason: 'superseded' });
  assert.deepEqual((await value<{ rules: Rule[] }>(cli, { type: 'rule.list' })).rules.map(rule => rule.number), [2]);
  assert.deepEqual((await value<{ rules: Rule[] }>(cli, { type: 'rule.list', all: true, role: 'implementer' })).rules.map(rule => rule.number), [1]);
  assert.equal((await value<{ rules: Rule[] }>(cli, { type: 'rule.list', all: true })).rules.length, 2);
  const path = join(root, '.cland/RULES.md');
  const before = await readFile(path, 'utf8');
  for (const number of ['R-1', '99']) {
    const result = await cland(root, 'rule', 'show', number);
    assert.notEqual(result.code, 0);
    assert.equal(await readFile(path, 'utf8'), before);
  }
  const aide = await clandWithEnv(root, { CLAND_SESSION_NAME: 'unknown', CLAND_ROLE: 'aide' }, 'rule', 'add', 'Forged.', '--scope', 'all', '--reason', 'spoof');
  assert.equal(aide.code, 1); assert.match(aide.stderr, /forbidden.*human.*Aide/);
});
