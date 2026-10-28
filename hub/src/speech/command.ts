import { accessSync, constants, statSync } from 'node:fs';
import { delimiter, isAbsolute, join } from 'node:path';
import { spawn } from 'node:child_process';
import { EXECUTOR_CREDENTIALS, withoutExecutorCredentials } from '../../../shared/executor-credentials.ts';
import { remoteRedactor, type RemoteRedactor } from '../remote/redact.ts';
import { SpeechError, type SpeechInput, type SpeechProvider, type SpeechResult } from './index.ts';

export class CommandProvider implements SpeechProvider {
  readonly name = 'command';
  readonly retry = false;
  readonly #argv: readonly string[];
  readonly #env: NodeJS.ProcessEnv;
  readonly #cwd: string | undefined;
  readonly #redact: RemoteRedactor;
  constructor(options: { argv: readonly string[]; env?: NodeJS.ProcessEnv; cwd?: string; redact?: RemoteRedactor }) {
    this.#argv = [...options.argv]; this.#env = options.env ?? process.env; this.#cwd = options.cwd;
    this.#redact = options.redact ?? remoteRedactor();
    this.#redact.register([...EXECUTOR_CREDENTIALS].map(name => this.#env[name] ?? ''));
  }
  async transcribe(input: SpeechInput): Promise<SpeechResult> {
    if (!this.#argv[0] || this.#argv.some(arg => arg.includes('\0'))) throw new SpeechError('not-configured', 'Speech command is not configured', undefined, this.#redact);
    if (input.signal?.aborted) throw new SpeechError('timeout', 'Speech command cancelled', undefined, this.#redact);
    return new Promise((resolve, reject) => {
      const child = spawn(this.#argv[0]!, this.#argv.slice(1), { shell: false, detached: true, cwd: this.#cwd,
        env: withoutExecutorCredentials({ ...this.#env, CLAND_SPEECH_MIME: input.mime, CLAND_SPEECH_LANGUAGE: input.languageHint ?? '' }), stdio: 'pipe' });
      let timedOut = false;
      let killTimer: ReturnType<typeof setTimeout> | undefined;
      let drainTimer: ReturnType<typeof setTimeout> | undefined;
      let groupTimer: ReturnType<typeof setTimeout> | undefined;
      let closed = false;
      const signalGroup = (signal: NodeJS.Signals) => {
        if (child.pid) { try { process.kill(-child.pid, signal); } catch { /* Owned group already exited. */ } }
      };
      const observeDrain = () => {
        let absent = child.pid === undefined;
        if (child.pid) {
          try { process.kill(-child.pid, 0); }
          catch (error) { absent = (error as NodeJS.ErrnoException).code === 'ESRCH'; }
        }
        if (closed && absent) finish();
        else groupTimer = setTimeout(observeDrain, 10);
      };
      const terminate = () => {
        if (killTimer) return;
        signalGroup('SIGTERM');
        killTimer = setTimeout(() => {
          signalGroup('SIGKILL');
          drainTimer = setTimeout(() => {
            clearTimeout(groupTimer);
            input.signal?.removeEventListener('abort', abort);
            child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy();
            reject(new SpeechError(timedOut ? 'timeout' : 'command-failed',
              `Speech command native drain incomplete; exit ${child.exitCode}; signal ${child.signalCode}; ${this.#redact.text(stderr.toString('utf8')).slice(-250)}`, undefined, this.#redact));
          }, 2_000);
          observeDrain();
        }, 100);
      };
      const abort = () => { timedOut = true; terminate(); };
      input.signal?.addEventListener('abort', abort, { once: true });
      const output: Buffer[] = [];
      let size = 0;
      let oversized = false;
      child.stdout.on('data', (bytes: Buffer) => {
        size += bytes.length;
        if (size <= 1_048_576) output.push(bytes);
        else if (!oversized) { oversized = true; terminate(); }
      });
      let stderr = Buffer.alloc(0);
      child.stderr.on('data', (bytes: Buffer) => { stderr = Buffer.concat([stderr, bytes]).subarray(-65_536); });
      let missing = false;
      child.on('error', (error: NodeJS.ErrnoException) => { missing = error.code === 'ENOENT'; });
      const finish = () => {
        input.signal?.removeEventListener('abort', abort); clearTimeout(killTimer); clearTimeout(drainTimer); clearTimeout(groupTimer);
        if (timedOut) { reject(new SpeechError('timeout', 'Speech command deadline reached', undefined, this.#redact)); return; }
        if (child.exitCode === 0 && !oversized) { resolve({ text: Buffer.concat(output).toString('utf8').trim() }); return; }
        reject(new SpeechError(missing ? 'not-configured' : 'command-failed', missing ? 'Speech command was not found'
          : 'Speech command failed: ' + this.#redact.text(stderr.toString('utf8')).slice(-400), undefined, this.#redact));
      };
      child.on('close', () => { closed = true; if (!killTimer) finish(); });
      child.stdin.on('error', () => {});
      child.stdin.end(input.audio);
    });
  }
}

/** Presence only: no process, paid call or environment mutation. */
export function resolveCommand(argv: readonly string[], env: NodeJS.ProcessEnv = process.env): string | null {
  const command = argv[0];
  if (!command || command.includes('\0')) return null;
  const candidates = isAbsolute(command) ? [command] : command.includes('/') ? []
    : (env.PATH ?? '').split(delimiter).filter(Boolean).map(path => join(path, command));
  for (const candidate of candidates) {
    try { if (statSync(candidate).isFile()) { accessSync(candidate, constants.X_OK); return candidate; } } catch { /* Fixed absence; never echo argv. */ }
  }
  return null;
}
