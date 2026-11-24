import { assertNoPublicationSecrets } from './secret-scan-policy.ts';

// Pure publication policy shared by the demo recorder and its unit regressions.
export function validateDemoResult(value: unknown, code: number, expectedFacts: unknown = []): void {
  if (!value || typeof value !== 'object'
    || !('result' in value) || !['PASS', 'FAIL', 'INCONCLUSIVE', 'BLOCKED'].includes(String(value.result))
    || !('evidence' in value) || !Array.isArray(value.evidence)) throw new Error('invalid headless case result');
  if (!Array.isArray(expectedFacts) || expectedFacts.some(key => typeof key !== 'string' || !key)) throw new Error('invalid expected fact keys');
  const facts = 'facts' in value ? value.facts : undefined;
  if (expectedFacts.some(key => !facts || typeof facts !== 'object' || Array.isArray(facts)
    || !Object.hasOwn(facts, key) || (facts as Record<string, unknown>)[key] == null)) throw new Error('missing expected fact key');
  if (value.result === 'PASS') {
    if (stepError(value)) throw new Error('recorded step error');
    if (code !== 0) throw new Error('PASS with nonzero native exit');
  }
}

function stepError(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, detail]) => {
    if (['error', 'errors', 'stepErrors'].includes(key) && detail != null && detail !== false && detail !== ''
      && !(Array.isArray(detail) && detail.length === 0)) return true;
    return stepError(detail);
  });
}

export function assertPublishable(value: unknown): void {
  assertNoPublicationSecrets(value, 'qa-demo');
}
