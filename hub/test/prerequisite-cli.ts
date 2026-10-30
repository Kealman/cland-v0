// Load every command runtime closure from a production-shaped copy; no test cases.
import { cp, mkdtemp, readdir, readFile, realpath, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';
import { importEdges } from './import-edges.ts';
import { cliSmokeOwner } from './prerequisite-process.ts';

export async function cliInstallFindings(source: URL, defect?: string): Promise<string[]> {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'cland-install-imports-'));
  const owner = cliSmokeOwner(root);
  try {
    const { findings } = await owner.prepare(async () => {
      for (const path of ['hub/src', 'hub/test/process-cleanup.ts', 'test-support', 'nvim/bin', 'nvim/NVIM_VERSION', 'shared', 'package.json', 'hub/package.json']) {
        await cp(new URL(path, source), join(root, path), { recursive: true, filter: path => !path.endsWith('.test.ts') });
      }
      // Runtime packages are reused read-only; the loader rejects undeclared dev packages.
      await symlink(fileURLToPath(new URL('node_modules', source)), join(root, 'node_modules'));
      if (defect) await writeFile(join(root, 'hub/src/cli/planted.ts'), defect);
      const modules = (await readdir(join(root, 'hub/src/cli'))).filter(name => name.endsWith('.ts'));
      const imports = new Set<string>();
      const findings: string[] = [];
      const requires: Array<{ importer: string; specifier: string }> = [];
      async function closure(path: string): Promise<void> {
        if (imports.has(path)) return;
        imports.add(path);
        let source: string;
        try { source = await readFile(path, 'utf8'); } catch { return; }
        if (!/\.[cm]?[tj]s$/.test(path)) return;
        const parsed = importEdges(path, stripTypeScriptTypes(source));
        findings.push(...parsed.findings);
        for (const {specifier: name, kind} of parsed.edges) {
          if (kind === 'require') requires.push({ importer: path, specifier: name });
          if (name.startsWith('.')) await closure(resolve(dirname(path), name));
          else imports.add(name);
        }
      }
      for (const name of modules) await closure(join(root, 'hub/src/cli', name));
      const script = `
        import { registerHooks, isBuiltin, createRequire } from 'node:module';
        import { readFileSync } from 'node:fs';
        const pkg = JSON.parse(readFileSync('./hub/package.json', 'utf8'));
        const allowed = new Set(Object.keys(pkg.dependencies));
        registerHooks({resolve(specifier, context, next) {
          if (context.parentURL?.startsWith(${JSON.stringify(`file://${root}/`)}) && !specifier.startsWith('/') && !specifier.startsWith('.') && !specifier.startsWith('file:') && !isBuiltin(specifier)) {
            const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
            if (!allowed.has(name)) throw new Error('not an installed runtime dependency: ' + specifier);
          }
          return next(specifier, context);
        }});
        process.send({type: 'smoke-ready'});
        process.disconnect();
        let failed = false;
        for (const name of ${JSON.stringify([...imports])}) {
          try { await import(name); }
          catch (error) { failed = true; console.error(name + ': ' + error.message); }
        }
        for (const edge of ${JSON.stringify(requires)}) {
          try { createRequire(edge.importer)(edge.specifier); }
          catch (error) { failed = true; console.error(edge.importer + ': ' + error.message); }
        }
        process.exitCode = failed ? 1 : 0;
      `;
      await writeFile(join(root, 'smoke.mjs'), script);
      return { findings };
    });
    const result = await owner.run(['smoke.mjs']);
    if (result.incomplete || result.code !== 0 || result.signal) findings.push(`CLI install imports incomplete (exit ${result.code}; signal ${result.signal}; ${result.incomplete ?? 'native failure'}): ${result.tail}`);
    return findings;
  } finally { await owner.remove(); }
}
