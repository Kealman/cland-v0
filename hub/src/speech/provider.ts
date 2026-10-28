import type { ProjectConfig } from '../init/config.ts';
import type { Secrets } from '../remote/secrets.ts';
import { remoteRedactor, type RemoteRedactor } from '../remote/redact.ts';
import { CommandProvider } from './command.ts';
import { ElevenLabsProvider } from './elevenlabs.ts';
import type { SpeechProvider } from './index.ts';

export const SPEECH_DATA_USE = {
  '': 'Transcription is off; no audio is sent to a speech provider. Change provider in [speech].',
  elevenlabs: 'ElevenLabs may train on audio outside enterprise plans and stores transcripts; turn off "Improve the models for everyone" under Terms and privacy, Data use. Change provider in [speech].',
  command: 'The local speech command handles the audio; its own configuration controls data use. Change command or provider in [speech].',
} as const;

/** Secrets are resolved by the daemon; explicit environment overrides still win. */
export function speechProvider(settings: ProjectConfig['speech'], secrets: Secrets,
  options: { env?: NodeJS.ProcessEnv; cwd?: string; redact?: RemoteRedactor } = {}): SpeechProvider | null {
  if (!settings.provider) return null;
  const env = options.env ?? process.env;
  const redact = options.redact ?? remoteRedactor();
  redact.register(Object.values(secrets).filter((value): value is string => typeof value === 'string'));
  if (settings.provider === 'command') return new CommandProvider({ argv: settings.command, env, ...(options.cwd === undefined ? {} : { cwd: options.cwd }), redact });
  return new ElevenLabsProvider({ key: env.ELEVENLABS_API_KEY ?? secrets['speech.elevenlabs_key'] ?? '', model: settings.model, env, redact });
}
