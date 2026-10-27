import { basename, join } from 'node:path';
import { parseConfig } from '../../init/config.ts';
import { setConfigValue } from '../../init/config-set.ts';
import { prepareSecretWrite } from '../../cli/secret.ts';
import { resolveSecrets, secretFingerprint, setSecret, validateSecrets, validateSecretValue } from '../../remote/secrets.ts';
import { Cancelled } from '../prompter.ts';
import { setupHub } from '../hub.ts';
import type { SetupStep } from '../types.ts';

const TOKEN = 'cland secret set telegram.token';
const ENABLE = 'cland config set remote.telegram.enabled true';
const RELOAD = 'cland hub reload';
const APPROVE = 'cland remote approve telegram <code>';

/** Further messenger and speech offers join this step before the Aide takes the terminal. */
export const remotes: SetupStep = async ({ root, env, machine, hub: injected, interactive, prompter, narrate }) => {
  const name = 'remote telegram';
  let fix = [TOKEN, ENABLE, RELOAD].join('; ');
  try {
    const config = parseConfig(await machine.read('config.toml') ?? '', basename(root), env);
    const enabled = config.remote.telegram.enabled;
    let token = resolveSecrets(root, env)['telegram.token'];
    const client = injected ?? setupHub(root, env);
    const running = await client.running();
    const status = running && token && enabled ? (await client.remotes?.())?.remotes.find(row => row.messenger === 'telegram') : undefined;
    if (token && enabled && status?.token.present && status.connection === 'connected' && status.pairing) return [{ name, verdict: 'ok', detail: `configured and paired; token ${secretFingerprint(token)}` }];
    fix = [!token ? TOKEN : '', !enabled ? ENABLE : '', RELOAD, token && enabled && !status?.pairing ? APPROVE : ''].filter(Boolean).join('; ');
    if (!interactive) return [{ name, verdict: !token && !enabled ? 'skip' : 'open', detail: 'optional Telegram remote', fix }];
    if (!await prompter.confirm('Set up Telegram remote now?', false)) return [{ name, verdict: 'skip', detail: 'Telegram declined' }];
    if (!token) {
      narrate?.('In Telegram, open @BotFather and send /newbot.\nChoose a name and a username for this project’s bot.\nCopy its token into the hidden prompt below.\n');
      prepareSecretWrite(root);
      for (;;) {
        token = await prompter.secret('Telegram token:');
        try {
          validateSecretValue(token);
          validateSecrets({ 'telegram.token': token });
          break;
        } catch {
          narrate?.('Expected Telegram token format: ^[1-9]\\d{0,16}:[A-Za-z0-9_-]{24,}$, at most 80 characters.\n');
        }
      }
      setSecret(root, 'telegram.token', token);
    }
    if (!enabled) {
      if (running) {
        if (!client.configure) throw new Error('configuration unavailable');
        await client.configure('remote.telegram.enabled', true);
      } else setConfigValue(root, join(root, '.cland/config.toml'), 'remote.telegram.enabled', true, env);
    }
    fix = `${RELOAD}; ${APPROVE}`;
    if (!running) return [{ name, verdict: 'open', detail: `enabled; token ${secretFingerprint(token)}; start the hub to pair`, fix }];
    if (!client.reload || !client.remotes) throw new Error('reload unavailable');
    await client.reload();
    const after = (await client.remotes()).remotes.find(row => row.messenger === 'telegram');
    if (!after?.token.present || after.connection !== 'connected') return [{ name, verdict: 'open', detail: 'Telegram did not connect; check cland remote status', fix: RELOAD }];
    const detail = `enabled; token ${after.token.fingerprint}`;
    if (after.pairing) return [{ name, verdict: 'done', detail: `${detail}; paired` }];
    return [{ name, verdict: 'open', detail: `${detail}; open ${after.botLink ?? 'the bot in Telegram'} and press Start`, fix: APPROVE }];
  } catch (error) {
    if (error instanceof Cancelled) throw error;
    // Provider/parser errors may contain input; setup diagnostics keep only fixed reasons.
    return [{ name, verdict: 'fail', detail: 'Telegram setup could not complete; check config, secrets and cland remote status', fix }];
  }
};
