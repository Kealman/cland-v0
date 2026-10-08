// The audit log (spec 4.2, decision #13): every tool call the hub answers, allowed or refused, with who made it.
// Until the journal (#34) it is the hub's log, `.cland/log/hub.log`, as `audit` events; the record's shape is the
// one the journal takes over, so keep it stable. Never the text of a message: only what the call was about.

/** `ok`: answered; `forbidden`: refused by the permission table; `error`: the tool itself failed. */
export type AuditOutcome = 'ok' | 'forbidden' | 'error';

export type AuditRecord = {
  ts: string;
  event: 'audit';
  /** The session's name at call time; `human` for the UI and the CLI. */
  session: string;
  /** The session's id (its harness's); null for the human. */
  sessionId: string | null;
  /** The role the hub held for the session at call time (null: none); `human` for the UI and the CLI. */
  role: string | null;
  /** The tool (the frame's type): `send`, `task.claim`, `role.set`, … */
  tool: string;
  /** A compact summary of the arguments: item ids, addressees, topic ids, names; text only as its length. */
  args: Record<string, unknown>;
  outcome: AuditOutcome;
  /** `forbidden`: the missing permission (`tool` or `tool:scope`) and why. */
  permission?: string;
  reason?: string;
  /** `error`: what the tool answered. */
  error?: string;
  /** The client a human call came through (`ui`, `cli`, …). */
  client?: string;
};

/** The fields that say what a call was about, copied as they are (strings capped). */
const KEPT = [
  'item',
  'to',
  'topic',
  'replyTo',
  'session',
  'role',
  'name',
  'harness',
  'model',
  'effort',
  'kind',
  'state',
  'assignee',
  'parent',
  'release',
  'force',
  'limit',
  'with',
  'labels',
  'add_labels',
  'remove_labels',
  'blocked_by',
  'unblock',
  'branch',
  'verdict',
  'repo',
  'relaunch',
  'then',
  'move',
] as const;
/** Free text: only its length is kept. */
const TEXT = ['text', 'body', 'title', 'comment'] as const;
const MAX = 80;

const cap = (v: unknown): unknown => {
  if (typeof v === 'string') return v.length > MAX ? `${v.slice(0, MAX)}…` : v;
  if (Array.isArray(v)) return v.slice(0, 20).map(cap);
  if (typeof v === 'object' && v !== null) return Object.fromEntries(Object.entries(v).slice(0, 10).map(([k, x]) => [k, cap(x)]));
  return v;
};

/** What the audit keeps of a request frame. A CLI's `as` is kept as the name it acts as. */
export function summarize(frame: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of KEPT) if (frame[k] !== undefined) out[k] = cap(frame[k]);
  for (const k of TEXT) if (typeof frame[k] === 'string') out[`${k}Chars`] = (frame[k] as string).length;
  // a handover note (#31), Markdown or its four sections: only its length
  if (frame.note !== undefined) out.noteChars = typeof frame.note === 'string' ? frame.note.length : JSON.stringify(frame.note).length;
  const as = frame.as as { name?: unknown; role?: unknown } | undefined;
  if (as && typeof as === 'object' && typeof as.name === 'string') out.as = cap(as.name);
  return out;
}

export const isAuditRecord = (v: unknown): v is AuditRecord =>
  typeof v === 'object' && v !== null && (v as { event?: unknown }).event === 'audit' && typeof (v as { tool?: unknown }).tool === 'string';

export type AuditFilter = {
  /** A session name (`human` for the human's calls). */
  session?: string;
  /** Only records at or after this time. */
  since?: Date;
};

/** The audit records in a hub log's text, oldest first, filtered. Lines that are not audit records are skipped. */
export function readAudit(logText: string, filter: AuditFilter = {}): AuditRecord[] {
  const out: AuditRecord[] = [];
  for (const line of logText.split('\n')) {
    if (!line.includes('"event":"audit"')) continue;
    let rec: unknown;
    try {
      rec = JSON.parse(line);
    } catch {
      continue;
    }
    if (!isAuditRecord(rec)) continue;
    if (filter.session !== undefined && rec.session !== filter.session) continue;
    if (filter.since && !(Date.parse(rec.ts) >= filter.since.getTime())) continue;
    out.push(rec);
  }
  return out;
}

/** `--since`: an ISO time, or a span back from now (`30s`, `15m`, `2h`, `1d`). Null when it is neither. */
export function parseSince(raw: string, now: Date = new Date()): Date | null {
  const span = /^(\d+)\s*([smhd])$/.exec(raw.trim());
  if (span) {
    const unit = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[span[2] as 's' | 'm' | 'h' | 'd'];
    return new Date(now.getTime() - Number(span[1]) * unit);
  }
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t);
}

/** One record as a line for a person: `ts  session [role]  tool  args  outcome (why)`. */
export function formatAudit(r: AuditRecord): string {
  const args = Object.entries(r.args)
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
    .join(' ');
  const who = r.role && r.role !== 'human' ? `${r.session} [${r.role}]` : r.session;
  const tail = r.outcome === 'forbidden' ? `forbidden ${r.permission ?? ''} (${r.reason ?? ''})` : r.outcome === 'error' ? `error (${r.error ?? ''})` : 'ok';
  return `${r.ts}  ${who}  ${r.tool}${args ? `  ${args}` : ''}  ${tail}`;
}
