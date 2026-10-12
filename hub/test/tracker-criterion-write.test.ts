import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import files, { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, connectUi, connectWsUi, spawnSpoke, startDaemon, startHub, tempProject } from './harness.ts';
import { taskWriteGate } from './tracker-write-gate.ts';
import { Tracker, type ItemView } from '../src/tracker/tracker.ts';

test('MCP done assigns legacy ids and CLI done writes the checkbox and a mark', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const made = await ui.request({ type: 'task.create', title: 'Write criteria', body: 'Intro\n\n## Acceptance criteria\n- [ ] First\n- [x] Second\n\n## Other\nKeep this.' });
  const item = (made.value as { item: ItemView }).item;
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  const marked = await coord.call<{ item: ItemView }>('task.criterion', { id: item.id, op: 'done', criterion: 'C1' });
  assert.deepEqual(marked.item.criteria.map(c => [c.id, c.checked, c.marks.map(m => m.kind)]), [['C1', true, ['done']], ['C2', true, []]]);
  assert.match(marked.item.body, /## Other\nKeep this\./);
  const result = await cland(root, 'task', 'criterion', item.id, 'done', 'C2', '--json');
  assert.equal(result.code, 0, result.stderr);
  const final = (JSON.parse(result.stdout) as { item: ItemView }).item;
  assert.equal(final.criteria[1]?.marks[0]?.kind, 'done');
  assert.match(await readFile(join(root, final.path), 'utf8'), /- \[x\] C2\. Second\n  - done: human · /);
});

test('verify and fail write run and note; failure clears done and reopens the task in progress', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const item = ((await ui.request({ type: 'task.create', title: 'Fail criteria', body: '## Acceptance criteria\n- [ ] First' })).value as { item: ItemView }).item;
  const rev = await spawnSpoke({ discover: true, cwd: root, name: 'rev', role: 'reviewer', sessionId: 'rev-id' });
  const qa = await spawnSpoke({ discover: true, cwd: root, name: 'qa-1', role: 'qa', sessionId: 'qa-id' });
  t.after(() => rev.close()); t.after(() => qa.close());
  const legacy = ((await ui.request({ type: 'task.create', title: 'Legacy checkbox', body: '## Acceptance criteria\n- [x] Legacy checked without done' })).value as { item: ItemView }).item;
  const legacyVerified = await rev.call<{ item: ItemView }>('task.criterion', { id: legacy.id, op: 'verify', criterion: 'C1', run: 'legacy-1' });
  assert.equal(legacyVerified.item.criteria[0]?.checked, false, 'a hub-written verification checkbox mirrors the absent done mark');
  await rev.call('subscribe', { subject: { item: item.id }, events: ['task'] });
  assert.equal((await cland(root, 'task', 'criterion', item.id, 'done', 'C1')).code, 0);
  const verified = await rev.call<{ item: ItemView }>('task.criterion', { id: item.id, op: 'verify', criterion: 'C1', run: 'rev-1' });
  assert.deepEqual(verified.item.criteria[0]?.marks.map(m => [m.kind, m.by]), [['done', 'human'], ['verified', 'rev [reviewer]']]);
  assert.match(verified.item.body, /- verified: rev \[reviewer\] · run rev-1 · /);
  const event = await ui.waitFor(f => f.type === 'message' && String((f.message as { text: string }).text).includes('criterion marked C1 verified'));
  assert.match((event.message as { text: string }).text, new RegExp(`${item.id} criterion marked C1 verified`));
  const cliVerify = await cland(root, 'task', 'criterion', item.id, 'verify', 'C1', '--run', 'cli-rev-1', '--as', 'rev', '--json');
  assert.equal(cliVerify.code, 0, cliVerify.stderr);
  assert.match((JSON.parse(cliVerify.stdout) as { item: ItemView }).item.body, /run cli-rev-1/);
  const missingRun = await rev.call<{ ok: boolean; error: string }>('task.criterion', { id: item.id, op: 'verify', criterion: 'C1' });
  assert.equal(missingRun.ok, false); assert.match(missingRun.error, /needs a run id/);
  const missingNote = await qa.call<{ ok: boolean; error: string }>('task.criterion', { id: item.id, op: 'fail', criterion: 'C1' });
  assert.equal(missingNote.ok, false); assert.match(missingNote.error, /needs a note/);
  assert.equal((await cland(root, 'task', 'close', item.id)).code, 0);
  const failed = await qa.call<{ item: ItemView }>('task.criterion', { id: item.id, op: 'fail', criterion: 'C1', note: 'Reconnect drops the clause' });
  assert.equal(failed.item.status, 'in progress'); assert.equal(failed.item.state, 'open');
  assert.equal(failed.item.criteria[0]?.checked, false);
  assert.deepEqual(failed.item.criteria[0]?.marks.map(m => m.kind), ['failed']);
  assert.match(failed.item.body, /- failed: qa-1 \[qa\] · .* · note Reconnect drops the clause/);
  assert.equal((await ui.request({ type: 'task.criterion', item: item.id, op: 'verify', criterion: 'C1', run: 'human-1' })).ok, false);
  const cliFail = await cland(root, 'task', 'criterion', item.id, 'fail', 'C1', '--note', 'CLI failure note', '--as', 'qa-1', '--json');
  assert.equal(cliFail.code, 0, cliFail.stderr);
  assert.match((JSON.parse(cliFail.stdout) as { item: ItemView }).item.body, /note CLI failure note/);
});

