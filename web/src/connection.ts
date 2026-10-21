import { PROTOCOL_VERSION, type AccountList, type Artifact, type ClientHello, type EventsPage, type HarnessProcessView, type HubFrame, type HubStatus, type Inbox, type ItemSummary, type ExplorerSummary, type SnapshotValues, type Topic, type WorkbenchRequest } from '../../shared/wire/index.ts';
import type { Area } from './keymap.ts';

export type ObjectRow = { id: string; title: string };
export type PlanStages = Array<{ name: string; state: 'open' | 'closed'; items: string[]; qa: { scope: string; when: string } }>;

/** Task deltas retain full verdict history; snapshots already carry the compact projection. */
function explorerItem(item: ItemSummary): ExplorerSummary {
  const rounds = { review: 0, qa: 0 };
  const latest = new Map<string, ExplorerSummary['verdicts'][number]>();
  for (const verdict of item.verdicts) {
    latest.delete(verdict.verdict);
    latest.set(verdict.verdict, { ...verdict, round: ++rounds[verdict.verdict] });
  }
  return { ...item, open_blockers: item.open_blockers ?? [], verdicts: [...latest.values()] };
}


export type ConnectionState = {
  project: string; live: boolean; restartRequired?: boolean;
  coordinator?: string | null;
  needsYou?: number;
  approvals?: number;
  plans?: number;
  waitingTopics?: number;
  releases?: ExplorerSummary[];
  items?: ExplorerSummary[];
  /** Closed task children are read through this boundary; T-1081 can back it with pages. */
  closedTasks?: (parent: string) => readonly ExplorerSummary[];
  loadClosed?: (parent: string) => void;
  tracker?: SnapshotValues['tracker'];
  idleFrom?: string[];
  plansById?: Record<string, PlanStages>;
  siblingOrders?: Record<string, string[]>;
  loadPlan?: (id: string) => void;
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
  const requestedPlans = new Set<string>();
  function request(frame: WorkbenchRequest) { socket.send(JSON.stringify(frame)); }
  function rows(area: Area, value: ObjectRow[]) {
    state = { ...state, rows: { ...state.rows, [area]: value } };
    changed(state);
  }
  function readObjects() {
    request({ type: 'session.list', id: 'shell-sessions' });
    request({ type: 'topic.list', id: 'shell-topics' });
    request({ type: 'events.list', id: 'shell-events', limit: 200 });
    request({ type: 'artifact.list', id: 'shell-artifacts' });
    request({ type: 'account.list', id: 'shell-accounts' });
  }
  function items(value: ExplorerSummary[]) {
    const closed = new Map<string, ExplorerSummary[]>();
    const ids = new Set(value.map(row => row.id));
    for (const row of value) if (row.kind === 'task' && row.state === 'closed') {
      const parent = row.parent && ids.has(row.parent) ? row.parent : '';
      if (!closed.has(parent)) closed.set(parent, []);
      closed.get(parent)!.push(row);
    }
    // Snapshot-backed today. A paged source replaces these two functions without changing the tree.
    state = { ...state, items: value, closedTasks: parent => closed.get(parent) ?? [], loadClosed: () => {},
      releases: value.filter(row => row.kind === state.tracker?.levels[0] && row.state === 'open')
      .sort((a, b) => (a.version ?? '').localeCompare(b.version ?? '', undefined, { numeric: true }) || (a.rank ?? 0) - (b.rank ?? 0)) };
    rows('Items', value);
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
    requestedPlans.clear();
    state = { ...state, loadPlan: id => {
      if (requestedPlans.has(id) || socket.readyState !== WebSocket.OPEN) return;
      requestedPlans.add(id);
      request({ type: 'task.plan', id: `tree-plan:${id}`, item: id, op: 'show' });
    } };
    socket = new WebSocket(url);
    // An open socket alone is not authenticated readiness. Bound the hello/status too.
    deadline = setTimeout(() => socket.close(), 5000);
    socket.onopen = () => {
      const hello: ClientHello = { type: 'hello', protocol: PROTOCOL_VERSION, client: 'ui', features: ['snapshot', 'numbered-deltas', 'slim-frames'] };
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
        request({ type: 'hub.status', id: 'connection-status' });
        request({ type: 'artifact.list', id: 'shell-artifacts' });
      } else if (frame.type === 'snapshot') {
        if (frame.domain === 'tracker') state = { ...state, tracker: frame.value, siblingOrders: {}, plansById: {} };
        else if (frame.domain === 'items') items(frame.value.items);
        else if (frame.domain === 'sessions') {
          state = { ...state, coordinator: frame.value.coordinator, idleFrom: frame.value.crew.config.idle_from ?? [] };
          rows('Sessions', frame.value.rows.map(row => ({ id: row.name, title: row.label ?? row.name })));
        } else if (frame.domain === 'inbox') inbox(frame.value);
        else if (frame.domain === 'topics') rows('Topics', frame.value.topics);
        else if (frame.domain === 'events') rows('Events', frame.value.rows.map(row => ({ id: row.id, title: row.text })));
        else if (frame.domain === 'accounts') rows('Accounts', frame.value.accounts.map(row => ({ id: `${row.harness}/${row.name}`, title: row.name })));
        changed(state);
      } else if (frame.type === 'resync' || frame.type === 'snapshot.refused') {
        socket.close();
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
      } else if (frame.type === 'result' && frame.id.startsWith('tree-plan:')) {
        const id = frame.id.slice('tree-plan:'.length);
        state = { ...state, plansById: { ...state.plansById, [id]: frame.ok ? (frame.value as { stages: PlanStages }).stages : [] } };
        changed(state);
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
      else if (frame.type === 'crew') { state = { ...state, idleFrom: frame.config.idle_from }; changed(state); }
      else if (frame.type === 'role.filled' || frame.type === 'role.vacant' || frame.type === 'presence') {
        request({ type: 'hub.status', id: 'connection-status' });
        request({ type: 'session.list', id: 'shell-sessions' });
      } else if (frame.type === 'task') {
        const value = new Map(state.items?.map(row => [row.id, row]));
        const oldParent = value.get(frame.id)?.parent ?? '';
        const newParent = frame.item?.parent ?? '';
        const siblingOrders = { ...state.siblingOrders };
        delete siblingOrders[oldParent];
        delete siblingOrders[newParent];
        if (frame.siblings) siblingOrders[newParent] = frame.siblings;
        state = { ...state, siblingOrders };
        if (frame.item) value.set(frame.id, explorerItem(frame.item));
        else value.delete(frame.id);
        if (requestedPlans.delete(frame.id)) state.loadPlan?.(frame.id);
        items([...value.values()]);
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
