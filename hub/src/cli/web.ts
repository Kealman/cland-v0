import { terminalQr } from '../qr.ts';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { hubDiscovery, readDiscovery } from '../project.ts';
import type { WebLinkResult, WebSessionsResult, WebRevokeResult } from '../protocol.ts';
import { askHubFrame } from './socket-client.ts';
import { WEB_USAGE } from './usage.ts';

export async function runWeb(args: string[], cwd = process.cwd()): Promise<number> {
  const { values } = parseArgs({ args, options: { 'no-open': { type: 'boolean' }, qr: { type: 'boolean' }, sessions: { type: 'boolean' }, revoke: { type: 'string' }, help: { type: 'boolean', short: 'h' } } });
  if (values.help) { process.stdout.write(WEB_USAGE); return 0; }
  if ([values['no-open'], values.sessions, values.revoke !== undefined].filter(Boolean).length > 1) throw new Error('--no-open, --sessions and --revoke cannot be combined');
  if (values.qr && (values.sessions || values.revoke !== undefined)) throw new Error('--qr cannot be combined with --sessions or --revoke');
  if (values.revoke === '') throw new Error('--revoke needs a session id');
  const d = readDiscovery(hubDiscovery(cwd));
  if (!d) throw new Error('no hub runs for this project — run `cland hub start`');
  // askHubFrame includes the shell's CLAND_SESSION_* actor; the hub refuses it.
  if (values.sessions) {
    const { sessions } = await askHubFrame(d, { type: 'web.sessions' }) as WebSessionsResult;
    process.stdout.write('ID  CREATED  LAST USED  SOCKETS\n');
    for (const session of sessions) process.stdout.write(`${session.id}  ${session.createdAt}  ${session.lastUsedAt}  ${session.sockets}\n`);
    return 0;
  }
  if (values.revoke !== undefined) {
    const { revoked } = await askHubFrame(d, { type: 'web.revoke', session: values.revoke }) as WebRevokeResult;
    process.stdout.write(`Revoked ${revoked}\n`);
    return 0;
  }
  const { url } = await askHubFrame(d, { type: 'web.link', ...(values.qr ? { qr: true } : {}) }) as WebLinkResult;
  process.stdout.write(`${url}\n`);
  if (values.qr) { process.stdout.write(terminalQr(url)); return 0; }
  if (values['no-open']) return 0;
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'linux' ? 'xdg-open' : null;
  if (!command) throw new Error('browser opening is supported on macOS and Linux; use --no-open');
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, [url], { stdio: 'ignore' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${command} exited ${code}; use the printed link`)));
  });
  return 0;
}
