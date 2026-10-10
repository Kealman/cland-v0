// Config defaults are the only fixed container names. Leaf kinds and maps stay outside the ladder.
export const DEFAULT_LEVELS: readonly string[] = ['release', 'epic'];
export const LEAF_KINDS = ['task', 'question', 'spec'] as const;
export const kindsFor = (levels: readonly string[]): string[] => [...levels, ...LEAF_KINDS, 'map'];

/** The second configured level owns epic planning and its QA demo, whatever its name. */
export const isPlanningContainer = (kind: string | undefined, levels: readonly string[]): boolean =>
  kind !== undefined && kind === levels[1];

/** Human-readable item kind; configured names follow the same first-letter article rule. */
export const kindWithArticle = (kind: string): string => `${/^[aeiou]/i.test(kind) ? 'an' : 'a'} ${kind}`;

/** Invalid ladders must not replace the project's intended hierarchy with a different one. */
export function configuredLevels(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every(v => typeof v === 'string' && /^[a-z][a-z0-9_-]*$/.test(v))) {
    throw new Error('[tracker] levels must be a list of kind names (lowercase letters, digits, _ or -)');
  }
  if (new Set(value).size !== value.length || value.some(v => kindsFor([]).includes(v))) {
    throw new Error('[tracker] levels must be unique container names, excluding task, question, spec and map');
  }
  return [...value];
}
