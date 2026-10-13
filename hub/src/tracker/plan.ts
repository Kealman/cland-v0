// Epic plans are file content. This module owns their YAML shape and Markdown section;
// the tracker supplies membership/criterion facts and keeps the last accepted version.
import { parse, stringify } from 'yaml';
import { idNumber } from './item.ts';
import { parseItemReference } from './prefixes.ts';

export type QaPolicy = { scope: 'none' | 'affected' | 'full'; when: 'per-item' | 'after-stage' };
export type EpicPlan = {
  stages: Array<{ name: string; qa: QaPolicy; lanes: string[][] }>;
  items?: Record<string, { qa?: QaPolicy; qa_criteria?: string[] }>;
};
/** Preserve plan spelling for approval hashes; match policy overrides by numeric identity. */
export function planOverrideKey(plan: EpicPlan, id: string): string | undefined {
  return Object.keys(plan.items ?? {}).find(key => idNumber(key) === idNumber(id));
}

export function planOverride(plan: EpicPlan, id: string): NonNullable<EpicPlan['items']>[string] | undefined {
  const key = planOverrideKey(plan, id);
  return key === undefined ? undefined : plan.items?.[key];
}

export class PlanError extends Error {}

const mapping = (raw: unknown, where: string): Record<string, unknown> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new PlanError(`${where} must be a mapping`);
  return raw as Record<string, unknown>;
};
const keys = (raw: Record<string, unknown>, allowed: string[], where: string): void => {
  for (const key of Object.keys(raw)) if (!allowed.includes(key)) throw new PlanError(`${where}: unknown field ${key}`);
};
const nonempty = (raw: unknown, where: string): unknown[] => {
  if (!Array.isArray(raw) || !raw.length) throw new PlanError(`${where} must be a nonempty list`);
  return raw;
};
export function qaPolicy(raw: unknown, where = 'qa'): QaPolicy {
  const r = mapping(raw, where);
  keys(r, ['scope', 'when'], where);
  if (typeof r.scope !== 'string' || !['none', 'affected', 'full'].includes(r.scope)) throw new PlanError(`${where}.scope must be none, affected or full`);
  if (typeof r.when !== 'string' || !['per-item', 'after-stage'].includes(r.when)) throw new PlanError(`${where}.when must be per-item or after-stage`);
  return { scope: r.scope as QaPolicy['scope'], when: r.when as QaPolicy['when'] };
}

