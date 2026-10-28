import { realClock, type Clock } from '../hub/clock.ts';
import { remoteRedactor, type RemoteRedactor } from '../remote/redact.ts';

export type SpeechInput = { audio: Uint8Array; mime: string; filename: string; languageHint?: string; durationSec?: number; signal?: AbortSignal };
export type SpeechResult = { text: string; language?: string; durationSec?: number; segments?: Array<{ text: string; start: number; end: number }> };
export interface SpeechProvider {
  name: string;
  /** false: one whole-note attempt; transcribe must join its native I/O on abort. */
  retry?: boolean;
  transcribe(input: SpeechInput): Promise<SpeechResult>;
}
export type SpeechErrorKind = 'not-configured' | 'auth' | 'bad-audio' | 'too-long' | 'quota' | 'rate-limited' | 'unavailable' | 'timeout' | 'command-failed';
export class SpeechError extends Error {
  readonly kind: SpeechErrorKind;
  readonly retryAfterMs: number | undefined;
  constructor(kind: SpeechErrorKind, message: string, retryAfterMs?: number, redact: RemoteRedactor = remoteRedactor()) {
    super(redact(message)); this.name = 'SpeechError'; this.kind = kind; this.retryAfterMs = retryAfterMs;
  }
}
// Node's ICU canonicalizes ISO 639-3/bibliographic aliases. DisplayNames supplies
// English names for the ISO 639-1 inventory without an extra runtime dependency.
const languageNames = new Map<string, string>();
const displayNames = new Intl.DisplayNames(['en'], { type: 'language' });
for (const code of 'aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo wa wo xh yi yo za zh zu'.split(' ')) {
  languageNames.set(displayNames.of(code)!.toLowerCase(), code);
}
export function normalizeLanguage(value?: string): string | undefined {
  if (!value) return undefined;
  const lowered = value.trim().toLowerCase();
  const named = languageNames.get(lowered);
  if (named) return named;
  try {
    const primary = new Intl.Locale(lowered.replaceAll('_', '-')).language;
    return /^[a-z]{2}$/.test(primary) ? primary : undefined;
  } catch { return undefined; }
}
export async function transcribeNote(provider: SpeechProvider, input: SpeechInput,
  options: { deadlineMs?: number; clock?: Clock; random?: () => number; redact?: RemoteRedactor } = {}): Promise<SpeechResult> {
  const clock = options.clock ?? realClock;
  const redact = options.redact ?? remoteRedactor();
  const deadlineMs = options.deadlineMs ?? 90_000;
  if (!Number.isFinite(deadlineMs) || deadlineMs <= 0) throw new SpeechError('timeout', 'Speech deadline reached', undefined, redact);
  const end = clock.now().getTime() + deadlineMs;
  const deadline = new AbortController();
  const timer = clock.setTimeout(() => deadline.abort(), deadlineMs);
  const signal = input.signal ? AbortSignal.any([input.signal, deadline.signal]) : deadline.signal;
  const timeout = () => new SpeechError('timeout', 'Speech deadline reached or cancelled', undefined, redact);
  try {
    for (let attempt = 0; ; attempt++) {
      if (signal.aborted || clock.now().getTime() >= end) throw timeout();
      const controller = new AbortController();
      const attemptSignal = AbortSignal.any([signal, controller.signal]);
      const attemptEnd = Math.min(end, clock.now().getTime() + (provider.retry === false ? deadlineMs : 30_000));
      const attemptTimer = clock.setTimeout(() => controller.abort(), attemptEnd - clock.now().getTime());
      try {
        const result = provider.retry === false
          ? await provider.transcribe({ ...input, signal: attemptSignal })
          : await abortable(() => provider.transcribe({ ...input, signal: attemptSignal }), attemptSignal, timeout);
        if (attemptSignal.aborted || clock.now().getTime() >= attemptEnd) throw timeout();
        return result;
      } catch (error) {
        // Native command failures include their close/incomplete-drain receipt.
        if (provider.retry === false && error instanceof SpeechError)
          throw new SpeechError(error.kind, error.message, error.retryAfterMs, redact);
        if (signal.aborted || clock.now().getTime() >= end) throw timeout();
        const failure = error instanceof SpeechError
          ? new SpeechError(error.kind, error.message, error.retryAfterMs, redact)
          : new SpeechError('unavailable', 'Speech provider failed', undefined, redact);
        if (provider.retry === false || attempt >= 2 || !['rate-limited', 'unavailable', 'timeout'].includes(failure.kind)) throw failure;
        const retryAfter = failure.retryAfterMs;
        const delay = retryAfter !== undefined && Number.isFinite(retryAfter) && retryAfter >= 0
          ? retryAfter : 1_000 * 2 ** attempt * (0.5 + (options.random ?? Math.random)());
        clock.clearTimeout(attemptTimer);
        await sleep(Math.min(delay, end - clock.now().getTime()), clock, signal, timeout);
      } finally { clock.clearTimeout(attemptTimer); }
    }
  } finally { clock.clearTimeout(timer); }
}

/** Race even providers that ignore cancellation; no late result can escape the deadline. */
function abortable<T>(run: () => Promise<T>, signal: AbortSignal, error: () => Error): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(error()); };
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve().then(() => { if (signal.aborted) throw error(); return run(); }).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
function sleep(ms: number, clock: Clock, signal: AbortSignal, error: () => Error): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(error()); return; }
    const abort = () => { clock.clearTimeout(timer); reject(error()); };
    const timer = clock.setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}
