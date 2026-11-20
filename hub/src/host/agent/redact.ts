/** One project-owned registry. Keep rotated values until all old consumers have drained. */
export type RemoteRedactor = ((text: string) => string) & {
  register: (secrets: readonly string[]) => void;
  /** Exact UTF-8 secret bytes only; media stays untouched when accepted. */
  containsSecret: (bytes: Uint8Array) => boolean;
  /** Persistence output: retain full text; complete JSON lines preserve structure. */
  text: (text: string) => string;
  /** JSON records: scrub nested string values while preserving schema keys. */
  value: <T>(value: T) => T;
};

/** Shared remote/speech output boundary. The callable form remains a bounded diagnostic. */
export function remoteRedactor(secrets: readonly string[] = []): RemoteRedactor {
  const values = new Set<string>();
  let pattern: RegExp;
  let registeredPattern: RegExp | undefined;
  const register = (secrets: readonly string[]) => {
    for (const value of secrets) if (value) values.add(value);
    const exact = [...values].sort((a, b) => b.length - a.length).map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    registeredPattern = exact.length ? new RegExp(exact.join('|'), 'gi') : undefined;
    // Incomplete captures keep no quoted credential bytes, even when an
    // escape or closing delimiter has not arrived before the line/EOF bound.
    const quotedValue = String.raw`"(?:\\[^\r\n]?|[^"\\\r\n])*(?:"|(?=[\r\n]|$))|'(?:\\[^\r\n]?|[^'\\\r\n])*(?:'|(?=[\r\n]|$))`;
    const escapedQuotedValue = String.raw`\\"(?:\\(?!")|[^\\\r\n])*(?:\\"|(?=[\r\n]|$))|\\'(?:\\(?!')|[^\\\r\n])*(?:\\'|(?=[\r\n]|$))`;
    // Full credential contexts win before exact values at the same position.
    pattern = new RegExp([
      String.raw`\b[a-z][a-z0-9+.-]*:\/\/\S+`,
      String.raw`\bbearer\s+\S+`,
      // Header values may contain schemes with quoted parameter lists. An
      // outer curl/string quote bounds the header; otherwise retain no tail.
      // Empty/bare-scheme lines also own the next whitespace-separated token.
      String.raw`\bauthorization[ \t]*[:=][ \t]*(?:[^\s"']+[ \t]*)?(?:\r\n|\r|\n)\s*(?:${escapedQuotedValue}|${quotedValue}|[^\s"']+)`,
      String.raw`(?<=(['"]))\bauthorization[ \t]*[:=][ \t]*(?:\\.|(?!\1)[^\r\n])*(?=\1)`,
      String.raw`\bauthorization[ \t]*[:=][ \t]*(?:${quotedValue}|[^\r\n]*)`,
      String.raw`\b(?:[a-z_]*token|[a-z_]*key|secret|authorization)\s*[:=]\s*(?:"[^"]*"|'[^']*'|\S+)`,
      ...exact,
    ].join('|'), 'gi');
  };
  register(secrets);
  const spansFor = (input: string, matcher = pattern): Array<{ start: number; end: number }> => {
    const markers = [...input.matchAll(/\[redacted\]/gi)].map(match => ({ start: match.index, end: match.index + match[0].length }));
    const spans: Array<{ start: number; end: number }> = [];
    matcher.lastIndex = 0;
    for (let match; (match = matcher.exec(input));) {
      let start = match.index, end = start + match[0].length;
      if (markers.some(marker => start >= marker.start && end <= marker.end)) {
        // Recheck overlaps: a shorter value inside a marker must not hide a
        // longer credential that starts there and extends into raw text.
        matcher.lastIndex = start + 1;
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
    return spans;
  };
  const redactText = (input: string): string => {
    let result = '', cursor = 0;
    for (const span of spansFor(input)) { result += input.slice(cursor, span.start) + '[redacted]'; cursor = span.end; }
    return result + input.slice(cursor);
  };
  // Captures contain JSONL and prefixed records such as `suite timing {...}`.
  // Match credentials in decoded strings, never against serialized delimiters.
  // Keep the conservative plain-text policy for incomplete/non-JSON output.
  const captureValue = (input: unknown): unknown => {
    if (typeof input === 'string') return redactText(input);
    if (Array.isArray(input)) return input.map(captureValue);
    if (input && typeof input === 'object') return Object.fromEntries(Object.entries(input).map(([key, value]) => [redactText(key), captureValue(value)]));
    return input;
  };
  const text = (input: string): string => {
    // Preserve original span authority across normalization and output slices.
    const spans = spansFor(input);
    const registered = registeredPattern ? spansFor(input, registeredPattern) : [];
    let rawIndex = 0;
    const rawRange = (start: number, end: number): string => {
      if (start >= end) return '';
      let output = '', cursor = start;
      while (rawIndex < spans.length && spans[rawIndex]!.end <= start) rawIndex++;
      for (let i = rawIndex; i < spans.length && spans[i]!.start < end; i++) {
        const span = spans[i]!;
        const first = Math.max(start, span.start), last = Math.min(end, span.end);
        output += input.slice(cursor, first) + '[redacted]';
        cursor = last;
      }
      return output + input.slice(cursor, end);
    };
    let result = '', pendingStart = 0, offset = 0, spanIndex = 0, registeredIndex = 0;
    for (const line of input.split(/(?<=\n)/)) {
      // Only strings/containers have JSON delimiters to preserve. Bare scalar
      // text includes opaque IDs: parsing a snowflake would round its digits.
      let start = line.search(/[\[{"]/);
      if (start < 0) { offset += line.length; continue; }
      if (!line.slice(0, start).trim()) start = 0;
      let parsed: unknown;
      try { parsed = JSON.parse(line.slice(start)); }
      catch { offset += line.length; continue; }
      const boundary = offset + start, end = offset + line.trimEnd().length;
      while (registeredIndex < registered.length && registered[registeredIndex]!.end <= boundary) registeredIndex++;
      // Registered spans wholly inside one JSON string are handled decoded.
      // Any span touching syntax (even across records) withholds the payload.
      const strings = [...line.slice(start).matchAll(/"(?:\\.|[^"\\])*"/g)].map(match => ({
        start: boundary + match.index + 1, end: boundary + match.index + match[0].length - 1,
      }));
      let maskPayload = false, stringIndex = 0;
      for (let i = registeredIndex; i < registered.length && registered[i]!.start < end; i++) {
        const span = registered[i]!;
        while (stringIndex < strings.length && strings[stringIndex]!.end < span.start) stringIndex++;
        const string = strings[stringIndex];
        if (!string || span.start < string.start || span.end > string.end) maskPayload = true;
      }
      while (spanIndex < spans.length && spans[spanIndex]!.end <= boundary) spanIndex++;
      const span = spans[spanIndex];
      if (!maskPayload && span && span.start < boundary && span.end > boundary) {
        offset += line.length; continue;
      }
      let json = maskPayload ? JSON.stringify('[redacted]') : JSON.stringify(captureValue(parsed));
      // Also catch registered spans newly produced by normalization/escaping.
      if (redactText(json) !== json) json = JSON.stringify('[redacted]');
      result += rawRange(pendingStart, boundary) + json + (line.match(/\r?\n$/)?.[0] ?? '');
      offset += line.length;
      pendingStart = offset;
    }
    return result + rawRange(pendingStart, input.length);
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

export function mapStrings<T>(input: T, transform: (text: string, key: string) => string, key = ''): T {
  if (typeof input === 'string') return transform(input, key) as T;
  if (Array.isArray(input)) return input.map(item => mapStrings(item, transform, key)) as T;
  if (input && typeof input === 'object') return Object.fromEntries(Object.entries(input).map(([key, item]) => [key, mapStrings(item, transform, key)])) as T;
  return input;
}
