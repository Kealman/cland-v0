import type { Clock } from '../hub/clock.ts';
import { SpeechError, transcribeNote, type SpeechProvider } from '../speech/index.ts';

/** Messenger-neutral download and transcription; original bytes never become a URL. */
export async function voiceNote(options: {
  fetch: (signal: AbortSignal) => Promise<Buffer>; provider: SpeechProvider | null;
  clock: Clock; signal: AbortSignal; mime?: string; filename?: string; message: string; duration?: number | undefined; language?: string | undefined;
}) {
  const { clock } = options;
  const start = clock.now().getTime();
  const deadline = new AbortController();
  const timer = clock.setTimeout(() => deadline.abort(), 90_000);
  const signal = AbortSignal.any([options.signal, deadline.signal]);
  const mime = options.mime || 'audio/ogg';
  const suffix = mime === 'audio/mpeg' || mime === 'audio/mp3' ? 'mp3' : ['audio/mp4', 'audio/m4a', 'audio/x-m4a'].includes(mime) ? 'm4a' : 'ogg';
  const name = options.filename ?? `voice-${options.message}.${suffix}`;
  try {
    const bytes = await options.fetch(signal);
    const downloaded = clock.now().getTime();
    let text: string;
    let line: string;
    try {
      if (!options.provider) throw new SpeechError('not-configured', 'off');
      const result = await transcribeNote(options.provider, { audio: bytes, mime, filename: name,
        ...(options.language ? { languageHint: options.language } : {}),
        ...(options.duration === undefined ? {} : { durationSec: options.duration }), signal },
      { clock, deadlineMs: 90_000 - (downloaded - start) });
      text = result.text.trim() ? `🎤 ${result.text.trim()}` : '🎤 nothing recognised';
      const duration = Math.floor(options.duration ?? result.durationSec ?? 0);
      line = `${text}\n${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')} · download ${((downloaded - start) / 1000).toFixed(1)} s · transcription ${((clock.now().getTime() - downloaded) / 1000).toFixed(1)} s · ${options.provider.name}`;
    } catch (error) {
      options.signal.throwIfAborted();
      const kind = error instanceof SpeechError ? error.kind : 'unavailable';
      text = kind === 'not-configured' ? '🎤 not transcribed' : `🎤 not transcribed: ${kind}`;
      line = kind === 'not-configured' ? options.provider
        ? options.provider.name === 'command'
          ? 'Transcription command is unavailable; configure [speech] command, then cland hub reload'
          : 'Transcription needs a key. Run cland secret set speech.elevenlabs_key, then cland hub reload'
        : 'Transcription is off ([speech] provider)' : text;
    }
    return { bytes, mime, name, text, line };
  } finally { clock.clearTimeout(timer); }
}
