import { resolveSecrets, secretFingerprint } from '../remote/secrets.ts';
import { fail, ok, warn, type Check } from './report.ts';
import { basename, join } from 'node:path';
import { readText } from '../init/files.ts';
import { defaultConfig, parseConfig } from '../init/config.ts';
import { layout, pidAlive, readDiscovery } from '../project.ts';
import { askHubFrame } from '../cli/socket-client.ts';
import type { RemoteStatusResult } from '../protocol.ts';
import { remoteRedactor } from '../remote/redact.ts';
import { remoteStopDetails } from '../remote/notices.ts';

/** Local credential presence only; validation never constructs a platform client. */
export async function checkRemotes(root: string, env: NodeJS.ProcessEnv): Promise<Check[]> {
  const out: Check[] = [];
  let config;
  try {
    const text = readText(join(root, '.cland/config.toml'));
    config = text === null ? defaultConfig(basename(root)) : parseConfig(text, basename(root), env);
  } catch {
    return [fail('remote config', 'cannot read remote enabled settings', 'repair .cland/config.toml')];
  }
  let redact = remoteRedactor();
  try {
    const secrets = resolveSecrets(root, env);
    redact = remoteRedactor(Object.values(secrets));
    for (const messenger of ['telegram', 'discord'] as const) {
      const token = secrets[`${messenger}.token`];
      out.push(token === undefined && config.remote[messenger].enabled
        ? warn(`${messenger} token`, 'absent', `cland secret set ${messenger}.token, then cland hub reload`)
        : ok(`${messenger} token`, token === undefined ? 'absent' : `present (${secretFingerprint(token)})`));
    }
  } catch {
    out.push(fail('remote secrets', 'cannot resolve project secrets', 'check .cland/secrets.toml and remote environment overrides; use cland secret set <messenger>.token'));
  }
  const discovery = readDiscovery(layout(root).discovery);
  let status: RemoteStatusResult | undefined;
  let unavailable = 'hub not running';
  if (discovery && pidAlive(discovery.pid)) {
    try { status = await askHubFrame(discovery, { type: 'remote.status' }, 3000, env) as RemoteStatusResult; }
    catch { unavailable = 'local remote status unavailable'; }
  }
  for (const messenger of ['telegram', 'discord'] as const) {
    const enabled = config.remote[messenger].enabled;
    out.push(ok(`${messenger} enabled`, String(enabled)));
    const row = status?.remotes.find(row => row.messenger === messenger);
    if (!row) {
      out.push(warn(`${messenger} connection`, unavailable, unavailable === 'hub not running' ? 'cland hub start' : 'update and restart the hub, then rerun cland doctor'));
      continue;
    }
    out.push(row.connection === 'disabled' || enabled && row.connection !== 'connected'
      ? warn(`${messenger} connection`, row.connection, 'cland hub reload; inspect cland remote status')
      : ok(`${messenger} connection`, row.connection));
    out.push(ok(`${messenger} pairing`, row.pairing
      ? redact.text(`${row.pairing.name} (${row.pairing.userId}); chat ${row.pairing.chatId}`) : 'none'));
    if (row.connection === 'disabled') {
      const stopped = row.stopCause ? remoteStopDetails(messenger, row.stopCause) : undefined;
      out.push(warn(`${messenger} stopped`, stopped?.cause ?? redact.text(row.reason ?? 'cause unavailable'),
        stopped?.fix ?? 'inspect cland remote status, repair the reported cause, then run cland hub reload'));
    }
  }
  return out;
}
