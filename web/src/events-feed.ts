import { PROTOCOL_VERSION, type EventRow, type EventsFilter, type HubFrame } from '../../shared/wire/index.ts';

/** A filtered journal subscription beside the workbench's unfiltered model stream.
 * Keeping the sockets separate lets a mounted Inbox count every new event.
 */
export function connectEvents(url: URL, initial: EventsFilter, push: (row: EventRow) => void, failed: (error: string) => void, synchronized: () => void) {
  let filter = initial;
  let socket: WebSocket;
  let stopped = false;
  let ready = false;
  let serial = 0;
  let confirmed = 0;
  let backoff = 250;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const subscribe = () => {
    if (ready) socket.send(JSON.stringify({ type: 'subscribe', id: `events-feed:${++serial}`, filter }));
  };
  const connect = () => {
    ready = false;
    socket = new WebSocket(url);
    deadline = setTimeout(() => socket.close(), 5000);
    socket.onopen = () => socket.send(JSON.stringify({ type: 'hello', protocol: PROTOCOL_VERSION, client: 'ui', features: ['slim-frames'] }));
    socket.onmessage = event => {
      if (stopped) return;
      let frame: HubFrame;
      try { frame = JSON.parse(String(event.data)) as HubFrame; } catch { socket.close(); return; }
      if (frame.type === 'welcome') { ready = true; subscribe(); }
      else if (frame.type === 'event' && confirmed === serial) push(frame.row);
      else if (frame.type === 'result' && frame.id === `events-feed:${serial}`) {
        clearTimeout(deadline);
        if (frame.ok) { confirmed = serial; backoff = 250; synchronized(); }
        else failed(frame.error ?? 'Events subscription failed');
      } else if (frame.type === 'error' || frame.type === 'resync') socket.close();
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      ready = false; clearTimeout(deadline);
      if (!stopped) {
        failed('Events offline; reconnecting');
        retry = setTimeout(connect, backoff); backoff = Math.min(backoff * 2, 10_000);
      }
    };
  };
  connect();
  return {
    setFilter(value: EventsFilter) { filter = value; subscribe(); },
    stop() { stopped = true; clearTimeout(deadline); clearTimeout(retry); socket.close(); },
  };
}
