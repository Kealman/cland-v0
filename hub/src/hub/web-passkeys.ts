// Volatile, bounded challenge owner. Responses stay inside the HTTP edge.
import { createPublicKey, randomBytes } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Users } from './users.ts';
import { verifyAssertion, verifyRegistration } from './webauthn.ts';

export function webPasskeys(users: Users, now: () => number, configuredOrigin: string, pageOrigin: (req: IncomingMessage) => string) {
  const pending = new Map<string, { userId: string; token?: string; origin: string; expires: number }>();
  users.onReset(() => pending.clear());
  function bytes(value: unknown): Buffer {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value) || value.length > 90_000) throw new Error('Passkey refused');
    const result = Buffer.from(value, 'base64url');
    if (result.toString('base64url') !== value) throw new Error('Passkey refused');
    return result;
  }
  return {
    close() { pending.clear(); },
    handle(path: string, body: Record<string, unknown>, req: IncomingMessage, issue: (userId: string) => string): unknown {
      const origin = pageOrigin(req);
      const rpId = configuredOrigin.startsWith('https:') ? new URL(configuredOrigin).hostname : 'localhost';
      if (new URL(origin).hostname !== rpId || !(origin.startsWith('https:') || origin.startsWith('http://localhost:'))) throw new Error('Passkey refused');
      const invite = path.startsWith('/invite/');
      if (path.endsWith('/options')) {
        for (const [key, row] of pending) if (row.expires <= now()) pending.delete(key);
        if (pending.size >= 1000) throw new Error('Passkey refused');
        const user = invite ? users.checkInvite(typeof body.token === 'string' ? body.token : '', now()) : users.byName(typeof body.name === 'string' ? body.name : '');
        if (!user || (!invite && user.state !== 'active')) throw new Error('Passkey refused');
        const challenge = randomBytes(32).toString('base64url');
        pending.set(challenge, { userId: user.id, ...(invite ? { token: String(body.token) } : {}), origin, expires: now() + 120_000 });
        const credentials = users.passkeys(user.id).map(row => ({ type: 'public-key', id: row.credentialId }));
        return invite ? { challenge, rp: { id: rpId, name: 'cland' }, user: { id: Buffer.from(user.id).toString('base64url'), name: user.name, displayName: user.displayName }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -8 }], timeout: 120_000, attestation: 'none', authenticatorSelection: { userVerification: 'preferred', residentKey: 'preferred' }, excludeCredentials: credentials }
          : { challenge, rpId, timeout: 120_000, userVerification: 'preferred', allowCredentials: credentials.length ? credentials : [{ type: 'public-key', id: randomBytes(32).toString('base64url') }] };
      }
      const challenge = typeof body.challenge === 'string' ? body.challenge : '';
      const row = pending.get(challenge);
      pending.delete(challenge); // Every attempt spends the challenge, including malformed responses.
      if (!row || row.expires <= now() || row.origin !== origin || invite !== (row.token !== undefined)) throw new Error('Passkey refused');
      const response = body.response as Record<string, unknown> | undefined;
      if (!response || typeof response !== 'object') throw new Error('Passkey refused');
      const common = { credentialId: bytes(response.credentialId), clientDataJSON: bytes(response.clientDataJSON) };
      const expected = { challenge, origin, rpId };
      if (invite) {
        const result = verifyRegistration({ ...common, attestationObject: bytes(response.attestationObject) }, expected);
        if (!result.ok) throw new Error('Passkey refused');
        return users.registerPasskey(row.token!, { credentialId: Buffer.from(result.credential.credentialId).toString('base64url'), publicKey: result.credential.publicKey, counter: result.credential.signCount }, now(), user => issue(user.id));
      }
      const credential = users.passkeys(row.userId).find(c => c.credentialId === common.credentialId.toString('base64url'));
      if (!credential) throw new Error('Passkey refused');
      const algorithm = createPublicKey(credential.publicKey).asymmetricKeyType === 'ed25519' ? -8 : -7;
      const result = verifyAssertion({ ...common, authenticatorData: bytes(response.authenticatorData), signature: bytes(response.signature) }, expected, { credentialId: common.credentialId, publicKey: credential.publicKey, algorithm, signCount: credential.counter });
      if (!result.ok) throw new Error('Passkey refused');
      users.advancePasskey(row.userId, credential.credentialId, credential.counter, result.signCount);
      return issue(row.userId);
    },
  };
}
