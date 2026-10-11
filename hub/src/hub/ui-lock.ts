// ui.json's hub and Neovim writers use a nonempty directory installed atomically.
// Recovery removes only the observed dead owner's unique name; rmdir cannot
// remove a successor's nonempty directory. PID uncertainty preserves ownership.
import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import type { Resumed } from './worktrees.ts';

const absent = (err: unknown) => (err as NodeJS.ErrnoException).code === 'ENOENT';
const occupied = (err: unknown) => ['EEXIST', 'ENOTEMPTY'].includes((err as NodeJS.ErrnoException).code ?? '');
const dead = (pid: number): boolean => {
  if (!Number.isSafeInteger(pid) || pid < 1) return false;
  try { process.kill(pid, 0); return false; }
  catch (err) { return (err as NodeJS.ErrnoException).code === 'ESRCH'; }
};
const busy = () => new Error('ui.json is being saved; retry the visibility choice');

async function removeEmpty(path: string, resumed: Resumed): Promise<void> {
  try { await fs.rmdir(path); }
  catch (err) { resumed(() => { if (!absent(err) && !occupied(err)) throw err; }); }
}

export async function acquireUiLock(path: string, resumed: Resumed): Promise<() => Promise<void>> {
  const name = resumed(() => `${randomUUID()}.owner`);
  const temporary = `${path}.${name}.tmp`;
  await fs.mkdir(temporary, { mode: 0o700 });
  try {
    await fs.writeFile(`${temporary}/${name}`, String(process.pid), { mode: 0o600, flag: 'wx' });
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await fs.rename(temporary, path);
        return resumed(() => async () => {
          await fs.rm(`${path}/${name}`, { force: true });
          await removeEmpty(path, resumed);
        });
      } catch (err) { resumed(() => { if (!occupied(err)) throw err; }); }
      let names: string[];
      try { names = await fs.readdir(path); }
      catch (err) { if (resumed(() => absent(err))) continue; throw err; }
      for (const owner of names) {
        resumed(() => { if (!/^[a-f0-9-]+\.owner$/.test(owner)) throw busy(); });
        let text: string;
        try { text = await fs.readFile(`${path}/${owner}`, 'utf8'); }
        catch (err) { if (resumed(() => absent(err))) continue; throw err; }
        resumed(() => { if (!dead(Number(text))) throw busy(); });
        // A competing recovery may have installed a different owner by now.
        // Only this observed filename is removable, never the whole directory.
        await fs.rm(`${path}/${owner}`, { force: true });
      }
      await removeEmpty(path, resumed);
    }
    return resumed(() => { throw busy(); });
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }
}
