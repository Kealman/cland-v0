// Deterministic source guard; fixtures exercise every rejected colour form before the tree scan.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export function colourViolations(path: string, source: string): string[] {
  if (path === 'tokens.css') return [];
  const colour = /#[\da-f]{3,8}\b|\b(?:rgba?|hsla?)\s*\(/i;
  return source.split('\n').flatMap((line, index) => colour.test(line) ? [`${path}:${index + 1}: use var(--token); colour values belong in tokens.css`] : []);
}

export async function checkColours(root: string): Promise<string[]> {
  const out: string[] = [];
  async function visit(dir: string): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) out.push(...colourViolations(relative(root, path), await readFile(path, 'utf8')));
    }
  }
  await visit(root);
  return out;
}

for (const fixture of ['#fff', '#ABCDEF', '#11223344', 'rgb(1 2 3)', 'rgba(1, 2, 3, .5)', 'hsl(0 0% 0%)', 'HSLA (0, 0%, 0%, 1)']) {
  assert.equal(colourViolations('nested/Component.tsx', `const colour = '${fixture}';`).length, 1, fixture);
  assert.equal(colourViolations('nested/styles.css', `a { color: ${fixture}; }`).length, 1, fixture);
  assert.equal(colourViolations('tokens.css', fixture).length, 0);
}
assert.equal(colourViolations('nested/tokens.css', '#fff').length, 1, 'only the root tokens file is exempt');
assert.equal(colourViolations('Shell.module.css', 'a { color: var(--text); }').length, 0);
const failures = await checkColours(fileURLToPath(new URL('./src/', import.meta.url)));
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log('web colours: token-only sources; colour fixtures passed');
