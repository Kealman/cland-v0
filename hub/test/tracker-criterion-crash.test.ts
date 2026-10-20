// T3: SIGKILL between capture and publication proves recovery from an interrupted writer process.
import { onCleanup, ownProcess } from './process-cleanup.ts';
import test, { type TestContext } from 'node:test';
import { execFile, type ExecFileException } from 'node:child_process';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject } from './harness.ts';
import { Tracker } from '../src/tracker/tracker.ts';

test('restart recovers an item after the criterion process is killed between capture and publication', t => crashRecovery(t, 'capture'));
test('restart retains edited source after the criterion process is killed following live publication', t => crashRecovery(t, 'publication'));

async function crashRecovery(t: TestContext, phase: 'capture' | 'publication') {
  const root = await tempProject(t);
  const actor = { id: 'human', name: 'human', role: null };
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db') });
  onCleanup(t, () => tracker.stop());
  const item = await tracker.create(actor, { size: 'M', title: 'Crash recovery', body: '## Acceptance criteria\n- [ ] First' });
  const original = await readFile(join(root, item.path), 'utf8');
  await tracker.stop();
  const script = `
    import files from 'node:fs/promises';
    import { Tracker } from ${JSON.stringify(new URL('../src/tracker/tracker.ts', import.meta.url).href)};
    let captured;
    const phase = ${JSON.stringify(phase)};
    const die = async () => {
      await new Promise(resolve => process.stdout.write(phase + '\\n', resolve));
      process.kill(process.pid, 'SIGKILL');
    };
    const tracker = new Tracker({ root: ${JSON.stringify(root)}, db: ${JSON.stringify(join(root, '.cland', 'hub.db'))}, files: {
      ...files, rename: async (from, to) => {
        await files.rename(from, to);
        if (String(from).endsWith('.md') && String(to).endsWith('.tmp')) {
          captured = String(to);
          if (phase === 'capture') await die();
        }
      },
      link: async (from, to) => {
        await files.link(from, to);
        if (phase === 'publication' && captured) {
          await files.writeFile(captured, (await files.readFile(captured, 'utf8')).replace('title: Crash recovery', 'title: Editor recovery'));
          await die();
        }
      },
    } });
    tracker.start();
    await tracker.criterion({ id: 'human', name: 'human', role: null }, ${JSON.stringify(item.id)}, { op: 'done', criterion: 'C1' });
  `;
  const result = Promise.withResolvers<{ error: ExecFileException | null; stdout: string }>();
  const child = execFile(process.execPath, ['--input-type=module', '-e', script],
    { timeout: 5000, killSignal: 'SIGKILL', signal: t.signal },
    (error, stdout) => result.resolve({ error, stdout }));
  const closed = new Promise<void>(resolve => child.once('close', () => resolve()));
  const stop = ownProcess(t, child.pid);
  onCleanup(t, async () => { await stop(); await closed; });
  try {
    const receipt = await result.promise;
    assert.equal(receipt.error?.signal, 'SIGKILL');
    assert.equal(receipt.error?.killed, false, 'the capture hook kills itself; the timeout is only a failure bound');
    assert.equal(receipt.stdout, `${phase}\n`, 'the writer reached the asserted boundary before its real SIGKILL');
  } finally {
    await stop();
    await closed;
  }
  const recovered = new Tracker({ root, db: join(root, '.cland', 'hub.db') });
  onCleanup(t, () => recovered.stop());
  recovered.start();
  assert.equal((await recovered.view(item.id)).criteria[0]?.checked, phase === 'publication');
  if (phase === 'capture') assert.equal(await readFile(join(root, item.path), 'utf8'), original);
  else {
    const captures = (await readdir(join(root, '.cland/tasks'))).filter(name => name.endsWith('.conflict'));
    assert.equal(captures.length, 1, 'startup preserves the edited source when a generated live path exists');
    assert.equal(await readFile(join(root, '.cland/tasks', captures[0]!), 'utf8'), original.replace('title: Crash recovery', 'title: Editor recovery'));
    assert.match(await readFile(join(root, item.path), 'utf8'), /title: Crash recovery/);
  }
}
