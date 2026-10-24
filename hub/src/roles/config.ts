// The project's role definitions, `.cland/roles.toml` (spec 4.4, ADR 0001): per role a clause, skills, launch
// defaults and the permission list (enforced by the hub on every spoke tool call: `permissions.ts`). Written with the defaults when missing, never rewritten;
// refreshed asynchronously every 500 ms; every check reads the last parsed snapshot. A file that does not parse is logged and the last good version stays in force.
import { readFile, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parse } from 'smol-toml';
import { ROLE_NAMES, nameRefusal } from '../names.ts';
import type { LogFn } from '../log.ts';
import type { Resumed } from '../hub/budget.ts';
import { DEFAULT_ROLES_TOML } from './default-roles.ts';
import { rolesTemplate } from './template.ts';
import { projectSkills } from './skills.ts';
import { installedHarnessesAsync } from '../doctor/harnesses.ts';
import { DEFAULT_PERMISSIONS, grantRefusal, customGrantRefusal } from './permissions.ts';
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
  /** At most one holder when enabled (the Coordinator default). */
  exclusive: boolean;
  clause: string;
  skills: string[];
  launch: LaunchDefaults;
  /** OpenCode's default snapshot hides these inputs; resolve them only for a launch on another harness. */
  policyOverrides?: Readonly<Record<string, unknown>>;
  /** Explicit launch keys ignored by the selected harness; one warning per role. */
  warnings?: string[];
  /** The spoke tools the role may use, as grants (`tool` or `tool:scope`, see `permissions.ts`); enforced by the
   *  dispatcher on every call. Built-ins inherit their grants; custom roles default to deny. */
  permissions: { tools: string[] };
};

export type RolesConfig = ReadonlyMap<string, RoleDefinition>;

/** What the hub asks of the role definitions: the last parsed snapshot, with no I/O at check time. */
export type RolesSource = {
  get: () => RolesConfig;
  fresh?: (resumed?: Resumed) => Promise<void>;
  /** Read only when building instructions; permission checks keep using the parsed snapshot. */
  availableSkills?: () => ReadonlySet<string>;
};

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
    writableRoots: mode === 'workspace-write' ? (roots ?? (base?.writableRoots.length ? base.writableRoots : (Object.hasOwn(DEFAULT_WRITABLE_ROOTS, role) ? DEFAULT_WRITABLE_ROOTS[role]! : []))) : [],
    network: mode === 'danger-full-access' ? 'full' : (network ?? base?.network ?? 'none'),
  };
};

/** Policy belongs to the role; only the actual OpenCode launch ignores it. */
export function roleLaunchPolicy(definition: RoleDefinition, harness: string): Pick<LaunchDefaults, 'approval' | 'sandbox' | 'permissions'> {
  if (harness === 'opencode') return { approval: null, sandbox: null, permissions: null };
  const launch = definition.policyOverrides;
  if (!launch) return definition.launch;
  const role = definition.role;
  const where = ROLE_NAMES.includes(role) ? role : `custom.${role}`;
  const builtin = BUILT_IN?.get(role)?.launch;
  return {
    approval: launch.approval === undefined ? (builtin?.approval ?? null) : oneOf(launch.approval, APPROVALS, `${where}.launch.approval`),
    sandbox: sandboxOf(launch, `${where}.launch`, builtin?.sandbox ?? null, role),
    permissions: launch.permissions === undefined ? (builtin?.permissions ?? null) : oneOf(launch.permissions, PERMISSIONS, `${where}.launch.permissions`, true),
  };
}

