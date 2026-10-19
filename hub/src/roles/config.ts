// The project's role definitions, `.cland/roles.toml` (spec 4.4, ADR 0001): per role a clause, skills, launch
// defaults and the permission list (enforced by the hub on every spoke tool call: `permissions.ts`). Written with the defaults when missing, never rewritten;
// refreshed asynchronously every 500 ms; every check reads the last parsed snapshot. A file that does not parse is logged and the last good version stays in force.
import { readFile, stat, writeFile } from 'node:fs/promises';
import { parse } from 'smol-toml';
import { ROLE_NAMES } from '../names.ts';
import type { LogFn } from '../log.ts';
import type { Resumed } from '../hub/budget.ts';
import { DEFAULT_ROLES_TOML } from './default-roles.ts';
import { rolesTemplate } from './template.ts';
import { installedHarnessesAsync } from '../doctor/harnesses.ts';
import { DEFAULT_PERMISSIONS, grantRefusal } from './permissions.ts';
import { APPROVALS, PERMISSIONS, SANDBOX_MODES, SANDBOX_NETWORKS, type Approval, type Permissions, type Sandbox } from '../adapters/contract.ts';

export type LaunchDefaults = {
  harness: string;
  account: string | null;
  /** null: the harness's own default. */
  model: string | null;
  /** null: the harness's own default. */
  effort: string | null;
  /** Whether the session asks before a command its sandbox refuses; null: the adapter's default (Codex: never). */
  approval: Approval | null;
  /** What the session's commands may touch, `writableRoots` as the file gives them (relative to the project
   *  root); null: the harness's own sandbox. Adapters whose harness takes neither ignore both. */
  sandbox: Sandbox | null;
  /** Claude Code: `auto` guards commands, `skip` bypasses checks; null: the harness's own settings. */
  permissions: Permissions | null;
};

export type RoleDefinition = {
  role: string;
  /** At most one holder (the Coordinator). */
  exclusive: boolean;
  clause: string;
  skills: string[];
  launch: LaunchDefaults;
  /** The spoke tools the role may use, as grants (`tool` or `tool:scope`, see `permissions.ts`); enforced by the
   *  dispatcher on every call. A role table with no `tools` list gets the built-in table's. */
  permissions: { tools: string[] };
};

export type RolesConfig = ReadonlyMap<string, RoleDefinition>;

/** What the hub asks of the role definitions: the last parsed snapshot, with no I/O at check time. */
export type RolesSource = { get: () => RolesConfig; fresh?: (resumed?: Resumed) => Promise<void> };

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

/**
 * The directories a role's `workspace-write` sandbox gets beyond its own, when `writable_roots` is left out (project-
 * relative): QA's runs and evidence (decision D14). `danger-full-access` has no roots; a written list replaces this.
 */
const DEFAULT_WRITABLE_ROOTS: Readonly<Record<string, string[]>> = { qa: ['.cland/qa'] };

const oneOf = <T extends string>(v: unknown, values: readonly T[], where: string, nameEmpty = false): T | null => {
  const s = optString(v, where);
  if (s !== null && !values.includes(s as T)) throw new Error(`${where} must be one of ${nameEmpty ? '"", ' : ''}${values.join(', ')}`);
  return s as T | null;
};

/**
 * `sandbox`, `writable_roots` and `network`. A key the table leaves out takes the role's built-in value (`base`), so
 * a `[<role>.launch]` written before these keys existed still gets its role's sandbox; `sandbox = ""` is the
 * harness's own. Inherited roots and network follow the mode that was written: roots only with `workspace-write`,
 * nothing closed with `danger-full-access`.
 */
