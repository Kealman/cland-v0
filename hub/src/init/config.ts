// `.cland/config.toml` (spec 4.9, decision #17): the project's name and the hub's hygiene thresholds, committed.
// `cland init` writes it with the defaults; `cland update` rewrites it to the current template, keeping the values
// it finds (so a threshold the human changed survives an update). A file without the mark is the human's and left
// alone. The hub reads the thresholds at start; a missing or unreadable file means the built-in defaults.
import { qaPolicy, type QaPolicy } from '../tracker/plan.ts';
import { visibilityOverrides, type VisibilityOverrides } from '../hub/visibility.ts';
import { DEFAULT_LEVELS, configuredLevels, Ladder, type Levels } from '../tracker/kinds.ts';
import { basename } from 'node:path';
import { parse } from 'smol-toml';
import { EVENT_LIMIT, LOOP_BREAKER, MAX_TEXT_BYTES, RATE_LIMIT, type LoopBreaker, type RateLimit } from '../hub/hygiene.ts';
import { MANAGED_MARK } from '../project.ts';
import { VERSION } from '../version.ts';
import { durationMs } from '../duration.ts';
import { isManagedFile, readText, writeIfChanged, type Report } from './files.ts';

export type ProjectConfig = {
  name: string;
  verification: { executor: 'local' | 'droplet'; budget: number; remoteBudget: number; lockPath: string; cacheMaxAgeMs: number; lifetimeMs: number; runTimeoutMs: number; runTimeout: string; dailySpendUsd: number; droplet: { size: string; prepare_size: string; regions: string[]; image: string } };
  sessions: { archiveAfterItemMs: number; archiveAfterStopMs: number };
  visibility: VisibilityOverrides;
  tracker: { levels: Levels };
  plan: { approval: 'none' | 'human'; qaDefault: QaPolicy };
  artifacts: { retentionDays: number };
  keys: { layouts: string[] };
  hygiene: { eventLimit: RateLimit; rateLimit: RateLimit; loopBreaker: LoopBreaker; maxTextBytes: number };
};

const MINUTE = 60_000;

export const defaultConfig = (name: string): ProjectConfig => ({
  name,
  verification: { executor: 'local', budget: 1, remoteBudget: 4, lockPath: '/tmp/cland-suite.lock', cacheMaxAgeMs: 86400000, lifetimeMs: 6600000, runTimeoutMs: 4500000, runTimeout: '75m', dailySpendUsd: 5, droplet: { size: 'c-8', prepare_size: 'c-8', regions: ['lon1', 'nyc1', 'sfo2'], image: 'ubuntu-24-04-x64' } },
  sessions: { archiveAfterItemMs: 3600000, archiveAfterStopMs: 86400000 },
  visibility: {},
  tracker: { levels: [...DEFAULT_LEVELS] },
  plan: { approval: 'none', qaDefault: { scope: 'none', when: 'per-item' } },
  artifacts: { retentionDays: 30 },
  keys: { layouts: [] },
  hygiene: { eventLimit: { ...EVENT_LIMIT }, rateLimit: { ...RATE_LIMIT }, loopBreaker: { ...LOOP_BREAKER }, maxTextBytes: MAX_TEXT_BYTES },
});

const minutes = (ms: number): number => ms / MINUTE;

