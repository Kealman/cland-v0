import { remoteRedactor, type RemoteRedactor } from '../remote/redact.ts';
import { normalizeLanguage, SpeechError, type SpeechErrorKind, type SpeechInput, type SpeechProvider, type SpeechResult } from './index.ts';

export class ElevenLabsProvider implements SpeechProvider {
  readonly name = 'elevenlabs';
  readonly #key: string;
  readonly #root: string;
  readonly #model: string;
  readonly #redact: RemoteRedactor;
  constructor(options: { key?: string; model?: string; env?: NodeJS.ProcessEnv; redact?: RemoteRedactor } = {}) {
    this.#key = options.key ?? '';
    this.#root = apiRoot((options.env ?? process.env).CLAND_ELEVENLABS_API_ROOT);
    this.#model = options.model ?? 'scribe_v2';
    this.#redact = options.redact ?? remoteRedactor();
    this.#redact.register([this.#key]);
  }
  async transcribe(input: SpeechInput): Promise<SpeechResult> {
    if (!this.#key) throw new SpeechError('not-configured', 'Speech key is not configured', undefined, this.#redact);
    try {
      const form = new FormData();
      form.set('model_id', this.#model);
      form.set('tag_audio_events', 'false');
      if (input.languageHint) form.set('language_code', normalizeLanguage(input.languageHint) ?? input.languageHint);
      form.set('file', new Blob([new Uint8Array(input.audio)], { type: input.mime }), input.filename);
      const response = await fetch(`${this.#root}/v1/speech-to-text`, { method: 'POST', headers: { 'xi-api-key': this.#key }, body: form, signal: input.signal ?? null, redirect: 'error' });
      const body: unknown = await response.json().catch(() => null);
      const record = body && typeof body === 'object' ? body as Record<string, unknown> : {};
      const detail = record.detail && typeof record.detail === 'object' ? record.detail as Record<string, unknown> : {};
      if (!response.ok) {
        const code = detail.status;
        let kind: SpeechErrorKind = 'unavailable';
        if (response.status === 401 || response.status === 403) kind = 'auth';
        else if (response.status === 402 || code === 'insufficient_credits') kind = 'quota';
        else if (response.status === 413 || ['audio_too_long', 'request_too_large'].includes(typeof code === 'string' ? code : '')) kind = 'too-long';
        else if (['invalid_audio', 'invalid_audio_format', 'invalid_file_type', 'audio_too_short'].includes(typeof code === 'string' ? code : '')) kind = 'bad-audio';
        else if (response.status === 429) kind = 'rate-limited';
        const retry = response.headers.get('retry-after');
        const retryAfterMs = retry === null ? undefined : /^\d+(?:\.\d+)?$/.test(retry.trim()) ? Number(retry) * 1_000 : Math.max(0, Date.parse(retry) - Date.now());
        throw new SpeechError(kind, typeof detail.message === 'string' ? detail.message : 'Speech request failed', retryAfterMs, this.#redact);
      }
      if (typeof record.text !== 'string') throw new SpeechError('unavailable', 'Invalid speech response', undefined, this.#redact);
      const language = normalizeLanguage(typeof record.language_code === 'string' ? record.language_code : undefined);
      return { text: record.text, ...(language ? { language } : {}) };
    } catch (error) {
      if (error instanceof SpeechError) throw error;
      throw new SpeechError(input.signal?.aborted ? 'timeout' : 'unavailable', 'Speech transport or response failed', undefined, this.#redact);
    }
  }
}

function apiRoot(override?: string): string {
  if (override === undefined) return 'https://api.elevenlabs.io';
  try {
    const url = new URL(override);
    if (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && url.port &&
        !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) return url.origin;
  } catch { /* Report no caller-supplied URL or credentials. */ }
  throw new SpeechError('not-configured', 'Speech API override must be loopback HTTP with an explicit port');
}