const sandboxOf = (launch: Record<string, unknown>, where: string, base: Sandbox | null, role: string): Sandbox | null => {
  const written = oneOf(launch.sandbox, SANDBOX_MODES, `${where}.sandbox`);
  const roots = launch.writable_roots === undefined ? null : strings(launch.writable_roots, `${where}.writable_roots`);
  const network = oneOf(launch.network, SANDBOX_NETWORKS, `${where}.network`);
  const mode = launch.sandbox === undefined ? (base?.mode ?? null) : written;
  if (mode === null) {
    if (roots?.length || network !== null) throw new Error(`${where}.writable_roots and ${where}.network need ${where}.sandbox`);
    return null;
  }
  if (roots?.length && mode !== 'workspace-write') throw new Error(`${where}.writable_roots needs sandbox = "workspace-write"`);
  if (mode === 'danger-full-access' && network !== null && network !== 'full') throw new Error(`${where}.network cannot be ${network} with sandbox = "danger-full-access": nothing is closed there`);
  return {
    mode,
    writableRoots: mode === 'workspace-write' ? (roots ?? (base?.writableRoots.length ? base.writableRoots : (DEFAULT_WRITABLE_ROOTS[role] ?? []))) : [],
    network: mode === 'danger-full-access' ? 'full' : (network ?? base?.network ?? 'none'),
  };
};

/** A role's grants: each one checked against the table's tools and scopes; absent → the built-in list. */
const grants = (v: unknown, role: string): string[] => {
  if (v === undefined) return [...(DEFAULT_PERMISSIONS[role] ?? [])];
  const list = strings(v, `${role}.permissions.tools`).map((g) => g.trim());
  for (const g of list) {
    const refusal = grantRefusal(g, `${role}.permissions.tools`);
    if (refusal) throw new Error(refusal);
  }
  return [...new Set(list)];
};

/** The built-in definitions once they are parsed (null while they are): what a launch table's missing keys take. */
let BUILT_IN: RolesConfig | null = null;

/** Parse the file's text. Throws with the place that is wrong; a role the file leaves out takes its default.
 * Callers with a known adapter registry can restrict harness ids; omitted keeps custom adapters valid.
 */
export function parseRoles(text: string, fallback: RolesConfig | null = null, allowedHarnesses?: readonly string[]): RolesConfig {
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
    const builtin = BUILT_IN?.get(role)?.launch ?? null;
    if (!isRecord(launch)) throw new Error(`[${role}.launch] must be a table`);
    if (!isRecord(permissions)) throw new Error(`[${role}.permissions] must be a table`);
    if (t.exclusive !== undefined && typeof t.exclusive !== 'boolean') throw new Error(`${role}.exclusive must be true or false`);
    const selectedHarness = launch.harness === undefined ? builtin?.harness : launch.harness;
    const harness = allowedHarnesses === undefined ? optString(selectedHarness, `${role}.launch.harness`)
      : oneOf(selectedHarness, allowedHarnesses, `${role}.launch.harness`);
    if (harness === null) throw new Error(`${role}.launch.harness is required`);
    out.set(role, {
      role,
      exclusive: t.exclusive === true,
      clause: (optString(t.clause, `${role}.clause`) ?? '').trim(),
      skills: strings(t.skills, `${role}.skills`),
      launch: {
        account: optString(launch.account, `${role}.launch.account`),
        harness,
        model: optString(launch.model, `${role}.launch.model`),
        effort: optString(launch.effort, `${role}.launch.effort`),
        // a key left out is the role's built-in value; `""` is the adapter's or the harness's own
        approval: launch.approval === undefined ? (builtin?.approval ?? null) : oneOf(launch.approval, APPROVALS, `${role}.launch.approval`),
        sandbox: sandboxOf(launch, `${role}.launch`, builtin?.sandbox ?? null, role),
        permissions: launch.permissions === undefined ? (builtin?.permissions ?? null) : oneOf(launch.permissions, PERMISSIONS, `${role}.launch.permissions`, true),
      },
      permissions: { tools: grants(permissions.tools, role) },
    });
  }
  return out;
}

/** Machine-independent built-in defaults; new-project files use the installed-harness template. */
export const DEFAULTS: RolesConfig = parseRoles(DEFAULT_ROLES_TOML, new Map());
BUILT_IN = DEFAULTS;

/** A fixed set of definitions, for a hub with no project file. */
export const fixedRoles = (config: RolesConfig = DEFAULTS): RolesSource => ({ get: () => config });

/** Maximum wait until the next refresh begins, independent of filesystem watch availability. */
export const ROLES_REFRESH_MS = 500;

