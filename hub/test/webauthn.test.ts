// T1: pure WebAuthn byte verification; no processes, timers, sockets or filesystem writes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { verifyRegistration, verifyAssertion } from '../src/hub/webauthn.ts';

// Independent fixture encoder, deliberately limited to values used by authenticators here.
function cbor(value: unknown): Buffer {
  function head(major: number, n: number) {
    if (n < 24) return Buffer.from([major * 32 + n]);
    if (n < 256) return Buffer.from([major * 32 + 24, n]);
    const b = Buffer.alloc(3); b[0] = major * 32 + 25; b.writeUInt16BE(n, 1); return b;
  }
  if (typeof value === 'number') return head(value < 0 ? 1 : 0, value < 0 ? -1 - value : value);
  if (typeof value === 'string') { const b = Buffer.from(value); return Buffer.concat([head(3, b.length), b]); }
  if (Buffer.isBuffer(value)) return Buffer.concat([head(2, value.length), value]);
  if (value instanceof Map) return Buffer.concat([head(5, value.size), ...[...value].flatMap(([k, v]) => [cbor(k), cbor(v)])]);
  throw Error('unsupported fixture');
}
const expected = { challenge: Buffer.alloc(32, 7).toString('base64url'), origin: 'https://cland.example', rpId: 'cland.example' };
function fixture(algorithm: -7 | -8 = -7) {
  const keys = algorithm === -7 ? generateKeyPairSync('ec', { namedCurve: 'prime256v1' }) : generateKeyPairSync('ed25519');
  const jwk = keys.publicKey.export({ format: 'jwk' });
  const cose = new Map<number, unknown>([[1, algorithm === -7 ? 2 : 1], [3, algorithm], [-1, algorithm === -7 ? 1 : 6], [-2, Buffer.from(jwk.x!, 'base64url')]]);
  if (algorithm === -7) cose.set(-3, Buffer.from(jwk.y!, 'base64url'));
  const id = Buffer.from('credential-id');
  const client = (type: string, extra = {}) => Buffer.from(JSON.stringify({ type, ...expected, ...extra }));
  const auth = (flags: number, count: number) => { const b = Buffer.alloc(37); createHash('sha256').update(expected.rpId).digest().copy(b); b[32] = flags; b.writeUInt32BE(count, 33); return b; };
  const registration = (key = cbor(cose), flags = 0x41) => {
    const length = Buffer.alloc(2); length.writeUInt16BE(id.length);
    return { credentialId: id, clientDataJSON: client('webauthn.create'), attestationObject: cbor(new Map<string, unknown>([['fmt', 'none'], ['attStmt', new Map()], ['authData', Buffer.concat([auth(flags, 0), Buffer.alloc(16), length, id, key])]])) };
  };
  const assertion = (flags = 1, count = 1, extra = {}) => {
    const authenticatorData = auth(flags, count), clientDataJSON = client('webauthn.get', extra);
    return { credentialId: id, authenticatorData, clientDataJSON, signature: sign(algorithm === -8 ? null : 'sha256', Buffer.concat([authenticatorData, createHash('sha256').update(clientDataJSON).digest()]), keys.privateKey) };
  };
  return { keys, cose, id, client, auth, registration, assertion };
}
for (const algorithm of [-7, -8] as const) test(`C1 registers none algorithm ${algorithm} with a usable public key`, () => {
  const f = fixture(algorithm), result = verifyRegistration(f.registration(), expected);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.credential.credentialId, f.id);
  assert.equal(result.credential.algorithm, algorithm);
  assert.equal(result.credential.publicKey, f.keys.publicKey.export({ format: 'pem', type: 'spki' }).toString());
  assert.deepEqual(verifyAssertion(f.assertion(), expected, result.credential), { ok: true, signCount: 1 });
});

test('C2 checks ceremony type, challenge, origin, cross-origin, RP and presence/verification for both ceremonies', () => {
  const f = fixture(), registered = verifyRegistration(f.registration(), expected);
  assert.ok(registered.ok); if (!registered.ok) return;
  for (const [extra, reason] of [
    [{ type: 'webauthn.create' }, 'type'], [{ challenge: 'foreign' }, 'challenge'],
    [{ origin: 'https://foreign.example' }, 'origin'], [{ crossOrigin: true }, 'cross-origin'],
  ] as const) assert.deepEqual(verifyAssertion(f.assertion(1, 1, extra), expected, registered.credential), { ok: false, reason });
  assert.deepEqual(verifyAssertion(f.assertion(0), expected, registered.credential), { ok: false, reason: 'user-present' });
  assert.deepEqual(verifyAssertion(f.assertion(), { ...expected, requireUserVerification: true }, registered.credential), { ok: false, reason: 'user-verified' });
  assert.deepEqual(verifyAssertion(f.assertion(5), { ...expected, requireUserVerification: true }, registered.credential), { ok: true, signCount: 1 });
  assert.deepEqual(verifyAssertion(f.assertion(), { ...expected, rpId: 'foreign.example' }, registered.credential), { ok: false, reason: 'rp-id' });
  for (const [options, reason] of [
    [{ ...expected, challenge: 'foreign' }, 'challenge'], [{ ...expected, origin: 'https://foreign.example' }, 'origin'],
    [{ ...expected, rpId: 'foreign.example' }, 'rp-id'], [{ ...expected, requireUserVerification: true }, 'user-verified'],
  ] as const) assert.deepEqual(verifyRegistration(f.registration(), options), { ok: false, reason });
  assert.deepEqual(verifyRegistration(f.registration(undefined, 0x40), expected), { ok: false, reason: 'user-present' });
});

