/** Ownership only: delivery eligibility and transport role admission remain separate. */
export function ownsHumanMessage(message: { fromKind: string; from: string; userId?: string; legacyUser?: boolean }, viewer: { id: string; role: string } | null): boolean {
  if (message.fromKind !== 'human') return false;
  if (!viewer) return message.from === 'human';
  if (message.legacyUser || !message.userId) return viewer.role === 'admin';
  return message.userId === viewer.id;
}
