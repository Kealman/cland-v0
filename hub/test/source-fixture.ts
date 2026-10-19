// Copy carriers need whole modules, including type-only and lazy imports. Unlike
// test-lint's export slices, no declaration in a copied source can be omitted.
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
import { join, posix } from 'node:path';

export type FixtureSource = (file: string) => Promise<string | undefined>;

export function fixtureSource(root: string): FixtureSource {
  return async file => {
    try { return await readFile(join(root, file), 'utf8'); }
    catch (error) {
      if (['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code ?? '')) return undefined;
      throw error;
    }
  };
}

/** Relative import closure plus explicit files loaded outside the module graph.
 * The reader may represent a checkout, an immutable Git tree, or a planted source.
 * Bare imports belong to the carrier's dependency install, never its copy set.
 */
export async function sourceFixtureFiles(read: FixtureSource, entries: readonly string[], assets: readonly string[]): Promise<string[]> {
  const extensions = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
  const sources = new Map<string, string | undefined>();
  const load = async (file: string) => {
    if (!sources.has(file)) sources.set(file, await read(file));
    return sources.get(file);
  };
  const inside = (file: string) => {
    if (posix.isAbsolute(file) || file === '..' || file.startsWith('../')) throw new Error(`fixture path escapes source root: ${file}`);
    return file;
  };
  const queue = entries.map(file => inside(posix.normalize(file)));
  const seen = new Set<string>();
  for (let i = 0; i < queue.length; i++) {
    const file = queue[i]!;
    if (seen.has(file)) continue;
    seen.add(file);
    const text = await load(file);
    if (text === undefined) throw new Error(`fixture source missing: ${file}`);
    for (const { fileName: specifier } of ts.preProcessFile(text, true, true).importedFiles) {
      if (!specifier.startsWith('.')) continue;
      const path = inside(posix.join(posix.dirname(file), specifier));
      // Match test-lint's relative-file and index resolution; explicit extensions
      // also retain imported JSON and declaration files needed by the compiler.
      const candidates = posix.extname(path) ? [path]
        : extensions.map(extension => path + extension).concat(extensions.map(extension => posix.join(path, 'index' + extension)));
      let dependency: string | undefined;
      for (const candidate of candidates) if (await load(candidate) !== undefined) { dependency = candidate; break; }
      if (!dependency) throw new Error(`fixture import missing: ${file} -> ${specifier}`);
      queue.push(dependency);
    }
  }
  return [...new Set([...seen, ...assets.map(file => inside(posix.normalize(file)))])].sort();
}