test('C3 tampering signed bytes, identity and replay counters are refused; zero counters remain usable', () => {
  const f = fixture(), registered = verifyRegistration(f.registration(), expected);
  assert.ok(registered.ok); if (!registered.ok) return;
  const credential = { ...registered.credential, signCount: 5 };
  for (const count of [0, 4, 5]) assert.deepEqual(verifyAssertion(f.assertion(1, count), expected, credential), { ok: false, reason: 'sign-counter' });
  assert.deepEqual(verifyAssertion(f.assertion(1, 6), expected, credential), { ok: true, signCount: 6 });
  assert.deepEqual(verifyAssertion(f.assertion(1, 0), expected, registered.credential), { ok: true, signCount: 0 });
  const signed = f.assertion(); signed.authenticatorData[36] = 2;
  assert.deepEqual(verifyAssertion(signed, expected, registered.credential), { ok: false, reason: 'signature' });
  const client = f.assertion(); client.clientDataJSON = Buffer.concat([client.clientDataJSON, Buffer.from(' ')]);
  assert.deepEqual(verifyAssertion(client, expected, registered.credential), { ok: false, reason: 'signature' });
  const signature = f.assertion(); signature.signature[10] = signature.signature[10]! ^ 1;
  assert.deepEqual(verifyAssertion(signature, expected, registered.credential), { ok: false, reason: 'signature' });
  const foreign = f.assertion(); foreign.credentialId = Buffer.from('foreign');
  assert.deepEqual(verifyAssertion(foreign, expected, registered.credential), { ok: false, reason: 'credential-id' });
  const rp = f.assertion(); rp.authenticatorData[0] = rp.authenticatorData[0]! ^ 1;
  assert.deepEqual(verifyAssertion(rp, expected, registered.credential), { ok: false, reason: 'rp-id' });
});

test('C4 bounded CBOR refuses truncation, indefinite lengths, oversize, deep nesting, duplicates and unsupported COSE', () => {
  const f = fixture(), response = f.registration();
  const malformed = [Buffer.from([0xa1]), Buffer.from([0xbf, 0xff]), Buffer.alloc(65_537), Buffer.from([0x5a, 0xff, 0xff, 0xff, 0xff]),
    Buffer.from([...Array<number>(10).fill(0x81), 0]), Buffer.from([0xa2, 1, 0, 1, 0]), Buffer.from([0x7f]), Buffer.from([0x61, 0xff])];
  for (const attestationObject of malformed) assert.deepEqual(verifyRegistration({ ...response, attestationObject }, expected), { ok: false, reason: 'malformed-cbor' });
  for (let n = 0; n < response.attestationObject.length; n++) assert.equal(verifyRegistration({ ...response, attestationObject: response.attestationObject.subarray(0, n) }, expected).ok, false);
  const unsupported = new Map(f.cose); unsupported.set(3, -257);
  assert.deepEqual(verifyRegistration(f.registration(cbor(unsupported)), expected), { ok: false, reason: 'unsupported-algorithm' });
  const wrongCurve = new Map(f.cose); wrongCurve.set(-1, 2);
  assert.deepEqual(verifyRegistration(f.registration(cbor(wrongCurve)), expected), { ok: false, reason: 'invalid-key' });
  const privateKey = new Map(f.cose); privateKey.set(-4, Buffer.alloc(32));
  assert.deepEqual(verifyRegistration(f.registration(cbor(privateKey)), expected), { ok: false, reason: 'invalid-key' });
  assert.equal(verifyRegistration({ ...response, attestationObject: Buffer.concat([response.attestationObject, Buffer.from([0])]) }, expected).ok, false);
  assert.equal(verifyRegistration(f.registration(Buffer.concat([cbor(f.cose), Buffer.from([0])])), expected).ok, false);
  for (const flags of [0x01, 0x43, 0x51]) assert.equal(verifyRegistration(f.registration(undefined, flags), expected).ok, false);
});

