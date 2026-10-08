// The project's role definitions, `.cland/roles.toml` (spec 4.4, ADR 0001): per role a clause, skills, launch
// defaults and the permission list (#30 enforces it). Written with the defaults when missing, never rewritten;
// watched, and read again before each use when it changed on disk, so the next launch or assignment uses
// what the human last saved. A file that does not parse is logged and the last good version stays in force.
import { existsSync, readFileSync, statSync, watch, writeFileSync, type FSWatcher } from 'node:fs';
import { basename, dirname } from 'node:path';
import { parse } from 'smol-toml';
import { ROLE_NAMES } from '../names.ts';
import type { LogFn } from '../log.ts';
import { DEFAULT_ROLES_TOML } from './default-roles.ts';

export type LaunchDefaults = {
  harness: string;
  /** null: the harness's own default. */
  model: string | null;
  /** null: the harness's own default. */
  effort: string | null;
};

export type RoleDefinition = {
  role: string;
  /** At most one holder (the Coordinator). */
  exclusive: boolean;
  clause: string;
  skills: string[];
  launch: LaunchDefaults;
  /** The spoke tools the role may use. Recorded only: enforced from #30 on. */
  permissions: { tools: string[] };
};

export type RolesConfig = ReadonlyMap<string, RoleDefinition>;

/** What the hub asks of the role definitions: the current ones, read again if the file changed. */
export type RolesSource = { get: () => RolesConfig };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const strings = (v: unknown, where: string): string[] => {
  if (v === undefined) return [];
  if (!Array.isArray(v) || !v.every((s) => typeof s === 'string')) throw new Error(`${where} must be a list of strings`);
  return v as string[];
};
const optString = (v: unknown, where: string): string | null => {
  if (v === undefined) return null;
  if (typeof v !== 'string') throw new Error(`${where} must be a string`);
  return v.trim() || null;
};

/** Parse the file's text. Throws with the place that is wrong; a role the file leaves out takes its default. */
export function parseRoles(text: string, fallback: RolesConfig | null = null): RolesConfig {
  const doc = parse(text) as Record<string, unknown>;
  const unknown = Object.keys(doc).filter((k) => !ROLE_NAMES.includes(k));
  if (unknown.length) throw new Error(`unknown role ${unknown.map((k) => `[${k}]`).join(', ')} (roles: ${ROLE_NAMES.join(', ')})`);
  const out = new Map<string, RoleDefinition>();
  for (const role of ROLE_NAMES) {
    const t = doc[role];
    if (t === undefined) {
      const d = (fallback ?? DEFAULTS).get(role);
      if (d) out.set(role, d);
      continue;
    }
    if (!isRecord(t)) throw new Error(`[${role}] must be a table`);
    const launch = t.launch ?? {};
    const permissions = t.permissions ?? {};
    if (!isRecord(launch)) throw new Error(`[${role}.launch] must be a table`);
    if (!isRecord(permissions)) throw new Error(`[${role}.permissions] must be a table`);
    if (t.exclusive !== undefined && typeof t.exclusive !== 'boolean') throw new Error(`${role}.exclusive must be true or false`);
    const harness = optString(launch.harness, `${role}.launch.harness`);
    if (harness === null) throw new Error(`${role}.launch.harness is required`);
    out.set(role, {
      role,
      exclusive: t.exclusive === true,
      clause: (optString(t.clause, `${role}.clause`) ?? '').trim(),
      skills: strings(t.skills, `${role}.skills`),
      launch: { harness, model: optString(launch.model, `${role}.launch.model`), effort: optString(launch.effort, `${role}.launch.effort`) },
      permissions: { tools: strings(permissions.tools, `${role}.permissions.tools`) },
    });
  }
  return out;
}

/** The built-in defaults: the file cland writes. */
export const DEFAULTS: RolesConfig = parseRoles(DEFAULT_ROLES_TOML, new Map());

/** A fixed set of definitions, for a hub with no project file. */
export const fixedRoles = (config: RolesConfig = DEFAULTS): RolesSource => ({ get: () => config });

/** `.cland/roles.toml`: created with the defaults when missing, watched, re-read when it changed. */
export class RolesFile implements RolesSource {
  readonly path: string;
  readonly #log: LogFn;
  #config: RolesConfig = DEFAULTS;
  /** What the loaded version looked like on disk: a different stamp means read again. */
  #stamp = '';
  #watcher: FSWatcher | null = null;
  #debounce: NodeJS.Timeout | null = null;

  constructor(path: string, log: LogFn = () => {}) {
    this.path = path;
    this.#log = log;
  }

  /** Write the defaults when the file is missing, load it, start watching. */
  start(): void {
    if (!existsSync(this.path)) {
      writeFileSync(this.path, DEFAULT_ROLES_TOML);
      this.#log({ event: 'roles-written', path: this.path });
    }
    this.#reload();
    try {
      // the folder, not the file: an editor that saves by rename replaces the file the watch was on
      this.#watcher = watch(dirname(this.path), (_kind, name) => {
        if (name !== null && name !== basename(this.path)) return;
        if (this.#debounce) clearTimeout(this.#debounce);
        this.#debounce = setTimeout(() => this.#reload(), 50);
        this.#debounce.unref();
      });
      this.#watcher.unref();
    } catch (err) {
      this.#log({ event: 'roles-unwatched', error: err instanceof Error ? err.message : String(err) });
    }
  }

  stop(): void {
    this.#watcher?.close();
    this.#watcher = null;
    if (this.#debounce) clearTimeout(this.#debounce);
  }

  /** The current definitions; read again first when the file changed since (a watch event may still be due). */
  get(): RolesConfig {
    if (this.#stampNow() !== this.#stamp) this.#reload();
    return this.#config;
  }

  #stampNow(): string {
    try {
      const s = statSync(this.path);
      return `${s.mtimeMs}:${s.size}:${s.ino}`;
    } catch {
      return 'missing';
    }
  }

  #reload(): void {
    const stamp = this.#stampNow();
    if (stamp === this.#stamp) return;
    this.#stamp = stamp;
    if (stamp === 'missing') {
      this.#log({ event: 'roles-missing', path: this.path, keeping: 'the last version read' });
      return;
    }
    try {
      this.#config = parseRoles(readFileSync(this.path, 'utf8'));
      this.#log({ event: 'roles-loaded', path: this.path, launch: Object.fromEntries([...this.#config].map(([r, d]) => [r, d.launch])) });
    } catch (err) {
      this.#log({ event: 'roles-unreadable', path: this.path, error: err instanceof Error ? err.message : String(err), keeping: 'the last version read' });
    }
  }
}
