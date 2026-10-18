// One last-good publication for project config and roles. Disk I/O and provenance are
// prepared before the synchronous commit; consumers retain their old objects.
import { parse } from 'smol-toml';
import { IDLE_NOTIFY_MS } from './inbox.ts';
import { execFile } from 'node:child_process';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { isDeepStrictEqual, promisify } from 'node:util';
import { defaultConfig, parseConfig, type ProjectConfig } from '../init/config.ts';
import { DEFAULTS, parseRoles, ROLES_REFRESH_MS, type RolesConfig, type RolesSource } from '../roles/config.ts';
import { DEFAULT_ROLES_TOML } from '../roles/default-roles.ts';
import type { Layout } from '../project.ts';
import type { LogFn } from '../log.ts';
import type { Resumed } from './budget.ts';
import { setConfigValue } from '../init/config-set.ts';

// These owners establish timers, storage or compatibility machinery at startup.
const STARTUP_FIELDS = ['name', 'sessions', 'visibility', 'tracker', 'artifacts', 'hygiene'] as const;
const STARTUP_VERIFICATION_FIELDS = [['lockPath', 'lock_path'], ['workers', 'workers'], ['testTimeoutMs', 'test_timeout'], ['stallTimeoutMs', 'stall_timeout'], ['coverageMaxAgeMs', 'coverage_max_age']] as const;
export type ConfigSetResult = { key: string; value: unknown; applies: string };

const exec = promisify(execFile);
const idleMinutes = (text: string): number => {
  const inbox = parse(text).inbox;
  if (inbox === undefined) return IDLE_NOTIFY_MS / 60000;
  if (!inbox || typeof inbox !== 'object' || Array.isArray(inbox) || inbox instanceof Date) throw new Error('inbox must be a table');
  const minutes = inbox.idle_minutes;
  if (minutes === undefined) return IDLE_NOTIFY_MS / 60000;
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) throw new Error('inbox.idle_minutes must be a number');
  return minutes;
};

