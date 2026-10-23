import { useSyncExternalStore } from 'react';

const query = '(width < 640px)';
export function isPhone() { return matchMedia(query).matches; }
function subscribe(changed: () => void) {
  const media = matchMedia(query);
  media.addEventListener('change', changed);
  return () => media.removeEventListener('change', changed);
}
export function usePhone() { return useSyncExternalStore(subscribe, isPhone); }
