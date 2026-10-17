import { VERIFY_OCCASIONS, type VerifyOccasion } from './protocol.ts';

/** CLI and MCP use the same role rule for integrated verification occasions. */
export function authorizeVerifyOccasion(role: string | null | undefined, occasion: VerifyOccasion): void {
  if (role !== 'coordinator' && !(role === 'qa' && occasion === VERIFY_OCCASIONS.epic)) {
    throw new Error('occasion requires the Coordinator, or QA with occasion epic');
  }
}
