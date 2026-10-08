// Session names and the role names (GLOSSARY.md, "Sessions and roles").

export const NAME_RE = /^[a-z0-9][a-z0-9-]{0,23}$/;

/**
 * The roles a session can run under. A role is a tag (`@reviewer`), so its name is never a session's.
 * TODO(#29): roles become hub-held state with clauses and permissions; today a session declares one in its hello.
 */
export const ROLE_NAMES: readonly string[] = ['coordinator', 'implementer', 'reviewer', 'qa'];

/** Names no session may take: the broadcast tag, the hub itself, and the roles. */
export const BUILTIN_RESERVED: ReadonlySet<string> = new Set(['all', 'hub', ...ROLE_NAMES]);

/** A refusal reason, or null when the name is acceptable. Live names are the caller's to check. */
export function nameRefusal(name: string, reserved: ReadonlySet<string> = new Set()): string | null {
  if (BUILTIN_RESERVED.has(name) || reserved.has(name)) return `name "${name}" is reserved`;
  if (!NAME_RE.test(name)) return `name "${name}" must match ${NAME_RE.source}: lowercase letters, digits and hyphens, 1–24 characters, starting with a letter or digit`;
  return null;
}

/** The prefix of a generated name. */
export const GENERATED_PREFIX = 'session';

/** `session-<n>` with the lowest free n ≥ 1. */
export function generatedName(taken: ReadonlySet<string>): string {
  for (let n = 1; ; n += 1) {
    const candidate = `${GENERATED_PREFIX}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
