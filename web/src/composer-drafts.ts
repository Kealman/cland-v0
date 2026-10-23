import { useSyncExternalStore } from 'react';
import type { HumanMessageKind } from '../../shared/wire/index.ts';
import type { ObjectRow } from './connection.ts';
import { readInterfaceState, writeInterfaceState } from './interface-state.ts';

type DraftContent = { text: string; kind: HumanMessageKind; to?: string | null | undefined; artifacts: ObjectRow[] };
type Draft = DraftContent & { pending?: DraftContent | undefined; pendingAt?: number | undefined; error?: string | undefined };
const drafts = new Map<string, Draft>();
const listeners = new Set<() => void>();
function get(topic: string): Draft {
  let draft = drafts.get(topic);
  if (!draft) {
    const saved = readInterfaceState(`draft.${topic}`) as Partial<Draft> | null;
    draft = { text: typeof saved?.text === 'string' ? saved.text : '',
      kind: saved?.kind === 'question' || saved?.kind === 'decision' ? saved.kind : 'message',
      to: saved?.to === null || typeof saved?.to === 'string' ? saved.to : undefined,
      artifacts: Array.isArray(saved?.artifacts) ? saved.artifacts.filter(row => row && typeof row.id === 'string' && typeof row.title === 'string') : [] };
    drafts.set(topic, draft);
  }
  return draft;
}
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function joined(first: string, second: string) { return first && second ? `${first}\n${second}` : first || second; }
function merged(first: ObjectRow[], second: ObjectRow[]) { return [...new Map([...first, ...second].map(row => [row.id, row])).values()]; }
// The pending input occupies a boundary in the editable draft. Withdrawn older
// text goes before that boundary; later typing stays after it.
function recoveredText(draft: Draft): string {
  if (!draft.pending) return draft.text;
  const at = draft.pendingAt ?? 0, before = draft.text.slice(0, at), after = draft.text.slice(at);
  return before + (before && !before.endsWith('\n') ? '\n' : '') + draft.pending.text + (after ? '\n' : '') + after;
}
function movedBoundary(before: string, after: string, at: number): number {
  let start = 0, suffix = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  while (suffix < before.length - start && suffix < after.length - start && before[before.length - suffix - 1] === after[after.length - suffix - 1]) suffix++;
  if (at <= start) return at; // New typing at the boundary follows the pending input.
  if (at >= before.length - suffix) return at + after.length - before.length;
  return start;
}
function update(topic: string, patch: Partial<Draft>) {
  const next = { ...get(topic), ...patch };
  drafts.set(topic, next);
  const content = next.pending ? { ...next.pending, text: recoveredText(next), artifacts: merged(next.pending.artifacts, next.artifacts) } : next;
  // A reload recovers uncertain text as a draft; it never replays a mutation.
  writeInterfaceState(`draft.${topic}`, { text: content.text, kind: content.kind, to: content.to, artifacts: content.artifacts });
  for (const listener of listeners) listener();
}
export async function sendComposerDraft(topic: string, send: (draft: DraftContent) => Promise<unknown>): Promise<void> {
  const current = get(topic);
  if (current.pending || !current.text.trim()) return;
  const pending = { text: current.text, kind: current.kind, to: current.to, artifacts: current.artifacts };
  update(topic, { text: '', artifacts: [], pending, pendingAt: 0, error: undefined });
  try { await send(pending); update(topic, { pending: undefined, pendingAt: undefined }); }
  catch (error) {
    const latest = get(topic);
    update(topic, { ...pending, text: recoveredText(latest), artifacts: merged(pending.artifacts, latest.artifacts), pending: undefined, pendingAt: undefined,
      error: error instanceof Error ? error.message : 'Send failed' });
  }
}
export function useComposerDraft(topic: string): [Draft, (patch: Partial<Draft>) => void] {
  const draft = useSyncExternalStore(subscribe, () => get(topic));
  return [draft, patch => {
    const latest = get(topic);
    update(topic, { ...patch, ...(latest.pending && patch.text !== undefined ? { pendingAt: movedBoundary(latest.text, patch.text, latest.pendingAt ?? 0) } : {}) });
  }];
}
export function restoreComposerText(topic: string, text: string): void {
  const draft = get(topic);
  const keep = !!draft.text.trim();
  update(topic, { text: keep ? joined(text, draft.text) : text,
    ...(draft.pending ? { pendingAt: text.length + (keep ? 1 + (draft.pendingAt ?? 0) : 0) } : {}) });
}
export function attachComposerArtifact(topic: string, artifact: ObjectRow): void {
  update(topic, { artifacts: merged(get(topic).artifacts, [artifact]) });
}
