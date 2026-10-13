// Acceptance criteria and their source spans; checkbox state never implies a mark.
export type CriterionMark =
  | { kind: 'done'; by: string; at: string }
  | { kind: 'verified'; by: string; at: string; run: string; commit?: string; current?: boolean }
  | { kind: 'failed'; by: string; at: string; note: string };

/** Body line numbers are one-based; malformed source is retained verbatim. */
export type CriterionWarning = { line: number; text: string; reason: string };

export type Criterion = {
  id: string | null;
  text: string;
  checked: boolean;
  marks: CriterionMark[];
  malformedMarks: CriterionWarning[];
};

export function validTimestamp(value: string): boolean {
  const fields = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!fields) return false;
  const year = Number(fields[1]), month = Number(fields[2]), day = Number(fields[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return days !== undefined && day >= 1 && day <= days && Number(fields[4]) <= 23 && Number(fields[5]) <= 59 &&
    Number(fields[6] ?? 0) <= 59 && Number(fields[8] ?? 0) <= 23 && Number(fields[9] ?? 0) <= 59;
}

function markOf(kind: string, value: string): CriterionMark | null {
  const parts = value.split(' · ').map(part => part.trim());
  const by = parts[0];
  if (!by || !/^\S+(?: \[[^\[\]]+\])?$/.test(by)) return null;
  const timestamp = kind === 'verified' ? parts[2] : parts[1];
  if (!timestamp || !validTimestamp(timestamp)) return null;
  if (kind === 'done' && parts.length === 2) return { kind, by, at: timestamp };
  if (kind === 'verified' && (parts.length === 3 || parts.length === 4)) {
    const run = /^run (\S+)$/.exec(parts[1] ?? '')?.[1];
    const commit = parts.length === 4 ? /^commit ([0-9a-f]{40,64})$/.exec(parts[3] ?? '')?.[1] : undefined;
    if (run && (parts.length === 3 || commit)) return { kind, by, at: timestamp, run, ...(commit ? { commit } : {}) };
  }
  if (kind === 'failed') {
    const note = /^note (.+)$/.exec(parts.slice(2).join(' · '))?.[1];
    if (note) return { kind, by, at: timestamp, note };
  }
  return null;
}

/** §3.4's list and mark sub-items. The checkbox is preserved independently of marks. */
export function criteriaSource(body: string, definitionOfDone = false) {
  const sources: { start: number; lines: number[]; indent: number }[] = [];
  let sectionEnd: number | undefined;
  let hasSection = false;
  const criteria: Criterion[] = [];
  const criteriaWarnings: CriterionWarning[] = [];
  let inSection = false;
  let current: Criterion | undefined;
  let indent: number | undefined;
  let textOpen = false;
  let fence: { character: string; length: number } | undefined;
  for (const [index, line] of body.split(/\r?\n/).entries()) {
    const fenced = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      if (fenced && fenced[1]![0] === fence.character && fenced[1]!.length >= fence.length && !fenced[2]!.trim()) fence = undefined;
      continue;
    }
    if (fenced) { fence = { character: fenced[1]![0]!, length: fenced[1]!.length }; textOpen = false; continue; }
    if (/^##[ \t]+Acceptance criteria(?:[ \t]+#+)?[ \t]*$/.test(line) || definitionOfDone && /^##[ \t]+Definition of done(?:[ \t]+#+)?[ \t]*$/.test(line)) { inSection = true; hasSection = true; sectionEnd = undefined; current = undefined; indent = undefined; continue; }
    if (!inSection) continue;
    if (/^#{1,2}\s/.test(line)) { sectionEnd = index; inSection = false; current = undefined; continue; }
    const checkbox = /^( {0,3})[-*+] \[([ xX])\](?:[ \t]+(.*))?$/.exec(line);
    if (checkbox && (indent === undefined || checkbox[1]!.length <= indent)) {
      indent = checkbox[1]!.length;
      const text = checkbox[3] ?? '';
      const identified = /^(C[1-9]\d*)\.(?:\s+(.*))?$/.exec(text);
      current = { id: identified?.[1] ?? null, text: identified ? identified[2] ?? '' : text, checked: checkbox[2]!.toLowerCase() === 'x', marks: [], malformedMarks: [] };
      criteria.push(current);
      sources.push({ start: index, lines: [index], indent });
      textOpen = true;
      continue;
    }
    // Tokenize every list line once: whitespace or an unknown sub-item must not bypass warnings.
    const listItem = /^([ \t]*)([-*+]|\d+[.)])(?:[ \t]+(.*))?$/.exec(line);
    if (listItem) {
      const candidate = /^[-*+]$/.test(listItem[2]!) ? /^(done|verified|failed)\b(.*)$/.exec(listItem[3] ?? '') : null;
      if (candidate || (current && (listItem[1]!.includes('\t') || listItem[1]!.length > (indent ?? 0)))) {
        const value = candidate ? /^:\s*(.*)$/.exec(candidate[2]!) : null;
        const mark = value ? markOf(candidate![1]!, value[1]!) : null;
        const reason = !current ? 'Mark has no criterion' : !candidate ? 'Unrecognized criterion sub-item' :
          listItem[1] !== ' '.repeat((indent ?? 0) + 2) ? 'Mark must be indented two spaces below its criterion' :
          !mark ? `Malformed ${candidate[1]} mark` : null;
        if (reason) {
          const warning = { line: index + 1, text: line, reason };
          criteriaWarnings.push(warning);
          current?.malformedMarks.push(warning);
        } else if (current && mark) { current.marks.push(mark); sources.at(-1)!.lines.push(index); }
      } else current = undefined;
      textOpen = false;
    } else if (!line.trim()) {
      textOpen = false;
    } else if (current && textOpen && line.startsWith(' '.repeat((indent ?? 0) + 2))) {
      sources.at(-1)!.lines.push(index);
      current.text += `\n${line.slice((indent ?? 0) + 2)}`;
    } else if (/^\S/.test(line)) {
      current = undefined;
    }
  }
  return { criteria, criteriaWarnings, sources, sectionEnd: sectionEnd ?? body.split(/\r?\n/).length, hasSection, insertionInFence: sectionEnd === undefined && fence !== undefined };
}

export function parseCriteria(body: string, definitionOfDone = false): { criteria: Criterion[]; criteriaWarnings: CriterionWarning[] } {
  const { criteria, criteriaWarnings } = criteriaSource(body, definitionOfDone);
  return { criteria, criteriaWarnings };
}

/** Parties named by §3.4, enforced at both the dispatcher and the tracker write boundary. */
export function criterionRefusal(op: unknown, actor: { role: string | null; human: boolean; claimed: boolean }): string | null {
  if (op === 'done') return actor.human || actor.role === 'coordinator' || actor.role === 'aide' || actor.role === 'implementer' && actor.claimed
    ? null : 'done requires the live claimant Implementer, Coordinator, Aide or human';
  if (op === 'verify' || op === 'fail') return !actor.human && (actor.role === 'reviewer' || actor.role === 'qa')
    ? null : 'verify and fail require Reviewer or QA';
  if (op === 'add' || op === 'edit' || op === 'remove') return actor.human || actor.role === 'coordinator' || actor.role === 'aide'
    ? null : 'add, edit and remove require Coordinator, Aide or human';
  return 'criterion operation must be done, verify, fail, add, edit or remove';
}

/** Exact-build evidence: legacy marks without a commit remain readable but cannot verify a build. */
export function annotateCriteria(criteria: Criterion[], tip: string | null): Criterion[] {
  return criteria.map(c => ({ ...c, marks: c.marks.map(m => m.kind === 'verified'
    ? { ...m, current: !!tip && m.commit === tip } : m) }));
}

/** Compact indexed marks: checkbox state alone never implies completion. */
export type CriterionSummary = { done: boolean; failed: boolean; verified: Array<string | null> };
export type CriteriaCounts = { total: number; done: number; verified: number; stale: number; failed: number };
export function summarizeCriteria(criteria: readonly Criterion[]): CriterionSummary[] {
  return criteria.map(c => ({ done: c.marks.some(m => m.kind === 'done'), failed: c.marks.some(m => m.kind === 'failed'),
    verified: c.marks.flatMap(m => m.kind === 'verified' ? [m.commit ?? null] : []) }));
}
export function countCriteria(criteria: readonly CriterionSummary[], tip: string | null): CriteriaCounts {
  const counts: CriteriaCounts = { total: criteria.length, done: 0, verified: 0, stale: 0, failed: 0 };
  for (const c of criteria) {
    if (c.failed) counts.failed++;
    else if (tip && c.verified.includes(tip)) counts.verified++;
    else if (c.verified.length) counts.stale++;
    else if (c.done) counts.done++;
  }
  return counts;
}
