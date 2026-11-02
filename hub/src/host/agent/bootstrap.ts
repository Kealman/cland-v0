// Native admission gate. execve preserves the checkpointed PID, session and birth.
import { readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { observeProcesses } from './native.ts';
import { checkpoint } from './storage.ts';
const directory = process.argv[2]!;
const plan = JSON.parse(await readFile(join(directory, 'plan.json'), 'utf8')) as {
  launchId: string; command: string; args: string[]; cwd: string; env: Record<string, string>; fakeEnv: NodeJS.ProcessEnv;
};
const observation = (await observeProcesses([process.pid], plan.fakeEnv)).get(process.pid);
if (!observation?.identity) throw new Error('bootstrap birth unavailable');
await checkpoint(join(directory, 'birth.json'), { launchId: plan.launchId, pid: process.pid, identity: observation.identity });
// The original environment is already held in memory; never retain it as history.
await unlink(join(directory, 'plan.json'));
for (;;) {
  let release: { identity?: string } | undefined;
  try { release = JSON.parse(await readFile(join(directory, 'release.json'), 'utf8')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  if (release?.identity === observation.identity) break;
  await new Promise(resolve => setTimeout(resolve, 20));
}
process.chdir(plan.cwd);
if (!process.execve) throw new Error('native execve unavailable');
process.execve(plan.command, [plan.command, ...plan.args], plan.env);
