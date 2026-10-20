import type { DurationManifest } from '../src/suite-durations.ts';

/** A migrated baseline with one grandfathered and one expiring allowance. */
export function durationFixture(file?: string) {
  const legacyKey = `${file ?? 'hub/test/old.test.ts'}::old`, expiringKey = `${file ?? 'hub/test/expiring.test.ts'}::expiring`;
  const legacy = { seconds: 6, owner: 'E-677', legacy: true as const, reason: 'Existing process lifecycle.' };
  const today = new Date(), expires = new Date(today);
  expires.setUTCDate(expires.getUTCDate() + 6);
  const manifest: DurationManifest = {
    version: 1, source: { artifacts: [], commit: 'base' },
    budget: { testSeconds: 5, fileSeconds: 60, T1: { testSeconds: 0.5, fileSeconds: 10, wallSeconds: 120 } },
    files: {}, tests: {}, allow: {
      [legacyKey]: legacy,
      [expiringKey]: { seconds: 6, owner: 'E-677', reason: 'Temporary process lifecycle.', added: today.toISOString().slice(0, 10), expires: expires.toISOString().slice(0, 10) },
    },
  };
  return { manifest, legacyKey, expiringKey, legacy };
}

export const durationOwner = '---\nid: E-677\nkind: epic\ntitle: Allowance owner\nstate: open\n---\n';
