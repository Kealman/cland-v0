// JSON-line envelope shared by protocol validation and read-only admission.
export const PROTOCOL_VERSION = 2;

/** Application frame kinds: streams are reserved and admit no binary payload yet. */
export const FRAME_LIMITS_BYTES = { json: 1024 * 1024, binary: 0 } as const;
export const BINARY_RESERVED_CLOSE_CODE = 4003;

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

