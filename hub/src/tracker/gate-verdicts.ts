// One evaluation for the merge gate and the hub's ready status. Input must carry merge evidence,
// annotated with the freshness cache; file headers do not substitute for hub-written verdicts.
import { MergeError } from '../merge.ts';
import type { IndexedVerdict } from './index-db.ts';
import type { ItemView } from './tracker.ts';

function verdict(view: ItemView, kind: 'review' | 'qa'): IndexedVerdict {
  const all = view.verdicts.filter((v) => v.verdict === kind);
  const v = all.filter((v) => v.source === 'hub').at(-1);
  if (!v) throw new MergeError(all.length ? `${kind}-provenance` : `${kind}-missing`, `${view.id}: no hub-written ${kind} verdict`);
  const role = kind === 'review' ? 'reviewer' : 'qa';
  if (v.writer?.role !== role || v.writer.sessionId === 'human' || v.writer.sessionId.startsWith('cli:')) throw new MergeError(`${kind}-role`, `${view.id}: the ${kind} writer did not hold ${role}`);
  if (view.claim?.role === 'implementer' && view.claim.sessionId === v.writer.sessionId) throw new MergeError(`${kind}-claimant`, `${view.id}: its claiming session cannot supply ${kind}`);
  if (v.result !== 'clear') throw new MergeError(`${kind}-not-clear`, `${view.id}: ${kind} is not clear`);
  // mergeViewAsync annotates the latest hub verdict even when a later file-only header exists.
  const current = v.current;
  if (current !== true) throw new MergeError(current === undefined ? `${kind}-pending` : `${kind}-stale`, `${view.id}: ${kind} is ${current === undefined ? 'still checking freshness; try again' : 'stale'}`);
  return v;
}

export function gateVerdicts(view: ItemView): { review: IndexedVerdict; qa: IndexedVerdict | null } {
  const review = verdict(view, 'review');
  const qa = view.labels.includes('qa-required') ? verdict(view, 'qa') : null;
  return { review, qa };
}