export type ConfigStatus = { loadedAt: string; sourceCommit: string | null };
export type ConfigReloadResult = ConfigStatus & { applied: string[]; warnings: string[] };
export class ProjectConfiguration implements RolesSource {
  #config: ProjectConfig;
  #roles: RolesConfig = DEFAULTS;
  #status: ConfigStatus = { loadedAt: new Date().toISOString(), sourceCommit: null };
  #idleMinutes = IDLE_NOTIFY_MS / 60000;
  #stamp = '';
  #attemptStamp = '';
  #timer: NodeJS.Timeout | undefined;
  #work: Promise<unknown> = Promise.resolve();
  #stopped = false;
  readonly layout: Layout;
  readonly log: LogFn;
  readonly env: NodeJS.ProcessEnv;
  readonly resumed: Resumed;
  readonly apply: (config: ProjectConfig) => void;
  readonly readSourceCommit: (() => Promise<string | null>) | undefined;
  constructor(layout: Layout, config: ProjectConfig | null, log: LogFn, env: NodeJS.ProcessEnv, resumed: Resumed, apply: (config: ProjectConfig) => void, readSourceCommit?: () => Promise<string | null>) {
    this.readSourceCommit = readSourceCommit;
    this.layout = layout; this.log = log; this.env = env; this.resumed = resumed; this.apply = apply;
    this.#config = config ?? defaultConfig(basename(layout.root));
  }
  get = (): RolesConfig => this.#roles;
  config = (): ProjectConfig => this.#config;
  status = (): ConfigStatus => ({ ...this.#status });
  async start(): Promise<void> {
    try { this.#idleMinutes = idleMinutes(await readFile(this.layout.config, 'utf8')); } catch { /* startup already reports unreadable config and uses defaults */ }
    try { await writeFile(this.layout.roles, DEFAULT_ROLES_TOML, { flag: 'wx' }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    try { this.#roles = parseRoles(await readFile(this.layout.roles, 'utf8')); }
    catch (error) { this.log({ event: 'roles-unreadable', path: this.layout.roles, error: String(error), keeping: 'the defaults' }); }
    this.#stamp = await this.#fileStamp(this.layout.roles);
    this.#attemptStamp = this.#stamp;
    this.log({ event: 'roles-loaded', path: this.layout.roles, launch: Object.fromEntries([...this.#roles].map(([role, definition]) => [role, definition.launch])) });
    this.#status.sourceCommit = await this.#sourceCommit();
    this.#timer = setInterval(() => { void this.fresh(); }, ROLES_REFRESH_MS);
    this.#timer.unref();
  }
  async stop(): Promise<void> { this.#stopped = true; clearInterval(this.#timer); await this.#work; }
  async #sourceCommit(): Promise<string | null> {
    if (this.readSourceCommit) return this.readSourceCommit();
    return exec('git', ['log', '-1', '--format=%H', '--', '.cland/config.toml'], { cwd: this.layout.root, env: this.env }).then(r => r.stdout.trim() || null, () => null);
  }
  async #fileStamp(path: string): Promise<string> {
    return stat(path).then(s => `${s.dev}:${s.ino}:${s.size}:${s.mtimeMs}:${s.ctimeMs}`, () => 'missing');
  }
  async fresh(resumed: Resumed = this.resumed): Promise<void> {
    try {
      await this.#work;
      const stamp = await this.#fileStamp(this.layout.roles);
      if (this.#stopped || stamp === this.#attemptStamp) return;
      this.#attemptStamp = stamp;
      await this.reload(resumed);
    } catch { /* reload already reports the file and keeps the complete last-good pair */ }
  }
  reload(resumed: Resumed = this.resumed): Promise<ConfigReloadResult> {
    const work = this.#work.then(() => this.#reload(resumed));
    this.#work = work.catch(() => {});
    return work;
  }
  set(key: string, value: unknown, resumed: Resumed, authorize: () => void): Promise<ConfigSetResult> {
    const work = this.#work.then(async () => {
      const readback = resumed(() => {
        authorize();
        if (this.#stopped) throw new Error('hub is stopping');
        return setConfigValue(this.layout.root, this.layout.config, key, value, this.env);
      });
      const startup = STARTUP_FIELDS.some(field => key.startsWith(`${field === 'name' ? 'project' : field}.`))
        || key === 'plan.qa_default'
        || STARTUP_VERIFICATION_FIELDS.some(([, field]) => key === `verification.${field}`);
      if (startup) return { key, value: readback, applies: 'restart' };
      try {
        await this.#reload(resumed);
        return { key, value: readback, applies: 'now' };
      } catch (error) {
        return { key, value: readback, applies: `saved; not applied: ${error instanceof Error ? error.message : String(error)}; resolve the refusal and run cland hub reload, or restart the hub` };
      }
    });
    this.#work = work.catch(() => {});
    return work;
  }
  async #reload(resumed: Resumed): Promise<ConfigReloadResult> {
    let file = this.layout.config;
    try {
      if (this.#stopped) throw new Error('hub is stopping');
      const configStamp = await this.#fileStamp(file);
      const configText = await readFile(file, 'utf8').catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      const config = configText === null ? this.#config : resumed(() => parseConfig(configText, basename(this.layout.root), this.env));
      const warnings = configText === null ? ['config.toml missing; keeping the last loaded config'] : [];
      if (configText !== null && resumed(() => idleMinutes(configText)) !== this.#idleMinutes) throw new Error('inbox.idle_minutes changed: restart required');
      for (const key of STARTUP_FIELDS) {
        if (!isDeepStrictEqual(config[key], this.#config[key])) throw new Error(`${key === 'tracker' ? 'tracker.levels or tracker.fatal_stall' : key} changed: restart required`);
      }
      if (!isDeepStrictEqual(config.plan.qaDefault, this.#config.plan.qaDefault)) throw new Error('plan.qa_default changed: restart required');
      for (const [key, field] of STARTUP_VERIFICATION_FIELDS) {
        if (config.verification[key] !== this.#config.verification[key]) throw new Error(`verification.${field} changed: restart required`);
      }
      file = this.layout.roles;
      const stamp = await this.#fileStamp(this.layout.roles);
      const rolesText = await readFile(file, 'utf8');
      const roles = resumed(() => parseRoles(rolesText));
      if (stamp !== await this.#fileStamp(this.layout.roles)) throw new Error('roles.toml changed during reload; retry');
      const sourceCommit = configText === null ? this.#status.sourceCommit : await this.#sourceCommit();
      const [lastConfigStamp, lastRoleStamp] = await Promise.all([this.#fileStamp(this.layout.config), this.#fileStamp(this.layout.roles)]);
      if (lastConfigStamp !== configStamp) { file = this.layout.config; throw new Error('config.toml changed during reload; retry'); }
      if (lastRoleStamp !== stamp) throw new Error('roles.toml changed during reload; retry');
      return resumed(() => {
        if (this.#stopped) throw new Error('hub is stopping');
        this.apply(config);
        this.#config = config; this.#roles = roles; this.#stamp = stamp; this.#attemptStamp = stamp;
        this.log({ event: 'roles-loaded', path: file, launch: Object.fromEntries([...roles].map(([role, definition]) => [role, definition.launch])) });
        if (configText !== null) this.#status = { loadedAt: new Date().toISOString(), sourceCommit };
        const applied = ['verification.executor', 'verification.local_fallback', 'verification.budget (capped at 1)', 'verification.remote_budget', 'verification.load_gate_workers', 'verification.shards', 'verification.cache_max_age_minutes', 'verification.wait_p90_target', 'verification.lifetime', 'verification.run_timeout', 'verification.daily_spend_usd', 'verification.droplet', 'keys.layouts', 'plan.approval', 'roles'];
        for (const warning of warnings) this.log({ event: 'config-reload-warning', file: this.layout.config, warning });
        this.log({ event: 'config-reloaded', ...this.#status, applied, warnings });
        return { ...this.#status, applied, warnings };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      resumed(() => {
        if (file === this.layout.roles) this.log({ event: 'roles-unreadable', path: file, error: message, keeping: 'the last good config and roles' });
        this.log({ event: 'config-reload-failed', file, error: message, keeping: 'the last good config and roles' });
      });
      throw new Error(`${file}: ${message}`);
    }
  }
}
