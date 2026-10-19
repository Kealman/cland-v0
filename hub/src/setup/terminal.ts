import { spawn } from 'node:child_process';
import { constants } from 'node:os';
import type { EventEmitter } from 'node:events';

export type TerminalSpawner = (bin: string, args: readonly string[], options: { env: NodeJS.ProcessEnv; cwd: string; stdio: 'inherit' }) => EventEmitter;

/** The child shares the terminal's process group and receives its signals directly.
 * Setup ignores Ctrl+C and Ctrl+\ only while the child owns that terminal.
 */
export async function terminalCommand(bin: string, args: readonly string[], options: { env: NodeJS.ProcessEnv; cwd: string }, deps: { spawn?: TerminalSpawner; signals?: Pick<NodeJS.Process, 'on' | 'removeListener'> | EventEmitter } = {}): Promise<number> {
  const signals = deps.signals ?? process;
  const ignore = () => {};
  signals.on('SIGINT', ignore);
  signals.on('SIGQUIT', ignore);
  try {
    return await new Promise<number>((resolve, reject) => {
      const child = (deps.spawn ?? spawn)(bin, args, { ...options, stdio: 'inherit' });
      child.once('error', reject);
      child.once('close', (code: number | null, signal: NodeJS.Signals | null) => {
        resolve(signal ? 128 + constants.signals[signal] : code ?? 1);
      });
    });
  } finally {
    signals.removeListener('SIGINT', ignore);
    signals.removeListener('SIGQUIT', ignore);
  }
}
