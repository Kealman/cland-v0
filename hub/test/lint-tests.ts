import { fileURLToPath } from 'node:url';
import { lintTests, testLintReport } from '../src/test-lint.ts';
import { testLintPolicy, lintRefusalLines, shrinkTestLint } from '../src/test-lint-policy.ts';

const args = process.argv.slice(2);
const details = args.includes('--details');
const cwd = args.find(arg => !['--shrink', '--details'].includes(arg)) ?? fileURLToPath(new URL('../../', import.meta.url));
if (args.includes('--shrink')) await shrinkTestLint(cwd);
for (const line of testLintReport(await lintTests(cwd), { detailedReachable: true, summaryOnly: !details })) console.log(line);
const findings = await testLintPolicy(cwd);
console.log(`test lint refusals: ${findings.length}`);
for (const line of lintRefusalLines(findings)) console.log(line);
if (!details) console.log('test lint detail: npm run test:lint -- --details');
if (findings.length) process.exitCode = 1;
