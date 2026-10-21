import { PROTOCOL_VERSION, type ClientHello, type HubFrame, type HubStatus, type Inbox, type ItemSummary, type WorkbenchRequest } from '../../shared/wire/index.ts';

export type ConnectionState = {
  project: string; live: boolean;
  coordinator?: string | null;
  needsYou?: number;
  approvals?: number;
  plans?: number;
  waitingTopics?: number;
  releases?: ItemSummary[];
};

/** Cookie-authenticated connection, retried from 250 ms up to 10 s between failures. */
export function connectHub(changed: (state: ConnectionState) => void): () => void {
  const url = new URL('/ws', location.href);
  url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  let state: ConnectionState = { project: 'Workbench', live: false };
  let socket: WebSocket;
  let stopped = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let backoff = 250;
  function request(frame: WorkbenchRequest) { socket.send(JSON.stringify(frame)); }
  function inbox(value: Inbox) {
    state = { ...state, needsYou: value.needsYou, approvals: value.approvals.length,
      plans: value.plans.length, waitingTopics: value.waiting.length };
    changed(state);
  }
  function connect() {
    socket = new WebSocket(url);
    // An open socket alone is not authenticated readiness. Bound the hello/status too.
    deadline = setTimeout(() => socket.close(), 5000);
    socket.onopen = () => {
      const hello: ClientHello = { type: 'hello', protocol: PROTOCOL_VERSION, client: 'ui' };
      socket.send(JSON.stringify(hello));
    };
    socket.onmessage = event => {
      let frame: HubFrame;
      try { frame = JSON.parse(String(event.data)) as HubFrame; }
      catch { socket.close(); return; }
      if (frame.type === 'welcome') {
        request({ type: 'subscribe', id: 'shell-subscribe' });
        request({ type: 'hub.status', id: 'connection-status' });
        request({ type: 'inbox.list', id: 'shell-inbox' });
        request({ type: 'task.list', id: 'shell-releases', kind: 'release', state: 'open', projection: 'summary' });
      } else if (frame.type === 'result' && frame.id === 'connection-status' && frame.ok) {
        const status = frame.value as HubStatus;
        if (typeof status?.root !== 'string') { socket.close(); return; }
        clearTimeout(deadline);
        backoff = 250;
        state = { ...state, project: status.root.split(/[\\/]/).filter(Boolean).at(-1) ?? status.root,
          live: true, coordinator: status.coordinator ?? null, needsYou: status.needsYou ?? 0 };
        changed(state);
      } else if (frame.type === 'result' && frame.ok && frame.id === 'shell-inbox') {
        inbox(frame.value as Inbox);
      } else if (frame.type === 'result' && frame.ok && frame.id === 'shell-releases') {
        state = { ...state, releases: (frame.value as { items: ItemSummary[] }).items };
        changed(state);
      } else if (frame.type === 'inbox') inbox(frame.inbox);
      else if (frame.type === 'role.filled' || frame.type === 'role.vacant' || frame.type === 'presence') {
        request({ type: 'hub.status', id: 'connection-status' });
      } else if (frame.type === 'task' && (frame.item?.kind === 'release' || state.releases?.some(item => item.id === frame.id))) {
        request({ type: 'task.list', id: 'shell-releases', kind: 'release', state: 'open', projection: 'summary' });
      } else if (frame.type === 'error') socket.close();
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      clearTimeout(deadline);
      state = { ...state, live: false };
      changed(state);
      if (!stopped) {
        retry = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 10_000);
      }
    };
  }
  connect();
  return () => {
    stopped = true;
    clearTimeout(retry);
    clearTimeout(deadline);
    socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
    socket.close();
  };
}