export function parsePlan(yaml: string, kinds?: readonly string[]): EpicPlan {
  let raw: unknown;
  try { raw = parse(yaml, { uniqueKeys: true, maxAliasCount: 100 }); }
  catch (err) { throw new PlanError(`plan is not valid YAML: ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`); }
  const r = mapping(raw, 'plan');
  keys(r, ['stages', 'items'], 'plan');
  const seen = new Set<string>(), names = new Set<string>();
  const stages = nonempty(r.stages, 'stages').map((raw, stageIndex) => {
    const where = `stages[${stageIndex + 1}]`;
    const s = mapping(raw, where);
    keys(s, ['name', 'qa', 'lanes'], where);
    if (typeof s.name !== 'string' || !s.name.trim() || /[\r\n]/.test(s.name)) throw new PlanError(`${where}.name must be a nonempty single line`);
    const name = s.name.trim();
    if (names.has(name)) throw new PlanError(`duplicate stage name ${name}`);
    names.add(name);
    const lanes = nonempty(s.lanes, `${where}.lanes`).map((lane, laneIndex) => nonempty(lane, `${where}.lanes[${laneIndex + 1}]`).map(id => {
      if (typeof id !== 'string' || !parseItemReference(id, kinds)) throw new PlanError(`${where}: lane item must be an id such as T-55`);
      if (seen.has(String(parseItemReference(id, kinds)!.n))) throw new PlanError(`${id} appears in more than one lane position`);
      seen.add(String(parseItemReference(id, kinds)!.n));
      return id;
    }));
    return { name, qa: qaPolicy(s.qa, `${where}.qa`), lanes };
  });
  const plan: EpicPlan = { stages };
  if (r.items !== undefined) {
    const items = mapping(r.items, 'items');
    plan.items = {};
    const overridden = new Set<number>();
    for (const [id, raw] of Object.entries(items)) {
      if (!parseItemReference(id, kinds) || !seen.has(String(parseItemReference(id, kinds)!.n))) throw new PlanError(`items.${id}: override item is not in a plan lane`);
      const n = parseItemReference(id, kinds)!.n;
      if (overridden.has(n)) throw new PlanError(`items.${id}: duplicate override for item number ${n}`);
      overridden.add(n);
      const item = mapping(raw, `items.${id}`);
      keys(item, ['qa', 'qa_criteria'], `items.${id}`);
      if (item.qa === undefined && item.qa_criteria === undefined) throw new PlanError(`items.${id}: needs qa or qa_criteria`);
      const override: NonNullable<EpicPlan['items']>[string] = {};
      if (item.qa !== undefined) override.qa = qaPolicy(item.qa, `items.${id}.qa`);
      if (item.qa_criteria !== undefined) {
        if (!Array.isArray(item.qa_criteria) || !item.qa_criteria.every(id => typeof id === 'string' && /^C[1-9]\d*$/.test(id))) throw new PlanError(`items.${id}.qa_criteria must be criterion ids such as C1`);
        if (new Set(item.qa_criteria).size !== item.qa_criteria.length) throw new PlanError(`items.${id}.qa_criteria contains duplicate ids`);
        override.qa_criteria = item.qa_criteria;
      }
      plan.items[id] = override;
    }
  }
  return plan;
}

export const planYaml = (plan: EpicPlan): string => stringify(plan, { lineWidth: 0 });

type Section = { start: number; end: number; lines: string[] };
function section(body: string): Section | null {
  const lines = body.replace(/\r\n/g, '\n').split('\n');
  let fence: { char: string; size: number } | null = null, start = -1, end = lines.length;
  for (const [i, line] of lines.entries()) {
    const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      if (marker && marker[1]![0] === fence.char && marker[1]!.length >= fence.size && !marker[2]!.trim()) fence = null;
      continue;
    }
    if (marker) { fence = { char: marker[1]![0]!, size: marker[1]!.length }; continue; }
    if (/^## Plan[ \t]*$/.test(line)) {
      if (start >= 0) throw new PlanError('duplicate ## Plan sections');
      start = i;
    } else if (start >= 0 && end === lines.length && /^#{1,2}(?:[ \t]|$)/.test(line)) end = i;
  }
  if (fence) throw new PlanError('unclosed Markdown fence; fix it before changing the plan');
  return start < 0 ? null : { start, end, lines };
}

export function planInBody(body: string, kinds?: readonly string[]): EpicPlan | null {
  // Ordinary items need no plan parsing, even if unrelated prose has an unfinished fence.
  if (!/^## Plan[ \t]*$/m.test(body)) return null;
  const found = section(body);
  if (!found) return null;
  const text = found.lines.slice(found.start + 1, found.end).join('\n').trim();
  const block = /^(`{3,}|~{3,})(?:yaml|yml)[ \t]*\n([\s\S]*?)\n\1[ \t]*$/.exec(text);
  if (!block) throw new PlanError('## Plan must contain exactly one fenced yaml block');
  return parsePlan(block[2]!, kinds);
}

export function withPlan(body: string, plan: EpicPlan): string {
  const found = section(body);
  const block = `## Plan\n\n\`\`\`yaml\n${planYaml(plan)}\`\`\``;
  if (!found) return [body.trim(), block].filter(Boolean).join('\n\n');
  return [found.lines.slice(0, found.start).join('\n').trimEnd(), block, found.lines.slice(found.end).join('\n').trimStart()].filter(Boolean).join('\n\n');
}
