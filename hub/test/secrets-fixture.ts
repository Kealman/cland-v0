// Owned native boundaries for secret CLI and Git tests. These subjects launch no descendants.
import { execFile } from 'node:child_process';
import { mkdtemp, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { fixtureEnvironment } from './fixture-environment.ts';
import { beforeDirectories, ownDirectory } from './process-cleanup.ts';
import { clandCliLaunch } from './tier-cli.ts';
import { remoteRedactor } from '../src/remote/redact.ts';

type Result = { code: number | null; signal: NodeJS.Signals | null; incomplete: string | null; stdout: string; stderr: string; argv: readonly string[]; leaked: boolean };
type Command = { result: Promise<Result>; closed: Promise<{ code: number | null; signal: NodeJS.Signals | null }>; stopAndDrain: () => Promise<void> };
type Owner = { root: string; commands: Set<Command>; values: Set<string> };
const owners = new Map<string, Owner>();
const entry = fileURLToPath(new URL('../bin/cland.ts', import.meta.url));

export async function secretProject(t: TestContext) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cland-secrets-')));
  const owner: Owner = { root, commands: new Set(), values: new Set() };
  owners.set(root, owner);
  const drain = async () => { for (const command of owner.commands) await command.stopAndDrain(); };
  const remove = ownDirectory(t, root, { beforeRemove: drain });
  beforeDirectories(t, drain);
  t.after(() => owners.delete(root));
  return { root, remove };
}

function ownerOf(cwd: string): Owner {
  for (let path = cwd; ; path = dirname(path)) {
    const owner = owners.get(path);
    if (owner) return owner;
    if (dirname(path) === path) throw new Error('secret command needs an owned disposable project');
  }
}

function launch(t: TestContext, cwd: string, executable: string, args: string[], input?: string, signal?: AbortSignal): Command {
  const owner = ownerOf(cwd);
  if (input) owner.values.add(input.replace(/\r?\n$/, ''));
  const redact = remoteRedactor([...owner.values]);
  const redactLines = (text: string) => text.split('\n').map(redact).join('\n');
  const completion = Promise.withResolvers<Omit<Result, 'code' | 'signal'>>();
  const closure = Promise.withResolvers<{ code: number | null; signal: NodeJS.Signals | null }>();
  let didClose = false;
  let tail = '';
  const child = execFile(executable, args, {
    cwd, env: fixtureEnvironment(owner.root, process.env),
    signal: signal ? AbortSignal.any([t.signal, signal]) : t.signal, timeout: 5000,
  }, (error, stdout, stderr) => {
    tail = redact(stderr.slice(-500));
    completion.resolve({ incomplete: error && typeof error.code !== 'number' ? String(error.code ?? error.name) : null,
      stdout: redactLines(stdout), stderr: redactLines(stderr), argv: child.spawnargs,
      leaked: [...owner.values].some(value => Boolean(value) && (stdout.includes(value) || stderr.includes(value))),
    });
  });
  child.once('close', (code, signal) => { didClose = true; closure.resolve({ code, signal }); });
  // EPIPE after a refused command is an input closure, not an unowned exception.
  child.stdin!.on('error', () => {});
  const result = Promise.all([completion.promise, closure.promise]).then(([captured, exit]) => ({ ...captured, ...exit }));
  let stopping: Promise<void> | undefined;
  const stopAndDrain = () => stopping ??= (async () => {
    // The ChildProcess handle is the owner: it cannot signal a recycled PID after close.
    if (!didClose) child.kill('SIGTERM');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        if (!didClose) child.kill('SIGKILL');
        reject(new Error(`secret command incomplete after stop: exit ${String(child.exitCode)}; signal ${String(child.signalCode)}; ${tail}`));
      }, 5000);
    });
    try { await Promise.race([Promise.allSettled([completion.promise, closure.promise, result]), expired]); }
    finally { clearTimeout(timer); }
  })();
  const command = { result, closed: closure.promise, stopAndDrain };
  // Register before returning or sending input; root removal repeats this exact barrier.
  owner.commands.add(command);
  beforeDirectories(t, stopAndDrain);
  if (input !== undefined) child.stdin!.end(input);
  return command;
}

export function launchSecretCli(t: TestContext, cwd: string, args: string[], options: { input?: string; signal?: AbortSignal } = {}): Command {
  return clandCliLaunch(() => launch(t, cwd, process.execPath, [entry, 'secret', ...args], options.input, options.signal));
}

export async function secretCli(t: TestContext, cwd: string, args: string[], input = ''): Promise<Result> {
  const result = await launchSecretCli(t, cwd, args, { input }).result;
  if (result.leaked) throw new Error('secret CLI leaked a registered fake value before capture redaction');
  if (result.incomplete) throw new Error(`secret CLI incomplete: ${result.incomplete}; exit ${String(result.code)}; signal ${String(result.signal)}; ${result.stderr.slice(-500)}`);
  return result;
}

export async function secretGit(t: TestContext, cwd: string, args: string[]): Promise<string> {
  const result = await launch(t, cwd, 'git', ['-c', 'gc.auto=0', ...args], '').result;
  if (result.code !== 0 || result.signal || result.incomplete) throw new Error(`secret Git incomplete: exit ${String(result.code)}; signal ${String(result.signal)}; ${result.stderr.slice(-500)}`);
  return result.stdout;
}
