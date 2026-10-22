// Snapshot framing is synchronous: compose and validate the whole transaction
// before the dispatcher writes the first frame. Streams and suite history stay out.
import { SNAPSHOT_LIMITS, type SnapshotDomain, type SnapshotEnd, type SnapshotFrame, type SnapshotRefused, type SnapshotValues } from '../protocol.ts';
import type { HubCore } from './core.ts';
import type { Tracker } from '../tracker/tracker.ts';
import type { Sessions } from '../adapters/sessions.ts';
import type { Accounts } from '../accounts/registry.ts';
import type { EventsPage, VerificationQueue } from '../protocol.ts';
import { crewSummary, defaultCrew } from '../crew.ts';
import { prefixOf } from '../tracker/prefixes.ts';

export function snapshotFrames(values: SnapshotValues, epoch: string, seq: number): { frames: Array<SnapshotFrame | SnapshotEnd> } | { refusal: SnapshotRefused } {
  const frames: Array<SnapshotFrame | SnapshotEnd> = [];
  for (const domain of Object.keys(SNAPSHOT_LIMITS) as SnapshotDomain[]) {
    const frame = { type: 'snapshot', epoch, seq, domain, value: values[domain] } as SnapshotFrame;
    const bytes = Buffer.byteLength(JSON.stringify(frame));
    if (bytes > SNAPSHOT_LIMITS[domain]) return { refusal: { type: 'snapshot.refused', code: 'frame-too-large', domain, bytes, limit: SNAPSHOT_LIMITS[domain] } };
    frames.push(frame);
  }
  frames.push({ type: 'snapshot.end', epoch, seq });
  return { frames };
}

/** Gather only the workbench model from already loaded state in one turn. */
export function composeSnapshot({ core, tracker, sessions, verification, events, registry }: {
  core: HubCore; tracker: Tracker | undefined; sessions: Sessions | null;
  verification: VerificationQueue | null; events: EventsPage; registry: Accounts;
}): SnapshotValues {
  const crew = core.crew?.get() ?? defaultCrew();
  const cutoff = core.clock.now().getTime() - 7 * 24 * 60 * 60 * 1000;
  const processes = sessions?.list() ?? [];
  return {
    tracker: { levels: tracker?.ladder.flat ?? [], ladder: tracker?.ladder.levels.map(level => [...level]) ?? [], prefixes: tracker ? Object.fromEntries([...tracker.kinds, 'category'].map(kind => [kind, prefixOf(kind)])) : {} },
    items: { items: tracker?.snapshotSummaries({ card: true }) ?? [], done_items: tracker?.doneItemCount() ?? 0 },
    sessions: { rows: core.sessionRows(processes), processes, presence: core.presence(), archived: sessions?.archivedCount() ?? 0, roles: core.roleList(), crew: { config: crew, summary: crewSummary(crew) }, coordinator: core.coordinator(), verification },
    topics: { topics: core.topics().filter(topic => topic.status !== 'closed' || Date.parse(topic.updatedAt) >= cutoff), marks: core.humanMarks() },
    inbox: core.inbox.list(), events, accounts: core.accountLimits.list(registry),
  };
}
