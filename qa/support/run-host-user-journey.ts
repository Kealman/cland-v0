// Run from the item worktree, after obtaining the native slot. No live hub mutations.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadavg } from 'node:os';
import { runnerFixtureEnvironment } from '../../hub/test/fixture-environment.ts';
import { privateInviteCapture } from './invite-capture.ts';

const [item, run, id] = process.argv.slice(2);
assert.match(item ?? '', /^T-\d+$/);
assert.match(run ?? '', /^[A-Za-z0-9][A-Za-z0-9._-]*$/);
assert.ok(['HOSTS-001', 'HOSTS-002', 'HOSTS-003', 'HOSTS-004', 'HOSTS-005'].includes(id ?? ''));
assert.ok(loadavg()[0]! < 12, 'native journey requires 1-minute load below 12');
const root = await mkdtemp('/tmp/qjourney-');
const env = runnerFixtureEnvironment(root, process.env);
const capture = privateInviteCapture();
const child = spawn(process.execPath, ['--test', resolve(`qa/cases/${id}.test.ts`)], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let refused = false;
const consume = (chunk: Buffer) => {
  if (refused) return;
  try { capture.write(chunk.toString()); } catch { refused = true; }
};
child.stdout.on('data', consume); child.stderr.on('data', consume);
const receipt = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
  child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal }));
});
// Drain to native close even when the capture refuses; no unsafe bytes reach disk.
let text = 'Capture refused; native receipt retained.\n';
if (!refused) { try { text = capture.finish().text; } catch { refused = true; } }
const result = refused || receipt.signal ? 'INCONCLUSIVE' : receipt.code === 0 ? 'PASS' : 'FAIL';
const path = join(root, `${id}.txt`);
await writeFile(path, text + '\n' + JSON.stringify({ native: receipt, result, platform: process.platform, arch: process.arch, node: process.version, browser: ['HOSTS-001', 'HOSTS-002'].includes(id!) ? 'pinned Chrome Headless Shell' : 'none', executor: 'local', fullSuite: false, source: 'current worktree; recorder build names HEAD, run report records tree cleanliness' }) + '\n');
const recorder = spawn('sh', [resolve('.agents/skills/qa/qa-record.sh'), 'note', item!, run!, id!, 'hub-api', 'scripted', result, path], { env, stdio: 'inherit' });
const recorded = await new Promise<number | null>((resolve, reject) => { recorder.once('error', reject); recorder.once('close', resolve); });
process.exitCode = recorded === 0 && result === 'PASS' ? 0 : 1;
