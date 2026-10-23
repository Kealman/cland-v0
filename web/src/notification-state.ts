import { useSyncExternalStore } from 'react';
import { readInterfaceState, writeInterfaceState } from './interface-state.ts';
import type { NotificationSwitch } from './notification-rules.ts';

export type NotificationPreferences = Record<NotificationSwitch, boolean> & { reason: string; pending: boolean };
const listeners = new Set<() => void>();
let state: NotificationPreferences | undefined;
export function notificationSnapshot(): NotificationPreferences {
  if (!state) {
    const saved = readInterfaceState('notifications') as Partial<NotificationPreferences> | null;
    state = { needsYou: saved?.needsYou === true, finished: saved?.finished === true, reason: '', pending: false };
    if (typeof Notification === 'undefined' || Notification.permission === 'denied') {
      state = { needsYou: false, finished: false, pending: false, reason: typeof Notification === 'undefined' ? 'Browser notifications are unavailable in this browser or origin' : 'Notifications are blocked in this browser; allow them in site settings' };
      writeInterfaceState('notifications', { needsYou: false, finished: false });
    }
  }
  return state;
}
function save(next: NotificationPreferences) {
  state = next;
  writeInterfaceState('notifications', { needsYou: next.needsYou, finished: next.finished });
  listeners.forEach(listener => listener());
}
function refresh() {
  if (state?.pending) return;
  state = undefined;
  notificationSnapshot();
  listeners.forEach(listener => listener());
}
function storageChanged(event: StorageEvent) {
  if (event.key === 'cland.ui.notifications.v1' || event.key === null) refresh();
}
export function subscribeNotifications(listener: () => void) {
  if (!listeners.size) { window.addEventListener('storage', storageChanged); window.addEventListener('focus', refresh); }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { window.removeEventListener('storage', storageChanged); window.removeEventListener('focus', refresh); }
  };
}
export function useNotifications() { return useSyncExternalStore(subscribeNotifications, notificationSnapshot); }

/** Call directly in an enabling gesture so the browser owns its permission prompt. */
export async function toggleNotification(kind: NotificationSwitch): Promise<void> {
  const previous = notificationSnapshot();
  if (previous.pending) return;
  if (previous[kind]) { save({ ...previous, [kind]: false }); return; }
  if (typeof Notification === 'undefined') { save({ needsYou: false, finished: false, pending: false, reason: 'Browser notifications are unavailable in this browser or origin' }); return; }
  save({ ...previous, pending: true, reason: '' });
  try {
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission !== 'granted') { save({ needsYou: false, finished: false, pending: false, reason: permission === 'denied' ? 'Notifications are blocked in this browser; allow them in site settings' : 'Notification permission was not granted' }); return; }
    save({ ...notificationSnapshot(), [kind]: true, pending: false, reason: '' });
  } catch { save({ needsYou: false, finished: false, pending: false, reason: 'Notification permission could not be requested' }); }
}
