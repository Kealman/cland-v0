import { mergeHumanMarks } from '../src/hub/human-marks.ts';
import { STUB_NOW } from '../../nvim/test/fixtures/clock.ts';
// Hub-side source of the recorded Neovim protocol projections. Never imported by T2.
import { parseConfig, defaultConfig } from '../src/init/config.ts';
import { Ladder, kindsFor } from '../src/tracker/kinds.ts';
import { prefixOf } from '../src/tracker/prefixes.ts';
import { parseCriteria, countCriteria, summarizeCriteria, type Criterion } from '../src/tracker/criteria.ts';
import { Visibility, type VisibilityOverrides } from '../src/hub/visibility.ts';
import type { VisibilityPreferenceFile } from '../src/hub/visibility-preferences.ts';
import type { Scenario } from '../../nvim/test/stub-hub.ts';
type Row = Record<string, any>;
export function fixtureOutput(operation: string, input: Row): unknown {
  const tracker = input.tracker as Scenario['tracker'];
  const ladder = new Ladder(tracker?.ladder ?? tracker?.levels ?? input.levels);
  const policy = new Visibility({
    preferences: { get: () => input.preferences ?? {} } as VisibilityPreferenceFile,
    overrides: (input.visibility ?? {}) as VisibilityOverrides,
    role: name => String([...(input.presence ?? []), ...(input.processes ?? [])].find((r: Row) => r.name === name)?.role ?? '') || null,
    process: id => input.processes?.find((r: Row) => r.sessionId === id),
    items: () => input.items ?? [], ladder, now: () => new Date(input.at),
  });
  const criteria = (item: Row) => {
    const parsed = parseCriteria(String(item.body ?? ''));
    const criteria = (Array.isArray(item.criteria) ? item.criteria : parsed.criteria) as Criterion[];
    const tip = 'stub-current-head';
    const current = criteria.map(c => ({ ...c, marks: (c.marks ?? []).map(m => m.kind === 'verified' ? { ...m, commit: m.current === false ? 'stub-old-head' : tip } : m) }));
    return { ...parsed, criteria, criteriaCounts: item.criteria && !Array.isArray(item.criteria) ? item.criteria : countCriteria(summarizeCriteria(current), tip) };
  };
  const summary = (item: Row) => ({ ...item, criteria: criteria(item).criteriaCounts });
  switch (operation) {
    case 'human-marks': {
      const numeric = typeof input.before.events === 'number' || typeof input.frame.events === 'number';
      const before = { ...input.before, ...(typeof input.before.events === 'number' ? { events: new Date(input.before.events).toISOString() } : {}) };
      const frame = { ...input.frame, ...(typeof input.frame.events === 'number' ? { events: new Date(input.frame.events).toISOString() } : {}) };
      const marks = mergeHumanMarks(before, frame, id => input.histories[id] ?? []);
      return numeric ? { ...marks, events: marks.events === null ? null : Date.parse(marks.events) } : marks;
    }
    case 'config': {
      const config = input.source ? parseConfig(input.source, '@root@', {}) : defaultConfig('@root@');
      const configured = new Ladder(tracker?.ladder ?? tracker?.levels ?? config.tracker.levels);
      return { keys: config.keys, tracker: { levels: configured.flat, ladder: configured.levels.map(level => [...level]), prefixes: tracker?.prefixes ?? Object.fromEntries([...kindsFor(configured), 'category'].map(kind => [kind, prefixOf(kind)])) } };
    }
    case 'criteria': return criteria(input);
    case 'inbox-count': return input.asks.filter((r: Row) => policy.place('inbox', r, 'ask').layer === 'now').length
      + input.approvals.filter((r: Row) => policy.place('inbox', r, 'approval').layer === 'now').length
      + input.plans.length + input.requests.length
      + input.messages.filter((r: Row) => (r.layer ?? policy.place('inbox', r, 'waiting').layer) === 'now').length;
    case 'frame': {
      const f = input.frame;
      if (f.type === 'task' && f.item) return policy.frame({ ...f, item: summary(f.item) });
      if (f.type === 'result' && f.ok === true && input.requestType === 'task.list') return policy.frame({ ...f, value: { ...f.value, items: f.value.items.map(summary) } });
      return policy.frame(f);
    }
    default: throw new Error(`unknown recording operation ${operation}`);
  }
}

export function recordedOutput(operation: string, input: unknown): unknown {
  const decoded = new Map<string, string>();
  const encode = new Map<string, string>();
  let i = 0;
  function restore(v: any, key = ''): any {
    if (typeof v === 'string' && /^@(old|recent):\d+@$/.test(v)) {
      let value = decoded.get(v);
      if (!value) {
        value = new Date(Date.parse(STUB_NOW) - (v.startsWith('@old:') ? 8 * 86400000 : 0) - (++i * 1000)).toISOString();
        decoded.set(v, value); encode.set(value, v);
      }
      return value;
    }
    if (Array.isArray(v)) return v.map(x => restore(x));
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k,x]) => [k,restore(x,k)]));
    return v;
  }
  const restored = restore(input);
  // Keep timestamp identity in the output; only the age class is relevant to projection.
  const normalize = (v: any): any => typeof v === 'string' ? encode.get(v) ?? v : Array.isArray(v) ? v.map(normalize) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k,x]) => [k,normalize(x)])) : v;
  return normalize(fixtureOutput(operation, restored));
}
