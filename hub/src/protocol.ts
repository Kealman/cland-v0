// The hub ↔ spoke protocol. One integer version, bumped on any incompatible change.
// Frames travel as JSON text over one WebSocket per spoke.

export const PROTOCOL_VERSION = 1;

/** The spoke's heartbeat interval; the hub closes a socket silent for two of them. */
export const HEARTBEAT_MS = 30_000;

/**
 * The largest frame the hub reads; a bigger one closes the socket before it is parsed. Every frame
 * the protocol carries today is kilobytes (a message's text is capped by hygiene at 8 KiB).
 */
export const MAX_FRAME_BYTES = 1024 * 1024;

/** What a refused spoke is told to do: the message names the fix, never only the fact. */
export const UPDATE_HINT = 'update cland and restart the session';

export type FromKind = 'human' | 'agent' | 'hub';
export type Via = 'session' | 'hub';
export type Outcome = 'delivered' | 'queued' | 'unknown' | 'refused' | 'empty';

export type Presence = {
  name: string;
  sessionId: string;
  cwd: string;
  /** The role the session declared in its hello, or null. */
  role: string | null;
  status: string | null;
  connectedAt: string;
};

export type Message = {
  id: string;
  from: string;
  fromKind: FromKind;
  /** The sender's role when a session wrote it; absent on the hub's own message. */
  fromRole?: string;
  via: Via;
  /** The resolved addressees of this delivery. */
  to: string[];
  text: string;
  replyTo?: string;
  ts: string;
};

export type Hello = {
  type: 'hello';
  protocol: number;
  sessionId: string;
  cwd: string;
  /** Requested name; absent means "assign me one". */
  name?: string;
  /** The role the session runs under. TODO(#29): roles become hub-held state; today it is a declared label. */
  role?: string;
};

export type SpokeRequest =
  | { type: 'send'; id: string; to: string[]; text: string; replyTo?: string }
  | { type: 'who'; id: string }
  | { type: 'history'; id: string; limit?: number; with?: string }
  | { type: 'status'; id: string; text: string }
  | { type: 'rename'; id: string; name: string }
  /** The heartbeat. */
  | { type: 'ping'; id: string };

export type SpokeFrame = Hello | SpokeRequest;

export type RefusalCode = 'version' | 'unauthorized' | 'name-in-use' | 'bad-name' | 'bad-hello';

export type HubFrame =
  | { type: 'welcome'; name: string; presence: Presence[]; role?: string }
  | { type: 'deliver'; message: Message }
  | { type: 'result'; id: string; ok: true; value: unknown }
  | { type: 'result'; id: string; ok: false; error: string }
  | { type: 'error'; code: RefusalCode; message: string };

export type SendOutcome = { to: string; outcome: Outcome; reason?: string };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Parse one wire frame; `null` when it is not even a typed object (the sender is then refused). */
export function parseFrame(raw: string): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(raw);
    return isRecord(v) && typeof v.type === 'string' ? v : null;
  } catch {
    return null;
  }
}

export function isHello(f: Record<string, unknown>): f is Hello {
  return (
    f.type === 'hello' &&
    typeof f.protocol === 'number' &&
    typeof f.sessionId === 'string' &&
    typeof f.cwd === 'string' &&
    (f.name === undefined || typeof f.name === 'string') &&
    (f.role === undefined || typeof f.role === 'string')
  );
}

export function isSpokeRequest(f: Record<string, unknown>): f is SpokeRequest {
  if (typeof f.id !== 'string') return false;
  switch (f.type) {
    case 'who':
    case 'ping':
      return true;
    case 'history':
      return (f.limit === undefined || typeof f.limit === 'number') && (f.with === undefined || typeof f.with === 'string');
    case 'status':
      return typeof f.text === 'string';
    case 'rename':
      return typeof f.name === 'string';
    case 'send':
      return Array.isArray(f.to) && f.to.every((t) => typeof t === 'string') && typeof f.text === 'string' && (f.replyTo === undefined || typeof f.replyTo === 'string');
    default:
      return false;
  }
}

export function isHubFrame(f: Record<string, unknown>): f is HubFrame {
  switch (f.type) {
    case 'welcome':
      return typeof f.name === 'string' && Array.isArray(f.presence);
    case 'deliver':
      return isRecord(f.message) && typeof f.message.id === 'string' && typeof f.message.text === 'string';
    case 'result':
      return typeof f.id === 'string' && typeof f.ok === 'boolean';
    case 'error':
      return typeof f.code === 'string' && typeof f.message === 'string';
    default:
      return false;
  }
}
