import type { Inbox, Layer } from '../../shared/wire/index.ts';

export type NotificationSwitch = 'needsYou' | 'finished';
export type NotificationNotice = {
  kind: NotificationSwitch; tag: string; title: string; body: string;
  target: { area: 'Inbox' | 'Items'; id: string }; layer: Layer | undefined;
};
export type NotificationConditions = Record<NotificationSwitch, boolean> & {
  permission: string; visible: boolean; focused: boolean;
};

/** Shared with other delivery adapters: no browser globals or side effects. */
export function shouldNotify(notice: NotificationNotice, conditions: NotificationConditions): boolean {
  return notice.layer === 'now' && conditions[notice.kind] && conditions.permission === 'granted'
    && !(conditions.visible && conditions.focused);
}

type NotificationFacts = {
  topics?: readonly { id: string; item?: string | null }[];
  items?: readonly { id: string; claim: { session: string } | null; assignee?: string | null }[];
};
export function inboxNotifications(inbox: Inbox, facts: NotificationFacts = {}): NotificationNotice[] {
  const notice = (id: string, layer: Layer | undefined, session: string, item: string, body: string): NotificationNotice => ({
    kind: 'needsYou', tag: id, title: `${session} · ${item}`, body, target: { area: 'Inbox', id }, layer,
  });
  return [...inbox.asks.map(row => ({ kind: 'needsYou', tag: row.id, title: `${row.from} · ${row.topic.item ?? row.topic.title}`,
    body: row.question, target: { area: 'Inbox', id: row.id }, layer: row.layer } as NotificationNotice)),
    ...inbox.approvals.map(row => notice(row.id, row.layer, row.session,
      facts.topics?.find(topic => topic.id === row.topic)?.item ?? facts.items?.find(item => item.claim?.session === row.session)?.id ?? row.session,
      row.subject.command ?? row.command ?? row.subject.change ?? row.subject.files?.join(', ') ?? row.subject.reason ?? 'Waiting for approval')),
    ...inbox.plans.map(row => {
      const item = facts.items?.find(item => item.id === row.id);
      return notice(row.id, row.layer, item?.claim?.session ?? item?.assignee ?? 'cland', row.subject, `Plan approval · ${row.title}`);
    }),
    ...inbox.requests.map(row => notice(row.id, row.layer, row.from, row.topic.item ?? row.subject, row.text)),
    ...inbox.messages.map(row => notice(row.id, row.layer, row.from, row.topic.item ?? row.subject, row.text)),
  ];
}

type NotificationTask = { id: string; kind: string; title: string; status?: string; layer?: Layer; claim: { session: string } | null; assignee?: string | null };
/** Done moves a task out of Now; eligibility belongs to its pre-transition layer. */
export function finishedNotification(previous: NotificationTask | undefined, item: NotificationTask): NotificationNotice | undefined {
  if (!previous || item.kind !== 'task' || item.status !== 'done' || previous.status === 'done' || previous.layer !== 'now') return;
  return { kind: 'finished', tag: item.id, title: `${item.claim?.session ?? previous.claim?.session ?? item.assignee ?? previous.assignee ?? 'cland'} · ${item.id}`,
    body: `Finished · ${item.title}`, target: { area: 'Items', id: item.id }, layer: previous.layer };
}