/** `.cland/roles.toml`: created at startup, then refreshed off the request path. */
export class RolesFile implements RolesSource {
  readonly path: string;
  readonly #log: LogFn;
  readonly #env: NodeJS.ProcessEnv;
  readonly #resumed: Resumed;
  readonly #read: (path: string) => Promise<string>;
  #config: RolesConfig = DEFAULTS;
  #text: string | null = null;
  #missing = false;
  #timer: NodeJS.Timeout | null = null;
  #running: Promise<boolean> | null = null;
  #stopped = false;
  #freshStamp: string | null = null;

  constructor(path: string, log: LogFn = () => {}, read: (path: string) => Promise<string> = path => readFile(path, 'utf8'), resumed: Resumed = work => work(), env: NodeJS.ProcessEnv = process.env) {
    this.#env = env;
    this.path = path;
    this.#log = log;
    this.#read = read;
    this.#resumed = resumed;
  }

  /** Load before accepting requests; never replace an existing human-written file. */
  async start(): Promise<void> {
    try {
      await writeFile(this.path, rolesTemplate(await installedHarnessesAsync(this.#env)), { flag: 'wx' });
      this.#resumed(() => this.#log({ event: 'roles-written', path: this.path }));
    } catch (err) {
      this.#resumed(() => { if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err; });
    }
    await this.#refresh();
    this.#resumed(() => {
      this.#timer = setInterval(() => { void this.#refresh(); }, ROLES_REFRESH_MS);
      this.#timer.unref();
    });
  }

  async stop(): Promise<void> {
    this.#stopped = true;
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
    await this.#running;
  }

  /** One immutable-in-use snapshot. A refresh publishes a replacement, never edits a check's map. */
  get(): RolesConfig { return this.#config; }

  /** Rare launch/assignment paths see an edit immediately; hot permission checks never await disk. */
  async fresh(resumed: Resumed = this.#resumed): Promise<void> {
    await this.#running;
    const stating = resumed(() => {
      try { return stat(this.path); }
      catch (err) { this.#unreadable(err); return null; }
    });
    if (stating === null) return;
    let stamp: string;
    try {
      const info = await stating;
      stamp = resumed(() => `${info.dev}:${info.ino}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`);
    } catch (err) { resumed(() => this.#unreadable(err)); return; }
    // A timer may have started while stat awaited. Finish it before starting the explicit fresh read.
    await this.#running;
    const changed = resumed(() => !this.#stopped && stamp !== this.#freshStamp);
    if (!changed) return;
    const read = await this.#refresh(resumed);
    resumed(() => { if (read && !this.#stopped) this.#freshStamp = stamp; });
  }

  #refresh(resumed: Resumed = this.#resumed): Promise<boolean> {
    if (this.#running) return this.#running;
    this.#running = this.#reload(resumed).finally(() => resumed(() => { this.#running = null; }));
    return this.#running;
  }

  /** Synchronous failure handling; the caller owns the whole resumed continuation's scope. */
  #unreadable(err: unknown): void {
    if (this.#stopped) return;
    const missing = (err as NodeJS.ErrnoException).code === 'ENOENT';
    if (missing && this.#missing) return;
    if (missing) { this.#missing = true; this.#text = null; }
    this.#log({ event: missing ? 'roles-missing' : 'roles-unreadable', path: this.path, error: err instanceof Error ? err.message : String(err), keeping: 'the last version read' });
  }

  async #reload(resumed: Resumed): Promise<boolean> {
    const reading = resumed(() => {
      try { return this.#read(this.path); }
      catch (err) { this.#unreadable(err); return null; }
    });
    if (reading === null) return false;
    let text: string;
    try { text = await reading; }
    catch (err) { resumed(() => this.#unreadable(err)); return false; }
    return resumed(() => {
      try {
        if (this.#stopped) return false;
        this.#missing = false;
        if (text === this.#text) return true;
        this.#text = text;
        // Parse before publication. Parse errors and their immediate log share this one continuation.
        const config = parseRoles(text);
        this.#config = config;
        this.#log({ event: 'roles-loaded', path: this.path, launch: Object.fromEntries([...config].map(([r, d]) => [r, d.launch])) });
        return true;
      } catch (err) { this.#unreadable(err); return false; }
    });
  }
}
