import type { HubFrame } from '../protocol.ts';

/** One project-owned registry. Keep rotated values until all old consumers have drained. */
export type RemoteRedactor = ((text: string) => string) & {
  register: (secrets: readonly string[]) => void;
  /** Exact UTF-8 secret bytes only; media stays untouched when accepted. */
  containsSecret: (bytes: Uint8Array) => boolean;
  /** Persistence output: retain document length and whitespace. */
  text: (text: string) => string;
  /** JSON records: scrub nested string values while preserving schema keys. */
  value: <T>(value: T) => T;
};

/** Shared remote/speech output boundary. The callable form remains a bounded diagnostic. */
export function remoteRedactor(secrets: readonly string[] = []): RemoteRedactor {
  const values = new Set<string>();
  let pattern: RegExp;
  const register = (secrets: readonly string[]) => {
    for (const value of secrets) if (value) values.add(value);
    // Full credential contexts win before exact values at the same position.
    pattern = new RegExp([
      String.raw`\b[a-z][a-z0-9+.-]*:\/\/\S+`,
      String.raw`\bbearer\s+\S+`,
      String.raw`\b(?:[a-z_]*token|[a-z_]*key|secret|authorization)\s*[:=]\s*(?:"[^"]*"|'[^']*'|\S+)`,
      ...[...values].sort((a, b) => b.length - a.length).map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    ].join('|'), 'gi');
  };
  register(secrets);
  const text = (input: string): string => {
    const markers = [...input.matchAll(/\[redacted\]/gi)].map(match => ({ start: match.index, end: match.index + match[0].length }));
    const spans: Array<{ start: number; end: number }> = [];
    pattern.lastIndex = 0;
    for (let match; (match = pattern.exec(input));) {
      let start = match.index, end = start + match[0].length;
      if (markers.some(marker => start >= marker.start && end <= marker.end)) {
        // Recheck overlaps: a shorter value inside a marker must not hide a
        // longer credential that starts there and extends into raw text.
        pattern.lastIndex = start + 1;
        continue;
      }
      for (const marker of markers) if (start < marker.end && end > marker.start) {
        start = Math.min(start, marker.start);
        end = Math.max(end, marker.end);
      }
      const previous = spans.at(-1);
      if (previous && start <= previous.end) previous.end = Math.max(previous.end, end);
      else spans.push({ start, end });
    }
    let result = '', cursor = 0;
    for (const span of spans) { result += input.slice(cursor, span.start) + '[redacted]'; cursor = span.end; }
    return result + input.slice(cursor);
  };
  const containsSecret = (bytes: Uint8Array): boolean => {
    const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return [...values].some(value => buffer.includes(Buffer.from(value, 'utf8')));
  };
  const value = <T>(input: T): T => redactValue(input, text);
  return Object.assign((input: string) => text(input).replace(/[\x00-\x1f\x7f\u2028\u2029]+/g, ' ').slice(0, 500), { register, text, value, containsSecret });
}

/** JSON keys are schema, not content. Keep them stable for records and clients. */
export function redactValue<T>(input: T, redact: (text: string) => string): T {
  return mapStrings(input, text => redact(text));
}

const CONTENT_FIELDS = new Set(['caption', 'text', 'reason', 'error', 'note', 'title', 'question', 'body', 'description', 'content', 'summary', 'command']);

/** Never rewrite an action, identifier or correlation to a different operation. */
export function redactFrame<T>(input: T, redact: (text: string) => string): T {
  return mapStrings(input, (text, key) => {
    const masked = redact(text);
    if (masked !== text && !CONTENT_FIELDS.has(key)) throw new Error('remote output would alter protocol routing');
    return masked;
  });
}

/** Hub-owned endpoint/display metadata is never remote input or an action target. */
export function redactHubFrame(input: HubFrame, redact: (text: string) => string): HubFrame {
  return mapStrings(input, (text, key) => {
    const masked = redact(text);
    if (masked !== text && !CONTENT_FIELDS.has(key) && key !== 'harnessId' && key !== 'attach')
      throw new Error('remote output would alter protocol routing');
    return masked;
  });
}

function mapStrings<T>(input: T, transform: (text: string, key: string) => string, key = ''): T {
  if (typeof input === 'string') return transform(input, key) as T;
  if (Array.isArray(input)) return input.map(item => mapStrings(item, transform, key)) as T;
  if (input && typeof input === 'object') return Object.fromEntries(Object.entries(input).map(([key, item]) => [key, mapStrings(item, transform, key)])) as T;
  return input;
}
