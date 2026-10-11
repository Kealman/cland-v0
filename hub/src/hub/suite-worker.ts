// Detached from both the CLI and the hub. Completion is a durable receipt, not a socket callback.
import { spawn } from 'node:child_process';
import { readFile, access, rename, writeFile } from 'node:fs/promises';
import { setTimeout as pause } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import type { SuiteSelection } from '../suite-selection.ts';

export async function suiteWorker(input: string): Promise<void> {
  const job = JSON.parse(await readFile(input, 'utf8')) as { cwd: string; mode: string; gate: string; result: string; selection?: SuiteSelection };
  let signal: NodeJS.Signals | null = null;
  let active: ReturnType<typeof spawn> | undefined;
  for (const name of ['SIGINT', 'SIGTERM'] as const) process.on(name, () => {
    if (signal) return;
    signal = name;
    // The worker owns this detached group; npm and the package lock runner receive the signal too.
    try { process.kill(-process.pid, name); } catch { active?.kill(name); }
  });
  const admissionDeadline = Date.now() + 15000;
  let admitted = false;
  while (!(admitted = await access(job.gate).then(() => true, () => false))) {
    if (signal || Date.now() >= admissionDeadline) break;
    await pause(25);
  }
  let code = 0;
  let cause = admitted ? '' : 'hub stopped before worker admission completed';
  try {
    const commands = [['run', 'typecheck'], ...(job.selection?.mode === 'full' ? [['test']] : job.mode === 'hub' ? [['test', '--workspace', 'hub']] : job.mode === 'nvim' ? [['run', 'test:nvim']] : [['test']])];
    if (!admitted) code = 1;
    for (const args of admitted ? commands : []) {
      if (signal) break;
      process.stdout.write(`\n$ npm ${args.join(' ')}\n`);
      const env: NodeJS.ProcessEnv = { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' };
      delete env.NODE_TEST_CONTEXT;
      delete env.CLAND_TEST_SKIP_LOCK;
      // One durable decision feeds the package runner and the result, even after restart.
      if (job.selection) env.CLAND_SUITE_SELECTION = JSON.stringify(job.selection);
      else delete env.CLAND_SUITE_SELECTION;
      active = spawn('npm', args, { cwd: job.cwd, env, stdio: ['ignore', 'inherit', 'inherit'] });
      const outcome = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
        active!.once('error', reject);
        active!.once('close', (code, signal) => resolve({ code, signal }));
      });
      active = undefined;
      code = outcome.code ?? 1;
      if (outcome.signal) cause = `npm terminated by ${outcome.signal}`;
      if (code !== 0) break;
    }
  } catch (error) { code = 1; cause = error instanceof Error ? error.message : String(error); }
  if (signal) { code = signal === 'SIGINT' ? 130 : 143; cause = `worker interrupted by ${signal}`; }
  process.stdout.write(`\nFinished: exit ${code}${cause ? `; ${cause}` : ''}\n`);
  await writeFile(`${job.result}.tmp`, JSON.stringify({ code, cause, finished: new Date().toISOString() }), { mode: 0o600 });
  await rename(`${job.result}.tmp`, job.result);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await suiteWorker(process.argv[2]!);