test('add edit remove retain unrelated prose and never reuse an id after restart', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const item = ((await ui.request({ type: 'task.create', title: 'Edit criteria', body: '## Acceptance criteria\n- [ ] C7. Existing\n- [ ] Legacy\n\nKeep this prose.\n\n## Other\nDo not touch.' })).value as { item: ItemView }).item;
  for (const args of [['edit', 'C7', 'Reworded'], ['add', 'New one'], ['remove', 'C9']] as const) {
    const result = await cland(root, 'task', 'criterion', item.id, ...args, '--json');
    assert.equal(result.code, 0, result.stderr);
  }
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  await startDaemon(t, root);
  const added = await cland(root, 'task', 'criterion', item.id, 'add', 'After restart', '--json');
  assert.equal(added.code, 0, added.stderr);
  const final = (JSON.parse(added.stdout) as { item: ItemView }).item;
  assert.deepEqual(final.criteria.map(c => [c.id, c.text]), [['C7', 'Reworded'], ['C8', 'Legacy'], ['C10', 'After restart']]);
  assert.match(final.body, /Keep this prose\./); assert.match(final.body, /## Other\nDo not touch\./);
  assert.match(await readFile(join(root, final.path), 'utf8'), /criterion_seq: 10/);
});

test('each role is limited to its criterion operations and done requires a live claim', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const item = ((await ui.request({ type: 'task.create', title: 'Permissions', assignee: 'impl', body: '## Acceptance criteria\n- [ ] C1. First' })).value as { item: ItemView }).item;
  const sessions = [];
  for (const [name, role] of [['coord', 'coordinator'], ['impl', 'implementer'], ['rev', 'reviewer'], ['qa-1', 'qa'], ['none', undefined], ['aide-1', 'aide']] as const) {
    const spoke = await spawnSpoke({ discover: true, cwd: root, name, sessionId: `cli:${name}`, ...(role ? { role } : {}) });
    sessions.push(spoke); t.after(() => spoke.close());
    if (!role) {
      // Revoke a live connection: clearing before the asynchronous hello refuses admission instead of a tool.
      await spoke.waitForPresence([name]);
      assert.equal((await ui.request({ type: 'role.clear', session: name })).ok, true);
    }
    for (const op of ['done', 'verify', 'fail', 'add', 'edit', 'remove']) {
      const shouldAllow = role === 'coordinator' || role === 'aide' ? ['done', 'add', 'edit', 'remove'].includes(op) : role === 'reviewer' || role === 'qa' ? ['verify', 'fail'].includes(op) : false;
      const result = await spoke.call<{ ok?: boolean; code?: string; reason?: string; item?: ItemView }>('task.criterion', { id: item.id, op, criterion: ((await ui.request({ type: 'task.view', item: item.id })).value as { item: ItemView }).item.criteria[0]!.id, run: 'r-1', note: 'Failed', text: 'First' });
      if (shouldAllow) {
        assert.ok(result.item, `${role} ${op}: ${JSON.stringify(result)}`);
        if (op === 'remove') assert.equal((await ui.request({ type: 'task.criterion', item: item.id, op: 'add', text: 'First' })).ok, true);
      } else { assert.equal(result.ok, false, `${role} ${op}`); assert.equal(result.code, 'forbidden', `${role} ${op}: ${JSON.stringify(result)}`); assert.ok(result.reason); }
    }
  }
  const impl = sessions[1]!;
  assert.ok((await impl.call<{ claim: unknown }>('task.claim', { id: item.id })).claim);
  const current = ((await ui.request({ type: 'task.view', item: item.id })).value as { item: ItemView }).item.criteria[0]!.id;
  const aideDone = await cland(root, 'task', 'criterion', item.id, 'done', current!, '--as', 'aide-1', '--json');
  assert.equal(aideDone.code, 0, aideDone.stderr);
  assert.equal((JSON.parse(aideDone.stdout) as { item: ItemView }).item.criteria[0]?.marks[0]?.by, 'aide-1');
  for (const op of ['verify', 'fail']) {
    const refused = await cland(root, 'task', 'criterion', item.id, op, current!, '--run', 'aide-run', '--note', 'Failed', '--as', 'aide-1');
    assert.notEqual(refused.code, 0); assert.match(refused.stderr, /require Reviewer or QA/);
  }
  assert.ok((await impl.call<{ item: ItemView }>('task.criterion', { id: item.id, op: 'done', criterion: current })).item);
  await impl.call('task.claim', { id: item.id, release: true });
  assert.equal((await impl.call<{ ok: boolean }>('task.criterion', { id: item.id, op: 'done', criterion: current })).ok, false);
});

