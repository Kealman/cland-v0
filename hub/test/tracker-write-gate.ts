import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import { eventually } from './harness.ts';

/** One-shot gate for a daemon's next temporary task write, armed only after fixture setup. */
export async function taskWriteGate(t: TestContext, root: string) {
  const dir = join(root, '.cland', 'test-task-write-gate');
  await mkdir(dir, { recursive: true });
  const release = () => writeFile(join(dir, 'release'), '');
  // The fixture's process/directory cleanup may already have removed the gate.
  t.after(async () => {
    try { await release(); }
    catch (err) { if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err; }
  });
  return {
    env: { CLAND_TEST_TASK_WRITE_GATE: dir },
    arm: async () => {
      for (const name of ['entered', 'release']) await rm(join(dir, name), { force: true });
      await writeFile(join(dir, 'armed'), '');
    },
    entered: () => eventually('tracker temporary write held at release gate', async () => {
      await readFile(join(dir, 'entered'));
      return true;
    }),
    release,
  };
}
