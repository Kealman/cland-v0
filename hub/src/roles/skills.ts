// The usable skill names in this project, including its own additions and linked skills.
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

export function projectSkills(root: string): ReadonlySet<string> {
  const directory = join(root, '.agents', 'skills');
  try {
    return new Set(readdirSync(directory).filter(name => isSkill(join(directory, name))));
  } catch {
    return new Set();
  }
}
