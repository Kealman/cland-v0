// Static verification policy shared by offline QA lint and runtime admission.
// Keep this module independent of hub transport, executor and credential code.

// Operational verification occasions are independent of configured tracker container kinds.
export const VERIFY_OCCASIONS = { batch: 'batch', stage: 'stage', epic: 'epic', release: 'release', soak: 'soak', 'dev-t3': 'dev-t3' } as const;
export type VerifyOccasion = typeof VERIFY_OCCASIONS[keyof typeof VERIFY_OCCASIONS];
export function isVerifyOccasion(value: unknown): value is VerifyOccasion {
  return Object.values(VERIFY_OCCASIONS).some(occasion => occasion === value);
}

/** CLI and MCP use the same role rule for integrated verification occasions. */
export function authorizeVerifyOccasion(role: string | null | undefined, occasion: VerifyOccasion): void {
  if (occasion === 'batch' || occasion === 'dev-t3') throw new Error(`${occasion} occasion is hub-owned`);
  if (role !== 'coordinator' && !(role === 'qa' && occasion === VERIFY_OCCASIONS.epic)) {
    throw new Error('occasion requires the Coordinator, or QA with occasion epic');
  }
}

export class VerifyAllReserved extends Error {}

/** Undefined role means the human shell; null means a session with no role. */
export function authorizeVerifyMode(role: string | null | undefined, mode: string, occasion?: VerifyOccasion): void {
  if (mode === 'all' && role !== undefined && role !== 'coordinator' && !occasion) throw new VerifyAllReserved();
  if (occasion) authorizeVerifyOccasion(role, occasion);
}
