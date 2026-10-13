// What the holder of a role reads when the hub delivers its clause (spec 4.4, ADR 0001): on assignment, on every
// reconnect, and when the role is revoked. The text is the hub message's; the `role` frame carries it beside the
// structured fields.
import { ROLE_LABELS, withRole } from '../names.ts';
import type { RoleDefinition } from './config.ts';
import type { CrewConfig } from '../crew.ts';

export function staffingClause(role: string, crew: CrewConfig): string {
  const rule = crew.crew[role];
  if (!rule) return '';
  const lines = [rule.subagents
    ? 'You may delegate to sub-agents inside your harness. Their cost counts to your session; they report to you and never use your cland connection.'
    : 'Complete work inside this session. Sub-agent delegation is disabled for your role by crew.toml.'];
  if (role === 'coordinator') lines.push(crew.leads.length
    ? `Launch Leads for these container levels: ${crew.leads.join(', ')}. Give each Lead its open container as item; it owns staffing below that node.`
    : 'The crew is flat (leads = []): lead the project from the root.');
  if (role === 'coordinator') lines.push(crew.idle_categories.length
    ? `idle_from categories, in order: ${crew.idle_categories.map(item => `${item.id} ${item.title}`).join(', ')}.`
    : crew.idle_from.length ? 'idle_from has no open categories; category work is never taken.' : 'idle_from is empty; category work is never taken.');
  return lines.join('\n');
}

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
