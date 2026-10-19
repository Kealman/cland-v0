// The migration executable remains a real CLI subprocess. Its nested `cland task`
// commands use the production parser/socket client directly, avoiding a fresh Node
// process per link. Native task CLI startup is covered by the task CLI contracts.
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { runTask } from '../src/cli/task.ts';

const cli = fileURLToPath(new URL('../bin/cland.ts', import.meta.url));
async function execute(file: string, args: string[]) {
  assert.equal(file, process.execPath);
  assert.equal(args[0], cli, 'the migration invokes the shipped task CLI');
  assert.equal(args[1], 'task');
  assert.equal(args.at(-1), '--json');
  let stdout = '', stderr = '';
  const code = await runTask(args.slice(2), process.cwd(), {
    out: text => { stdout += text; }, err: text => { stderr += text; },
  });
  if (code !== 0) throw Object.assign(new Error(stderr), { code, stdout, stderr });
  return { stdout, stderr };
}
// The executable promisifies execFile. Preserve that public result shape while
// refusing any unexpected subprocess instead of silently passing it through.
const injected = Object.assign(() => { throw new Error('expected promisified migration task command'); }, { [promisify.custom]: execute });
Object.defineProperty(childProcess, 'execFile', { value: injected });
syncBuiltinESMExports();
