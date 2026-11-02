/** Shared placement policy for launch and role assignment. Legacy rows are local. */
export function checkRoleHost(role: string | null | undefined, host = 'local'): void {
  if (host !== 'local' && (role === 'coordinator' || role === 'aide'))
    throw new Error('Coordinator and Aide roles run only on the local host');
}
