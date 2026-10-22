import { PROTOCOL_VERSION, type Artifact, type Capabilities, type ClientHello, type EventsPage, type HubFrame, type HubStatus, type Inbox, type ItemSummary, type ExplorerSummary, type SnapshotValues, type Topic, type WorkbenchRequest } from '../../shared/wire/index.ts';
import { replaceSession, sessionSnapshot, type SessionsState } from './sessions/state.ts';
import { replaceAccount, type AccountsState } from './accounts/state.ts';
import { replaceArtifact, type ArtifactsState } from './artifacts/state.ts';
import type { Area } from './keymap.ts';
import { compareReleases } from './current-release.ts';
import { TopicThreads, type ThreadPage } from './topic-threads.ts';

export type ObjectRow = { id: string; title: string };
type Command<T> = T extends unknown ? Omit<T, 'id'> : never;
export type PlanStages = Array<{ name: string; state: 'open' | 'closed'; items: string[]; qa: { scope: string; when: string } }>;

/** Task deltas retain full verdict history; snapshots already carry the compact projection. */
function explorerItem(item: ItemSummary): ExplorerSummary {
  const rounds = { review: 0, qa: 0 };
  const latest = new Map<string, ExplorerSummary['verdicts'][number]>();
  for (const verdict of item.verdicts) {
    latest.delete(verdict.verdict);
    latest.set(verdict.verdict, { ...verdict, round: ++rounds[verdict.verdict] });
  }
  return { ...item, verify: item.verify ? { ...item.verify, cached: !!item.verify.cached } : null, open_blockers: item.open_blockers ?? [], verdicts: [...latest.values()] };
}


export type ConnectionState = SessionsState & AccountsState & ArtifactsState & {
  project: string; live: boolean; restartRequired?: boolean;
  command?: <T>(frame: Command<WorkbenchRequest>) => Promise<T>;
  resolveItem?: (id: string) => Promise<{ item: ExplorerSummary; ancestors: ExplorerSummary[] } | undefined>;
  loadItems?: (ids: string[]) => Promise<void>;
  coordinator?: string | null;
  topics?: Topic[];
  threads?: TopicThreads;
  marks?: SnapshotValues['topics']['marks'];
  crew?: SnapshotValues['sessions']['crew']['config'];
  needsYou?: number;
  approvals?: number;
  plans?: number;
  waitingTopics?: number;
  releases?: ExplorerSummary[];
  items?: ExplorerSummary[];
  doneItems?: number | undefined;
  /** Loaded closed children from bounded parent pages. */
  closedTasks?: (parent: string) => readonly ExplorerSummary[];
  closedTasksLoaded?: (parent: string) => boolean;
  loadClosed?: (parent: string) => void;
  cardFacts?: Record<string, Partial<ExplorerSummary>>;
  cardErrors?: Record<string, string>;
  bodies?: Record<string, { text?: string; error?: string }>;
  loadCard?: (id: string) => void;
  loadBody?: (id: string) => void;
  tracker?: SnapshotValues['tracker'];
  idleFrom?: string[];
  plansById?: Record<string, PlanStages>;
  siblingOrders?: Record<string, string[]>;
  loadPlan?: (id: string) => void;
  rows?: Partial<Record<Area, ObjectRow[]>>;
};