export function renderConfig(c: ProjectConfig): string {
  const h = c.hygiene;
  return `${MANAGED_MARK} ${VERSION} — cland update rewrites this file and keeps the values below; remove this line to take it over.
# The project's cland settings (spec 4.9). Committed.

[project]
name = ${JSON.stringify(c.name)}

[verification]
executor = ${JSON.stringify(c.verification.executor)}
# Local admission stays capped at one, behind the compatibility leases.
budget = ${c.verification.budget}
# Parallel droplet runs beside the local slot.
remote_budget = ${c.verification.remoteBudget}
lock_path = ${JSON.stringify(c.verification.lockPath)}
# Reuse green candidate trees for this many minutes; 0 disables caching.
cache_max_age_minutes = ${minutes(c.verification.cacheMaxAgeMs)}
lifetime = "${c.verification.lifetimeMs % MINUTE === 0 ? `${minutes(c.verification.lifetimeMs)}m` : `${c.verification.lifetimeMs / 1000}s`}"

run_timeout = ${JSON.stringify(c.verification.runTimeout)}
daily_spend_usd = ${c.verification.dailySpendUsd}

[verification.droplet]
size = ${JSON.stringify(c.verification.droplet.size)}
prepare_size = ${JSON.stringify(c.verification.droplet.prepare_size)}
regions = ${JSON.stringify(c.verification.droplet.regions)}
image = ${JSON.stringify(c.verification.droplet.image)}

[sessions]
# Archive stopped crew after their item closes, otherwise after their stop. Aides are excluded.
archive_after_item = "${c.sessions.archiveAfterItemMs / 1000}s"
archive_after_stop = "${c.sessions.archiveAfterStopMs / 1000}s"

# Container kinds, ordered top-down; a list at a level groups peers. The first kind owns releases.
# Other root kinds (category by default) have no version or rank. Leaves and map are outside the ladder.
[tracker]
levels = ${JSON.stringify(c.tracker.levels)}

[plan]
approval = "${c.plan.approval}"
# QA for tasks outside any plan. Review is always required.
qa_default = { scope = "${c.plan.qaDefault.scope}", when = "${c.plan.qaDefault.when}" }

# Keyboard layouts for Neovim Normal-mode letters (currently: ru). Ctrl focus chords use English.
[keys]
layouts = ${JSON.stringify(c.keys.layouts)}

# The hub's message hygiene, read at hub start (cland hub stop, then start, to apply a change).
[hygiene]
# messages one session may send to other sessions within the window
rate_limit_max = ${h.rateLimit.max}
rate_limit_window_minutes = ${minutes(h.rateLimit.windowMs)}
# events delivered to one session within their own window
event_limit_max = ${h.eventLimit.max}
event_limit_window_minutes = ${minutes(h.eventLimit.windowMs)}
# messages between one pair of sessions within the window before the pair is muted, and for how long
loop_breaker_max = ${h.loopBreaker.max}
loop_breaker_window_minutes = ${minutes(h.loopBreaker.windowMs)}
loop_breaker_mute_minutes = ${minutes(h.loopBreaker.muteMs)}
# the largest message text, in bytes
max_text_bytes = ${h.maxTextBytes}

# Archived artifact files are removed after this many days; their index entries stay.
[artifacts]
retention_days = ${c.artifacts.retentionDays}

# Surface.kind = layer (now, watch, background, archive); read at hub start.
[visibility]
${Object.entries(c.visibility).flatMap(([surface, kinds]) => Object.entries(kinds).map(([kind, layer]) => `${surface}.${kind} = ${JSON.stringify(layer)}`)).join("\n")}
`;
}

const positive = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined);

