import { basename } from 'node:path';
import { parseConfig } from '../../init/config.ts';
import { prepareSecretWrite } from '../../cli/secret.ts';
import { resolveSecrets, setSecret, validateSecretValue } from '../../remote/secrets.ts';
import { SPEECH_DATA_USE } from '../../speech/provider.ts';
import { Cancelled } from '../prompter.ts';
import type { SetupStep } from '../types.ts';

/** Local presence only: setup never sends audio or checks a paid provider. */
export const speech: SetupStep = async ({ root, env, machine, interactive, prompter, narrate }) => {
  const name = 'speech';
  const fix = 'cland secret set speech.elevenlabs_key';
  try {
    const { provider } = parseConfig(await machine.read('config.toml') ?? '', basename(root), env).speech;
    const detail = SPEECH_DATA_USE[provider];
    if (provider !== 'elevenlabs') return [{ name, verdict: 'ok', detail }];
    if (resolveSecrets(root, env)['speech.elevenlabs_key']) return [{ name, verdict: 'ok', detail }];
    if (!interactive) return [{ name, verdict: 'open', detail, fix }];
    narrate?.(`${detail}\n`);
    if (!await prompter.confirm('Set up ElevenLabs transcription now?', false)) return [{ name, verdict: 'skip', detail }];
    prepareSecretWrite(root);
    for (;;) {
      const key = await prompter.secret('ElevenLabs key:');
      try { validateSecretValue(key); } catch {
        narrate?.('Expected a nonempty key of at most 4096 bytes without control characters.\n');
        continue;
      }
      setSecret(root, 'speech.elevenlabs_key', key);
      break;
    }
    return [{ name, verdict: 'done', detail }];
  } catch (error) {
    if (error instanceof Cancelled) throw error;
    return [{ name, verdict: 'fail', detail: 'Speech setup could not complete; check config and secrets', fix }];
  }
};
