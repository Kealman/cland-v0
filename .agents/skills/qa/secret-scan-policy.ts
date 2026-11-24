// Pure scanner shipped with the QA kit; no native imports.
export type SecretScanProfile = 'qa-demo' | 'capture';

export function assertNoPublicationSecrets(value: unknown, profile: SecretScanProfile, secret?: string): void {
  scanPublication(value, false, profile, secret);
}

function scanPublication(value: unknown, authorization: boolean, profile: SecretScanProfile, secret?: string): void {
  // Walk parsed metadata rather than re-serializing strings and hiding whitespace.
  if (value && typeof value === 'object') {
    // Header entry pairs carry the same context as named object properties.
    const entryAuthorization = Array.isArray(value) && value.length === 2
      && typeof value[0] === 'string' && /^Authorization$/i.test(value[0]);
    for (const [key, detail] of Object.entries(value)) {
      scanPublication(key, authorization, profile, secret);
      // Keep header context through arrays and nested metadata, not only scalars.
      scanPublication(detail, authorization || /^Authorization$/i.test(key)
        || (entryAuthorization && key === '1'), profile, secret);
    }
    return;
  }
  if (typeof value !== 'string') return;
  const text = authorization ? `Authorization: ${value}` : value;
  // Check decoded URL/JSON spellings too. Never include matches in diagnostics.
  let decoded = value;
  try { decoded = decodeURIComponent(decoded); } catch { /* Raw text is still scanned. */ }
  // Complete JSON captures use the same contextual walk as parsed metadata.
  // Parse before flattening escapes, which could otherwise invalidate JSON.
  let parsed: unknown;
  try { parsed = JSON.parse(decoded); } catch { /* Plain text uses the patterns below. */ }
  if (parsed !== null && (typeof parsed === 'object' || typeof parsed === 'string')) scanPublication(parsed, authorization, profile, secret);
  decoded = decoded.replace(/\\+u([0-9a-f]{4})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))).replace(/\\+\//g, '/');
  decoded = decoded.replace(/\\+[nrtf]/g, ' ').replace(/\\+"/g, '"');
  if (authorization) decoded = `Authorization: ${decoded}`;
  const patterns = [
    /(?:token|api[_-]?key)\s*[=:]\s*\S+|\/Users\/|\/home\/|auth\?token=/i,
    ...(profile === 'capture' ? [/Bearer\s+\S+/i] : []),
    // Headers supply credential context even for short values; standalone prose
    // needs a token-like run of at least 16 characters (padding excluded).
    /\bAuthorization["']?\s*:\s*["']?\s*Bearer\s+[A-Za-z0-9._~+\/-]+=*/i,
    /\bBearer\s+[A-Za-z0-9._~+\/-]{16,}=*/i,
    /(?:[?&#]|\b)(?:token|access_token|api_key)=[^\s&"'<>]+/i,
    /\b(?:sk-(?:proj-|svcacct-|ant-)?[A-Za-z0-9_-]{16,}|dop_v1_[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,}|AIza[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16})\b/,
    /\b[A-Z][A-Z0-9_]*(?:TOKEN|API_KEY|SECRET_ACCESS_KEY)\b["']?\s*[:=]\s*["']?[^\s"',;}]+/i,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  ];
  if ((secret !== undefined && (text.includes(secret) || decoded.includes(secret)))
    || patterns.some(pattern => pattern.test(text) || pattern.test(decoded))) throw new Error('secret scan refused publication');
}

