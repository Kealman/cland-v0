import { Ladder } from '../tracker/kinds.ts';
// §3.5 policy lives in the hub. Layers are projections, not stored decisions: history,
// snapshots and live frames all use today's clock, role identities and project defaults.
import type { HubFrame } from '../protocol.ts';
import type { VisibilityPreferences, VisibilityPreferenceFile, PreferenceSurface } from './visibility-preferences.ts';

export type Layer = 'now' | 'watch' | 'background' | 'archive';
export const DEFAULT_VISIBILITY = {
  messages: { human: 'now', ask: 'now', not_clear: 'watch', clear: 'watch', coordinator_report: 'watch', agent: 'background', old: 'archive' },
  // Warnings inform the human; asks, approvals and waiting topics need a response.
  inbox: { plan: 'watch', ask: 'now', approval: 'now', waiting: 'now', not_clear: 'watch', death: 'watch', clear: 'watch', release: 'watch', import: 'watch', idle: 'watch', other: 'background' },
  sessions: { aide: 'now', waiting: 'now', busy: 'now', idle: 'watch', stopped: 'background', archived: 'archive' },
  items: { active: 'now', planned: 'watch', backlog: 'background', unscheduled: 'background', done: 'background', closed_release: 'archive' },
  artifacts: { human: 'watch', coordinator: 'watch', kept: 'watch', agent: 'background', archived: 'archive' },
  // Topics are palette entries, too; their status supplies the same four-layer vocabulary.
  topics: { waiting: 'now', open: 'watch', closed: 'archive' },
} as const;
export type Surface = keyof typeof DEFAULT_VISIBILITY;
export type VisibilityOverrides = Partial<Record<Surface, Record<string, Layer>>>;
type Row = Record<string, unknown>;
const row = (v: unknown): Row | null => typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Row : null;
const rows = (v: unknown): Row[] => Array.isArray(v) ? v.filter(x => row(x) !== null) as Row[] : [];

export function visibilityOverrides(value: unknown): VisibilityOverrides {
  if (value === undefined) return {};
  const table = row(value);
  if (!table) throw new Error('[visibility] must be a table');
  const out: VisibilityOverrides = {};
  for (const [surface, cells] of Object.entries(table)) {
    if (!Object.hasOwn(DEFAULT_VISIBILITY, surface)) throw new Error(`unknown visibility surface ${surface}`);
    const s = surface as Surface;
    const kinds = row(cells);
    if (!kinds) throw new Error(`[visibility] ${s} must be a table keyed by kind`);
    out[s] = {};
    for (const [kind, layer] of Object.entries(kinds)) {
      if (!Object.hasOwn(DEFAULT_VISIBILITY[s], kind)) throw new Error(`unknown visibility kind ${s}.${kind}`);
      if (!['now', 'watch', 'background', 'archive'].includes(String(layer)) || typeof layer !== 'string') throw new Error(`visibility ${s}.${kind} must be now, watch, background or archive`);
      out[s]![kind] = layer as Layer;
    }
  }
  return out;
}

/** Verdict presentation retains the v0 structured facts and agent first-line convention. */
export function messageVerdict(m: Row): 'clear' | 'not clear' | undefined {
  const d = row(m.detail);
  if (m.fromKind === 'hub' && m.kind === 'report' && d && ['review', 'qa'].includes(String(d.verdict)) && ['clear', 'not clear'].includes(String(d.result))) return d.result as 'clear' | 'not clear';
  if (m.fromKind !== 'agent') return;
  const match = String(m.text ?? '').split(/[\r\n]/)[0]?.toLowerCase().match(/^(review|qa) (not clear|clear)(?=$|[^a-z])/);
  return match?.[2] as 'clear' | 'not clear' | undefined;
}

