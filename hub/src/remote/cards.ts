import type { AskOutcome, InboxAsk } from '../protocol.ts';

export type CardAction = { option: number } | { kind: 'other' | 'decline' };
export type RemoteCard = { title: string; question: string; buttons: Array<{ label: string; action: CardAction }> };

/** A remote card is a view of the hub's ask, independent of any messenger. */
export function askCard(ask: InboxAsk): RemoteCard {
  return { title: `${ask.from} · ${ask.topic.title}`, question: ask.question,
    buttons: [...ask.options.slice(0, 9).map((label, index) => ({ label, action: { option: index + 1 } })),
      ...(ask.free ? [{ label: 'Other answer…', action: { kind: 'other' as const } }] : []),
      { label: 'Decline…', action: { kind: 'decline' } }],
  };
}

export function outcomeLine(outcome: AskOutcome): string {
  const choice = outcome.status === 'declined' ? `Declined: ${outcome.reason}` : outcome.text;
  const where = outcome.via === 'telegram' ? 'Telegram' : outcome.via === 'discord' ? 'Discord'
    : outcome.via === 'web' ? 'Web' : outcome.via === 'neovim' ? 'Neovim' : outcome.via;
  return `${choice} · ${outcome.by}${where ? ` via ${where}` : ''} · ${new Date(outcome.at).toTimeString().slice(0, 5)}`;
}
