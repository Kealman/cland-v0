// Notifications only: no fetch handler and no offline shell cache.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data;
  if (!target || !['Inbox', 'Items'].includes(target.area) || typeof target.id !== 'string') return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (windows.length) {
      await windows[0].focus();
      windows[0].postMessage({ type: 'notification-open', target });
    } else {
      const url = new URL('/', self.location.origin);
      url.searchParams.set('area', target.area.toLowerCase());
      url.searchParams.set('row', target.id);
      await self.clients.openWindow(url.href);
    }
  })());
});
