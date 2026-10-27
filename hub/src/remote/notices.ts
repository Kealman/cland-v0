import type { RemoteVia } from '../protocol.ts';

/** One redacted hub notice in General, outside the remote's frame authority. */
export function remoteNotice(post: (text: string) => void, redact: (text: string) => string, messenger: RemoteVia, cause: string, fix: string, transition = false): void {
  post(redact(`${messenger === 'telegram' ? 'Telegram' : 'Discord'} remote${transition ? ' ' : ': '}${cause}${fix ? `; ${fix}` : ''}`));
}
