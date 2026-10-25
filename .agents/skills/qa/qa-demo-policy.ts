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
  // Walk parsed metadata rather than re-serializing strings and hiding whitespace.
  if (value && typeof value === 'object') {
    for (const [key, detail] of Object.entries(value)) {
      assertPublishable(key);
      assertPublishable(detail);
    }
    return;
  }
  if (typeof value !== 'string') return;
  const text = value;
  // Check decoded URL/JSON spellings too. Never include matches in diagnostics.
  let decoded = text.replace(/\\u([0-9a-f]{4})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))).replace(/\\\//g, '/');
  decoded = decoded.replace(/\\[nrtf]/g, ' ');
  try { decoded = decodeURIComponent(decoded); } catch { /* Raw text is still scanned. */ }
  const patterns = [
    /(?:[?&#]|\b)(?:token|access_token|api_key)=[^\s&"'<>]+/i,
    /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/i,
    /\b(?:sk-(?:proj-|svcacct-|ant-)?[A-Za-z0-9_-]{16,}|dop_v1_[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,}|AIza[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16})\b/,
    /\b[A-Z][A-Z0-9_]*(?:TOKEN|API_KEY|SECRET_ACCESS_KEY)\b["']?\s*[:=]\s*["']?[^\s"',;}]+/i,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  ];
  if (patterns.some(pattern => pattern.test(text) || pattern.test(decoded))) throw new Error('secret scan refused publication');
}
