import { createContext, useContext, useRef, type ReactNode } from 'react';
import type { InboxAsk, InboxApproval, InboxPlan, InboxRequest, InboxMessage, InboxDeparture, InboxPairing } from '../../shared/wire/index.ts';
import type { ConnectionState } from './connection.ts';

export type InboxEntry = { kind: 'ask'; row: InboxAsk } | { kind: 'approval'; row: InboxApproval } | { kind: 'pairing'; row: InboxPairing } | { kind: 'plan'; row: InboxPlan } | { kind: 'request'; row: InboxRequest } | { kind: 'message'; row: InboxMessage };
export function liveInboxEntries(connection: ConnectionState): InboxEntry[] {
  const inbox = connection.inbox;
  return [...(inbox?.asks ?? []).map(row => ({ kind: 'ask' as const, row })), ...(inbox?.approvals ?? []).map(row => ({ kind: 'approval' as const, row })),
    ...(inbox?.pairings ?? []).map(row => ({ kind: 'pairing' as const, row })), ...(inbox?.plans ?? []).map(row => ({ kind: 'plan' as const, row })), ...(inbox?.requests ?? []).map(row => ({ kind: 'request' as const, row })), ...(inbox?.messages ?? []).map(row => ({ kind: 'message' as const, row }))];
}

type Visit = { entries: Map<string, InboxEntry>; departures: Map<string, InboxDeparture> };
const InboxVisit = createContext<Visit>({ entries: new Map(), departures: new Map() });
export function useInboxVisit() { return useContext(InboxVisit); }

/** One active visit spans the list, its drawer, and either Inbox pane. */
export function InboxVisitProvider({ connection, active, children }: { connection: ConnectionState; active: boolean; children: ReactNode }) {
  const visit = useRef<Visit>({ entries: new Map(), departures: new Map() });
  if (!active) visit.current = { entries: new Map(), departures: new Map() };
  for (const entry of liveInboxEntries(connection)) {
    const known = visit.current.entries.has(entry.row.id);
    if (entry.kind === 'ask' && connection.askCards?.get(entry.row.id)?.state !== undefined && connection.askCards.get(entry.row.id)!.state !== 'open' && !known) continue;
    if (entry.kind === 'approval' && (connection.approvalCards?.get(entry.row.id)?.state ?? entry.row.state) === 'closed' && !known) continue;
    visit.current.entries.set(entry.row.id, entry);
  }
  if (active) for (const departure of connection.inbox?.departures ?? []) visit.current.departures.set(departure.id, departure);
  for (const [id, entry] of visit.current.entries) {
    // Codes grant access only while the hub lists them; never retain a departed code for this visit.
    if (entry.kind === 'pairing' && !connection.inbox?.pairings?.some(row => row.id === id)) visit.current.entries.delete(id);
    if (entry.kind === 'approval') {
      const latest = connection.approvalCards?.get(id);
      if (latest) visit.current.entries.set(id, { kind: 'approval', row: latest });
    }
  }
  return <InboxVisit.Provider value={visit.current}>{children}</InboxVisit.Provider>;
}
