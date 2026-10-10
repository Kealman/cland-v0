// The address grammar: tags anywhere in a text.
//   @<name>    one session        @all      every session the hub knows
//   @<glob>    `*` over names     @<role>   the sessions holding that role
//   @lead T-n the claimant of an open item, or the Coordinator
// A tag is a token, not a mention: `@server-1,` and `(@rate-*)` both tag. Resolution is the hub's
// (it knows who is connected and who holds which role); this module only finds and classifies.

const TAG_RE = /(?<![A-Za-z0-9_.])@(lead\s+T-[1-9]\d*(?![A-Za-z0-9_-])|[A-Za-z0-9][A-Za-z0-9._*-]*)/g;

/** Every distinct tag in the text, in order of first appearance, without the `@`. */
export function parseTags(text: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const match of text.matchAll(TAG_RE)) {
    const tag = (match[1] as string).replace(/[.]+$/, '').replace(/\s+/g, ' '); // a sentence-final dot is punctuation
    if (tag.length === 0 || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

/** Turn a `*` glob into a matcher over session names. */
export function globMatcher(glob: string): (name: string) => boolean {
  const source = glob
    .split('*')
    .map((part) => part.replace(/[.+^${}()|[\]\\]/g, '\\$&'))
    .join('[a-z0-9-]*');
  const re = new RegExp(`^${source}$`);
  return (name) => re.test(name);
}

export type Resolved =
  | { kind: 'all' }
  | { kind: 'session'; name: string; online: boolean }
  | { kind: 'glob'; glob: string; names: string[] }
  /** A role: the sessions holding it, as the hub knows them — possibly none. */
  | { kind: 'role'; role: string; names: string[] }
  | { kind: 'unknown'; tag: string };

export type ResolveContext = {
  connected: Iterable<string>;
  /** Sessions the hub has seen before, connected or not — an offline one is a queue target. */
  known?: Iterable<string>;
  /** Every role name, held or not, with the sessions holding it; a role's name is never a session's. */
  roles?: ReadonlyMap<string, readonly string[]>;
};

export function resolveTag(tag: string, ctx: ResolveContext): Resolved {
  const t = tag.replace(/^@/, '');
  if (t.toLowerCase() === 'all' || t === '*') return { kind: 'all' };
  const role = ctx.roles?.get(t);
  if (role) return { kind: 'role', role: t, names: [...role] };
  const connected = new Set(ctx.connected);
  const known = new Set([...connected, ...(ctx.known ?? [])]);
  if (t.includes('*')) {
    const matches = globMatcher(t.toLowerCase());
    return { kind: 'glob', glob: t, names: [...known].filter(matches) };
  }
  if (known.has(t)) return { kind: 'session', name: t, online: connected.has(t) };
  return { kind: 'unknown', tag: t };
}