test('a concurrent hand save refuses the criterion write and retry keeps both changes', async t => {
  const root = await tempProject(t);
  const gate = await taskWriteGate(t, root);
  const { discovery } = await startDaemon(t, root, gate.env);
  const ui = await connectUi(t, discovery);
  const item = ((await ui.request({ type: 'task.create', title: 'Concurrent', body: '## Acceptance criteria\n- [ ] First\n\n## Notes\nOriginal.' })).value as { item: ItemView }).item;
  const path = join(root, item.path);
  await gate.arm();
  const writing = ui.request({ type: 'task.criterion', item: item.id, op: 'done', criterion: 'C1' });
  await gate.entered();
  const edited = (await readFile(path, 'utf8')).replace('Original.', 'Hand-written note.');
  await writeFile(path, edited);
  await gate.release();
  const refused = await writing;
  assert.equal(refused.ok, false); assert.match(refused.error!, /concurrent hand edit.*retry/);
  assert.equal(await readFile(path, 'utf8'), edited);
  const retry = await ui.request({ type: 'task.criterion', item: item.id, op: 'done', criterion: 'C1' });
  assert.equal(retry.ok, true, retry.error);
  const final = (retry.value as { item: ItemView }).item;
  assert.match(final.body, /Hand-written note\./); assert.equal(final.criteria[0]?.marks[0]?.kind, 'done');
});

test('a criterion grant revoked during the write refuses without assigning ids', async t => {
  const root = await tempProject(t);
  const gate = await taskWriteGate(t, root);
  const { discovery } = await startDaemon(t, root, gate.env);
  const ui = await connectUi(t, discovery);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'coord-id' });
  t.after(() => coord.close());
  const item = ((await ui.request({ type: 'task.create', title: 'Revoked', body: '## Acceptance criteria\n- [ ] First' })).value as { item: ItemView }).item;
  const original = await readFile(join(root, item.path), 'utf8');
  await gate.arm();
  const writing = coord.call<{ ok: boolean; code: string }>('task.criterion', { id: item.id, op: 'done', criterion: 'C1' });
  await gate.entered();
  assert.equal((await ui.request({ type: 'role.clear', session: 'coord' })).ok, true);
  await gate.release();
  const refused = await writing;
  assert.equal(refused.ok, false); assert.equal(refused.code, 'forbidden');
  assert.equal(await readFile(join(root, item.path), 'utf8'), original);
});

