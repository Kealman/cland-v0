import { useEffect, useState } from 'react';
import { refreshNotificationPermission, toggleNotification, useNotifications } from './notification-state.ts';
import s from './PhoneNotifications.module.css';

export function PhoneNotifications() {
  const preferences = useNotifications();
  const [subscribed, setSubscribed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const supported = 'serviceWorker' in navigator;
  useEffect(() => {
    let mounted = true;
    if (supported) void navigator.serviceWorker.getRegistration('/').then(registration => {
      if (mounted) setSubscribed(registration?.active?.state === 'activated');
    }).catch(() => {});
    return () => { mounted = false; };
  }, [supported]);
  async function subscribe() {
    setPending(true); setError('');
    try {
      // Request directly in the tap; no asynchronous work precedes permission.
      const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
      refreshNotificationPermission();
      if (permission !== 'granted') return;
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
      const worker = registration.active ?? registration.installing ?? registration.waiting;
      if (!worker) throw new Error('Notification worker is unavailable');
      if (worker.state !== 'activated') await new Promise<void>((resolve, reject) => {
        const changed = () => {
          if (worker.state === 'activated' || worker.state === 'redundant') {
            worker.removeEventListener('statechange', changed);
            if (worker.state === 'activated') resolve(); else reject(new Error('Notification worker could not activate'));
          }
        };
        worker.addEventListener('statechange', changed); changed();
      });
      setSubscribed(true);
    } catch { setError('Notification worker could not be registered; use HTTPS and allow notifications in site settings'); }
    finally { setPending(false); }
  }
  return <div className={s.notifications} role="group" aria-label="Notifications">
    {([['needsYou', 'Needs you'], ['finished', 'Finished']] as const).map(([kind, label]) => <button key={kind} type="button" role="switch" aria-label={label}
      aria-checked={preferences[kind]} disabled={pending || preferences.pending} title={preferences.reason || `Notify for ${label.toLowerCase()} while this page is hidden or unfocused`}
      onClick={() => { void toggleNotification(kind); }}>{label}<span aria-hidden="true">{preferences[kind] ? 'on' : 'off'}</span></button>)}
    <button type="button" aria-label="Subscribe to notifications" disabled={pending || preferences.pending || !supported || typeof Notification === 'undefined'}
      title={preferences.reason || error || (!supported ? 'Service workers require a supported browser over HTTPS' : 'Allow notifications for this browser')}
      onClick={() => { void subscribe(); }}>{pending ? 'Subscribing…' : subscribed ? 'Subscribed' : 'Subscribe to notifications'}</button>
  </div>;
}