/** The file's values over the defaults; a value of the wrong type is ignored. Throws when the TOML does not parse. */
export function parseConfig(text: string, fallbackName: string): ProjectConfig {
  const doc = parse(text) as Record<string, unknown>;
  const c = defaultConfig(fallbackName);
  const sessions = (doc.sessions ?? {}) as Record<string, unknown>;
  for (const [key, field] of [['archive_after_item', 'archiveAfterItemMs'], ['archive_after_stop', 'archiveAfterStopMs']] as const) {
    if (sessions[key] !== undefined) {
      if (typeof sessions[key] !== 'string') throw new Error(`sessions.${key} must be a duration string`);
      c.sessions[field] = durationMs(sessions[key]);
    }
  }
  const verification = (doc.verification ?? {}) as Record<string, unknown>;
  if (verification.executor !== undefined) {
    if (verification.executor !== 'local' && verification.executor !== 'droplet') throw new Error('verification.executor must be local or droplet');
    c.verification.executor = verification.executor;
  }
  if (verification.lifetime !== undefined) {
    if (typeof verification.lifetime !== 'string') throw new Error('verification.lifetime must be a duration string');
    try { c.verification.lifetimeMs = durationMs(verification.lifetime); }
    catch { throw new Error('verification.lifetime must be a positive duration (s, m, h or d)'); }
  }
  if (verification.run_timeout !== undefined) {
    if (typeof verification.run_timeout !== 'string') throw new Error('verification.run_timeout must be a duration string');
    try { c.verification.runTimeoutMs = durationMs(verification.run_timeout); }
    catch { throw new Error('verification.run_timeout must be a positive duration (s, m, h or d)'); }
    c.verification.runTimeout = verification.run_timeout;
  }
  const margin = Number(process.env.CLAND_TEST_EXECUTOR_MARGIN_MS) || 600000;
  if (c.verification.lifetimeMs < c.verification.runTimeoutMs + margin) throw new Error(`verification.lifetime ${verification.lifetime ?? '110m'} must be at least run_timeout ${c.verification.runTimeout} plus 10 minutes`);
  if (verification.daily_spend_usd !== undefined) {
    if (typeof verification.daily_spend_usd !== 'number' || !Number.isFinite(verification.daily_spend_usd) || verification.daily_spend_usd < 0) throw new Error('verification.daily_spend_usd must be a nonnegative number');
    c.verification.dailySpendUsd = verification.daily_spend_usd;
  }
  if (verification.droplet !== undefined) {
    const droplet = verification.droplet;
    if (!droplet || typeof droplet !== 'object' || Array.isArray(droplet) || droplet instanceof Date) throw new Error('verification.droplet must be a table');
    const values = droplet as Record<string, unknown>;
    for (const key of ['size', 'image', 'prepare_size'] as const) if (values[key] !== undefined) {
      if (typeof values[key] !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(values[key])) throw new Error(`verification.droplet.${key} must be a nonempty slug`);
      c.verification.droplet[key] = values[key];
    }
    if (values.regions !== undefined) {
      if (!Array.isArray(values.regions) || !values.regions.length || !values.regions.every(v => typeof v === 'string' && /^[a-z0-9]+$/.test(v))) throw new Error('verification.droplet.regions must be a nonempty list of region slugs');
      c.verification.droplet.regions = values.regions;
    }
  }
  if (verification.remote_budget !== undefined) {
    if (typeof verification.remote_budget !== 'number' || !Number.isSafeInteger(verification.remote_budget) || verification.remote_budget <= 0) throw new Error('verification.remote_budget must be a positive integer');
    c.verification.remoteBudget = verification.remote_budget;
  }
  if (typeof verification.budget === 'number' && Number.isSafeInteger(verification.budget) && verification.budget > 0) c.verification.budget = verification.budget;
  if (typeof verification.lock_path === 'string' && verification.lock_path.startsWith('/')) c.verification.lockPath = verification.lock_path;
  if (typeof verification.cache_max_age_minutes === 'number' && Number.isFinite(verification.cache_max_age_minutes) && verification.cache_max_age_minutes >= 0) c.verification.cacheMaxAgeMs = verification.cache_max_age_minutes * MINUTE;
  c.visibility = visibilityOverrides(doc.visibility);
  const project = (doc.project ?? {}) as Record<string, unknown>;
  if (typeof project.name === 'string' && project.name.trim()) c.name = project.name;
  const tracker = (doc.tracker ?? {}) as Record<string, unknown>;
  if (tracker.levels !== undefined) c.tracker.levels = configuredLevels(tracker.levels);
  const plan = (doc.plan ?? {}) as Record<string, unknown>;
  if (plan.approval !== undefined) {
    if (plan.approval !== 'none' && plan.approval !== 'human') throw new Error('plan.approval must be none or human');
    c.plan.approval = plan.approval;
  }
  if (plan.qa_default !== undefined) c.plan.qaDefault = qaPolicy(plan.qa_default, 'plan.qa_default');
  const keys = (doc.keys ?? {}) as Record<string, unknown>;
  if (Array.isArray(keys.layouts) && keys.layouts.every(v => typeof v === 'string')) c.keys.layouts = [...new Set(keys.layouts)];
  const a = (doc.artifacts ?? {}) as Record<string, unknown>;
  if (typeof a.retention_days === 'number' && Number.isFinite(a.retention_days) && a.retention_days >= 0) c.artifacts.retentionDays = a.retention_days;
  const h = (doc.hygiene ?? {}) as Record<string, unknown>;
  const set = (key: string, apply: (n: number) => void, scale = 1) => {
    const n = positive(h[key]);
    if (n !== undefined) apply(n * scale);
  };
  set('rate_limit_max', (n) => (c.hygiene.rateLimit.max = Math.floor(n)));
  set('rate_limit_window_minutes', (n) => (c.hygiene.rateLimit.windowMs = n), MINUTE);
  set('event_limit_max', n => (c.hygiene.eventLimit.max = Math.floor(n)));
  set('event_limit_window_minutes', n => (c.hygiene.eventLimit.windowMs = n), MINUTE);
  set('loop_breaker_max', (n) => (c.hygiene.loopBreaker.max = Math.floor(n)));
  set('loop_breaker_window_minutes', (n) => (c.hygiene.loopBreaker.windowMs = n), MINUTE);
  set('loop_breaker_mute_minutes', (n) => (c.hygiene.loopBreaker.muteMs = n), MINUTE);
  set('max_text_bytes', (n) => (c.hygiene.maxTextBytes = Math.floor(n)));
  return c;
}

/** What the hub runs with: the file's values, or null (the built-in defaults) when it is missing or unreadable. */
export function readProjectConfig(path: string, root: string, refused: (error: string) => void = () => {}): ProjectConfig | null {
  const text = readText(path);
  if (text === null) return null;
  try {
    return parseConfig(text, basename(root));
  } catch (err) {
    refused(err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** Write the managed config: the defaults when missing, the current template with the file's values when marked. */
export function provisionConfig(report: Report, path: string, root: string): void {
  const current = readText(path);
  if (current !== null && !isManagedFile(current)) {
    report.add(path, 'kept', 'no "managed by cland" mark: the project\'s own');
    return;
  }
  let config = defaultConfig(basename(root));
  if (current !== null) {
    try {
      config = parseConfig(current, basename(root));
    } catch (err) {
      report.add(path, 'kept', `marked, but not valid TOML (${err instanceof Error ? err.message : String(err)}): fix or remove it`);
      return;
    }
  }
  let ladderNote: string | undefined;
  if (current !== null) {
    if (JSON.stringify(config.tracker.levels) === JSON.stringify(new Ladder(DEFAULT_LEVELS).flat)) {
      config.tracker.levels = [...DEFAULT_LEVELS];
      ladderNote = 'tracker levels: old default rewritten to [["release","category"],"epic"]';
    } else {
      ladderNote = `tracker levels kept: ${JSON.stringify(config.tracker.levels)}`;
    }
  }
  writeIfChanged(report, path, renderConfig(config), current);
  const change = report.changes.at(-1);
  if (ladderNote && change && change.action !== 'kept') change.note = ladderNote;
}
