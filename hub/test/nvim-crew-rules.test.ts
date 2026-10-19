// T2: CLI and injected-clock crew reload rules; recorded header screens live in nvim/test/crew.test.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { clandWithEnv, projectHub, connectUi, eventually, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';


test('sessions header follows crew CLI and hand edits, retaining the last good summary on refusal and refresh', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const { discovery } = await projectHub(t, root, {}, { clock });
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const summary = async () => ((await ui.request({ type: 'hub.status' })).value as { crew: { summary: string } }).crew.summary;
  assert.match(await summary(), /rev pool 1/);
  const set = await clandWithEnv(root, {}, 'crew', 'set', 'reviewer.size', '2');
  assert.equal(set.code, 0, set.stderr);
  assert.match(await summary(), /rev pool 2/);
  const path = join(root, '.cland/crew.toml');
  const good = await readFile(path, 'utf8');
  await writeFile(path, good.replace('leads = []', 'leads = ["epic"]'));
  await clock.advance(500);
  await eventually('hand edit updates crew', async () => (await summary()).includes('leads: epic') || undefined);
  assert.match(await summary(), /rev pool 2.*leads: epic/);
  const beforeRefusal = ui.frames.length;
  await writeFile(path, '[crew.reviewer]\nsize = 0\n');
  // The refusal must arrive before checking retention, rather than checking before the poll can run.
  await clock.advance(500);
  await eventually('invalid crew source refused', () => ui.frames.slice(beforeRefusal).find(f => f.type === 'message' && String((f.message as { text?: string })?.text).includes('crew refused')));
  await ui.request({ type: 'hub.status', flushLogs: true });
  const log = await readFile(join(root, '.cland/log/hub.log'), 'utf8');
  assert.match(log, /crew-refused/);
  assert.match(await summary(), /rev pool 2.*leads: epic/);
  await writeFile(path, good);
  await clock.advance(500);
  await eventually('valid crew restored', async () => (await summary()).includes('leads: none') || undefined);
  assert.match(await summary(), /rev pool 2.*leads: none/);
});
