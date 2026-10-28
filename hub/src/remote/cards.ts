import type { ApprovalChoice, ApprovalOutcome, AskCard, AskOutcome, Inbox, InboxApproval, InboxAsk } from '../protocol.ts';

export type CardAction = { option: number } | { kind: 'other' | 'decline' } | { choice: ApprovalChoice };
export type RemoteCard = { title: string; question: string; truncated?: string; link?: string; preview?: 'message' | 'command'; buttons: Array<{ label: string; action: CardAction; style?: 'success' | 'primary' | 'danger' }> };

export function approvalCard(approval: InboxApproval): RemoteCard {
  const choices = { once: ['Approve once', 'success'], always: ['Always allow', 'primary'], deny: ['Deny', 'danger'] } as const;
  return { title: `${approval.session} asks to run · ${approval.harness ?? 'harness'}`,
    question: approval.subject.command ?? approval.command ?? approval.subject.files?.join('\n') ?? approval.subject.change ?? 'Approval requested',
    truncated: 'full command in the workbench',
    buttons: approval.choices.map(choice => ({ label: choices[choice][0], style: choices[choice][1], action: { choice } })),
  };
}

export function approvalOutcomeLine(outcome: ApprovalOutcome): string {
  const choice = outcome.choice === 'once' ? 'Approved once' : outcome.choice === 'always' ? 'Always allowed'
    : outcome.choice === 'deny' ? 'Denied' : outcome.choice === 'withdrawn' ? 'Withdrawn' : 'Answered in the harness';
  const note = outcome.note && [...outcome.note].length > 800
    ? [...outcome.note].slice(0, 800).join('') + '… (full note in the workbench)' : outcome.note;
  return attributedLine(`${choice}${note ? `: ${note}` : ''}`, outcome);
}

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
  return attributedLine(outcome.status === 'declined' ? `Declined: ${outcome.reason}` : outcome.text, outcome);
}

function attributedLine(choice: string, outcome: { by: string; via?: string; at: string }): string {
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

export type InboxPublication = { id: string; since: string } & (
  { kind: 'ask'; ask: InboxAsk } | { kind: 'approval'; approval: InboxApproval } | { kind: 'notice'; notice: RemoteNotice }
);

/** One publication order shared by messenger inbox commands. */
export function inboxPublication(inbox: Inbox, webOrigin?: string): InboxPublication[] {
  const rows: InboxPublication[] = [
    ...inbox.asks.map(ask => ({ kind: 'ask' as const, id: ask.id, since: ask.since, ask })),
    ...inbox.approvals.filter(row => row.answerIn === 'hub' && row.state !== 'closed')
      .map(approval => ({ kind: 'approval' as const, id: approval.id, since: approval.since, approval })),
    ...noticeCards(inbox, webOrigin).map(notice => ({ kind: 'notice' as const, id: notice.id, since: notice.since, notice })),
  ];
  return rows.sort((a, b) => a.since.localeCompare(b.since) || a.id.localeCompare(b.id));
}
