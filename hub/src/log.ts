// The hub's log: one closure every event goes through, written as one JSON object per line.

export type LogEntry = Record<string, unknown>;
export type LogFn = (entry: LogEntry) => void;

/** A JSON-lines log over `write`: each entry gets a leading `ts` (ISO) unless it carries one. */
export function jsonLinesLog(write: (line: string) => void, now: () => Date = () => new Date()): LogFn {
  return (entry) => write(`${JSON.stringify({ ts: now().toISOString(), ...entry })}\n`);
}