/** Warning facts are projected on snapshots and live events; they require no human action. */
export function warningSeverity(surface: Surface, r: Row): 'warn' | undefined {
  if (surface === 'messages') {
    const detail = row(r.detail);
    const eventWarning = r.fromKind === 'hub' && (
      r.detail && ['verification-executor-fallback', 'verification-sharding-skipped', 'verification-cleanup-incomplete'].includes(String(row(r.detail)?.event))
      || r.kind === 'session-death'
      || (r.kind === 'event' && ((detail?.event === 'task' && detail.result === 'not clear') || (detail?.event === 'session.state' && detail.lifecycle === 'died')))
      || (r.kind === 'agent-message' && detail?.result === 'not clear')
    );
    if (messageVerdict(r) === 'not clear' || eventWarning) return 'warn';
  }
  if ((surface === 'inbox' || surface === 'messages') && r.kind === 'account-limited') return 'warn';
  if (surface === 'inbox' && (r.kind === 'executor-fallback' || r.kind === 'death' || (r.kind === 'verdict' && r.result === 'not clear'))) return 'warn';
}

// SemVer precedence, including numeric prerelease identifiers and ignoring build metadata.
function versionCompare(a: unknown, b: unknown): number {
  if (typeof a !== 'string') return typeof b === 'string' ? 1 : 0;
  if (typeof b !== 'string') return -1;
  const parts = (v: string) => v.split(/[+-]/)[0]!.split('.');
  const numeric = (x: string, y: string) => x.length - y.length || (x === y ? 0 : x < y ? -1 : 1);
  const aa = parts(a), bb = parts(b);
  for (let i = 0; i < 3; i++) { const diff = numeric(aa[i]!, bb[i]!); if (diff) return diff; }
  const ap = a.split('+')[0]!.split('-').slice(1).join('-'), bp = b.split('+')[0]!.split('-').slice(1).join('-');
  if (!ap || !bp) return ap === bp ? 0 : ap ? -1 : 1;
  const as = ap.split('.'), bs = bp.split('.');
  for (let i = 0; i < Math.max(as.length, bs.length); i++) {
    const x = as[i], y = bs[i];
    if (x === undefined || y === undefined) return x === y ? 0 : x === undefined ? -1 : 1;
    if (x === y) continue;
    const xn = /^\d+$/.test(x), yn = /^\d+$/.test(y);
    if (xn && yn) return numeric(x, y);
    if (xn !== yn) return xn ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return 0;
}

export class Visibility {
  readonly #overrides: VisibilityOverrides;
  readonly preferences: VisibilityPreferenceFile | undefined;
  readonly #role: (name: string) => string | null;
  readonly #process: (sessionId: string) => Row | undefined;
  readonly #now: () => Date;
  readonly #items: () => Row[];
  readonly #ladder: Ladder;
  constructor(options: { preferences?: VisibilityPreferenceFile | undefined; overrides?: VisibilityOverrides; role?: (name: string) => string | null; process?: (sessionId: string) => Row | undefined; now?: () => Date; items?: () => Row[]; ladder?: Ladder } = {}) {
    this.#overrides = options.overrides ?? {};
    this.preferences = options.preferences;
    this.#role = options.role ?? (() => null);
    this.#process = options.process ?? (() => undefined);
    this.#now = options.now ?? (() => new Date());
    this.#items = options.items ?? (() => []);
    this.#ladder = options.ladder ?? new Ladder();
  }

  layer(surface: Surface, kind: string): Layer {
    const defaults: Readonly<Record<string, Layer>> = DEFAULT_VISIBILITY[surface];
    return this.#overrides[surface]?.[kind] ?? defaults[kind] ?? 'background';
  }

  /** Project policy can promote an informational event; human pins do not change its class. */
  raisedToNow(surface: Surface, object: Row, kind?: string): boolean {
    if (!this.#overrides[surface]) return false;
    const cell = kind ?? this.#kind(surface, object);
    const defaults: Readonly<Record<string, Layer>> = DEFAULT_VISIBILITY[surface];
    return this.#overrides[surface]?.[cell] === 'now' && defaults[cell] !== 'now';
  }

  place<T extends object>(surface: Surface, object: T, kind?: string): T & { layer: Layer; severity?: 'warn' } {
    const r = object as Row;
    const cell = kind ?? this.#kind(surface, r);
    // Creation chips inherit the artifact's effective layer exactly once.
    if (surface === 'messages' && cell === 'artifact') return { ...object, layer: this.place('artifacts', row(r.artifact)!).layer };
    const severity = warningSeverity(surface, r);
    let layer = severity && cell !== 'old' ? 'watch' : this.layer(surface, cell);
    if (surface === 'messages' && row(r.detail)?.event === 'verification-cleanup-incomplete' && cell !== 'old') layer = 'now';
    const preferences: VisibilityPreferences = this.preferences?.get() ?? {};
    const choice = (surface: PreferenceSurface, target: unknown) => {
      const cells = preferences[surface];
      return typeof target === 'string' && cells && Object.hasOwn(cells, target) ? cells[target] : undefined;
    };
    // A direct choice wins; otherwise related records inherit their topic/session choice.
    const topic = surface === 'inbox' && cell === 'waiting' ? r.id : typeof r.topic === 'string' ? r.topic : row(r.topic)?.id;
    const session = surface === 'sessions' ? r.name ?? r.session : r.session ?? (surface === 'messages' ? r.from : undefined);
    const direct = surface === 'topics' ? choice('topics', r.id)
      : surface === 'sessions' ? choice('sessions', session)
      : surface === 'artifacts' ? choice('artifacts', r.id) : undefined;
    const mode = direct ?? choice('topics', topic) ?? choice('sessions', session);
    if (mode === 'pin') layer = 'now';
    if (mode === 'mute') layer = ({ now: 'watch', watch: 'background', background: 'archive', archive: 'archive' } as const)[layer];
    if (surface === 'sessions' && cell === 'archived') layer = 'archive';
    return { ...object, layer, ...(severity ? { severity } : {}) };
  }

  #kind(surface: Surface, r: Row, activeItems?: Set<unknown>): string {
    switch (surface) {
      case 'messages': {
        if (r.fromKind === 'hub' && r.kind === 'event' && row(r.detail)?.event === 'rule') return 'agent';
        const ts = Date.parse(String(r.ts));
        if (Number.isFinite(ts) && this.#now().getTime() - ts > 7 * 86_400_000) return 'old';
        if (r.ask || r.answerTo) return 'ask';
        // Verdicts remain visible to the human even when addressed to an agent.
        const verdict = messageVerdict(r);
        if (verdict) return verdict === 'clear' ? 'clear' : 'not_clear';
        if (r.fromKind === 'hub' && row(r.detail)?.event === 'verification-executor-fallback') return 'not_clear';
        // Creation chips share artifact policy; a message with attachments keeps message policy.
        if (row(r.artifact) && !Array.isArray(r.artifacts)) return 'artifact';
        const to = Array.isArray(r.to) ? r.to : [];
        const toHuman = to.includes('human') || to.includes('aide') || to.some(n => typeof n === 'string' && this.#role(n) === 'aide') || (r.fromKind === 'agent' && to.length === 0 && (!r.artifact || Array.isArray(r.artifacts)) && !['progress', 'event'].includes(String(r.kind)));
        if (r.fromRole === 'coordinator' && (r.kind === undefined || r.kind === 'report') && toHuman) return 'coordinator_report';
        if (r.fromKind === 'human' || r.fromRole === 'aide' || toHuman) return 'human';
        return 'agent';
      }
      case 'inbox':
        return r.kind === 'verdict' ? r.result === 'not clear' ? 'not_clear' : r.result === 'clear' ? 'clear' : 'other' : Object.hasOwn(DEFAULT_VISIBILITY.inbox, String(r.kind)) ? String(r.kind) : 'other';
      case 'sessions':
        if (r.archived === true || r.archivedAt) return 'archived';
        if (r.role === 'aide') return 'aide';
        if (r.live === false || ['exited', 'stopped', 'failed'].includes(String(r.status))) return 'stopped';
        return String(r.state).startsWith('waiting') ? 'waiting' : r.state === 'busy' ? 'busy' : 'idle';
      case 'items': {
        if (r.state === 'closed' && r.kind === this.#ladder.top) return 'closed_release';
        if (r.state === 'closed' || r.status === 'done') return 'done';
        const current = (activeItems ?? this.#currentItems()).has(r.id);
        if (r.status === 'planned' && current) return 'planned';
        if (['in progress', 'review', 'qa', 'ready'].includes(String(r.status)) && current) return 'active';
        return !this.#ladder.containers.includes(String(r.kind)) && (r.parent === null || r.parent === undefined || r.parent === '') ? 'unscheduled' : 'backlog';
      }
      case 'artifacts': {
        const authorRole = Object.hasOwn(r, 'creatorRole') ? r.creatorRole : this.#role(String(r.creator));
        if (r.status === 'archived') return 'archived';
        if (r.creator === 'human' || authorRole === 'aide') return 'human';
        if (r.kept === true) return 'kept';
        return authorRole === 'coordinator' && ['shared', 'sent'].includes(String(r.status)) ? 'coordinator' : 'agent';
      }
      case 'topics': return r.status === 'closed' ? 'closed' : r.status === 'waiting for human' ? 'waiting' : 'open';
    }
  }

  #currentItems(items = this.#items()): Set<unknown> {
    const current = items.filter(i => i.kind === this.#ladder.top && i.state === 'open').sort((a, b) => versionCompare(a.version, b.version) || Number(String(a.id).slice(2)) - Number(String(b.id).slice(2)))[0];
    const active = new Set<unknown>();
    if (!current) return active;
    const children = new Map<unknown, unknown[]>();
    for (const i of items) { const list = children.get(i.parent) ?? []; list.push(i.id); children.set(i.parent, list); }
    const pending: unknown[] = [current.id];
    while (pending.length) {
      const id = pending.pop();
      if (active.has(id)) continue;
      active.add(id);
      pending.push(...children.get(id) ?? []);
    }
    return active;
  }

  /** Project only protocol records; text, arbitrary detail and capability maps remain untouched. */
  frame<T extends HubFrame | Row>(frame: T): T {
    let activeItems: Set<unknown> | undefined;
    let itemRows: Row[] | undefined;
    const project = (payload: Row): Row => {
      const out = { ...payload };
      for (const [key, surface] of Object.entries({ messages: 'messages', digest: 'messages', sessions: 'sessions', presence: 'sessions', processes: 'sessions', harnesses: 'sessions', items: 'items', topics: 'topics', artifacts: 'artifacts' } as const)) {
        if (Array.isArray(out[key]) && !(key === 'messages' && typeof out.needsYou === 'number')) out[key] = rows(out[key]).map(r => one(surface, r));
      }
      for (const [key, surface] of Object.entries({ message: 'messages', process: 'sessions', item: 'items', topic: 'topics', artifact: 'artifacts' } as const)) {
        const r = row(out[key]);
        if (r) out[key] = one(surface, r);
      }
      if (Array.isArray(out.asks)) out.asks = rows(out.asks).map(r => this.place('inbox', r, 'ask'));
      if (Array.isArray(out.approvals)) out.approvals = rows(out.approvals).map(r => this.place('inbox', r, 'approval'));
      if (Array.isArray(out.waiting)) out.waiting = rows(out.waiting).map(r => this.place('inbox', r, 'waiting'));
      if (Array.isArray(out.notifications)) out.notifications = rows(out.notifications).map(r => this.place('inbox', r));
      for (const key of ['value', 'inbox']) { const r = row(out[key]); if (r) out[key] = project(r); }
      if (out.type === 'task') {
        itemRows ??= this.#items();
        if (itemRows.length) out.layers = Object.fromEntries(itemRows.map(item => [String(item.id), one('items', item).layer]));
      }
      if (out.type === 'session.state') {
        // State follows the process event on stop/exit; retain terminal facts and its launch role.
        const process = this.#process(String(out.sessionId));
        out.layer = this.place('sessions', { ...process, name: out.session, state: out.state, role: process?.role ?? this.#role(String(out.session)) }).layer;
      }
      return out;
    };
    const one = (surface: Surface, r: Row): Row => {
      if (surface === 'topics' && typeof r.status !== 'string') return r;
      if (surface === 'items') activeItems ??= this.#currentItems(itemRows ??= this.#items());
      const object = surface === 'messages' ? project(r) : r;
      return this.place(surface, object, this.#kind(surface, object, activeItems));
    };
    return project(frame as Row) as T;
  }
}
