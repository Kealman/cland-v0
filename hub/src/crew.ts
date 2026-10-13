// Staffing policy only; role clauses, permissions and harness defaults stay in roles.toml.
import { readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { parse, stringify as serialize } from 'smol-toml';
import { DEFAULT_LEVELS, kindsFor, ladderOf, type LadderInput } from './tracker/kinds.ts';
import { parseItemReference, prefixOf } from './tracker/prefixes.ts';
import { idNumber } from './tracker/item.ts';
import type { Tracker } from './tracker/tracker.ts';
import type { LogFn } from './log.ts';
import type { Resumed } from './hub/budget.ts';

export const CREW_ROLES = ['coordinator', 'lead', 'implementer', 'reviewer', 'qa', 'aide'] as const;
export type CrewPolicy = 'per-item' | 'per-group' | 'pool' | 'singleton';
export type CrewRole = { policy: CrewPolicy; size: number | null; keep_context: boolean; stop_after: 'merge' | 'never'; subagents: boolean };
export type IdleCategory = { id: string; title: string };
export type CrewConfig = { leads: string[]; idle_from: string[]; idle_categories: IdleCategory[]; idle_ignored: Array<{ id: string; reason: string }>; crew: Record<string, CrewRole> };
export type CrewSource = { get(): CrewConfig; set(key: string, value: unknown, resumed: Resumed, authorize: () => void): Promise<CrewConfig> };

export function defaultCrew(): CrewConfig {
  const crew: Record<string, CrewRole> = {};
  for (const role of CREW_ROLES) crew[role] = { policy: 'per-item', size: null, keep_context: false, stop_after: 'never', subagents: role === 'coordinator' || role === 'lead' };
  crew.coordinator!.policy = 'singleton'; crew.coordinator!.size = 1;
  crew.implementer!.stop_after = 'merge';
  crew.reviewer = { policy: 'pool', size: 1, keep_context: true, stop_after: 'never', subagents: false };
  crew.qa!.policy = 'singleton'; crew.qa!.size = 1;
  return { leads: [], idle_from: [], idle_categories: [], idle_ignored: [], crew };
}

export function parseIdleFrom(value: unknown, levels: LadderInput = DEFAULT_LEVELS): string[] {
  if (!Array.isArray(value)) throw new Error('idle_from must be a list of item ids');
  const kinds = [...kindsFor(levels), 'category'];
  const ids = value.map(raw => {
    const ref = typeof raw === 'string' ? parseItemReference(raw, kinds) : null;
    if (!ref) throw new Error(`idle_from: invalid item id ${String(raw)}`);
    return `C-${ref.n}`;
  });
  if (new Set(ids).size !== ids.length) throw new Error('idle_from: duplicate item id');
  return ids;
}

/** Resolve once per reload; ignored references remain in the source policy. */
export function resolveCrewIdle(config: CrewConfig, tracker: Tracker): CrewConfig {
  if (!config.idle_from.length) return { ...config, idle_categories: [], idle_ignored: [] };
  const category = tracker.ladder.roots.find(kind => kind !== tracker.ladder.top && prefixOf(kind) === 'C');
  const items = new Map(tracker.list().map(item => [idNumber(item.id), item]));
  const idle_categories: IdleCategory[] = [];
  const idle_ignored: CrewConfig['idle_ignored'] = [];
  for (const id of config.idle_from) {
    const item = items.get(idNumber(id));
    if (!item || item.kind !== category || item.state !== 'open') {
      const reason = !item ? 'no such item' : item.kind !== category ? `item is ${item.kind}, not a category` : 'category is closed';
      idle_ignored.push({ id, reason });
    } else idle_categories.push({ id: item.id, title: item.title });
  }
  return { ...config, idle_categories, idle_ignored };
}
// smol-toml uses null-prototype objects for ordinary TOML tables.
function isPlainTable(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null) return false;
  const prototype = Object.getPrototypeOf(v);
  return prototype === Object.prototype || prototype === null;
}
function keys(doc: Record<string, unknown>, allowed: readonly string[], where: string): void {
  for (const key of Object.keys(doc)) if (!allowed.includes(key)) throw new Error(`${where}: unknown key ${key}`);
}
export function parseCrew(text: string, levels: LadderInput = DEFAULT_LEVELS): CrewConfig {
  const doc = parse(text);
  if (!isPlainTable(doc)) throw new Error('crew.toml must contain a table');
  keys(doc, ['leads', 'idle_from', 'crew'], 'crew.toml');
  const out = defaultCrew();
  const ladder = ladderOf(levels);
  if (doc.idle_from !== undefined) out.idle_from = parseIdleFrom(doc.idle_from, levels);
  if (doc.leads !== undefined) {
    if (!Array.isArray(doc.leads) || !doc.leads.every(v => typeof v === 'string' && ladder.canLead(v)) || new Set(doc.leads).size !== doc.leads.length) throw new Error(`leads must be a unique list of container levels (${ladder.containers.filter(kind => ladder.canLead(kind)).join(', ')})`);
    out.leads = doc.leads as string[];
  }
  if (doc.crew === undefined) return out;
  if (!isPlainTable(doc.crew)) throw new Error('crew must be a table');
  keys(doc.crew, CREW_ROLES, 'crew');
  for (const [role, table] of Object.entries(doc.crew)) {
    if (!isPlainTable(table)) throw new Error(`crew.${role} must be a table`);
    keys(table, ['policy', 'size', 'keep_context', 'stop_after', 'subagents'], `crew.${role}`);
    const rule = out.crew[role]!;
    if (table.policy !== undefined) {
      if (typeof table.policy !== 'string' || !['per-item', 'per-group', 'pool', 'singleton'].includes(table.policy)) throw new Error(`crew.${role}.policy must be per-item, per-group, pool or singleton`);
      rule.policy = table.policy as CrewPolicy;
      // A policy change takes the new policy's cap rather than inheriting the old one.
      rule.size = rule.policy === 'singleton' ? 1 : rule.policy === 'pool' ? 1 : null;
    }
    if (table.size !== undefined) {
      if (typeof table.size !== 'number' || !Number.isSafeInteger(table.size) || table.size < 1) throw new Error(`crew.${role}.size must be a positive safe integer`);
      rule.size = table.size;
    }
    if (rule.policy === 'singleton' && rule.size !== 1) throw new Error(`crew.${role}.size must be 1 for singleton`);
    for (const key of ['keep_context', 'subagents'] as const) {
      if (table[key] !== undefined) {
        if (typeof table[key] !== 'boolean') throw new Error(`crew.${role}.${key} must be true or false`);
        rule[key] = table[key];
      }
    }
    if (table.stop_after !== undefined) {
      if (table.stop_after !== 'merge' && table.stop_after !== 'never') throw new Error(`crew.${role}.stop_after must be merge or never`);
      rule.stop_after = table.stop_after;
    }
  }
  return out;
}
export function renderCrew(config: CrewConfig): string {
  const lines = ['# Project staffing policy; role definitions and harness defaults live in roles.toml.', `leads = ${JSON.stringify(config.leads)}`, `idle_from = ${JSON.stringify(config.idle_from)}`];
  for (const role of CREW_ROLES) {
    const rule = config.crew[role]!;
    lines.push('', `[crew.${role}]`, `policy = ${JSON.stringify(rule.policy)}`);
    if (rule.size !== null) lines.push(`size = ${rule.size}`);
    lines.push(`keep_context = ${rule.keep_context}`, `stop_after = ${JSON.stringify(rule.stop_after)}`, `subagents = ${rule.subagents}`);
  }
  return lines.join('\n') + '\n';
}
export const DEFAULT_CREW_TOML = renderCrew(defaultCrew());
export function crewSummary(config: CrewConfig): string {
  return [['implementer', 'impl'], ['reviewer', 'rev'], ['qa', 'qa']].map(([role, label]) => {
    const rule = config.crew[role!]!;
    return `${label} ${rule.policy === 'singleton' ? '1' : rule.policy.replace('-', ' ') + (rule.size === null ? '' : ` ${rule.size}`)}`;
  }).concat(`leads: ${config.leads.join(', ') || 'none'}`, `idle: ${config.idle_categories.map(item => `${item.id} ${item.title}`).join(', ') || 'never'}`, ...config.idle_ignored.map(item => `ignored ${item.id}: ${item.reason}`)).join(' · ');
}

