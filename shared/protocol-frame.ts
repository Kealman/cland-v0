// JSON-line envelope shared by protocol validation and read-only admission.
export const PROTOCOL_VERSION = 2;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Parse one wire frame; `null` when it is not even a typed object (the sender is then refused). */
export function parseFrame(raw: string): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(raw);
    return isObject(v) && typeof v.type === 'string' ? v : null;
  } catch {
    return null;
  }
}

