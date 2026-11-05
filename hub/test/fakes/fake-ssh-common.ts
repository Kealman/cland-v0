import net from 'node:net';
import { readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { fakeHost } from './fake-host.ts';
export type Forward = { direction: 'L' | 'R'; spec: string };
export function parseSsh(args: string[]) {
  const options: Record<string, string> = {};
  const forwards: Forward[] = [];
  let operation = '', master = false, destination = '';
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (!arg.startsWith('-')) { destination = arg; return { options, forwards, operation, master, destination, command: args.slice(i + 1) }; }
    if (['-N', '-M', '-a', '-x', '-t', '-T', '-n', '-q'].includes(arg)) { if (arg === '-N') master = true; continue; }
    const flag = arg.slice(0, 2);
    if (!['-o', '-S', '-O', '-L', '-R', '-F', '-i', '-p', '-l'].includes(flag)) throw new Error('unsupported fake ssh option');
    const value = arg.length > 2 ? arg.slice(2) : args[++i];
    if (!value) throw new Error('missing ssh option value');
    if (flag === '-o') { const pair = value.match(/^([^=\s]+)[=\s]+(.+)$/); if (!pair) throw new Error('invalid ssh option'); options[pair[1]!.toLowerCase()] = pair[2]!; }
    if (flag === '-S') options.controlpath = value;
    if (flag === '-O') operation = value;
    if (flag === '-L' || flag === '-R') forwards.push({ direction: flag.slice(1) as 'L' | 'R', spec: value });
  }
  throw new Error('missing fake host');
}
export async function authenticate(options: Record<string, string>, destination: string) {
  const name = destination.split('@').at(-1)!;
  const host = await fakeHost(process.env, name);
  if (options.stricthostkeychecking !== 'yes' || !options.userknownhostsfile) throw new Error('fake ssh requires pinned host key');
  const key = (await readFile(join(host.directory, 'host-key.pub'), 'utf8')).trim();
  // OpenSSH loads both user and global trust sources. Default globals are
  // scratch-only and opt-in in the fake; never inspect this machine's trust.
  const files = (value: string): string[] => {
    const tokens = value.match(/"(?:[^"\\]|\\.)*"|[^\s]+/g) ?? [];
    return tokens.map(token => token.startsWith('"') ? token.slice(1,-1).replace(/\\(.)/g,'$1') : token);
  };
  const sources = [...files(options.userknownhostsfile), ...(options.globalknownhostsfile ? files(options.globalknownhostsfile) : process.env.FAKE_SSH_GLOBAL_KNOWN_HOSTS ? [process.env.FAKE_SSH_GLOBAL_KNOWN_HOSTS] : [])];
  let accepted = false;
  for (const path of sources) {
    if (path === 'none') continue;
    const known = await readFile(path, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
    if (known.split('\n').some(line => { const parts = line.trim().split(/\s+/); return parts[0]?.split(',').includes(name) && parts.slice(1,3).join(' ') === key; })) accepted = true;
  }
  if (!accepted) throw new Error('fake ssh host key mismatch');
  return host;
}
export type HostOwner = { directory: string; boot: string };
export type MasterReceipt = { control: string; owner: HostOwner; token: string };
export async function hostOwner(directory: string): Promise<HostOwner> {
  return { directory: await realpath(directory), boot: await readFile(join(directory, 'boot-id'), 'utf8') };
}
export function sameOwner(a: HostOwner | undefined, b: HostOwner): boolean {
  return a?.directory === b.directory && a.boot === b.boot;
}
export type Control = { operation: string; forwards: Forward[]; owner: HostOwner; token?: string };
export function controlRequest(path: string, request: Control, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ path });
    socket.setTimeout(timeoutMs, () => socket.destroy(new Error('fake ssh control timed out')));
    let response = '';
    socket.on('error', reject);
    socket.on('connect', () => socket.end(JSON.stringify(request) + '\n'));
    socket.on('data', data => { response += data; });
    socket.on('end', () => { if (response.trim() === 'ok') resolve(); else reject(new Error(response.trim() || 'fake ssh control closed')); });
  });
}