/** Poll off the request path. Invalid/missing sources retain the last good snapshot and emit one notice. */
export class CrewFile implements CrewSource {
  #config = defaultCrew();
  #text: string | null = null;
  #error: string | null = null;
  #timer: NodeJS.Timeout | null = null;
  #queue: Promise<unknown> = Promise.resolve();
  #stopped = false;
  readonly path: string;
  readonly log: LogFn;
  readonly changed: (config: CrewConfig) => void;
  readonly levels: LadderInput;
  readonly resumed: Resumed;
  readonly tracker: Tracker;
  constructor(path: string, log: LogFn, changed: (config: CrewConfig) => void, tracker: Tracker, resumed: Resumed = work => work()) {
    this.path = path; this.log = log; this.changed = changed; this.levels = tracker.ladder; this.resumed = resumed;
    this.tracker = tracker;
  }
  get(): CrewConfig { return this.#config; }
  async start(): Promise<void> {
    try { await writeFile(this.path, DEFAULT_CREW_TOML, { flag: 'wx' }); }
    catch (err) { if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err; }
    await this.#enqueue(() => this.#reload());
    this.#timer = setInterval(() => { void this.#enqueue(() => this.#reload()); }, 500);
    this.#timer.unref();
  }
  async stop(): Promise<void> { this.#stopped = true; if (this.#timer) clearInterval(this.#timer); await this.#queue; }
  #enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = this.#queue.then(work);
    this.#queue = next.catch(() => {});
    return next;
  }
  #publish(text: string, config: CrewConfig): void {
    config = resolveCrewIdle(config, this.tracker);
    this.#text = text; this.#error = null;
    if (JSON.stringify(config) === JSON.stringify(this.#config)) return;
    this.#config = config;
    this.log({ event: 'crew-loaded', path: this.path, crew: config });
    this.changed(config);
  }
  async #reload(): Promise<void> {
    if (this.#stopped) return;
    try {
      const text = await readFile(this.path, 'utf8');
      this.resumed(() => {
        if (this.#stopped) return;
        const config = text === this.#text ? this.#config : parseCrew(text, this.levels);
        this.#publish(text, config);
      });
    } catch (err) {
      this.resumed(() => {
        if (this.#stopped) return;
        const error = err instanceof Error ? err.message : String(err);
        if (error !== this.#error) this.log({ event: 'crew-refused', path: this.path, error, keeping: 'the last good crew' });
        this.#error = error;
        // Reappearance of the same valid text clears the refusal state.
        this.#text = null;
      });
    }
  }
  set(key: string, value: unknown, resumed: Resumed, authorize: () => void): Promise<CrewConfig> {
    return this.#enqueue(async () => {
      const original = await readFile(this.path, 'utf8');
      const text = resumed(() => {
        authorize();
        const doc = parse(original) as Record<string, unknown>;
        parseCrew(original, this.levels); // Never overwrite a broken human edit using the cached snapshot.
        if (key === 'leads' || key === 'idle_from') doc[key] = value;
        else {
          const [role, field, extra] = key.split('.');
          if (!role || !CREW_ROLES.includes(role as typeof CREW_ROLES[number]) || !field || extra) throw new Error('crew key must be leads, idle_from or <role>.<key>');
          const crew = (doc.crew ??= {}) as Record<string, unknown>;
          const table = (crew[role] ??= {}) as Record<string, unknown>;
          table[field] = value;
        }
        // Render raw TOML through the serializer, then validate the complete candidate before writing.
        return renderCrew(parseCrew(serialize(doc), this.levels));
      });
      const temporary = `${this.path}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, text, { flag: 'wx' });
        const current = await readFile(this.path, 'utf8');
        resumed(() => { authorize(); if (current !== original) throw new Error('crew.toml changed while setting it; retry'); });
        await rename(temporary, this.path);
        return resumed(() => { this.#publish(text, parseCrew(text, this.levels)); return this.get(); });
      } finally { await unlink(temporary).catch(() => {}); }
    });
  }
}
