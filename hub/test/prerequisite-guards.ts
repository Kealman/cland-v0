// Report-only dependency guards; tests assert findings independently of rollout policy.
import { importEdges } from './import-edges.ts';
import { isBuiltin } from 'node:module';
import { dirname, resolve } from 'node:path';

export function siteImportFindings(entries: string[], files: Map<string, string>, allowed: Set<string>): string[] {
  const findings: string[] = [];
  const seen = new Set<string>();
  function visit(file: string): void {
    if (seen.has(file)) return;
    seen.add(file);
    const text = files.get(file);
    if (text === undefined) { findings.push(`${file}: missing local dependency`); return; }
    const parsed = importEdges(file, text);
    findings.push(...parsed.findings);
    for (const {specifier, line} of parsed.edges) {
      if (isBuiltin(specifier)) continue;
      if (specifier.startsWith('.')) {
        const target = resolve(dirname(file), specifier);
        const found = [target, `${target}.ts`, `${target}.js`, `${target}/index.ts`].find(path => files.has(path));
        if (found) visit(found); else findings.push(`${file}:${line}: missing dependency ${specifier}`);
      } else {
        const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]!;
        if (!allowed.has(name)) findings.push(`${file}:${line}: ${specifier} is not a site dependency`);
      }
    }
  }
  entries.forEach(visit);
  return findings;
}
