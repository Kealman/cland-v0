import { REMOTE_USAGE } from './usage.ts';
import { parseArgs } from 'node:util';
import { hubDiscovery, readDiscovery } from '../project.ts';
import { askHubFrame } from './socket-client.ts';
import type { Pairing } from '../remote/state.ts';
import type { RemoteStatusResult } from '../protocol.ts';

export async function runRemote(args: string[], cwd = process.cwd()): Promise<number> {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: { json: { type: 'boolean' } } });
  const [sub, messenger, code] = positionals;
  const knownMessenger = messenger === 'telegram' || messenger === 'discord';
  const valid = sub === 'status' && positionals.length === 1
    || knownMessenger && (sub === 'approve' && positionals.length === 3
      || (sub === 'unpair' || sub === 'test') && positionals.length === 2);
  if (!valid)
    throw new Error(`usage: cland remote <command>\n${REMOTE_USAGE}`);
  const discovery = readDiscovery(hubDiscovery(cwd));
  if (!discovery) throw new Error('no hub runs for this project — run cland hub start');
  const frame = sub === 'status' ? { type: 'remote.status' }
    : sub === 'approve' ? { type: 'pairing.approve', messenger, code }
    : { type: `remote.${sub}`, messenger };
  const value = await askHubFrame(discovery, frame);
  let text: string;
  if (sub === 'status') text = (value as RemoteStatusResult).remotes.map(row => [
    row.messenger,
    `token: ${row.token.present ? `present (${row.token.fingerprint})` : 'absent'}`,
    `paired: ${row.pairing ? `${row.pairing.name} (${row.pairing.userId}); chat ${row.pairing.chatId}` : 'none'}`,
    `connection: ${row.connection}${row.reason ? ` (${row.reason})` : ''}`,
    `last inbound: ${row.lastInbound ?? 'none'}`, `last outbound: ${row.lastOutbound ?? 'none'}`,
    `outbox: ${row.outboxDepth}`, `mute: ${row.mute}`, `bot: ${row.botLink ?? 'unavailable'}`,
  ].join('\n')).join('\n\n');
  else if (sub === 'test') text = `token checked; ${(value as { sent: boolean }).sent ? 'test line sent' : 'no paired chat'}`;
  else if (sub === 'unpair') text = `unpaired ${messenger}`;
  else {
    const { pairing } = value as { pairing: Pairing };
    text = `paired ${messenger}: ${pairing.name} (${pairing.userId})`;
  }
  process.stdout.write(`${values.json ? JSON.stringify(value) : text}\n`);
  return 0;
}
