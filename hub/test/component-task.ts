// T2: the production task CLI parser/formatter over its real socket, with explicit IO and environment.
// Native entrypoint/process coverage stays in the calling files; input tables need no new Node child.
import assert from 'node:assert/strict';
import { runCrew } from '../src/cli/crew.ts';
import { runTask } from '../src/cli/task.ts';
import type { CliResult } from './harness.ts';

export async function componentTask(cwd: string, command: string, ...args: string[]): Promise<CliResult> {
  assert.equal(command, 'task');
  let stdout = '', stderr = '';
  const io = { out: (text: string) => { stdout += text; }, err: (text: string) => { stderr += text; } };
  try {
    const code = await runTask(args, cwd, io, {});
    return { code, stdout, stderr };
  } catch (error) {
    return { code: 1, stdout, stderr: stderr + `cland: ${error instanceof Error ? error.message : String(error)}\n` };
  }
}

export async function componentTaskJson<T>(cwd: string, ...args: string[]): Promise<T> {
  const result = await componentTask(cwd, 'task', ...args, '--json');
  assert.equal(result.code, 0, result.stderr);
  return JSON.parse(result.stdout) as T;
}

/** Same crew parser, formatter and shell identity as the native entrypoint. */
export async function componentCrewWithEnv(cwd: string, env: NodeJS.ProcessEnv, command: string, ...args: string[]): Promise<CliResult> {
  assert.equal(command, 'crew');
  let stdout = '', stderr = '';
  try {
    const code = await runCrew(args, cwd, { out: text => { stdout += text; } }, env);
    return { code, stdout, stderr };
  } catch (error) {
    stderr += `cland: ${error instanceof Error ? error.message : String(error)}\n`;
    return { code: 1, stdout, stderr };
  }
}
