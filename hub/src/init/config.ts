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
import type { HarnessId } from '../doctor/ranges.ts';

export type ProjectConfig = {
  name: string;
  setup: { declinedInstalls: HarnessId[] };
  merge: { queue: boolean; batch: number; batchWaitMs: number };
  verification: { prepare: string; check: string; test: string; soak: string; executor: 'local' | 'droplet'; localFallback: boolean; workers: number; loadGateWorkers: number; budget: number; remoteBudget: number; shards: number; lockPath: string; cacheMaxAgeMs: number; waitP90TargetMs: number; coverageMaxAgeMs: number; testTimeoutMs: number; stallTimeoutMs: number; lifetimeMs: number; runTimeoutMs: number; runTimeout: string; dailySpendUsd: number; droplet: { workers?: number; size: string; prepare_size: string; regions: string[]; image: string } };
  sessions: { archiveAfterItemMs: number; archiveAfterStopMs: number };
  visibility: VisibilityOverrides;
  tracker: { levels: Levels; fatalStallMs: number };
  plan: { approval: 'none' | 'human'; qaDefault: QaPolicy };
  artifacts: { retentionDays: number };
  keys: { layouts: string[] };
  hygiene: { eventLimit: RateLimit; rateLimit: RateLimit; loopBreaker: LoopBreaker; maxTextBytes: number };
};

const MINUTE = 60_000;

export const defaultConfig = (name: string): ProjectConfig => ({
  name,
  setup: { declinedInstalls: [] },
  merge: { queue: false, batch: 3, batchWaitMs: 600_000 },
  verification: { prepare: '', check: '', test: '', soak: '', executor: 'local', localFallback: true, workers: 4, loadGateWorkers: 2, budget: 1, remoteBudget: 4, shards: 2, lockPath: '/tmp/cland-suite.lock', cacheMaxAgeMs: 86400000, waitP90TargetMs: 1200000, coverageMaxAgeMs: 172800000, testTimeoutMs: 120000, stallTimeoutMs: 600000, lifetimeMs: 6600000, runTimeoutMs: 4500000, runTimeout: '75m', dailySpendUsd: 5, droplet: { size: 'c-8', prepare_size: 'c-8', regions: ['lon1', 'nyc1', 'sfo2'], image: 'ubuntu-24-04-x64' } },
  sessions: { archiveAfterItemMs: 3600000, archiveAfterStopMs: 86400000 },
  visibility: {},
  tracker: { levels: [...DEFAULT_LEVELS], fatalStallMs: 60000 },
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

[setup]
# Missing harnesses declined in setup; --install <harness> runs their installer.
declined_installs = ${JSON.stringify(c.setup.declinedInstalls)}

[verification]
# cland verify runs nothing until test is set; use cland config set verification.test '<command>'.
# prepare installs what check and test need; runs on a droplet in the prepared image and before every run, never locally.
prepare = ${JSON.stringify(c.verification.prepare)}
# check is the fast gate; runs first and on the host before a droplet is made.
check = ${JSON.stringify(c.verification.check)}
# test is the suite; its exit code decides the run.
test = ${JSON.stringify(c.verification.test)}
executor = ${JSON.stringify(c.verification.executor)}
# Allow default droplet requests to use the local slot when remote is unavailable.
local_fallback = ${c.verification.localFallback}
# Concurrent machine test files; the free shard always uses one worker.
workers = ${c.verification.workers}
# Extra load-gate lanes; repetitions of one new test stay sequential.
load_gate_workers = ${c.verification.loadGateWorkers}
# Local admission stays capped at one, behind the compatibility leases.
budget = ${c.verification.budget}
# Parallel droplet runs beside the local slot.
remote_budget = ${c.verification.remoteBudget}
shards = ${c.verification.shards}
lock_path = ${JSON.stringify(c.verification.lockPath)}
# Reuse green candidate trees for this many minutes; 0 disables caching.
cache_max_age_minutes = ${minutes(c.verification.cacheMaxAgeMs)}
# Queue wait p90 target; informational, without changing admission.
wait_p90_target = "${c.verification.waitP90TargetMs % MINUTE === 0 ? `${minutes(c.verification.waitP90TargetMs)}m` : `${c.verification.waitP90TargetMs / 1000}s`}"
# Function coverage older than this falls back to package selection.
coverage_max_age = "${c.verification.coverageMaxAgeMs / 1000}s"
# Named tests fail at this deadline; silent commands are stopped with their process tree.
test_timeout = "${c.verification.testTimeoutMs / 1000}s"
stall_timeout = "${c.verification.stallTimeoutMs / 1000}s"
lifetime = "${c.verification.lifetimeMs % MINUTE === 0 ? `${minutes(c.verification.lifetimeMs)}m` : `${c.verification.lifetimeMs / 1000}s`}"

run_timeout = ${JSON.stringify(c.verification.runTimeout)}
daily_spend_usd = ${c.verification.dailySpendUsd}
# Nightly UTC time (HH:MM); empty disables the droplet soak.
soak = ${JSON.stringify(c.verification.soak)}

[verification.droplet]
${c.verification.droplet.workers === undefined ? "# workers inherits verification.workers" : `workers = ${c.verification.droplet.workers}`}
size = ${JSON.stringify(c.verification.droplet.size)}
prepare_size = ${JSON.stringify(c.verification.droplet.prepare_size)}
regions = ${JSON.stringify(c.verification.droplet.regions)}
image = ${JSON.stringify(c.verification.droplet.image)}

[merge]
# Queue reviewed code heads for batch landing. Documentation and human overrides land immediately.
queue = ${c.merge.queue}
batch = ${c.merge.batch}
batch_wait = "${c.merge.batchWaitMs / 1000}s"

[sessions]
# Archive stopped crew after their item closes, otherwise after their stop. Aides are excluded.
archive_after_item = "${c.sessions.archiveAfterItemMs / 1000}s"
archive_after_stop = "${c.sessions.archiveAfterStopMs / 1000}s"

# Container kinds, ordered top-down; a list at a level groups peers. The first kind owns releases.
# Other root kinds (category by default) have no version or rank. Leaves and map are outside the ladder.
[tracker]
levels = ${JSON.stringify(c.tracker.levels)}
# Warn after 5 seconds; exit only if the same operation is still outstanding at this deadline.
# Maximum: 2147483s (the platform timer limit).
fatal_stall = "${c.tracker.fatalStallMs / 1000}s"

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

const workerCount = (value: unknown, field: string): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error(`${field} must be a positive integer`);
  return value;
};

const positive = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined);

