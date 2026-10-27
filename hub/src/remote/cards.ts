import type { AskCard, AskOutcome, Inbox, InboxAsk } from '../protocol.ts';

export type CardAction = { option: number } | { kind: 'other' | 'decline' };
export type RemoteCard = { title: string; question: string; link?: string; preview?: 'message' | 'command'; buttons: Array<{ label: string; action: CardAction }> };
export type RemoteNotice = { id: string; kind: 'plan' | 'request' | 'message' | 'approval'; since: string; topic: string; reference?: string; card: RemoteCard };

/** Notices share the card renderer, but offer no remote action. */
export function noticeCards(inbox: Inbox, webOrigin?: string): RemoteNotice[] {
  return [
    ...inbox.plans.map(row => ({ id: row.id, kind: 'plan' as const, since: row.since, topic: 'general', reference: `re plan ${row.subject}:`,
      card: { title: `📥 Plan ${row.subject} · ${row.title}`, question: 'Plans are approved in the workbench.', ...(webOrigin ? { link: webOrigin } : {}), buttons: [] } })),
    ...inbox.requests.map(row => ({ id: row.id, kind: 'request' as const, since: row.since, topic: row.topic.id,
      card: { title: `📥 ${row.request} · ${row.from} · ${row.subject}`, question: row.text, preview: 'message' as const, buttons: [] } })),
    ...inbox.messages.filter(row => !!row.topic.item).map(row => ({ id: row.id, kind: 'message' as const, since: row.since, topic: row.topic.id,
      card: { title: `📥 ${row.from} · ${row.topic.item}`, question: row.text, preview: 'message' as const, buttons: [] } })),
    ...inbox.approvals.filter(row => row.answerIn === 'tui').map(row => ({ id: row.id, kind: 'approval' as const, since: row.since, topic: 'general', reference: `re approval ${row.session}:`,
      card: { title: `📥 ${row.session} · ${row.harness ?? 'approval'}`, question: `Answer in its terminal.\n\n${row.subject.command ?? row.command ?? row.subject.files?.join('\n') ?? 'Waiting for approval'}`, preview: 'command' as const, buttons: [] } })),
  ];
}

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
    : outcome.via === 'web' ? 'web' : outcome.via === 'neovim' ? 'Neovim' : outcome.via;
  return `${choice} · ${outcome.by}${where ? ` via ${where}` : ''} · ${new Date(outcome.at).toTimeString().slice(0, 5)}`;
}

/** Closure frames and inbox departures describe the same hub-owned card. */
export function closedCardLine(card: Pick<AskCard, 'state' | 'outcome'>, asker: string): string | undefined {
  if (card.outcome) return outcomeLine(card.outcome);
  if (card.state === 'withdrawn') return `Withdrawn · asked by ${asker}`;
  if (card.state === 'cancelled') return 'Cancelled: topic or item closed';
  return undefined;
}
