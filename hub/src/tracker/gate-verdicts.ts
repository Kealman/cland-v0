// One criteria and verdict evaluation for the merge gate and the hub's ready status. Input must carry merge evidence,
// annotated with the freshness cache; file headers do not substitute for hub-written verdicts.
import { MergeError } from '../merge.ts';
import type { IndexedVerdict } from './index-db.ts';
import type { ItemView } from './tracker.ts';

function verdict(view: ItemView, kind: 'review' | 'qa'): IndexedVerdict {
  const all = view.verdicts.filter((v) => v.verdict === kind && v.stage === undefined);
  const v = all.filter((v) => v.source === 'hub').at(-1);
  if (!v) throw new MergeError(all.length ? `${kind}-provenance` : `${kind}-missing`, `${view.id}: no hub-written ${kind} verdict`);
  const role = kind === 'review' ? 'reviewer' : 'qa';
  if (v.writer?.role !== role || v.writer.sessionId === 'human' || v.writer.sessionId.startsWith('cli:')) throw new MergeError(`${kind}-role`, `${view.id}: the ${kind} writer did not hold ${role}`);
  if ((view.claim?.role === 'implementer' || view.claim?.role === 'aide') && view.claim.sessionId === v.writer.sessionId) throw new MergeError(`${kind}-claimant`, `${view.id}: its claiming session cannot supply ${kind}`);
  if (v.result !== 'clear') throw new MergeError(`${kind}-not-clear`, `${view.id}: ${kind} is not clear`);
  // mergeViewAsync annotates the latest hub verdict even when a later file-only header exists.
  const current = v.current;
  if (current !== true) throw new MergeError(current === undefined ? `${kind}-pending` : `${kind}-stale`, `${view.id}: ${kind} is ${current === undefined ? 'still checking freshness; try again' : 'stale'}`);
  return v;
}

/** Whether the item's independent, current QA evidence qualifies, apart from criteria and review. */
export function qaSatisfied(view: ItemView): boolean {
  try { verdict(view, 'qa'); return true; }
  catch (err) { if (err instanceof MergeError) return false; throw err; }
}

export function incompleteCriteria(view: ItemView): string[] {
  const missingIds = (view.qaCriteria ?? []).filter(id => !view.criteria.some(c => c.id === id)).map(id => `${id}: QA criterion is missing`);
  return [...missingIds, ...view.criteria.flatMap(c => {
    const missing: string[] = [];
    const failed = c.marks.some(m => m.kind === 'failed');
    if (failed || !c.marks.some(m => m.kind === 'done')) missing.push('not done');
    const needsQa = c.id !== null && view.qaCriteria?.includes(c.id);
    if (failed || !c.marks.some(m => m.kind === 'verified' && m.current === true && (!needsQa || /\[qa\]$/i.test(m.by)))) missing.push(needsQa ? 'not verified by QA' : 'not verified');
    return missing.length ? [`${c.id ?? 'legacy criterion'}: ${c.text} (${missing.join(', ')})`] : [];
  })];
}

export function gateVerdicts(view: ItemView): { review: IndexedVerdict; qa: IndexedVerdict | null } {
  const incomplete = incompleteCriteria(view);
  if (incomplete.length) {
    const legacy = view.criteria.some(c => c.id === null) ? ' Legacy criterion ids are assigned on the first criterion operation; read task view again for the assigned ids.' : '';
    throw new MergeError('criteria-incomplete', `${view.id}: incomplete acceptance criteria:\n${incomplete.join('\n')}\nThe claiming Implementer marks each criterion done with cland task criterion ${view.id} done C<n>, then Reviewer or QA records a clear verdict with --verified C<n> or --verified all.${legacy}`);
  }
  const review = verdict(view, 'review');
  const policy = view.qaPolicy;
  const qa = policy && policy.scope !== 'none' && policy.when === 'per-item' ? verdict(view, 'qa') : null;
  return { review, qa };
}

/** Epic demos are QA on dev, not a task merge: no review or Implementer done marks are required. */
export function incompleteEpicCriteria(view: ItemView, qa?: IndexedVerdict): string[] {
  return view.criteria.flatMap(c => {
    const verified = c.marks.some(m => m.kind === 'verified' && m.current === true && m.by === qa?.by && m.run === qa?.run);
    return !c.id || c.marks.some(m => m.kind === 'failed') || !verified
      ? [`${c.id ?? 'legacy criterion'}: ${c.text} (not verified in the current QA run)`] : [];
  });
}

export function gateEpicVerdict(view: ItemView): IndexedVerdict {
  const qa = verdict(view, 'qa');
  const incomplete = incompleteEpicCriteria(view, qa);
  if (view.criteriaWarnings.length || new Set(view.criteria.map(c => c.id)).size !== view.criteria.length) {
    throw new MergeError('criteria-incomplete', `${view.id}: fix malformed criterion sub-items or duplicate criterion ids before closing the epic`);
  }
  if (incomplete.length) throw new MergeError('criteria-incomplete', `${view.id}: incomplete epic criteria:\n${incomplete.join('\n')}\nQA runs the Definition of done on dev and records a clear verdict with --verified C<n> or --verified all. Legacy ids are assigned on the first criterion operation; read task view again.`);
  return qa;
}
