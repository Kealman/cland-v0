/** Only assertion/error fields cross the runner boundary; never inspect arbitrary
 * error properties (which can contain environments and child command lines). */
export type LoadDiagnostic = { name?: string; message: string; stack?: string; code?: string; failureType?: string; cause?: LoadDiagnostic };
export function loadDiagnostic(error: unknown): LoadDiagnostic {
  return serialize(error, new Set());
}
function serialize(error: unknown, seen: Set<object>): LoadDiagnostic {
  if (!error || typeof error !== 'object') return { message: String(error) };
  if (seen.has(error)) return { message: '[circular error cause]' };
  seen.add(error);
  const value = error as Record<string, unknown>;
  const result: LoadDiagnostic = { message: String(value.message ?? 'test failed') };
  for (const field of ['name', 'stack', 'code', 'failureType'] as const) if (typeof value[field] === 'string') result[field] = value[field];
  if (value.cause && value.cause !== error) result.cause = serialize(value.cause, seen);
  return result;
}

/** Sanitize before writing either a receipt or the durable suite log. Use one
 * replacement pass so a short setting cannot modify a redaction marker. */
export function redactLoadDiagnostic<T>(value: T, env: NodeJS.ProcessEnv): T {
  const values = [...new Set(Object.values(env).filter((v): v is string => Boolean(v))
    .flatMap(value => [value, JSON.stringify(value).slice(1, -1)]))].sort((a, b) => b.length - a.length);
  const pattern = values.length ? new RegExp(values.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g') : null;
  const environment = (text: string) => pattern ? text.split('[redacted]').map(part => part.replace(pattern, '[redacted]')).join('[redacted]') : text;
  // A command argument can span arbitrary lines. Discard its entire message
  // tail rather than trying to distinguish script text from command output.
  const clean = (text: string) => environment(text.replace(/\b(command(?:\s+line|\s+failed(?:\s+with[^:\n]*)?)?|cmd|argv|spawnargs)\s*[:=][\s\S]*/i, '$1: [redacted]'));
  const visit = (item: unknown): unknown => typeof item === 'string' ? clean(item)
    : Array.isArray(item) ? item.map(visit)
    : item && typeof item === 'object' ? Object.fromEntries(Object.entries(item).map(([key, entry]) => {
      // Error.stack embeds the full message before its frames. Replace that
      // exact message as a unit, so multiline command arguments cannot masquerade
      // as stack frames. Preserve the independently captured frame suffix.
      const message = (item as { message?: unknown }).message;
      if (key === 'stack' && typeof entry === 'string' && typeof message === 'string' && message) {
        const start = entry.indexOf(message);
        if (start >= 0) return [key, environment(entry.slice(0, start)) + clean(message) + environment(entry.slice(start + message.length))];
      }
      return [key, visit(entry)];
    })) : item;
  return visit(value) as T;
}