test('C4 malformed runtime values and assertion extensions never escape the result boundary', () => {
  const f = fixture(), registered = verifyRegistration(f.registration(), expected);
  assert.ok(registered.ok); if (!registered.ok) return;
  for (const invalid of [null, {}, { clientDataJSON: Buffer.from('{') }]) {
    assert.equal(verifyRegistration(invalid as never, expected).ok, false);
    assert.equal(verifyAssertion(invalid as never, expected, registered.credential).ok, false);
  }
  for (const flags of [0x41, 0x03, 0x11, 0x81]) assert.equal(verifyAssertion(f.assertion(flags), expected, registered.credential).ok, false);
  const extra = f.assertion(); extra.authenticatorData = Buffer.concat([extra.authenticatorData, Buffer.from([0])]);
  assert.equal(verifyAssertion(extra, expected, registered.credential).ok, false);
});

test('C5 verifier imports only node built-ins', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/hub/webauthn.ts', import.meta.url), 'utf8');
  const imports = [...source.matchAll(/(?:from\s+|import\s*\()(['"])([^'"]+)\1/g)].map(match => match[2]!);
  assert.ok(imports.length > 0);
  assert.ok(imports.every(specifier => specifier.startsWith('node:')));
});

test('extension maps are consumed exactly; foreign keys, malformed JSON and non-none attestations are refused', () => {
  const f = fixture(), registered = verifyRegistration(f.registration(), expected);
  assert.ok(registered.ok); if (!registered.ok) return;
  const registration = f.registration(Buffer.concat([cbor(f.cose), cbor(new Map([['example', 1]]))]), 0xc1);
  assert.ok(verifyRegistration(registration, expected).ok);
  const assertion = f.assertion(0x81);
  assertion.authenticatorData = Buffer.concat([assertion.authenticatorData, cbor(new Map([['example', 1]]))]);
  assertion.signature = sign('sha256', Buffer.concat([assertion.authenticatorData, createHash('sha256').update(assertion.clientDataJSON).digest()]), f.keys.privateKey);
  assert.deepEqual(verifyAssertion(assertion, expected, registered.credential), { ok: true, signCount: 1 });
  assert.deepEqual(verifyAssertion(fixture().assertion(), expected, registered.credential), { ok: false, reason: 'signature' });
  for (const text of ['{', 'null', '[]', '"text"']) assert.deepEqual(verifyRegistration({ ...f.registration(), clientDataJSON: Buffer.from(text) }, expected), { ok: false, reason: 'client-data' });
  for (const [fmt, attStmt] of [['packed', new Map()], ['none', new Map([['sig', Buffer.alloc(64)]])]] as const) {
    const attestationObject = cbor(new Map<string, unknown>([['fmt', fmt], ['attStmt', attStmt], ['authData', f.auth(0x41, 0)]]));
    assert.deepEqual(verifyRegistration({ ...f.registration(), attestationObject }, expected), { ok: false, reason: 'attestation-format' });
  }
});

test('assertion key algorithms and malformed signatures fail closed with bounded reasons', () => {
  const f = fixture(), registered = verifyRegistration(f.registration(), expected);
  assert.ok(registered.ok); if (!registered.ok) return;
  assert.deepEqual(verifyAssertion({ ...f.assertion(), signature: Buffer.from([0xff]) }, expected, registered.credential), { ok: false, reason: 'signature' });
  assert.deepEqual(verifyAssertion(f.assertion(), expected, { ...registered.credential, publicKey: 'not a key' }), { ok: false, reason: 'invalid-key' });
  assert.deepEqual(verifyAssertion(f.assertion(), expected, { ...registered.credential, algorithm: -8 }), { ok: false, reason: 'invalid-key' });
  assert.deepEqual(verifyRegistration({ ...f.registration(), clientDataJSON: f.client('webauthn.get') }, expected), { ok: false, reason: 'type' });
});

for (const algorithm of [-7, -8] as const) test(`C3 unsigned RP hash, UP, UV and counter mutations are refused for ${algorithm}`, () => {
  const f = fixture(algorithm), registered = verifyRegistration(f.registration(), expected);
  assert.ok(registered.ok); if (!registered.ok) return;
  for (const [offset, mask, reason] of [[0, 1, 'rp-id'], [32, 1, 'user-present'], [32, 4, 'signature'], [36, 1, 'signature']] as const) {
    const assertion = f.assertion(5, 2);
    assert.deepEqual(verifyAssertion(assertion, expected, registered.credential), { ok: true, signCount: 2 });
    assertion.authenticatorData[offset] = assertion.authenticatorData[offset]! ^ mask;
    assert.deepEqual(verifyAssertion(assertion, expected, registered.credential), { ok: false, reason });
    if (offset === 32 && mask === 4) assert.deepEqual(verifyAssertion(assertion, { ...expected, requireUserVerification: true }, registered.credential), { ok: false, reason: 'user-verified' });
  }
  const forgedVerification = f.assertion(1);
  forgedVerification.authenticatorData[32] = 5;
  assert.deepEqual(verifyAssertion(forgedVerification, { ...expected, requireUserVerification: true }, registered.credential), { ok: false, reason: 'signature' });
});