test('marks preserve fenced examples and wrapped text and refuse malformed marks', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const body = '## Acceptance criteria\n- [ ] C1. Wrapped\n  continuation\n\n```\n- [ ] C99. Example\n```\n  - done: impl-1 · 2026-10-09T10:00Z\n\n## Other\nUntouched';
  const item = ((await ui.request({ type: 'task.create', title: 'Source', body })).value as { item: ItemView }).item;
  const marked = await ui.request({ type: 'task.criterion', item: item.id, op: 'done', criterion: 'C1' });
  assert.equal(marked.ok, true, marked.error);
  assert.match((marked.value as { item: ItemView }).item.body, /```\n- \[ \] C99\. Example\n```/);
  assert.equal((marked.value as { item: ItemView }).item.criteria[0]?.text, 'Wrapped\ncontinuation');
  await ui.request({ type: 'task.edit', item: item.id, body: '## Acceptance criteria\n- [ ] C1. First\n  - done: impl-1 · yesterday' });
  const malformed = await ui.request({ type: 'task.criterion', item: item.id, op: 'done', criterion: 'C1' });
  assert.equal(malformed.ok, false); assert.match(malformed.error!, /malformed/);
});

for (const save of ['capture', 'publish'] as const) {
  test(`an editor save racing criterion ${save} survives a refused write`, async t => {
    const root = await tempProject(t);
    let armed = false;
    let edited = '';
    const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), files: { ...files,
      rename: async (from, to) => {
        if (armed && save === 'capture' && String(to).endsWith('.conflict')) {
          armed = false;
          edited = (await readFile(String(from), 'utf8')).replace('Original.', 'Saved during capture.');
          const editor = `${from}.editor`;
          await writeFile(editor, edited);
          await files.rename(editor, from);
        }
        await files.rename(from, to);
      },
      link: async (from, to) => {
        if (armed && save === 'publish' && String(from).endsWith('.tmp')) {
          armed = false;
          const captured = (await files.readdir(join(root, '.cland', 'tasks'))).find(n => n.endsWith('.conflict'))!;
          edited = (await readFile(join(root, '.cland', 'tasks', captured), 'utf8')).replace('Original.', 'Saved during publication.');
          await writeFile(to, edited);
        }
        await files.link(from, to);
      },
    } });
    t.after(() => tracker.stop());
    const hub = await startHub({ tracker });
    t.after(() => hub.close());
    const ui = await connectWsUi(t, hub);
    const item = ((await ui.request({ type: 'task.create', title: 'Race', body: '## Acceptance criteria\n- [ ] First\n\n## Notes\nOriginal.' })).value as { item: ItemView }).item;
    armed = true;
    const refused = await ui.request({ type: 'task.criterion', item: item.id, op: 'done', criterion: 'C1' });
    assert.equal(refused.ok, false); assert.match(refused.error!, /concurrent hand.*retry/);
    assert.equal(await readFile(join(root, item.path), 'utf8'), edited);
    const retry = await ui.request({ type: 'task.criterion', item: item.id, op: 'done', criterion: 'C1' });
    assert.equal(retry.ok, true, retry.error);
    const final = (retry.value as { item: ItemView }).item;
    assert.equal(final.criteria[0]?.checked, true);
    assert.match(final.body, /Saved during/);
  });
}

test('a late in-place editor save refuses the mark and retains its recovery source', async t => {
  const root = await tempProject(t);
  let editor: files.FileHandle | undefined;
  let captured: string | undefined;
  let edited = '';
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), files: { ...files,
    rename: async (from, to) => {
      if (String(to).endsWith('.conflict')) captured = String(to);
      await files.rename(from, to);
    },
    unlink: async path => {
      if (editor && String(path).endsWith('.tmp')) {
        await editor.truncate(0);
        await editor.writeFile(edited, 'utf8');
        await editor.close(); editor = undefined;
      }
      await files.unlink(path);
    },
  } });
  t.after(() => tracker.stop()); t.after(async () => { await editor?.close(); });
  const hub = await startHub({ tracker }); t.after(() => hub.close());
  const ui = await connectWsUi(t, hub);
  const item = ((await ui.request({ type: 'task.create', title: 'Late save', body: '## Acceptance criteria\n- [ ] First\n\n## Notes\nOriginal.' })).value as { item: ItemView }).item;
  const path = join(root, item.path);
  edited = (await readFile(path, 'utf8')).replace('Original.', 'Late in-place save.');
  editor = await files.open(path, 'r+');
  const refused = await ui.request({ type: 'task.criterion', item: item.id, op: 'done', criterion: 'C1' });
  assert.equal(refused.ok, false); assert.match(refused.error!, /concurrent in-place hand edit.*recover.*retry/);
  assert.ok(captured); assert.equal(await readFile(captured, 'utf8'), edited);
  // Recover the source named by the refusal, then retry the criterion operation.
  await writeFile(path, edited);
  const retry = await ui.request({ type: 'task.criterion', item: item.id, op: 'done', criterion: 'C1' });
  assert.equal(retry.ok, true, retry.error);
  assert.match((retry.value as { item: ItemView }).item.body, /Late in-place save\./);
  assert.equal((retry.value as { item: ItemView }).item.criteria[0]?.checked, true);
});

