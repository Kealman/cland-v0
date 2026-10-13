import { DEFAULT_LEVELS, kindsFor } from './kinds.ts';

/** Kind prefixes share one numeric identity space. Configured kinds use the same rule. */
export const prefixOf = (kind: string): string => kind[0]!.toUpperCase();

const ITEM_KINDS = [...kindsFor(DEFAULT_LEVELS), 'category'];

/** Bare numbers have no prefix; unrelated references such as A-12 are refused. */
export function parseItemReference(raw: string, kinds: readonly string[] = ITEM_KINDS): { prefix: string | null; n: number } | null {
  const match = /^(?:([a-z])-)?(\d+)$/i.exec(raw.trim());
  if (!match) return null;
  const prefix = match[1]?.toUpperCase() ?? null;
  const n = Number(match[2]);
  if (!Number.isSafeInteger(n) || n < 1 || prefix !== null && !kinds.some(kind => prefixOf(kind) === prefix)) return null;
  return { prefix, n };
}