/** The file's values over the defaults. Legacy wrong types are ignored unless strict validation is requested. */
export function parseConfig(text: string, fallbackName: string, env: NodeJS.ProcessEnv = process.env, { strict = false }: { strict?: boolean } = {}): ProjectConfig {
  const doc = parse(text) as Record<string, unknown>;
  const c = defaultConfig(fallbackName);
  const setup = (doc.setup ?? {}) as Record<string, unknown>;
  if (setup.declined_installs !== undefined) {
    const ids = setup.declined_installs;
    if (!Array.isArray(ids) || !ids.every(id => ['claude-code', 'codex', 'opencode'].includes(id))) {
      throw new Error('setup.declined_installs must be a list of harness ids: claude-code, codex, opencode');
    }
    c.setup.declinedInstalls = [...new Set(ids)] as HarnessId[];
  }
  // Startup keeps legacy lenience; settings writes must never silently discard a supplied value.
  const accepts = (key: string, value: unknown, valid: boolean, expected: string): void => {
    if (strict && value !== undefined && !valid) throw new Error(`${key} must be ${expected}`);
  };
  const merge = (doc.merge ?? {}) as Record<string, unknown>;
  accepts('merge.queue', merge.queue, typeof merge.queue === 'boolean', 'a boolean');
  if (typeof merge.queue === 'boolean') c.merge.queue = merge.queue;
  accepts('merge.batch', merge.batch, Number.isSafeInteger(merge.batch) && Number(merge.batch) > 0, 'a positive integer');
  if (Number.isSafeInteger(merge.batch) && Number(merge.batch) > 0) c.merge.batch = Number(merge.batch);
  if (merge.batch_wait !== undefined) {
    if (typeof merge.batch_wait !== 'string') throw new Error('merge.batch_wait must be a duration string');
    c.merge.batchWaitMs = durationMs(merge.batch_wait);
  }
  const sessions = (doc.sessions ?? {}) as Record<string, unknown>;
  for (const [key, field] of [['archive_after_item', 'archiveAfterItemMs'], ['archive_after_stop', 'archiveAfterStopMs']] as const) {
    if (sessions[key] !== undefined) {
      if (typeof sessions[key] !== 'string') throw new Error(`sessions.${key} must be a duration string`);
      c.sessions[field] = durationMs(sessions[key]);
    }
  }
  const verification = (doc.verification ?? {}) as Record<string, unknown>;
  for (const key of ['prepare', 'check', 'test'] as const) {
    if (verification[key] === undefined) continue;
    if (typeof verification[key] !== 'string') throw new Error(`verification.${key} must be a command string`);
    c.verification[key] = verification[key];
  }
  if (verification.soak !== undefined) {
    if (typeof verification.soak !== 'string' || verification.soak !== '' && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(verification.soak)) throw new Error('verification.soak must be HH:MM UTC or empty');
    c.verification.soak = verification.soak;
  }
  for (const [key, field] of [['test_timeout', 'testTimeoutMs'], ['stall_timeout', 'stallTimeoutMs'], ['coverage_max_age', 'coverageMaxAgeMs'], ['wait_p90_target', 'waitP90TargetMs']] as const) {
    if (verification[key] === undefined) continue;
    try {
      if (typeof verification[key] !== 'string') throw new Error('not a duration');
      c.verification[field] = durationMs(verification[key]);
    } catch { throw new Error(`verification.${key} must be a positive duration (s, m, h or d)`); }
  }
  if (verification.load_gate_workers !== undefined) c.verification.loadGateWorkers = workerCount(verification.load_gate_workers, 'verification.load_gate_workers');
  if (verification.workers !== undefined) c.verification.workers = workerCount(verification.workers, 'verification.workers');
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
  const margin = Number(env.CLAND_TEST_EXECUTOR_MARGIN_MS) || 600000;
  if (c.verification.lifetimeMs < c.verification.runTimeoutMs + margin) throw new Error(`verification.lifetime ${verification.lifetime ?? '110m'} must be at least run_timeout ${c.verification.runTimeout} plus 10 minutes`);
  if (verification.daily_spend_usd !== undefined) {
    if (typeof verification.daily_spend_usd !== 'number' || !Number.isFinite(verification.daily_spend_usd) || verification.daily_spend_usd < 0) throw new Error('verification.daily_spend_usd must be a nonnegative number');
    c.verification.dailySpendUsd = verification.daily_spend_usd;
  }
  if (verification.droplet !== undefined) {
    const droplet = verification.droplet;
    if (!droplet || typeof droplet !== 'object' || Array.isArray(droplet) || droplet instanceof Date) throw new Error('verification.droplet must be a table');
    const values = droplet as Record<string, unknown>;
    if (values.workers !== undefined) c.verification.droplet.workers = workerCount(values.workers, 'verification.droplet.workers');
    for (const key of ['size', 'image', 'prepare_size'] as const) if (values[key] !== undefined) {
      if (typeof values[key] !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(values[key])) throw new Error(`verification.droplet.${key} must be a nonempty slug`);
      c.verification.droplet[key] = values[key];
    }
    if (values.regions !== undefined) {
      if (!Array.isArray(values.regions) || !values.regions.length || !values.regions.every(v => typeof v === 'string' && /^[a-z0-9]+$/.test(v))) throw new Error('verification.droplet.regions must be a nonempty list of region slugs');
      c.verification.droplet.regions = values.regions;
    }
  }
  if (verification.shards !== undefined) {
    if (typeof verification.shards !== 'number' || !Number.isSafeInteger(verification.shards) || verification.shards <= 0) throw new Error('verification.shards must be a positive integer');
    c.verification.shards = verification.shards;
  }
  if (verification.local_fallback !== undefined) {
    if (typeof verification.local_fallback !== 'boolean') throw new Error('verification.local_fallback must be a boolean');
    c.verification.localFallback = verification.local_fallback;
  }
  if (verification.remote_budget !== undefined) {
    if (typeof verification.remote_budget !== 'number' || !Number.isSafeInteger(verification.remote_budget) || verification.remote_budget <= 0) throw new Error('verification.remote_budget must be a positive integer');
    c.verification.remoteBudget = verification.remote_budget;
  }
  accepts('verification.budget', verification.budget, typeof verification.budget === 'number' && Number.isSafeInteger(verification.budget) && verification.budget > 0, 'a positive integer');
  if (typeof verification.budget === 'number' && Number.isSafeInteger(verification.budget) && verification.budget > 0) c.verification.budget = verification.budget;
  accepts('verification.lock_path', verification.lock_path, Boolean(typeof verification.lock_path === 'string' && verification.lock_path.startsWith('/')), 'an absolute path string');
  if (typeof verification.lock_path === 'string' && verification.lock_path.startsWith('/')) c.verification.lockPath = verification.lock_path;
  accepts('verification.cache_max_age_minutes', verification.cache_max_age_minutes, Boolean(typeof verification.cache_max_age_minutes === 'number' && Number.isFinite(verification.cache_max_age_minutes) && verification.cache_max_age_minutes >= 0), 'a nonnegative number');
  if (typeof verification.cache_max_age_minutes === 'number' && Number.isFinite(verification.cache_max_age_minutes) && verification.cache_max_age_minutes >= 0) c.verification.cacheMaxAgeMs = verification.cache_max_age_minutes * MINUTE;
  c.visibility = visibilityOverrides(doc.visibility);
  const project = (doc.project ?? {}) as Record<string, unknown>;
  accepts('project.name', project.name, Boolean(typeof project.name === 'string' && project.name.trim()), 'a nonempty string');
  if (typeof project.name === 'string' && project.name.trim()) c.name = project.name;
  const tracker = (doc.tracker ?? {}) as Record<string, unknown>;
  if (tracker.levels !== undefined) c.tracker.levels = configuredLevels(tracker.levels);
  if (tracker.fatal_stall !== undefined) {
    try {
      if (typeof tracker.fatal_stall !== 'string') throw new Error('not a duration');
      c.tracker.fatalStallMs = durationMs(tracker.fatal_stall);
    } catch { throw new Error('tracker.fatal_stall must be a positive duration (s, m, h or d)'); }
    if (c.tracker.fatalStallMs > 2147483647) throw new Error('tracker.fatal_stall must not exceed 2147483s (the platform timer limit)');
  }
  const plan = (doc.plan ?? {}) as Record<string, unknown>;
  if (plan.approval !== undefined) {
    if (plan.approval !== 'none' && plan.approval !== 'human') throw new Error('plan.approval must be none or human');
    c.plan.approval = plan.approval;
  }
  if (plan.qa_default !== undefined) c.plan.qaDefault = qaPolicy(plan.qa_default, 'plan.qa_default');
  const keys = (doc.keys ?? {}) as Record<string, unknown>;
  accepts('keys.layouts', keys.layouts, Boolean(Array.isArray(keys.layouts) && keys.layouts.every(v => typeof v === 'string')), 'a list of strings');
  if (Array.isArray(keys.layouts) && keys.layouts.every(v => typeof v === 'string')) c.keys.layouts = [...new Set(keys.layouts)];
  const a = (doc.artifacts ?? {}) as Record<string, unknown>;
  accepts('artifacts.retention_days', a.retention_days, Boolean(typeof a.retention_days === 'number' && Number.isFinite(a.retention_days) && a.retention_days >= 0), 'a nonnegative number');
  if (typeof a.retention_days === 'number' && Number.isFinite(a.retention_days) && a.retention_days >= 0) c.artifacts.retentionDays = a.retention_days;
  const h = (doc.hygiene ?? {}) as Record<string, unknown>;
  const set = (key: string, apply: (n: number) => void, scale = 1) => {
    const n = positive(h[key]);
    accepts(`hygiene.${key}`, h[key], n !== undefined, 'a positive number');
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
export function readProjectConfig(path: string, root: string, refused: (error: string) => void = () => {}, env: NodeJS.ProcessEnv = process.env): ProjectConfig | null {
  const text = readText(path);
  if (text === null) return null;
  try {
    return parseConfig(text, basename(root), env);
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
