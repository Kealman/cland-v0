import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Fake transport evidence retains environment keys only, including credential keys. */
export async function recordMachineCall(root: string, mode: string | undefined, args: readonly string[], faults: object, env: NodeJS.ProcessEnv): Promise<void> {
  await appendFile(join(root, 'machine-calls.jsonl'), `${JSON.stringify({ mode, args, faults, env: Object.keys(env).sort() })}\n`);
}
