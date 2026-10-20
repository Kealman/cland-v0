// OpenCode V2 rules are ordered, last match wins. They are rules, not a sandbox:
// shell commands retain the host user's authority and Code Mode can move a session.
import { resolve } from 'node:path';
import type { LaunchPolicy } from '../contract.ts';
import type { PermissionRule } from './client.ts';

type PolicyInput = LaunchPolicy & { cwd: string; item?: string | null };
export function sessionPolicy(input: PolicyInput): { rules: PermissionRule[]; unsupported: Array<{ field: string; reason: string }> } {
  const rules: PermissionRule[] = [];
  const unsupported: Array<{ field: string; reason: string }> = [];
  const add = (action: string, resource: string, effect: PermissionRule['effect']) => rules.push({ action, resource, effect });
  if (input.approval) unsupported.push({ field: 'approval', reason: "OpenCode ignores approval; OpenCode's own configuration governs" });
  if (input.sandbox) {
    unsupported.push({ field: 'sandbox', reason: "OpenCode ignores sandbox; OpenCode's own configuration governs" });
    unsupported.push({ field: 'network', reason: `OpenCode has no network isolation counterpart (${input.sandbox.network})` });
  }
  if (input.permissions) unsupported.push({ field: 'permissions', reason: "OpenCode ignores permissions; OpenCode's own configuration governs" });
  // D8 confines item sessions independently of launch policy. Internal paths are Location-relative;
  // canonical external paths are absolute. Deny parent-relative mutations too, because
  // paths elsewhere in the enclosing Git worktree can bypass external_directory.
  if (input.item) {
    const cwd = resolve(input.cwd).replace(/\\/g, '/');
    add('external_directory', '*', 'deny');
    add('external_directory', `${cwd}/*`, 'allow');
    add('edit', '/*', 'deny');
    add('edit', '?:/*', 'deny');
    add('edit', '..', 'deny');
    add('edit', '../*', 'deny');
    add('edit', `${cwd}/*`, 'allow');
    unsupported.push({ field: 'item', reason: 'Code Mode worktree_create and session_move request no permission; moves are watched' });
  }
  return { rules, unsupported };
}
