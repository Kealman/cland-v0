// JSON-lines framing for the byte-stream edges (the Unix socket, stdio): complete lines are split off first
// and each is held to the frame limit on its own; only the unfinished remainder is limited as it grows. So a
// near-limit frame and the next one arriving in the same read are both read, and an oversized frame is
// refused as soon as it is known to be one, before its newline.

export type LineReaderOptions = {
  /** The largest line, in UTF-8 bytes, newline not counted. */
  maxBytes: number;
  /** One complete, non-blank line, trimmed. */
  onLine: (line: string) => void;
  /** A line (complete or not) went over the limit; nothing more is read. */
  onTooLarge: () => void;
  /** Whether lines still count: once false, the rest of a read is left unread. */
  isOpen: () => boolean;
};

/** A reader to feed every decoded chunk of the stream to, in order. */
export function lineReader(options: LineReaderOptions): (chunk: string) => void {
  const { maxBytes } = options;
  // a UTF-16 code unit is at most 3 UTF-8 bytes: below a third of the limit, no need to count
  const tooLarge = (s: string) => s.length > maxBytes / 3 && Buffer.byteLength(s) > maxBytes;
  let buffer = '';
  let dead = false;
  return (chunk) => {
    if (dead) return;
    buffer += chunk;
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      if (!options.isOpen()) return;
      const raw = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      if (tooLarge(raw)) {
        dead = true;
        buffer = '';
        return options.onTooLarge();
      }
      const line = raw.trim();
      if (line) options.onLine(line);
    }
    if (tooLarge(buffer)) {
      dead = true;
      buffer = '';
      options.onTooLarge();
    }
  };
}
