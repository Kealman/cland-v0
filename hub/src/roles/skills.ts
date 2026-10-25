// The usable skill names in this project, including its own additions and linked skills.
import { readdir, stat } from 'node:fs/promises';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** A usable skill is a folder (or a link to one) holding a SKILL.md file. */
export function isSkill(path: string): boolean {
  try {
    return statSync(path).isDirectory() && statSync(join(path, 'SKILL.md')).isFile();
  } catch {
    return false;
  }
}

/** `isSkill` without blocking: the hub's off-request inventory refresh reads this way (T-1230). */
async function usableSkill(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory() && (await stat(join(path, 'SKILL.md'))).isFile();
  } catch {
    return false;
  }
}

/**
 * The diagnosis CLI reads the inventory synchronously. Serving paths must not: the hub keeps
 * `projectSkillsAsync`'s snapshot and reads it without I/O when it assembles a role clause (T-1230).
 */
export function projectSkills(root: string): ReadonlySet<string> {
  const directory = join(root, '.agents', 'skills');
  try {
    return new Set(readdirSync(directory).filter(name => isSkill(join(directory, name))));
  } catch {
    return new Set();
  }
}

/** The same inventory, off the request path: scan asynchronously, then publish the snapshot. */
export async function projectSkillsAsync(root: string): Promise<ReadonlySet<string>> {
  const directory = join(root, '.agents', 'skills');
  try {
    const names = await readdir(directory);
    const usable = await Promise.all(names.map(async name => (await usableSkill(join(directory, name))) ? name : null));
    return new Set(usable.filter((name): name is string => name !== null));
  } catch {
    return new Set();
  }
}
