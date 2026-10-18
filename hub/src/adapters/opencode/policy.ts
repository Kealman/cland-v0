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
  const mode = input.sandbox?.mode;
  if (input.permissions === 'skip') add('*', '*', 'allow');
  else {
    if (mode || input.approval === 'never') add('*', '*', 'allow');
    if (mode === 'read-only') add('edit', '*', 'deny');
    if (mode === 'workspace-write') {
      add('external_directory', '*', input.approval === 'on-request' || input.approval === 'untrusted' ? 'ask' : 'deny');
      for (const root of [input.cwd, ...input.sandbox!.writableRoots]) add('external_directory', `${resolve(root).replace(/\\/g, '/')}/*`, 'allow');
    }
    if (input.approval === 'untrusted') add('shell', '*', 'ask');
  }
  if (input.sandbox) {
    unsupported.push({ field: 'sandbox', reason: 'rules, not a sandbox; shell commands retain host authority' });
    unsupported.push({ field: 'network', reason: `OpenCode has no network isolation counterpart (${input.sandbox.network})` });
  }
  if (input.permissions === 'auto') unsupported.push({ field: 'permissions', reason: 'Claude Code auto permission mode has no OpenCode counterpart' });
  // D8 is stricter than skip and writable_roots. Internal paths are Location-relative;
  // canonical external paths are absolute. Deny parent-relative mutations too, because
  // paths elsewhere in the enclosing Git worktree can bypass external_directory.
  if (input.item) {
    const cwd = resolve(input.cwd).replace(/\\/g, '/');
    add('external_directory', '*', 'deny');
    add('external_directory', `${cwd}/*`, 'allow');
    if (mode !== 'read-only' || input.permissions === 'skip') {
      add('edit', '/*', 'deny');
      add('edit', '?:/*', 'deny');
      add('edit', '..', 'deny');
      add('edit', '../*', 'deny');
      add('edit', `${cwd}/*`, 'allow');
    }
    unsupported.push({ field: 'item', reason: 'Code Mode worktree_create and session_move request no permission; moves are watched' });
  }
  return { rules, unsupported };
}
