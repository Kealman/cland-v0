/** Shared remote/speech diagnostic boundary. Register exact secrets before use. */
export function remoteRedactor(secrets: readonly string[] = []): (text: string) => string {
  const values = [...new Set(secrets.filter(value => value.length > 0))].sort((a, b) => b.length - a.length);
  // Match whole credential contexts before exact values at the same position.
  // One replacement prevents registered values from changing inserted markers
  // or hiding a URL/Bearer prefix from a later scrub. Case-insensitive matching
  // is deliberately conservative for both labels and registered values.
  const pattern = new RegExp([
    String.raw`\b[a-z][a-z0-9+.-]*:\/\/\S+`,
    String.raw`\bbearer\s+\S+`,
    String.raw`\b(?:[a-z_]*token|[a-z_]*key|secret|authorization)\s*[:=]\s*(?:"[^"]*"|'[^']*'|\S+)`,
    ...values.map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  ].join('|'), 'gi');
  return text => {
    return text.replace(pattern, '[redacted]')
      .replace(/[\x00-\x1f\x7f\u2028\u2029]+/g, ' ')
      .slice(0, 500);
  };
}
