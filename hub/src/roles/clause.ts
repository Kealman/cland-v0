// What the holder of a role reads when the hub delivers its clause (spec 4.4, ADR 0001): on assignment, on every
// reconnect, and when the role is revoked. The text is the hub message's; the `role` frame carries it beside the
// structured fields.
import { ROLE_LABELS, withRole } from '../names.ts';
import type { RoleDefinition } from './config.ts';

export function clauseText(name: string, role: string, definition: RoleDefinition | undefined): string {
  const label = ROLE_LABELS[role] ?? role;
  const lines = [`cland hub: you hold the role ${label} in this project, shown to others as ${withRole(name, role)}. This is your role clause; it stays in force until the hub tells you your role changed.`, ''];
  lines.push(definition?.clause || `(roles.toml gives the ${label} no clause.)`);
  if (definition?.skills.length) lines.push('', `Skills for this role: ${definition.skills.join(', ')}.`);
  return lines.join('\n');
}

export function revokedText(name: string, previous: string | null, reason: string): string {
  const label = previous ? (ROLE_LABELS[previous] ?? previous) : 'your role';
  return `cland hub: ${name} no longer holds the role ${label} (${reason}). Stop acting as ${label}: take no new work in it and send nothing on its behalf. Wait until the human assigns you a role again.`;
}