test('a named human CLI actor can mark done and manage criteria but cannot verify', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const created = await cland(root, 'task', 'create', 'Named human', '--body', '## Acceptance criteria\n- [ ] First', '--json');
  const item = (JSON.parse(created.stdout) as { item: ItemView }).item;
  for (const args of [['done', 'C1'], ['edit', 'C1', '--text', 'Reworded'], ['add', 'Second'], ['remove', 'C2']] as const) {
    const result = await cland(root, 'task', 'criterion', item.id, ...args, '--as', 'alice', '--json');
    assert.equal(result.code, 0, result.stderr);
    const updated = (JSON.parse(result.stdout) as { item: ItemView }).item;
    if (args[0] === 'done') assert.equal(updated.criteria[0]?.marks[0]?.by, 'alice');
  }
  const refused = await cland(root, 'task', 'criterion', item.id, 'verify', 'C1', '--run', 'alice-run', '--as', 'alice', '--json');
  assert.notEqual(refused.code, 0); assert.match(refused.stderr, /require Reviewer or QA/);
});

test('add refuses insertion inside an unclosed Markdown code fence without changing the file', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  for (const body of ['## Acceptance criteria\n- [ ] First\n\n```markdown\nAn unfinished example', 'Details\n\n~~~\nAn unfinished example']) {
    const item = ((await ui.request({ type: 'task.create', title: 'Open fence', body })).value as { item: ItemView }).item;
    const before = await readFile(join(root, item.path), 'utf8');
    const added = await ui.request({ type: 'task.criterion', item: item.id, op: 'add', text: 'Visible criterion' });
    assert.equal(added.ok, false); assert.match(added.error!, /unclosed.*fence/);
    assert.equal(await readFile(join(root, item.path), 'utf8'), before);
  }
});

test('restart recovers an item after the criterion process is killed between capture and publication', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
  const made = await cland(root, 'task', 'create', 'Crash recovery', '--body', '## Acceptance criteria\n- [ ] First', '--json');
  assert.equal(made.code, 0, made.stderr);
  const item = (JSON.parse(made.stdout) as { item: ItemView }).item;
  const original = await readFile(join(root, item.path), 'utf8');
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  const script = `
    import files from 'node:fs/promises';
    import { Tracker } from ${JSON.stringify(new URL('../src/tracker/tracker.ts', import.meta.url).href)};
    const tracker = new Tracker({ root: ${JSON.stringify(root)}, db: ${JSON.stringify(join(root, '.cland', 'hub.db'))}, files: {
      ...files, rename: async (from, to) => {
        await files.rename(from, to);
        if (String(to).endsWith('.conflict')) process.kill(process.pid, 'SIGKILL');
      }
    } });
    tracker.start();
    await tracker.criterion({ id: 'human', name: 'human', role: null }, ${JSON.stringify(item.id)}, { op: 'done', criterion: 'C1' });
  `;
  await assert.rejects(promisify(execFile)(process.execPath, ['--input-type=module', '-e', script]), error => (error as NodeJS.ErrnoException & { signal?: string }).signal === 'SIGKILL');
  await startDaemon(t, root);
  const recovered = await cland(root, 'task', 'view', item.id, '--json');
  assert.equal(recovered.code, 0, recovered.stderr);
  assert.equal((JSON.parse(recovered.stdout) as { item: ItemView }).item.criteria[0]?.checked, false);
  assert.equal(await readFile(join(root, item.path), 'utf8'), original);
});
