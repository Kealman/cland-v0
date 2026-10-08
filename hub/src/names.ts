// Session names and the role names (GLOSSARY.md, "Sessions and roles").

export const NAME_RE = /^[a-z0-9][a-z0-9-]{0,23}$/;

/**
 * The roles a session can hold (spec 4.4). A role is a tag (`@reviewer`), so its name is never a session's.
 * Roles are hub-held state (ADR 0001): their definitions are in `.cland/roles.toml` (`src/roles/`).
 */
export const ROLE_NAMES: readonly string[] = ['coordinator', 'implementer', 'reviewer', 'qa'];

/** How a role is written next to a name. */
export const ROLE_LABELS: Readonly<Record<string, string>> = { coordinator: 'Coordinator', implementer: 'Implementer', reviewer: 'Reviewer', qa: 'QA' };

/** A session as it is shown everywhere: `rev-1 [Reviewer]`, or the bare name when it holds no role. */
export function withRole(name: string, role: string | null | undefined): string {
  return role ? `${name} [${ROLE_LABELS[role] ?? role}]` : name;
}

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
