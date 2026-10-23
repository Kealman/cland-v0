import type { HubFrame } from '../../shared/wire/index.ts';
import { findItem, type ConnectionState } from './connection.ts';
import { inboxNotifications, finishedNotification, shouldNotify, type NotificationNotice } from './notification-rules.ts';
import { notificationSnapshot, subscribeNotifications } from './notification-state.ts';

/** One lifetime per open page; snapshots seed identities instead of replaying old work. */
export function browserNotifications(open: (target: NotificationNotice['target']) => void) {
  const unsubscribe = subscribeNotifications(() => {});
  const seen = new Set<string>();
  const active = new Set<Notification>();
  function receive(frame: HubFrame, connection: ConnectionState) {
    const inbox = frame.type === 'inbox' ? frame.inbox : frame.type === 'snapshot' && frame.domain === 'inbox' ? frame.value : undefined;
    const finished = frame.type === 'task' && frame.item ? finishedNotification(findItem(connection, frame.id), frame.item) : undefined;
    const notices = [...(inbox ? inboxNotifications(inbox, connection) : []), ...(finished ? [finished] : [])];
    for (const notice of notices) {
      const key = `${notice.kind}:${notice.tag}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (frame.type === 'snapshot' || typeof Notification === 'undefined' || !shouldNotify(notice, {
        ...notificationSnapshot(), permission: Notification.permission, visible: document.visibilityState === 'visible', focused: document.hasFocus(),
      })) continue;
      try {
        const notification = new Notification(notice.title, { body: notice.body, tag: notice.tag });
        active.add(notification);
        notification.onclose = () => active.delete(notification);
        notification.onclick = () => { window.focus(); open(notice.target); notification.close(); active.delete(notification); };
      } catch { /* Unsupported delivery must not interrupt incoming hub state. */ }
    }
  }
  return { receive, close: () => { unsubscribe(); for (const notification of active) notification.close(); active.clear(); } };
}
