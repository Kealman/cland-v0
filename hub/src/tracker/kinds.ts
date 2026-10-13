// Config defaults are the only fixed container names. Leaf kinds and maps stay outside the ladder.
export type Levels = readonly (string | readonly string[])[];
export const DEFAULT_LEVELS: Levels = [['release', 'category'], 'epic'];
export const LEAF_KINDS = ['task', 'question', 'spec'] as const;

/** One reader for hierarchy, release ownership and compatibility with flat clients. */
export class Ladder {
  readonly levels: readonly (readonly string[])[];
  readonly top: string | undefined;
  readonly planning: readonly string[];
  readonly containers: readonly string[];
  readonly roots: readonly string[];
  constructor(levels: Levels = DEFAULT_LEVELS) {
    this.levels = Object.freeze(configuredLevels(levels).map(level => Object.freeze(typeof level === 'string' ? [level] : [...level])));
    this.roots = this.levels[0] ?? [];
    this.top = this.roots[0];
    this.planning = this.levels[1] ?? [];
    this.containers = Object.freeze(this.levels.flat());
  }
  levelOf(kind: string): number { return this.levels.findIndex(level => level.includes(kind)); }
  canLead(kind: string): boolean { return kind === this.top || this.levelOf(kind) > 0; }
  get flat(): string[] { return this.levels.map(level => level[0]!); }
}
export type LadderInput = Levels | Ladder;
export const ladderOf = (levels: LadderInput): Ladder => levels instanceof Ladder ? levels : new Ladder(levels);
export const kindsFor = (levels: LadderInput): string[] => [...ladderOf(levels).containers, ...LEAF_KINDS, 'map'];

/** The second configured level owns epic planning and its QA demo, whatever its names. */
export const isPlanningContainer = (kind: string | undefined, levels: LadderInput): boolean =>
  kind !== undefined && ladderOf(levels).planning.includes(kind);

/** Human-readable item kind; configured names follow the same first-letter article rule. */
export const kindWithArticle = (kind: string): string => `${/^[aeiou]/i.test(kind) ? 'an' : 'a'} ${kind}`;

/** Invalid ladders must not replace the project's intended hierarchy with a different one. */
export function configuredLevels(value: unknown): (string | string[])[] {
  if (!Array.isArray(value) || !value.every(level => {
    const kinds = typeof level === 'string' ? [level] : level;
    return Array.isArray(kinds) && kinds.length > 0 && kinds.every(kind => typeof kind === 'string' && /^[a-z][a-z0-9_-]*$/.test(kind));
  })) throw new Error('[tracker] levels must be a list of kind names or nonempty lists of kind names (lowercase letters, digits, _ or -)');
  const kinds: string[] = value.flat();
  if (new Set(kinds).size !== kinds.length || kinds.some(kind => [...LEAF_KINDS, 'map'].includes(kind))) {
    throw new Error('[tracker] levels must be unique container names, excluding task, question, spec and map');
  }
  const prefixes = new Map<string, string>();
  for (const kind of kinds) {
    const prefix = kind[0]!.toUpperCase();
    const previous = prefixes.get(prefix);
    if (previous) throw new Error(`[tracker] kind prefixes must be unique: ${previous} and ${kind} both use ${prefix}`);
    prefixes.set(prefix, kind);
  }
  return value.map(level => typeof level === 'string' ? level : [...level]);
}
