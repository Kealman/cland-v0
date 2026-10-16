/** Structured verdict findings. Counts are always derived from the entries, never caller supplied. */
export const SEVERITIES = ['high', 'medium', 'low'] as const;
export type Severity = (typeof SEVERITIES)[number];
export type Finding = { severity: Severity; text: string; file?: string; line?: number };
export type FindingCounts = Record<Severity, number>;

export function parseFindings(value: unknown): Finding[] {
  if (!Array.isArray(value)) throw new Error('findings must be an array');
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') throw new Error('each finding must be { severity, text, file?, line? }');
    const f = entry as Record<string, unknown>;
    if (!(SEVERITIES as readonly unknown[]).includes(f.severity)) throw new Error('finding severity must be high, medium or low');
    if (typeof f.text !== 'string' || !f.text.trim()) throw new Error('finding text must be nonempty');
    if (f.file !== undefined && (typeof f.file !== 'string' || !f.file.trim() || /[\r\n]/.test(f.file))) throw new Error('finding file must be a nonempty single-line path');
    if (f.line !== undefined && (f.file === undefined || !Number.isSafeInteger(f.line) || Number(f.line) < 1)) throw new Error('finding line must be a positive integer with a file');
    return { severity: f.severity as Severity, text: f.text, ...(f.file !== undefined ? { file: f.file as string } : {}), ...(f.line !== undefined ? { line: f.line as number } : {}) };
  });
}

export function countFindings(findings: readonly Finding[]): FindingCounts {
  const counts: FindingCounts = { high: 0, medium: 0, low: 0 };
  for (const finding of findings) counts[finding.severity]++;
  return counts;
}

/** CLI suffixes are recognized only at the end, preserving colons and @ elsewhere in the text. */
export function parseFinding(raw: string): Finding {
  const match = /^(high|medium|low):([\s\S]*)$/.exec(raw);
  if (!match) throw new Error('--finding needs high|medium|low:text[@file:line]');
  const location = /@([^@\r\n]+):(\d+)$/.exec(match[2]!);
  return parseFindings([{ severity: match[1], text: location ? match[2]!.slice(0, location.index) : match[2], ...(location ? { file: location[1], line: Number(location[2]) } : {}) }])[0]!;
}
