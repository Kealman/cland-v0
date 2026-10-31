// T0 report only: inventory build guards without executing package commands.
import { glob, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildGuardFindings } from './build-guard-tiers.ts';

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Usage: node hub/test/lint-build-guard-tiers.ts\nReport-only inventory of build/prebuild/postbuild guard scripts and npm aliases versus verify tier entries and eager value imports. No commands execute; findings and incomplete inventory never change exit status. Script targets are conservative candidates; record non-guard reasons in the item. Computed shell commands require manual review.');
} else {
  try {
    const root = fileURLToPath(new URL('../../', import.meta.url));
    const files = new Map<string, string>();
    for await (const path of glob(['**/package.json', '**/*.{ts,tsx,js,mjs,cjs,sh,py}'], { cwd: root, exclude: ['**/node_modules/**', '**/.git/**', '**/.cland/**', '**/dist/**', '**/.astro/**'] })) {
      files.set(path, await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'));
    }
    const tiers = JSON.parse(await readFile(new URL('tiers.json', import.meta.url), 'utf8')) as { tests: Record<string, unknown> };
    const findings = buildGuardFindings(files, Object.keys(tiers.tests));
    console.log(`Build guard tiers (report only): ${findings.length ? findings.join('\n') : 'all discovered guards covered'}`);
  } catch (error) {
    console.log(`Build guard tiers (report only): incomplete: ${error instanceof Error ? error.message : String(error)}`);
  }
}
