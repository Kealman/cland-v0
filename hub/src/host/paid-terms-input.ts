/** Wire validation stays independent of pool configuration and effect owners. */
export type ExpectedPaidTerms = { pool: Record<string, unknown>; builder?: { prepare_size: string; regions: string[]; image: string } };
export function isExpectedPaidTerms(value: unknown): value is ExpectedPaidTerms {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (!v.pool || typeof v.pool !== 'object' || Array.isArray(v.pool)) return false;
  if (v.builder === undefined) return true;
  if (!v.builder || typeof v.builder !== 'object' || Array.isArray(v.builder)) return false;
  const b = v.builder as Record<string, unknown>;
  return typeof b.prepare_size === 'string' && typeof b.image === 'string' && Array.isArray(b.regions) && b.regions.every(r => typeof r === 'string');
}
