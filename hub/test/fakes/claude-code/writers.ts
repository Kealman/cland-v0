// Every fake CLI (including polls) registers before it can write the home.
import { existsSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { captureProcess } from '../../process-cleanup.ts';

export function registerWriter(home: string, session: boolean): boolean {
  const registry = process.env.FAKE_CLAUDE_WRITERS;
  if (!registry) return true; // standalone fake, outside fakeClaude's ownership
  const active = join(home, 'writers-open');
  if (!existsSync(active)) return false;
  const identity = captureProcess(process.pid);
  if (!identity) throw new Error('fake Claude writer has no process identity');
  try {
    const temporary = join(registry, `${process.pid}.tmp`);
    writeFileSync(temporary, JSON.stringify({ ...identity, session }));
    renameSync(temporary, join(registry, `${process.pid}.json`));
  }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
  // Cleanup may close admission between the first check and registration. A
  // rejected invocation never creates directories or writes calls/jobs afterwards.
  return existsSync(active);
}
