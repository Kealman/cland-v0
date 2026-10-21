import { PROTOCOL_VERSION, type AccountList, type Artifact, type ClientHello, type EventsPage, type HarnessProcessView, type HubFrame, type HubStatus, type Inbox, type ItemSummary, type Topic, type WorkbenchRequest } from '../../shared/wire/index.ts';
import type { Area } from './keymap.ts';

export type ObjectRow = { id: string; title: string };


export type ConnectionState = {
  project: string; live: boolean; restartRequired?: boolean;
  coordinator?: string | null;
  needsYou?: number;
  approvals?: number;
  plans?: number;
  waitingTopics?: number;
  releases?: ItemSummary[];
  rows?: Partial<Record<Area, ObjectRow[]>>;
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
  function rows(area: Area, value: ObjectRow[]) {
    state = { ...state, rows: { ...state.rows, [area]: value } };
    changed(state);
  }
  function readObjects() {
    request({ type: 'task.list', id: 'shell-items', state: 'open', projection: 'summary' });
    request({ type: 'session.list', id: 'shell-sessions' });
    request({ type: 'topic.list', id: 'shell-topics' });
    request({ type: 'events.list', id: 'shell-events', limit: 200 });
    request({ type: 'artifact.list', id: 'shell-artifacts' });
    request({ type: 'account.list', id: 'shell-accounts' });
  }
  function inbox(value: Inbox) {
    state = { ...state, needsYou: value.needsYou, approvals: value.approvals.length,
      plans: value.plans.length, waitingTopics: value.waiting.length };
    rows('Inbox', [
      ...value.asks.map(row => ({ id: row.id, title: row.question })),
      ...value.approvals.map(row => ({ id: row.id, title: row.command ?? row.label })),
      ...value.plans.map(row => ({ id: row.id, title: row.title })),
      ...value.requests.map(row => ({ id: row.id, title: row.text })),
      ...value.messages.map(row => ({ id: row.id, title: row.text })),
      ...value.waiting.map(row => ({ id: row.id, title: row.title })),
    ]);
  }
  function connect() {
    socket = new WebSocket(url);
    // An open socket alone is not authenticated readiness. Bound the hello/status too.
    deadline = setTimeout(() => socket.close(), 5000);
    socket.onopen = () => {
      const hello: ClientHello = { type: 'hello', protocol: PROTOCOL_VERSION, client: 'ui', features: [] };
      socket.send(JSON.stringify(hello));
    };
    socket.onmessage = event => {
      let frame: HubFrame;
      try { frame = JSON.parse(String(event.data)) as HubFrame; }
      catch { socket.close(); return; }
      if (frame.type === 'welcome') {
        const loaded = document.querySelector('meta[name="cland-build-stamp"]')?.getAttribute('content');
        if (loaded && frame.buildStamp && loaded !== frame.buildStamp) {
          // One reload per target build, even if a proxy keeps serving old entry HTML.
          let reload = false;
          try {
            reload = sessionStorage.getItem('cland-reload-build') !== frame.buildStamp;
            sessionStorage.setItem('cland-reload-build', frame.buildStamp);
          } catch { /* Storage may be unavailable; keep the current page usable. */ }
          if (reload) { stopped = true; clearTimeout(deadline); socket.close(); location.reload(); return; }
        }
        request({ type: 'subscribe', id: 'shell-subscribe' });
        readObjects();
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
      } else if (frame.type === 'result' && frame.ok && frame.id === 'shell-items') {
        rows('Items', (frame.value as { items: ItemSummary[] }).items.map(row => ({ id: row.id, title: row.title })));
      } else if (frame.type === 'result' && frame.ok && frame.id === 'shell-sessions') {
        rows('Sessions', (frame.value as { processes: HarnessProcessView[] }).processes.map(row => ({ id: row.name, title: row.label ?? row.name })));
      } else if (frame.type === 'result' && frame.ok && frame.id === 'shell-topics') {
        rows('Topics', (frame.value as { topics: Topic[] }).topics.map(row => ({ id: row.id, title: row.title })));
      } else if (frame.type === 'result' && frame.ok && frame.id === 'shell-events') {
        rows('Events', (frame.value as EventsPage).rows.map(row => ({ id: row.id, title: row.text })));
      } else if (frame.type === 'result' && frame.ok && frame.id === 'shell-artifacts') {
        rows('Artifacts', (frame.value as { artifacts: Artifact[] }).artifacts.map(row => ({ id: row.id, title: row.title })));
      } else if (frame.type === 'result' && frame.ok && frame.id === 'shell-accounts') {
        rows('Accounts', (frame.value as AccountList).accounts.map(row => ({ id: `${row.harness}/${row.name}`, title: row.name })));
      } else if (frame.type === 'inbox') inbox(frame.inbox);
      else if (frame.type === 'role.filled' || frame.type === 'role.vacant' || frame.type === 'presence') {
        request({ type: 'hub.status', id: 'connection-status' });
        request({ type: 'session.list', id: 'shell-sessions' });
      } else if (frame.type === 'task' && (frame.item?.kind === 'release' || state.releases?.some(item => item.id === frame.id))) {
        request({ type: 'task.list', id: 'shell-releases', kind: 'release', state: 'open', projection: 'summary' });
        request({ type: 'task.list', id: 'shell-items', state: 'open', projection: 'summary' });
      } else if (frame.type === 'task') {
        request({ type: 'task.list', id: 'shell-items', state: 'open', projection: 'summary' });
      } else if (frame.type === 'topic') {
        request({ type: 'topic.list', id: 'shell-topics' });
      } else if (frame.type === 'event') {
        request({ type: 'events.list', id: 'shell-events', limit: 200 });
      } else if (frame.type === 'artifact') {
        request({ type: 'artifact.list', id: 'shell-artifacts' });
      } else if (frame.type === 'account') {
        request({ type: 'account.list', id: 'shell-accounts' });
      } else if (frame.type === 'session.process' || frame.type === 'sessions.pruned') {
        request({ type: 'session.list', id: 'shell-sessions' });
      } else if (frame.type === 'visibility') {
        readObjects();
      } else if (frame.type === 'error') {
        if (frame.code === 'version') {
          stopped = true;
          state = { ...state, live: false, restartRequired: true };
          changed(state);
        }
        socket.close();
      }
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
