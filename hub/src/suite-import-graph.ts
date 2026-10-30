import { ImportGraphError } from './suite-import-errors.ts';
import { externalModuleProof } from './suite-import-externals.ts';
import { readFile, stat } from 'node:fs/promises';
import { dirname, posix, resolve } from 'node:path';
import { graphImports } from './suite-import-parser.ts';

/** Relative runtime dependencies, including helpers and re-exports. Caller owns the checkout. */
export async function importingTests(cwd: string, changedPaths: readonly string[], testFiles: readonly string[], onUnknown?: (test: string, error: unknown) => void): Promise<string[]> {
  return importingTestsFromSource(changedPaths, testFiles, async file => {
    const path = resolve(cwd, file);
    const info = await stat(path).catch(error => { if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return undefined; throw error; });
    if (!info?.isFile()) return undefined;
    if (info.size > 2 * 1024 * 1024) throw new Error(`import graph source too large: ${file}`);
    return readFile(path, 'utf8');
  }, onUnknown);
}

/** Immutable-object readers return undefined only for absent files; incomplete scans throw. */
export async function importingTestsFromSource(changedPaths: readonly string[], testFiles: readonly string[], readSource: (path: string) => Promise<string | undefined>, onUnknown?: (test: string, error: unknown) => void): Promise<string[]> {
  const changed = new Set(changedPaths);
  const sources = new Map<string, Promise<string | undefined>>();
  const dependencies = new Map<string, Promise<string[]>>();
  let work = 0, bytes = 0;
  const read = (path: string) => {
    let pending = sources.get(path);
    if (!pending) {
      pending = (async () => {
        if (++work > 20_000) throw new ImportGraphError('source read budget exceeded', 'scan');
        const source = await readSource(path);
        const size = Buffer.byteLength(source ?? '');
        bytes += size;
        if (size > 2 * 1024 * 1024) throw new ImportGraphError('import graph byte budget exceeded');
        if (bytes > 32 * 1024 * 1024) throw new ImportGraphError('import graph byte budget exceeded', 'scan');
        return source;
      })();
      sources.set(path, pending);
    }
    return pending;
  };
  const external = externalModuleProof(read);
  const imports = (file: string): Promise<string[]> => {
    let pending = dependencies.get(file);
    if (!pending) {
      pending = (async () => {
        if (!/\.[cm]?[jt]sx?$/.test(file)) throw new Error('incomplete import graph: unsupported source extension');
        const source = await read(file);
        if (source === undefined) throw new Error(`missing import source: ${file}`);
        const result: string[] = [];
        for (const { specifier, base, resolveOnly } of await graphImports(source, file)) {
          const importer = base ?? file;
          if (resolveOnly) {
            if (await external(importer, specifier, true)) continue;
            throw new Error(`incomplete import graph: escaping require binding [${file}]`);
          }
          if (!specifier.startsWith('.')) {
            if (await external(importer, specifier)) continue;
            throw new Error(`incomplete import graph: unresolved module specifier ${specifier}`);
          }
          const path = posix.normalize(posix.join(dirname(importer), specifier));
          if (path.startsWith('../') || posix.isAbsolute(path)) throw new Error('import outside candidate');
          const candidates = [path, `${path}.ts`, `${path}.tsx`, `${path}/index.ts`, `${path}/index.tsx`];
          let found: string | undefined;
          for (const candidate of candidates) if (await read(candidate) !== undefined) { found = candidate; break; }
          if (!found) throw new Error(`unresolved relative import: ${path}`);
          result.push(found);
        }
        return result;
      })();
      dependencies.set(file, pending);
    }
    return pending;
  };
  const selected: string[] = [];
  for (const test of testFiles) {
    try {
      let edges = 0;
      const seen = new Set<string>();
      const queue = [test];
      while (queue.length) {
        if (++edges > 200_000) throw new Error('import graph traversal budget exceeded');
        const file = queue.pop()!;
        if (seen.has(file)) continue;
        seen.add(file);
        if (changed.has(file)) { selected.push(test); break; }
        queue.push(...await imports(file));
      }
    } catch (error) { if (!onUnknown || error instanceof ImportGraphError && error.scope === 'scan') throw error; onUnknown(test, error); }
  }
  return [...new Set(selected)].sort();
}
