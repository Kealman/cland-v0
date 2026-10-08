// The handover note (spec 4.4, decision #10, #31): four sections, goals now, work in flight, open decisions, waiting
// on; given as an object with those keys or as Markdown with those headings. Read, checked and rendered here.
import type { HandoverNote } from '../protocol.ts';

/** The four sections, in order, with the heading each has in Markdown. */
export const NOTE_SECTIONS: ReadonlyArray<{ key: keyof HandoverNote; heading: string }> = [
  { key: 'goals_now', heading: 'Goals now' },
  { key: 'work_in_flight', heading: 'Work in flight' },
  { key: 'open_decisions', heading: 'Open decisions' },
  { key: 'waiting_on', heading: 'Waiting on' },
];

/** A role's state as the store keeps it (`role_state`): its latest note and its latest move. */
export type RoleRecord = {
  note: { sections: HandoverNote; from: string; to: string; at: string } | null;
  handover: { from: string | null; to: string; by: string; at: string } | null;
};

export const isRoleRecord = (v: unknown): v is RoleRecord => typeof v === 'object' && v !== null && 'note' in v && 'handover' in v;

/** A handover refused for its note: `missing` names the sections (`goals_now`, …) that are absent or empty. */
export class NoteIncomplete extends Error {
  readonly missing: string[];
  constructor(missing: string[]) {
    const names = missing.map((k) => `"${NOTE_SECTIONS.find((s) => s.key === k)?.heading.toLowerCase() ?? k}"`).join(', ');
    super(
      `handover refused: the note has no ${names} section${missing.length > 1 ? 's' : ''} — a handover note needs four non-empty sections: goals now, work in flight, open decisions, waiting on (an object with goals_now, work_in_flight, open_decisions, waiting_on, or Markdown with those four headings)`,
    );
    this.missing = missing;
  }
}

const HEADING = /^#{1,6}[ \t]*(.+?)[ \t]*:?[ \t]*#*[ \t]*$/;
const normal = (s: string) => s.toLowerCase().replace(/[_\s-]+/g, ' ').trim();

/**
 * The note from what a caller gave: an object with the four keys, or Markdown with the four headings (any level, any
 * case). Throws `NoteIncomplete` naming every section that is missing or empty.
 */
export function parseNote(raw: unknown): HandoverNote {
  const found: Partial<Record<keyof HandoverNote, string>> = {};
  if (typeof raw === 'string') {
    let current: keyof HandoverNote | null = null;
    const lines: Partial<Record<keyof HandoverNote, string[]>> = {};
    for (const line of raw.split(/\r?\n/)) {
      const h = HEADING.exec(line);
      const section = h ? NOTE_SECTIONS.find((s) => normal(s.heading) === normal(h[1] as string)) : undefined;
      if (section) {
        current = section.key;
        lines[current] ??= [];
        continue;
      }
      if (current) lines[current]?.push(line);
    }
    for (const { key } of NOTE_SECTIONS) if (lines[key]) found[key] = (lines[key] as string[]).join('\n').trim();
  } else if (typeof raw === 'object' && raw !== null) {
    const o = raw as Record<string, unknown>;
    for (const { key } of NOTE_SECTIONS) if (typeof o[key] === 'string') found[key] = (o[key] as string).trim();
  }
  const missing = NOTE_SECTIONS.map((s) => s.key).filter((k) => !found[k]);
  if (missing.length) throw new NoteIncomplete(missing);
  return found as HandoverNote;
}

/** The note as Markdown, its four sections under their headings. */
export const renderNote = (note: HandoverNote): string => NOTE_SECTIONS.map(({ key, heading }) => `## ${heading}\n\n${note[key]}`).join('\n\n');

/** What the new holder reads after its clause: the note and where the rest of the role's state is. */
export const noteText = (from: string, note: HandoverNote): string =>
  [
    `Handover note from ${from}:`,
    '',
    renderNote(note),
    '',
    'You continue from this note and the hub, never from the previous session\'s transcript: `role.state` lists the topics waiting for your role, its open asks and its claims; `history` with a `topic` reads a topic\'s messages.',
  ].join('\n');
