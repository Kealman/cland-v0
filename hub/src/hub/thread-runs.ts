import type { Message, ThreadRun } from '../protocol.ts';
import { messageVerdict } from './visibility.ts';

/** Stored facts exclude clock-dependent presentation and retain distinct participants. */
export type RunFacts = Pick<ThreadRun, 'id' | 'firstSeq' | 'messageCount' | 'latest'> & { names: string[] };

/** Match thread.lua's local date rules on the hub host, shared by both clients. */
export function runDay(at: string): string {
  const date = new Date(at);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function joinsRun(message: Message, role: (name: string) => string | null): boolean {
  if (message.fromKind !== 'agent' || message.fromRole === 'aide' || message.ask || message.answerTo || messageVerdict(message)) return false;
  if (['ask', 'answer', 'verdict', 'request'].includes(message.kind ?? '')) return false;
  if (message.to.some(name => name === 'human' || name === 'aide' || role(name) === 'aide')) return false;
  // An unaddressed artifact creation chip folds; an ordinary unaddressed send is to the human.
  return message.to.length > 0 || !!message.artifact && !message.artifacts;
}

export function appendRun(previous: RunFacts | undefined, message: Message, seq: number): RunFacts {
  const names = [...(previous?.names ?? [])];
  for (const name of [message.from, ...message.to]) if (!names.includes(name)) names.push(name);
  return {
    id: previous?.id ?? `run:${message.id}`,
    firstSeq: previous?.firstSeq ?? seq,
    names,
    messageCount: (previous?.messageCount ?? 0) + 1,
    latest: { kind: message.kind ?? 'report', preview: message.text.trim().split(/\s+/u).slice(0, 12).join(' ').slice(0, 120), at: message.ts },
  };
}

export function foldLine(facts: RunFacts, now: number): ThreadRun {
  const participants = facts.names.slice(0, 3), otherParticipants = Math.max(0, facts.names.length - 3);
  const ageMs = Math.max(0, now - Date.parse(facts.latest.at));
  const age = ageMs < 60_000 ? `${Math.floor(ageMs / 1000)}s` : ageMs < 3_600_000 ? `${Math.floor(ageMs / 60_000)}m`
    : ageMs < 86_400_000 ? `${Math.floor(ageMs / 3_600_000)}h` : `${Math.floor(ageMs / 86_400_000)}d`;
  const who = participants.join(participants.length === 2 ? ' → ' : ', ') + (otherParticipants ? ` +${otherParticipants}` : '');
  return {
    id: facts.id, firstSeq: facts.firstSeq, participants, otherParticipants, messageCount: facts.messageCount, latest: facts.latest, ageMs,
    foldLine: `${who} · ${facts.messageCount} ${facts.messageCount === 1 ? 'message' : 'messages'} · ${facts.latest.kind}: ${facts.latest.preview} · ${age}`,
  };
}
