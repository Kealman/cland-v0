#!/usr/bin/env node
import { mkdir, readFile, writeFile, access, realpath } from 'node:fs/promises';
import { join, resolve, relative, isAbsolute, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { fixtureSocketPath } from '../../../test-support/socket-path.ts';
import { fakeHostSocketPath } from './fake-host-socket.ts';
import { AgentClient } from '../../src/host/agent-client.ts';
import { observeProcesses } from '../../src/host/agent/native.ts';
import { controlRequest, hostOwner, sameOwner } from './fake-ssh-common.ts';
import type { MasterReceipt } from './fake-ssh-common.ts';
export function hostDirectory(root: string, name: string): string {
  if (!isAbsolute(root) || !/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('invalid fake host root/name');
  return join(dirname(fixtureSocketPath(root, 'fake-hosts')), name);
}
export async function createFakeHost(root: string, name: string) {
  const directory = hostDirectory(root, name);
  const home = join(directory, 'home');
  fakeHostSocketPath(home);
  const run = join(home, '.cland-host/run');
  await mkdir(run, { recursive: true, mode: 0o700 });
  const key = `ssh-ed25519 ${Buffer.from(`fake-host:${name}`).toString('base64')}`;
  await writeFile(join(directory, 'host-key.pub'), key);
  await writeFile(join(directory, 'client-key'), 'FAKE CLIENT KEY\n', { mode: 0o600 });
  await writeFile(join(directory, 'boot-id'), randomUUID());
  const knownHosts = join(directory, 'known_hosts');
  await writeFile(knownHosts, `${name} ${key}\n`);
  return { directory, home, run, knownHosts, bootId: join(directory, 'boot-id'), key };
}
export async function fakeHost(env: NodeJS.ProcessEnv, name: string) {
  if (!env.CLAND_FAKE_HOSTS?.split(',').includes(name) || !env.CLAND_FAKE_HOST_ROOT) throw new Error('unreachable fake host');
  const directory = hostDirectory(env.CLAND_FAKE_HOST_ROOT, name);
  fakeHostSocketPath(join(directory, 'home'));
  await access(join(directory, 'host-key.pub'));
  try { await access(join(directory, 'gone')); } catch { return { directory, home: join(directory, 'home') }; }
  throw new Error('unreachable fake host');
}
export async function hostPath(home: string, path: string): Promise<string> {
  const root = await realpath(home);
  const input = path.replace(/^~\//, '');
  const candidate = isAbsolute(input) && contained(resolve(home), resolve(input))
    ? resolve(root, relative(resolve(home), resolve(input))) : resolve(root, input);
  // Resolve the nearest existing parent as well, so scp cannot follow an escaping symlink.
  let parent = candidate;
  while (true) {
    try { const actual = await realpath(parent); if (!contained(root, actual)) throw new Error('fake host path escapes home'); break; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; const next = resolve(parent, '..'); if (next === parent) throw error; parent = next; }
  }
  if (!contained(root, candidate)) throw new Error('fake host path escapes home');
  // Keep the short lexical alias after canonical containment validation.
  return resolve(home, relative(root, candidate));
}
function contained(root: string, path: string) { const rel = relative(root, path); return rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel); }
export async function hostControl(action: string, name: string, env = process.env) {
  const host = await fakeHost(env, name);
  if (action === 'kill-agent') {
    const record = JSON.parse(await readFile(join(host.home, '.cland-host/run/agent.pid'), 'utf8')) as { pid: number; identity: string };
    // Bind the receipt to the requested host's authenticated live endpoint.
    // On Linux all fake hosts share the kernel boot id, so birth alone is not
    // an owner fence. No signal operation is added to the agent protocol.
    if (!env.CLAND_HOST_SECRET) throw new Error('fake agent owner check requires CLAND_HOST_SECRET');
    const client = await AgentClient.connect(fakeHostSocketPath(host.home), env.CLAND_HOST_SECRET);
    try {
      if (client.hello.pid !== record.pid) throw new Error('fake agent owner mismatch; nothing signalled');
      const native = await observeProcesses([record.pid], { ...env, CLAND_HOST_BOOT_ID_FILE: join(host.directory, 'boot-id') });
      if (!Number.isSafeInteger(record.pid) || record.pid <= 1 || !record.identity || native.get(record.pid)?.identity !== record.identity) throw new Error('fake agent identity mismatch; nothing signalled');
      process.kill(record.pid, 'SIGKILL');
    } finally { await client.close(); }
    return;
  }
  if (action === 'gone') { await writeFile(join(host.directory, 'gone'), 'gone'); return; }
  if (action !== 'kill-master') throw new Error('usage: fake-host.ts create|kill-master|kill-agent|gone <host>');
  // Ask the live master to SIGKILL itself: never trust a persisted PID as signal authority.
  const record = JSON.parse(await readFile(join(host.directory, 'master-control'), 'utf8')) as MasterReceipt;
  const owner = await hostOwner(host.directory);
  if (!sameOwner(record.owner, owner) || !record.token) throw new Error('fake master owner mismatch');
  await controlRequest(record.control, { operation: 'kill-master', forwards: [], owner, token: record.token });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [action, name] = process.argv.slice(2);
    if (!name) throw new Error('usage: fake-host.ts create|kill-master|kill-agent|gone <host>');
    if (action === 'create') { if (!process.env.CLAND_FAKE_HOST_ROOT) throw new Error('missing fake root'); await createFakeHost(process.env.CLAND_FAKE_HOST_ROOT, name); }
    else await hostControl(action ?? '', name);
  } catch (error) { console.error((error as Error).message); process.exitCode = 1; }
}
