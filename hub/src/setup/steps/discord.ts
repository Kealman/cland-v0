import { setTimeout as delay } from 'node:timers/promises';
import { basename, join } from 'node:path';
import { parseConfig } from '../../init/config.ts';
import { setConfigValue } from '../../init/config-set.ts';
import { prepareSecretWrite } from '../../cli/secret.ts';
import { resolveSecrets, secretFingerprint, setSecret, validateSecrets, validateSecretValue } from '../../remote/secrets.ts';
import { Cancelled } from '../prompter.ts';
import { setupHub } from '../hub.ts';
import { pairRemote } from '../pairing.ts';
import type { SetupStep } from '../types.ts';

const TOKEN = 'cland secret set discord.token';
const ENABLE = 'cland config set remote.discord.enabled true';
const RELOAD = 'cland hub reload';
const APPROVE = 'cland remote approve discord <code>';

/** Discord follows Telegram and validates the application before enabling. */
export const discord: SetupStep = async ({ root, env, machine, hub: injected, interactive, prompter, narrate, signal }) => {
  const name = 'remote discord';
  let fix = [TOKEN, ENABLE, RELOAD].join('; ');
  try {
    signal?.throwIfAborted();
    const config = parseConfig(await machine.read('config.toml') ?? '', basename(root), env);
    const enabled = config.remote.discord.enabled;
    let token = resolveSecrets(root, env)['discord.token'];
    const client = injected ?? setupHub(root, env);
    const running = await client.running();
    const status = running && token && enabled ? (await client.remotes?.())?.remotes.find(row => row.messenger === 'discord') : undefined;
    if (token && enabled && status?.token.present && status.connection === 'connected' && status.pairing) return [{ name, verdict: 'ok', detail: `configured and paired; token ${secretFingerprint(token)}` }];
    fix = [!token ? TOKEN : '', !enabled ? ENABLE : '', RELOAD, token && enabled && !status?.pairing ? APPROVE : ''].filter(Boolean).join('; ');
    if (!interactive) return [{ name, verdict: !token && !enabled ? 'skip' : 'open', detail: `optional Discord remote${status?.botLink ? `; open ${status.botLink} and run /cland pair` : ''}`, fix }];
    if (!await prompter.confirm('Set up Discord remote now?', false)) return [{ name, verdict: 'skip', detail: 'Discord declined', fix }];
    narrate?.('In the Discord Developer Portal, create an application and bot for this project.\nSet Install Link to None, turn Public Bot off, enable Message Content Intent, and clear Interactions Endpoint URL.\nCopy the bot token into the hidden prompt below.\n');
    if (!token) {
      prepareSecretWrite(root);
      for (;;) {
        token = await prompter.secret('Discord token:');
        try {
          validateSecretValue(token);
          validateSecrets({ 'discord.token': token });
          break;
        } catch {
          narrate?.('Enter a non-empty Discord token without control characters.\n');
        }
      }
      signal?.throwIfAborted();
      setSecret(root, 'discord.token', token);
    }
    const { DiscordApi } = await import('../../remote/discord-api.ts');
    const api = new DiscordApi(token, env.CLAND_DISCORD_API_ROOT ? { apiRoot: env.CLAND_DISCORD_API_ROOT } : {});
    for (;;) {
      const application = await api.getCurrentApplication(signal ? { signal } : undefined);
      if (!/^\d+$/.test(application.id)) throw new Error('invalid application id');
      const changes = [application.bot_public ? 'Turn Public Bot off.' : '',
        !(application.flags & ((1 << 18) | (1 << 19))) ? 'Enable Message Content Intent.' : '',
        application.interactions_endpoint_url ? 'Clear Interactions Endpoint URL.' : ''].filter(Boolean);
      narrate?.(`Invite the bot to your server: https://discord.com/oauth2/authorize?client_id=${application.id}&scope=bot&permissions=117824\n`);
      if (!changes.length) break;
      narrate?.(`${changes.join('\n')}\n`);
      if (!await prompter.confirm('Re-check Discord application settings?', false))
        return [{ name, verdict: 'open', detail: changes.join(' '), fix }];
    }
    signal?.throwIfAborted();
    if (!enabled) {
      if (running) {
        if (!client.configure) throw new Error('configuration unavailable');
        await client.configure('remote.discord.enabled', true);
      } else setConfigValue(root, join(root, '.cland/config.toml'), 'remote.discord.enabled', true, env);
    }
    fix = `${RELOAD}; ${APPROVE}`;
    if (!running) return [{ name, verdict: 'open', detail: `enabled; token ${secretFingerprint(token)}; start the hub to pair`, fix }];
    if (!client.reload || !client.remotes) throw new Error('reload unavailable');
    signal?.throwIfAborted();
    await client.reload();
    // Reload completes configuration; the native gateway's READY/ACK arrives later.
    const deadline = Date.now() + 10_000;
    let after = (await client.remotes()).remotes.find(row => row.messenger === 'discord');
    while (after?.token.present && after.connection === 'disconnected' && Date.now() < deadline) {
      await delay(50, undefined, signal ? { signal } : undefined);
      after = (await client.remotes()).remotes.find(row => row.messenger === 'discord');
    }
    if (!after?.token.present || after.connection !== 'connected') return [{ name, verdict: 'open', detail: 'Discord did not connect; check cland remote status', fix: RELOAD }];
    const detail = `enabled; token ${after.token.fingerprint}`;
    if (after.pairing) return [{ name, verdict: 'done', detail: `${detail}; paired` }];
    signal?.throwIfAborted();
    return [await pairRemote({ messenger: 'discord', name, detail, link: after.botLink ?? 'your Discord server', gesture: 'run /cland pair in the server channel', client, prompter })];
  } catch (error) {
    if (error instanceof Cancelled) throw error;
    signal?.throwIfAborted();
    // Provider/parser errors may contain input; setup diagnostics keep only fixed reasons.
    return [{ name, verdict: 'fail', detail: 'Discord setup could not complete; check config, secrets and cland remote status', fix }];
  }
};
