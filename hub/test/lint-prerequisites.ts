// T0: new prerequisite guards report findings without feeding the exit status.
import { glob, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { siteImportFindings } from './prerequisite-guards.ts';
import { cliInstallFindings } from './prerequisite-cli.ts';

if (process.argv.includes('--help')) {
  console.log('Usage: node hub/test/lint-prerequisites.ts\nReport-only install-shaped CLI runtime imports and transitive site dependency boundary. Findings do not fail checks. Web bundle/dependency readiness reports at runner and probe entry.');
} else {
 try {
  const root = new URL('../../', import.meta.url);
  const files = new Map<string, string>();
  for (const area of ['site/test', 'site/src', 'hub/src', 'shared']) {
    for await (const path of glob(`${area}/**/*.{ts,tsx,js,mjs}`, { cwd: root })) files.set(resolve(fileURLToPath(root), path), await readFile(new URL(path, root), 'utf8'));
  }
  const pkg = JSON.parse(await readFile(new URL('site/package.json', root), 'utf8')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const entries = [...files.keys()].filter(path => path.includes('/site/test/'));
  const site = siteImportFindings(entries, files, new Set([...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]));
  console.log(`Site import boundary (report only): ${site.length ? site.join('\n') : `${entries.length} entries clear`}`);
  const cli = await cliInstallFindings(root);
  console.log(`CLI install imports (report only): ${cli.length ? cli.join('\n') : 'all command modules clear'}`);
  if (cli.some(line => line.includes('not an installed runtime dependency: typescript'))) console.log('CLI install baseline: known finding T-1484; installed verify duration-identity parser requires dev-only TypeScript; generic projects without hub/test/durations.json avoid this path');
 } catch (error) { console.log(`Prerequisite guards (report only): incomplete: ${error instanceof Error ? error.message : String(error)}`); }
}