/** A role's grants: each one checked against the table's tools and scopes; absent → the built-in list. */
const grants = (v: unknown, role: string, where = role): string[] => {
  if (v === undefined) return [...(DEFAULT_PERMISSIONS[role] ?? [])];
  const list = strings(v, `${where}.permissions.tools`).map((g) => g.trim());
  for (const g of list) {
    const refusal = grantRefusal(g, `${where}.permissions.tools`)
      ?? (!ROLE_NAMES.includes(role) ? customGrantRefusal(g, `${where}.permissions.tools`) : null);
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
  return parseDefinitions(text, fallback, allowedHarnesses);
}

function parseDefinitions(text: string, fallback: RolesConfig | null, allowedHarnesses?: readonly string[], builtInPolicy = false): RolesConfig {
  const doc = parse(text) as Record<string, unknown>;
  const unknown = Object.keys(doc).filter((k) => k !== 'custom' && !ROLE_NAMES.includes(k));
  if (unknown.length) throw new Error(`unknown role ${unknown.map((k) => `[${k}]`).join(', ')} (roles: ${ROLE_NAMES.join(', ')})`);
  const out = new Map<string, RoleDefinition>();
  const custom = doc.custom ?? {};
  if (!isRecord(custom)) throw new Error('[custom] must be a table');
  for (const role of Object.keys(custom)) {
    const refusal = nameRefusal(role, new Set(['human', 'custom']));
    if (refusal) throw new Error(`custom.${role}: ${refusal}`);
  }
  for (const role of [...ROLE_NAMES, ...Object.keys(custom)]) {
    const isCustom = !ROLE_NAMES.includes(role);
    const where = isCustom ? `custom.${role}` : role;
    const t = isCustom ? custom[role] : doc[role];
    if (t === undefined) {
      const d = (fallback ?? DEFAULTS).get(role);
      if (d) out.set(role, d);
      continue;
    }
    if (!isRecord(t)) throw new Error(`[${where}] must be a table`);
    const launch = t.launch ?? {};
    const permissions = t.permissions ?? {};
    const builtin = BUILT_IN?.get(role)?.launch ?? null;
    if (!isRecord(launch)) throw new Error(`[${where}.launch] must be a table`);
    if (!isRecord(permissions)) throw new Error(`[${where}.permissions] must be a table`);
    if (t.exclusive !== undefined && typeof t.exclusive !== 'boolean') throw new Error(`${where}.exclusive must be true or false`);
    if (isCustom) {
      for (const key of Object.keys(t)) if (!['clause', 'skills', 'exclusive', 'launch', 'permissions'].includes(key)) throw new Error(`${where}.${key}: unknown field`);
      for (const key of Object.keys(launch)) if (!['harness', 'model', 'effort', 'account', 'approval', 'sandbox', 'writable_roots', 'network', 'permissions'].includes(key)) throw new Error(`${where}.launch.${key}: unknown field`);
      for (const key of Object.keys(permissions)) if (key !== 'tools') throw new Error(`${where}.permissions.${key}: unknown field`);
      if (!optString(t.clause, `${where}.clause`)) throw new Error(`${where}.clause is required`);
    }
    const selectedHarness = launch.harness === undefined ? builtin?.harness : launch.harness;
    const harness = allowedHarnesses === undefined ? optString(selectedHarness, `${where}.launch.harness`)
      : oneOf(selectedHarness, allowedHarnesses, `${where}.launch.harness`);
    if (harness === null) throw new Error(`${where}.launch.harness is required`);
    const nativePolicy = harness === 'opencode' && !builtInPolicy;
    const ignored = nativePolicy ? ['approval', 'sandbox', 'writable_roots', 'network', 'permissions'].filter(key => launch[key] !== undefined) : [];
    out.set(role, {
      role,
      exclusive: t.exclusive === true,
      clause: (optString(t.clause, `${where}.clause`) ?? '').trim(),
      skills: strings(t.skills, `${where}.skills`),
      ...(nativePolicy ? { policyOverrides: Object.fromEntries(ignored.map(key => [key, launch[key]])) } : {}),
      ...(ignored.length ? { warnings: [`${where}.launch: OpenCode ignores ${ignored.join(', ')}; OpenCode's own configuration governs`] } : {}),
      launch: {
        account: optString(launch.account, `${where}.launch.account`),
        harness,
        model: optString(launch.model, `${where}.launch.model`),
        effort: optString(launch.effort, `${where}.launch.effort`),
        // The snapshot describes the role's default harness. Keep OpenCode's ignored inputs
        // above for other actual launch harnesses; `""` selects a harness's own defaults.
        approval: nativePolicy ? null : launch.approval === undefined ? (builtin?.approval ?? null) : oneOf(launch.approval, APPROVALS, `${where}.launch.approval`),
        sandbox: nativePolicy ? null : sandboxOf(launch, `${where}.launch`, builtin?.sandbox ?? null, role),
        permissions: nativePolicy ? null : launch.permissions === undefined ? (builtin?.permissions ?? null) : oneOf(launch.permissions, PERMISSIONS, `${where}.launch.permissions`, true),
      },
      permissions: { tools: grants(permissions.tools, role, where) },
    });
  }
  return out;
}

/** Machine-independent built-in defaults; new-project files use the installed-harness template. */
// Keep historical per-role policy for roles moved to Codex or Claude Code. Normalizing
// the OpenCode default first would otherwise erase their inherited compatibility values.
BUILT_IN = parseDefinitions(DEFAULT_ROLES_TOML, new Map(), undefined, true);
export const DEFAULTS: RolesConfig = new Map([...parseRoles(DEFAULT_ROLES_TOML, new Map())].map(([role, definition]) => {
  // Omitted roles inherit policy, not warnings about keys absent from the project file.
  const { warnings: _warnings, ...defaults } = definition;
  return [role, defaults];
}));

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

  availableSkills(): ReadonlySet<string> { return projectSkills(dirname(dirname(this.path))); }

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
        for (const definition of config.values()) for (const warning of definition.warnings ?? []) {
          this.#log({ event: 'roles-warning', path: this.path, role: definition.role, warning });
        }
        this.#log({ event: 'roles-loaded', path: this.path, launch: Object.fromEntries([...config].map(([r, d]) => [r, d.launch])) });
        return true;
      } catch (err) { this.#unreadable(err); return false; }
    });
  }
}
