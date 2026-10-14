import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { appendFile, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { shellQuote } from '../../../src/executor/droplet/machine.ts';
import { join, resolve } from 'node:path';

const run = promisify(execFile);
const [mode, ...args] = process.argv.slice(2);
const state = process.env.CLAND_TEST_FAKE_MACHINE_ROOT!;
const mapping = JSON.parse(await readFile(join(state, 'addresses.json'), 'utf8')) as Record<string, string>;
const faults = JSON.parse(await readFile(join(state, 'machine-faults.json'), 'utf8')) as { ssh?: boolean; sshFailures?: number; startReplyLost?: number; startMarkerOnly?: number; install?: boolean; marker?: boolean; delayMs?: number; delayCommand?: string };
await appendFile(join(state, 'machine-calls.jsonl'), `${JSON.stringify({ mode, args, faults, env: process.env })}\n`);
// Options in the driver's fixed vector always occur in pairs.
let index = 0;
while (args[index]?.startsWith('-')) index += 2;
const paths = args.slice(index);
const target = paths.find(value => /^(runner|root)@/.test(value));
const address = target?.split('@')[1]?.split(':')[0];
const directory = address && mapping[address];
if (!directory) process.exit(255);
const user = target!.split('@')[0];
const privateKey = args[args.indexOf('-i') + 1]!;
const offered = (await readFile(`${privateKey}.pub`, 'utf8').catch(() => '')).trim();
const authorized = await readFile(join(directory, user === 'root' ? 'root/.ssh/authorized_keys' : 'home/runner/.ssh/authorized_keys'), 'utf8').catch(() => '');
if (!offered || !authorized.split('\n').some(line => line.trim() === offered)) process.exit(255);
const home = join(directory, 'home/runner');
const env = { HOME: home, PATH: process.env.PATH, LANG: 'en_US.UTF-8' };
await mkdir(join(home, 'tmp'), { recursive: true });
if (mode === 'scp') {
  const remote = target!.slice(target!.indexOf(':') + 1);
  const path = resolve(home, remote.replace(/^~\//, ''));
  if (!path.startsWith(`${home}/`)) process.exit(2);
  await mkdir(resolve(path, '..'), { recursive: true });
  await copyFile(paths[0] === target ? path : paths[0]!, paths[0] === target ? paths[1]! : path);
  if (paths[0] !== target && path.endsWith('/run.sh')) await writeFile(path, (await readFile(path, 'utf8')).replaceAll('/tmp/cland-suite.lock', join(home, 'tmp/suite.lock')));
} else {
  if (faults.ssh) process.exit(255);
  if (faults.sshFailures) { faults.sshFailures--; await writeFile(join(state, 'machine-faults.json'), JSON.stringify(faults)); process.exit(255); }
  let command = paths[1]!;
  const starting = command.includes('setsid nohup bash');
  if (starting && faults.startMarkerOnly) {
    faults.startMarkerOnly--; await writeFile(join(state, 'machine-faults.json'), JSON.stringify(faults));
    const runId = /runs\/([a-zA-Z0-9-]+)/.exec(command)![1]!;
    await writeFile(join(home, 'runs', runId, 'started'), ''); process.exit(255);
  }
  if (faults.delayMs && (!faults.delayCommand || command.includes(faults.delayCommand))) await new Promise(r => setTimeout(r, faults.delayMs));
  if (faults.install && command.includes('npm ci')) process.exit(1);
  if (faults.marker && command.includes('cat "$HOME/.cland-image.json"')) { process.stdout.write('{}\n'); process.exit(0); }
  // Root maintenance remains inside the fake machine's filesystem.
  command = command.replaceAll('/home/runner', home).replaceAll('/var/lib/', `${directory}/var/lib/`).replaceAll('/root/.ssh/', `${directory}/root/.ssh/`).replaceAll('/etc/ssh/', `${directory}/etc/ssh/`).replace('cloud-init clean --logs', `rm -rf ${shellQuote(join(directory, 'var/lib/cloud'))}`);
  try {
    const result = await run('bash', ['-c', command], { cwd: home, env, maxBuffer: 8 * 1024 * 1024 });
    if (starting && faults.startReplyLost) { faults.startReplyLost--; await writeFile(join(state, 'machine-faults.json'), JSON.stringify(faults)); process.exit(255); }
    process.stdout.write(result.stdout); process.stderr.write(result.stderr);
  } catch (error) {
    const result = error as { stdout?: string; stderr?: string; code?: number };
    process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? ''); process.exit(typeof result.code === 'number' ? result.code : 1);
  }
}
