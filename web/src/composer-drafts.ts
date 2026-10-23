import { useSyncExternalStore } from 'react';
import type { HumanMessageKind } from '../../shared/wire/index.ts';
import type { ObjectRow } from './connection.ts';
import { readInterfaceState, writeInterfaceState } from './interface-state.ts';

type DraftContent = { text: string; kind: HumanMessageKind; to?: string | null | undefined; artifacts: ObjectRow[] };
type Draft = DraftContent & { pending?: DraftContent | undefined; error?: string | undefined };
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
function update(topic: string, patch: Partial<Draft>) {
  const next = { ...get(topic), ...patch };
  drafts.set(topic, next);
  const content = next.pending ? { ...next.pending, text: joined(next.pending.text, next.text), artifacts: merged(next.pending.artifacts, next.artifacts) } : next;
  // A reload recovers uncertain text as a draft; it never replays a mutation.
  writeInterfaceState(`draft.${topic}`, { text: content.text, kind: content.kind, to: content.to, artifacts: content.artifacts });
  for (const listener of listeners) listener();
}
export async function sendComposerDraft(topic: string, send: (draft: DraftContent) => Promise<unknown>): Promise<void> {
  const current = get(topic);
  if (current.pending || !current.text.trim()) return;
  const pending = { text: current.text, kind: current.kind, to: current.to, artifacts: current.artifacts };
  update(topic, { text: '', artifacts: [], pending, error: undefined });
  try { await send(pending); update(topic, { pending: undefined }); }
  catch (error) {
    const latest = get(topic);
    update(topic, { ...pending, text: joined(pending.text, latest.text), artifacts: merged(pending.artifacts, latest.artifacts), pending: undefined,
      error: error instanceof Error ? error.message : 'Send failed' });
  }
}
export function useComposerDraft(topic: string): [Draft, (patch: Partial<Draft>) => void] {
  const draft = useSyncExternalStore(subscribe, () => get(topic));
  return [draft, patch => update(topic, patch)];
}
