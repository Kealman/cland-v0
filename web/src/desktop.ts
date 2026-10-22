import { useSyncExternalStore } from 'react';
const query = '(min-width: 1280px)';
export function isDesktop() { return matchMedia(query).matches; }
function subscribe(changed: () => void) {
  const media = matchMedia(query);
  media.addEventListener('change', changed);
  return () => media.removeEventListener('change', changed);
}
export function useDesktop() { return useSyncExternalStore(subscribe, isDesktop); }
