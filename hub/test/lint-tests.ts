import { fileURLToPath } from 'node:url';
import { lintTests, testLintReport } from '../src/test-lint.ts';
import { testLintPolicy, lintRefusalLines, shrinkTestLint } from '../src/test-lint-policy.ts';

const args = process.argv.slice(2);
const cwd = args.find(arg => arg !== '--shrink') ?? fileURLToPath(new URL('../../', import.meta.url));
if (args.includes('--shrink')) await shrinkTestLint(cwd);
for (const line of testLintReport(await lintTests(cwd), { detailedReachable: true })) console.log(line);
const findings = await testLintPolicy(cwd);
for (const line of lintRefusalLines(findings)) console.log(line);
if (findings.length) process.exitCode = 1;
