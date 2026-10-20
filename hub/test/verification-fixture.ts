import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type FixtureStack = { prepare?: string } & ({ stack?: 'cland' } | { stack: 'other'; check: string; test: string });

/** Write candidate files before the caller commits them; return its verification table lines. */
export async function verificationFixture(root: string, options: FixtureStack & {
  typecheck?: string;
  testScript?: string;
  packageFields?: Record<string, unknown>;
} = {}): Promise<string> {
  const prepare = `prepare = ${JSON.stringify(options.prepare ?? '')}\n`;
  if (options.stack === 'other') return prepare + `check = ${JSON.stringify(options.check)}\ntest = ${JSON.stringify(options.test)}\n`;
  await writeFile(join(root, 'package.json'), JSON.stringify({ ...options.packageFields, scripts: {
    typecheck: options.typecheck ?? 'node -e "process.exit(0)"',
    test: options.testScript ?? 'node -e "process.exit(0)"',
  } }));
  await mkdir(join(root, 'hub/test'), { recursive: true });
  // Preserve the missing runner's lease/coverage probe decisions. Scripts run the
  // fixture's commands directly; this marker is not an executable package runner.
  await writeFile(join(root, 'hub/test/run-suite.ts'), '// Fixture runner supports inheritedLease.\n');
  return prepare + 'check = "npm run typecheck"\ntest = "npm test"\n';
}
