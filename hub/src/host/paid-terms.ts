import type { ProjectConfig } from '../init/config.ts';
import { hostPoolsDocument } from './pools.ts';

import type { ExpectedPaidTerms } from './paid-terms-input.ts';
export { isExpectedPaidTerms } from './paid-terms-input.ts';
export type { ExpectedPaidTerms } from './paid-terms-input.ts';
export function paidTerms(config: ProjectConfig, pool: string, builder = false): ExpectedPaidTerms {
  const d = config.verification.droplet;
  return { pool: hostPoolsDocument(config.hosts)[pool] as Record<string, unknown>, ...(builder ? { builder: { prepare_size: d.prepare_size, regions: d.regions, image: d.image } } : {}) };
}
const sorted = (value: unknown): unknown => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, sorted(v)])) : value;
const canonical = (value: unknown): string | undefined => JSON.stringify(sorted(value));
export function assertPaidTerms(expected: ExpectedPaidTerms | undefined, current: ExpectedPaidTerms): void {
  if (expected && canonical(expected) !== canonical(current)) throw Error(`paid terms changed; current terms: ${JSON.stringify(current)}`);
}
