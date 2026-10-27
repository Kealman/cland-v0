import type { RemoteStopCause, RemoteVia } from '../protocol.ts';

/** Shared recovery wording for General, CLI status and doctor. No provider text is parsed. */
const STOPS: Record<RemoteVia, Partial<Record<RemoteStopCause, { cause: string; fix: string }>>> = {
  telegram: {
    token: { cause: 'wrong or revoked token (401)', fix: 'set a new token with cland secret set telegram.token, then run cland hub reload' },
    blocked: { cause: 'bot blocked (403)', fix: 'unblock the bot in Telegram, then run cland hub reload' },
    'other-consumer': { cause: 'another consumer of the token (409)', fix: 'stop the other token consumer, then run cland hub reload' },
  },
  discord: {
    token: { cause: 'wrong or revoked token (4004)', fix: 'set a new token with cland secret set discord.token, then run cland hub reload' },
    'message-content': { cause: 'Message Content toggle disabled (4014)', fix: 'enable Message Content in the Discord application, then run cland hub reload' },
    blocked: { cause: 'bot blocked (403)', fix: 'restore the bot access in Discord, then run cland hub reload' },
  },
};

export const remoteStopDetails = (messenger: RemoteVia, cause: RemoteStopCause) =>
  Object.hasOwn(STOPS[messenger], cause) ? STOPS[messenger][cause] : undefined;

/** Trusted adapter metadata survives the gateway's redacted legacy reason. */
export function remoteStopCause(error: unknown): RemoteStopCause | undefined {
  if (!(error instanceof Error) || !Object.hasOwn(error, 'stopCause')) return undefined;
  const cause = (error as Error & { stopCause: unknown }).stopCause;
  return cause === 'token' || cause === 'message-content' || cause === 'blocked' || cause === 'other-consumer' ? cause : undefined;
}

export function remoteStopError(messenger: RemoteVia, stopCause: RemoteStopCause, detail = ''): Error & { stopCause: RemoteStopCause } {
  const wording = remoteStopDetails(messenger, stopCause);
  return Object.assign(new Error(`${wording?.cause ?? 'remote stopped'}; ${wording?.fix ?? 'cland hub reload'}${detail ? `; ${detail}` : ''}`), { stopCause });
}

/** One redacted hub notice in General, outside the remote's frame authority. */
export function remoteNotice(post: (text: string) => void, redact: (text: string) => string, messenger: RemoteVia, cause: string, fix: string, transition = false): void {
  post(redact(`${messenger === 'telegram' ? 'Telegram' : 'Discord'} remote${transition ? ' ' : ': '}${cause}${fix ? `; ${fix}` : ''}`));
}