/** Loaded closed rows remain outside the open snapshot set. */
export function itemRows(connection: ConnectionState): ExplorerSummary[] {
  const rows = new Map(connection.items?.map(row => [row.id, row]));
  const parents = ['', ...rows.keys()];
  const visited = new Set<string>();
  for (const parent of parents) {
    if (visited.has(parent)) continue;
    visited.add(parent);
    for (const row of connection.closedTasks?.(parent) ?? []) {
      if (!rows.has(row.id)) { rows.set(row.id, row); parents.push(row.id); }
    }
  }
  return [...rows.values()];
}
export function findItem(connection: ConnectionState, id: string | undefined): ExplorerSummary | undefined {
  return id ? itemRows(connection).find(row => row.id === id) : undefined;
}

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
  let commandSerial = 0;
  let cursor: { epoch: string; seq: number } | undefined;
  const threads = new TopicThreads((topic, before) => command<ThreadPage>({ type: 'topic.history', topic, limit: 100, ...(before === undefined ? {} : { before }) }), () => { state = { ...state }; changed(state); });
  const commands = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  function rejectCommands() {
    for (const pending of commands.values()) { clearTimeout(pending.timer); pending.reject(new Error('Connection lost; check topic history before retrying')); }
    commands.clear();
  }
  async function command<T>(frame: Command<WorkbenchRequest>): Promise<T> {
    if (!state.live || socket.readyState !== WebSocket.OPEN) throw new Error('Hub offline');
    return new Promise<T>((resolve, reject) => {
      const id = `action:${++commandSerial}`;
      const timer = setTimeout(() => { commands.delete(id); reject(new Error('No receipt; check topic history before retrying')); }, 10_000);
      commands.set(id, { resolve: value => resolve(value as T), reject, timer });
      request({ ...frame, id } as WorkbenchRequest);
    });
  }
  async function resolveItem(id: string): Promise<{ item: ExplorerSummary; ancestors: ExplorerSummary[] } | undefined> {
    const number = id.split('-').at(-1);
    let row = itemRows(state).find(item => item.id.split('-').at(-1) === number);
    if (!row) {
      const result = await command<{ items: ExplorerSummary[] }>({ type: 'task.list', ids: [id], projection: 'summary' });
      row = result.items[0];
      if (row) items([...state.items ?? [], row]);
    }
    const target = row;
    const ancestors: ExplorerSummary[] = [];
    const seen = new Set<string>();
    while (row?.parent && !seen.has(row.parent)) {
      seen.add(row.parent);
      const parent = findItem(state, row.parent);
      if (parent) row = parent;
      else {
        const result = await command<{ items: ExplorerSummary[] }>({ type: 'task.list', ids: [row.parent], projection: 'summary' });
        row = result.items[0];
        if (row) items([...state.items ?? [], row]);
      }
      if (row) ancestors.push(row);
    }
    return target ? { item: target, ancestors } : undefined;
  }
  const itemRevisions = new Map<string, number>();
  const retainedItems = new Set<string>();
  async function loadItems(ids: string[]) {
    ids.forEach(id => retainedItems.add(id));
    const missing = [...new Set(ids)].filter(id => !findItem(state, id));
    for (let offset = 0; offset < missing.length; offset += 100) {
      const batch = missing.slice(offset, offset + 100);
      const revisions = new Map(batch.map(id => [id, itemRevisions.get(id)]));
      const result = await command<{ items: ExplorerSummary[] }>({ type: 'task.list', ids: batch, projection: 'summary' });
      const rows = new Map(state.items?.map(row => [row.id, row]));
      for (const row of result.items) {
        // A newer delta, including deletion, wins over an outstanding summary read.
        if (itemRevisions.get(row.id) === revisions.get(row.id) && !findItem(state, row.id)) rows.set(row.id, row);
      }
      items([...rows.values()]);
    }
  }
  const requestedPlans = new Set<string>();
  const closed = new Map<string, ExplorerSummary[]>();
  const closedLoads = new Map<string, {rows:Map<string,ExplorerSummary>;deltas:Map<string,ExplorerSummary|null>}>();
  const closedWanted = new Set<string>();
  function loadClosed(parent:string) {
    if (closed.has(parent) || closedLoads.has(parent) || socket.readyState !== WebSocket.OPEN) return;
    closedWanted.add(parent);
    closedLoads.set(parent,{rows:new Map(),deltas:new Map()});
    request({type:'task.list',id:`tree-closed:${parent}`,projection:'summary',state:'closed',parent});
  }
  function closedParent(row:ExplorerSummary) { return row.parent && findItem(state,row.parent) ? row.parent : ''; }
  let cardSerial = 0;
  const cardRequests = new Map<string, { item: string; body: boolean }>();
  const pendingCards = new Set<string>();
  const pendingBodies = new Set<string>();
  function loadCardData(item: string, body: boolean) {
    const pending = body ? pendingBodies : pendingCards;
    if (socket.readyState !== WebSocket.OPEN || pending.has(item) ||
        (body ? state.bodies?.[item] : state.cardFacts?.[item] || state.cardErrors?.[item])) return;
    pending.add(item);
    const id = `card:${++cardSerial}`;
    cardRequests.set(id, { item, body });
    request(body ? { type: 'task.view', id, item } : { type: 'task.list', id, ids: [item], projection: 'summary' });
  }
  function invalidateCard(id: string) {
    const cardFacts = { ...state.cardFacts }, bodies = { ...state.bodies }, cardErrors = { ...state.cardErrors };
    delete cardFacts[id]; delete bodies[id]; delete cardErrors[id];
    pendingCards.delete(id); pendingBodies.delete(id);
    for (const [key, value] of cardRequests) if (value.item === id) cardRequests.delete(key);
    state = { ...state, cardFacts, bodies, cardErrors };
  }
  function request(frame: WorkbenchRequest) { socket.send(JSON.stringify(frame)); }
  function rows(area: Area, value: ObjectRow[]) {
    state = { ...state, rows: { ...state.rows, [area]: value } };
    changed(state);
  }
  function readObjects() {
    request({ type: 'topic.list', id: 'shell-topics' });
    request({ type: 'events.list', id: 'shell-events', limit: 200 });
  }
  function items(value: ExplorerSummary[]) {
    state = { ...state, items: value, closedTasks: parent => closed.get(parent) ?? [], closedTasksLoaded: parent => closed.has(parent), loadClosed,
      releases: value.filter(row => row.kind === state.tracker?.levels[0] && row.state === 'open')
      .sort(compareReleases) };
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
    state = { ...state, command, resolveItem, loadItems, threads };
    requestedPlans.clear();
    closedLoads.clear();
    cardRequests.clear(); pendingCards.clear(); pendingBodies.clear();
    state = { ...state, loadCard: id => loadCardData(id, false), loadBody: id => loadCardData(id, true) };
    state = { ...state, loadPlan: id => {
      if (requestedPlans.has(id) || socket.readyState !== WebSocket.OPEN) return;
      requestedPlans.add(id);
      request({ type: 'task.plan', id: `tree-plan:${id}`, item: id, op: 'show' });
    } };
    socket = new WebSocket(url);
    // An open socket alone is not authenticated readiness. Bound the hello/status too.
    deadline = setTimeout(() => socket.close(), 5000);
    socket.onopen = () => {
      const hello: ClientHello = { type: 'hello', protocol: PROTOCOL_VERSION, client: 'ui', features: ['snapshot', 'numbered-deltas', 'slim-frames'], ...(cursor ? { resume: cursor } : {}) };
      socket.send(JSON.stringify(hello));
    };
    socket.onmessage = event => {
      let frame: HubFrame;
      try { frame = JSON.parse(String(event.data)) as HubFrame; }
      catch { socket.close(); return; }
      if (frame.type === 'snapshot.end' || ('epoch' in frame && 'seq' in frame && frame.type !== 'snapshot')) cursor = { epoch: frame.epoch, seq: frame.seq };
      threads.apply(frame);
      if (frame.type === 'result' && commands.has(frame.id)) {
        const pending = commands.get(frame.id)!;
        commands.delete(frame.id); clearTimeout(pending.timer);
        if (frame.ok) pending.resolve(frame.value);
        else pending.reject(new Error(frame.error ?? 'Request failed'));
      } else if (frame.type === 'welcome') {
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
        request({ type: 'session.list', id: 'shell-sessions' });
        request({ type: 'artifact.list', id: 'shell-artifacts' });
      } else if (frame.type === 'snapshot') {
        if (frame.domain === 'tracker') {
          cursor = undefined; // A partial replacement must never be resumed as a complete model.
          itemRevisions.clear(); retainedItems.clear(); closed.clear();
          state = { ...state, tracker: frame.value, siblingOrders: {}, plansById: {}, cardFacts: {}, bodies: {}, cardErrors: {} };
        }
        else if (frame.domain === 'items') {
          state = {...state,doneItems:frame.value.done_items};
          items(frame.value.items);
          for (const parent of closedWanted) loadClosed(parent);
        }
        else if (frame.domain === 'sessions') {
          state = { ...state, coordinator: frame.value.coordinator, ...sessionSnapshot(frame.value, Date.now()), crew: frame.value.crew.config, idleFrom: frame.value.crew.config.idle_from ?? [] };
          rows('Sessions', frame.value.rows.map(row => ({ id: row.name, title: row.label ?? row.name })));
        } else if (frame.domain === 'inbox') inbox(frame.value);
        else if (frame.domain === 'topics') { threads.reset(); state = { ...state, topics: frame.value.topics, marks: frame.value.marks }; rows('Topics', frame.value.topics); }
        else if (frame.domain === 'events') rows('Events', frame.value.rows.map(row => ({ id: row.id, title: row.text })));
        else if (frame.domain === 'accounts') {
          state = { ...state, accounts: frame.value };
          rows('Accounts', frame.value.accounts.map(row => ({ id: `${row.harness}/${row.name}`, title: row.name })));
        }
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
        for (const parent of closedWanted) loadClosed(parent);
        changed(state);
      } else if (frame.type === 'result' && frame.ok && frame.id === 'shell-inbox') {
        inbox(frame.value as Inbox);
      } else if (frame.type === 'result' && frame.id.startsWith('tree-closed:')) {
        const parent=frame.id.slice('tree-closed:'.length), load=closedLoads.get(parent);
        if (!load) return;
        if (!frame.ok) { closedLoads.delete(parent);return; }
        const page=frame.value as {items:ExplorerSummary[];next:string|null};
        for (const row of page.items) load.rows.set(row.id,row);
        if (page.next) request({type:'task.list',id:frame.id,projection:'summary',state:'closed',parent,cursor:page.next});
        else {
          for (const [id,row] of load.deltas) { if(row) load.rows.set(id,row); else load.rows.delete(id); }
          closed.set(parent,[...load.rows.values()]);closedLoads.delete(parent);
          items(state.items??[]);
        }
      } else if (frame.type === 'result' && cardRequests.has(frame.id)) {
        const { item, body } = cardRequests.get(frame.id)!;
        cardRequests.delete(frame.id);
        (body ? pendingBodies : pendingCards).delete(item);
        if (body) state = { ...state, bodies: { ...state.bodies, [item]: frame.ok
          ? { text: (frame.value as { item: { body: string } }).item.body } : { error: frame.error ?? 'Body unavailable' } } };
        else if (frame.ok) state = { ...state, cardFacts: { ...state.cardFacts, [item]: (frame.value as { items: Partial<ExplorerSummary>[] }).items[0] ?? {} } };
        else state = { ...state, cardErrors: { ...state.cardErrors, [item]: frame.error ?? 'Card unavailable' } };
        changed(state);
      } else if (frame.type === 'result' && frame.id.startsWith('tree-plan:')) {
        const id = frame.id.slice('tree-plan:'.length);
        state = { ...state, plansById: { ...state.plansById, [id]: frame.ok ? (frame.value as { stages: PlanStages }).stages : [] } };
        changed(state);
      } else if (frame.type === 'result' && frame.ok && frame.id === 'shell-sessions') {
        state = { ...state, adapters: (frame.value as { adapters: Record<string, Capabilities> }).adapters };
        changed(state);
      } else if (frame.type === 'result' && frame.ok && frame.id === 'shell-topics') {
        state = { ...state, topics: (frame.value as { topics: Topic[] }).topics };
        rows('Topics', state.topics!);
      } else if (frame.type === 'result' && frame.ok && frame.id === 'shell-events') {
        rows('Events', (frame.value as EventsPage).rows.map(row => ({ id: row.id, title: row.text })));
      } else if (frame.type === 'result' && frame.ok && frame.id === 'shell-artifacts') {
        state = { ...state, artifacts: (frame.value as { artifacts: Artifact[] }).artifacts };
        rows('Artifacts', state.artifacts!.map(row => ({ id: row.id, title: row.title })));
      } else if (frame.type === 'marks') { state = { ...state, marks: frame.marks }; changed(state); }
      else if (frame.type === 'inbox') inbox(frame.inbox);
      else if (frame.type === 'session.row') {
        state = { ...state, sessions: replaceSession(state.sessions ?? [], frame.key, frame.row) };
        rows('Sessions', state.sessions!.map(row => ({ id: row.name, title: row.label })));
      }
      else if (frame.type === 'session.usage') { state = { ...state, sessions: (state.sessions ?? []).map(row => row.sessionId === frame.sessionId ? { ...row, usage: frame.usage } : row) }; changed(state); }
      else if (frame.type === 'crew') { state = { ...state, crew: frame.config, idleFrom: frame.config.idle_from }; changed(state); }
      else if (frame.type === 'role.filled' || frame.type === 'role.vacant') {
        request({ type: 'hub.status', id: 'connection-status' });
      } else if (frame.type === 'task') {
        itemRevisions.set(frame.id, (itemRevisions.get(frame.id) ?? 0) + 1);
        if (frame.done_items !== undefined) state = {...state,doneItems:frame.done_items};
        invalidateCard(frame.id);
        const value = new Map(state.items?.map(row => [row.id, row]));
        const previous = findItem(state, frame.id);
        const oldParent = previous?.parent ?? '';
        const newParent = frame.item?.parent ?? '';
        // An unloaded row has no known old parent; any cached order may include it.
        const siblingOrders = previous ? { ...state.siblingOrders } : {};
        delete siblingOrders[oldParent];
        delete siblingOrders[newParent];
        if (frame.siblings) siblingOrders[newParent] = frame.siblings;
        state = { ...state, siblingOrders };
        const row=frame.item ? explorerItem(frame.item) : null;
        for (const [parent,load] of closedLoads) load.deltas.set(frame.id,row?.state==='closed'&&closedParent(row)===parent ? row : null);
        for (const [parent,rows] of closed) {
          const next=rows.filter(item=>item.id!==frame.id);
          if (row?.state==='closed'&&closedParent(row)===parent) next.push(row);
          closed.set(parent,next);
        }
        if (row && (!(row.kind==='task'&&row.state==='closed') || retainedItems.has(row.id))) value.set(frame.id,row);
        else value.delete(frame.id);
        if (requestedPlans.delete(frame.id)) state.loadPlan?.(frame.id);
        items([...value.values()]);
      } else if (frame.type === 'topic') {
        state = { ...state, topics: [...(state.topics ?? []).filter(row => row.id !== frame.topic.id), frame.topic] };
        rows('Topics', state.topics!);
      } else if (frame.type === 'message') {
        state = { ...state, topics: (state.topics ?? []).map(row => row.id === frame.topic.id ? { ...row, ...frame.topic } : row) };
        rows('Topics', state.topics ?? []);
      } else if (frame.type === 'delivery' || frame.type === 'ask') {
        state = { ...state }; changed(state);
      } else if (frame.type === 'event') {
        request({ type: 'events.list', id: 'shell-events', limit: 200 });
      } else if (frame.type === 'artifact') {
        state = { ...state, artifacts: replaceArtifact(state.artifacts, frame.artifact) };
        rows('Artifacts', state.artifacts!.map(row => ({ id: row.id, title: row.title })));
      } else if (frame.type === 'verification.queue') {
        state = { ...state, verification: { queue: frame.queue, receivedAt: Date.now() } };
        changed(state);
      } else if (frame.type === 'account') {
        state = { ...state, accounts: replaceAccount(state.accounts, frame.account) };
        rows('Accounts', state.accounts!.accounts.map(row => ({ id: `${row.harness}/${row.name}`, title: row.name })));
      } else if (frame.type === 'session.process') {
        if (frame.archived !== undefined) { state = { ...state, archivedSessions: frame.archived }; changed(state); }
      } else if (frame.type === 'sessions.pruned') {
        state = { ...state, archivedSessions: frame.archived, sessions: (state.sessions ?? []).filter(row => !frame.sessionIds.includes(row.sessionId)) };
        rows('Sessions', state.sessions!.map(row => ({ id: row.name, title: row.label })));
      } else if (frame.type === 'visibility') {
        if ('rows' in frame) {
          const topics = new Map(state.topics?.map(row => [row.id, row]));
          for (const row of frame.rows.topics) topics.set(row.id, row);
          state = { ...state, topics: [...topics.values()], artifacts: frame.rows.artifacts.reduce((rows, artifact) => replaceArtifact(rows, artifact), state.artifacts ?? []) };
          rows('Topics', state.topics!);
          rows('Artifacts', state.artifacts!.map(row => ({ id: row.id, title: row.title })));
        } else readObjects();
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
      rejectCommands();
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
    rejectCommands();
    socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
    socket.close();
  };
}
