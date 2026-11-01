/** Attestation-free WebAuthn verification. Callers own challenge expiry/consumption,
 * credential ownership/uniqueness and atomic counter persistence. No input is trusted. */
import { createHash, createPublicKey, verify } from 'node:crypto';

export interface WebAuthnExpected {
  challenge: string;
  origin: string;
  rpId: string;
  requireUserVerification?: boolean;
}
export interface WebAuthnCredential {
  credentialId: Uint8Array;
  publicKey: string;
  algorithm: -7 | -8;
  signCount: number;
}
export interface RegistrationResponse {
  credentialId: Uint8Array;
  clientDataJSON: Uint8Array;
  attestationObject: Uint8Array;
}
export interface AssertionResponse {
  credentialId: Uint8Array;
  clientDataJSON: Uint8Array;
  authenticatorData: Uint8Array;
  signature: Uint8Array;
}
export type WebAuthnReason = 'malformed-input' | 'malformed-cbor' | 'unsupported-algorithm' | 'invalid-key'
  | 'attestation-format' | 'credential-id' | 'client-data' | 'type' | 'challenge' | 'origin'
  | 'cross-origin' | 'rp-id' | 'user-present' | 'user-verified' | 'flags' | 'signature' | 'sign-counter';
type Failure = { ok: false; reason: WebAuthnReason };
type Result<T> = ({ ok: true } & T) | Failure;
class Refusal extends Error {
  reason: WebAuthnReason;
  constructor(reason: WebAuthnReason) { super(reason); this.reason = reason; }
}
function refuse(reason: WebAuthnReason): never { throw new Refusal(reason); }
function guarded<T>(work: () => T): Result<T> {
  try { return { ok: true, ...work() }; }
  catch (error) { return { ok: false, reason: error instanceof Refusal ? error.reason : 'malformed-input' }; }
}
const MAX_BYTES = 65_536;
function bytes(value: Uint8Array, max = MAX_BYTES): Buffer {
  if (!(value instanceof Uint8Array) || value.length > max || !value.length) refuse('malformed-input');
  return Buffer.from(value);
}
const utf8 = new TextDecoder('utf-8', { fatal: true });
// Only definite-length, bounded CBOR. No tags/floats/complex map keys or duplicate keys.
class Cbor {
  data: Buffer;
  offset = 0;
  remaining = 4096;
  constructor(data: Buffer) { this.data = data; if (data.length > MAX_BYTES) refuse('malformed-cbor'); }
  take(n: number): Buffer {
    if (n > this.data.length - this.offset) refuse('malformed-cbor');
    const b = this.data.subarray(this.offset, this.offset + n); this.offset += n; return b;
  }
  read(depth = 0): unknown {
    if (depth > 8 || --this.remaining < 0) refuse('malformed-cbor');
    const initial = this.take(1)[0]!;
    const major = initial >> 5, info = initial & 31;
    if (major === 7 && (info === 20 || info === 21 || info === 22)) return info === 22 ? null : info === 21;
    let n: number;
    if (info < 24) n = info;
    else if (info === 24) n = this.take(1)[0]!;
    else if (info === 25) n = this.take(2).readUInt16BE();
    else if (info === 26) n = this.take(4).readUInt32BE();
    else refuse('malformed-cbor');
    if (major === 0) return n;
    if (major === 1) return -1 - n;
    if (n > MAX_BYTES) refuse('malformed-cbor');
    if (major === 2) return this.take(n);
    if (major === 3) { try { return utf8.decode(this.take(n)); } catch { refuse('malformed-cbor'); } }
    if ((major === 4 && n > this.remaining) || (major === 5 && n * 2 > this.remaining)) refuse('malformed-cbor');
    if (major === 4) return Array.from({ length: n }, () => this.read(depth + 1));
    if (major === 5) {
      const map = new Map<string | number, unknown>();
      for (let i = 0; i < n; i++) {
        const key = this.read(depth + 1);
        if ((typeof key !== 'string' && typeof key !== 'number') || map.has(key)) refuse('malformed-cbor');
        map.set(key, this.read(depth + 1));
      }
      return map;
    }
    refuse('malformed-cbor');
  }
  end() { if (this.offset !== this.data.length) refuse('malformed-cbor'); }
}
function map(value: unknown): Map<string | number, unknown> {
  if (!(value instanceof Map)) refuse('malformed-cbor');
  return value;
}
function publicKey(value: unknown): { publicKey: string; algorithm: -7 | -8 } {
  const key = map(value), algorithm = key.get(3);
  if (algorithm !== -7 && algorithm !== -8) refuse('unsupported-algorithm');
  const x = key.get(-2), y = key.get(-3);
  if (!Buffer.isBuffer(x) || x.length !== 32) refuse('invalid-key');
  if (key.get(1) !== (algorithm === -7 ? 2 : 1) || key.get(-1) !== (algorithm === -7 ? 1 : 6)) refuse('invalid-key');
  if (algorithm === -7 && (!Buffer.isBuffer(y) || y.length !== 32)) refuse('invalid-key');
  // Reject private-key material rather than silently importing it as a public credential.
  if (key.has(algorithm === -7 ? -4 : -3)) refuse('invalid-key');
  try {
    const jwk = algorithm === -7
      ? { kty: 'EC', crv: 'P-256', x: x.toString('base64url'), y: (y as Buffer).toString('base64url') }
      : { kty: 'OKP', crv: 'Ed25519', x: x.toString('base64url') };
    return { algorithm, publicKey: createPublicKey({ key: jwk, format: 'jwk' }).export({ format: 'pem', type: 'spki' }).toString() };
  } catch { refuse('invalid-key'); }
}
function checkClient(raw: Buffer, expected: WebAuthnExpected, type: string) {
  let client: Record<string, unknown>;
  try {
    const value: unknown = JSON.parse(utf8.decode(raw));
    if (!value || typeof value !== 'object' || Array.isArray(value)) refuse('client-data');
    client = value as Record<string, unknown>;
  } catch { refuse('client-data'); }
  if (client.type !== type) refuse('type');
  // Compare the canonical base64url value supplied by the challenge owner.
  if (!/^[A-Za-z0-9_-]+$/.test(expected.challenge) || Buffer.from(expected.challenge, 'base64url').toString('base64url') !== expected.challenge
    || client.challenge !== expected.challenge) refuse('challenge');
  if (client.origin !== expected.origin) refuse('origin');
  const origin = new URL(expected.origin);
  if (origin.origin !== expected.origin || (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && origin.hostname === 'localhost'))) refuse('origin');
  if (origin.hostname !== expected.rpId) refuse('rp-id');
  if (client.crossOrigin !== undefined && client.crossOrigin !== false) refuse('cross-origin');
  if (client.topOrigin !== undefined) refuse('cross-origin');
}
function checkAuth(auth: Buffer, expected: WebAuthnExpected, registration: boolean): number {
  if (auth.length < 37) refuse('malformed-input');
  if (!auth.subarray(0, 32).equals(createHash('sha256').update(expected.rpId).digest())) refuse('rp-id');
  const flags = auth[32]!;
  if (!(flags & 1)) refuse('user-present');
  if (expected.requireUserVerification && !(flags & 4)) refuse('user-verified');
  if ((flags & 0x22) || ((flags & 0x10) && !(flags & 8)) || Boolean(flags & 0x40) !== registration) refuse('flags');
  return flags;
}
export function verifyRegistration(response: RegistrationResponse, expected: WebAuthnExpected): Result<{ credential: WebAuthnCredential }> {
  return guarded(() => {
    checkClient(bytes(response.clientDataJSON, 8192), expected, 'webauthn.create');
    if (response.attestationObject instanceof Uint8Array && response.attestationObject.length > MAX_BYTES) refuse('malformed-cbor');
    const reader = new Cbor(bytes(response.attestationObject));
    const attestation = map(reader.read()); reader.end();
    if (attestation.get('fmt') !== 'none' || map(attestation.get('attStmt')).size !== 0) refuse('attestation-format');
    const raw = attestation.get('authData');
    if (!Buffer.isBuffer(raw) || raw.length < 55) refuse('malformed-input');
    const flags = checkAuth(raw, expected, true);
    const idLength = raw.readUInt16BE(53), end = 55 + idLength;
    if (!idLength || idLength > 1023 || end >= raw.length) refuse('credential-id');
    const credentialId = raw.subarray(55, end);
    if (!credentialId.equals(bytes(response.credentialId, 1023))) refuse('credential-id');
    const cose = new Cbor(raw.subarray(end));
    const key = publicKey(cose.read());
    if (flags & 0x80) map(cose.read());
    cose.end();
    return { credential: { credentialId, ...key, signCount: raw.readUInt32BE(33) } };
  });
}
export function verifyAssertion(response: AssertionResponse, expected: WebAuthnExpected, credential: WebAuthnCredential): Result<{ signCount: number }> {
  return guarded(() => {
    const auth = bytes(response.authenticatorData), client = bytes(response.clientDataJSON, 8192);
    const signature = bytes(response.signature, 1024);
    if (!bytes(response.credentialId, 1023).equals(bytes(credential.credentialId, 1023))) refuse('credential-id');
    if (credential.algorithm !== -7 && credential.algorithm !== -8) refuse('unsupported-algorithm');
    if (!Number.isInteger(credential.signCount) || credential.signCount < 0 || credential.signCount > 0xffffffff) refuse('sign-counter');
    if (auth.length < 37) refuse('malformed-input');
    checkClient(client, expected, 'webauthn.get');
    const flags = checkAuth(auth, expected, false);
    const extensions = new Cbor(auth.subarray(37));
    if (flags & 0x80) map(extensions.read());
    extensions.end();
    let key;
    try {
      key = createPublicKey(credential.publicKey);
      if (credential.algorithm === -8 ? key.asymmetricKeyType !== 'ed25519'
        : key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') refuse('invalid-key');
    } catch { refuse('invalid-key'); }
    try {
      if (!verify(credential.algorithm === -8 ? null : 'sha256', Buffer.concat([auth, createHash('sha256').update(client).digest()]), key, signature)) refuse('signature');
    } catch { refuse('signature'); }
    const signCount = auth.readUInt32BE(33);
    if ((signCount || credential.signCount) && signCount <= credential.signCount) refuse('sign-counter');
    return { signCount };
  });
}
