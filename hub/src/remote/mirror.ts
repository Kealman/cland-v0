import type { Message, RemoteVia } from '../protocol.ts';

/** General's shared eligibility and author policy; rendering belongs to the messenger. */
export function mirrorOut(message: Message, self: RemoteVia): { header: string; text: string; silent: boolean } | null {
  if (message.kind === 'request' || message.answerTo || message.ask && !message.ask.to
    || message.fromKind === 'human' && message.via === self) return null;
  const author = message.fromKind === 'human'
    ? message.via === 'telegram' ? 'you (Telegram)' : message.via === 'discord' ? 'you (Discord)' : 'you'
    : message.from;
  return { header: `${author} · ${message.kind ?? 'message'}`, text: message.text,
    silent: message.kind === 'progress' || message.fromKind === 'hub' };
}
