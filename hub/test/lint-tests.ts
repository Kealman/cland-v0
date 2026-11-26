import { fileURLToPath } from 'node:url';
import { lintTests, testLintReport, testLintFacts } from '../src/test-lint.ts';
import { testLintPolicy, lintRefusalLines, shrinkTestLint } from '../src/test-lint-policy.ts';
import { readDurationManifest } from '../src/suite-durations.ts';
import { fixedTestWaits } from '../src/fixed-test-waits.ts';
import { glob, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const args = process.argv.slice(2);
const details = args.includes('--details');
const cwd = args.find(arg => !['--shrink', '--details'].includes(arg)) ?? fileURLToPath(new URL('../../', import.meta.url));
await readDurationManifest(cwd); // Duplicate diagnostics are advisory, outside refusal counts.
let fixedCount = 0;
let fixedComplete = true;
try {
  for await (const file of glob(['hub/test/**/*.ts', 'web/test/**/*.ts', 'nvim/test/**/*.ts'], { cwd })) {
    const text = await readFile(join(cwd, file), 'utf8');
    // The lexical resolver below handles aliases/shadowing; skip sources that
    // cannot possibly register the node:test after API before loading a binder.
    if (/(['"])(?:node:)?test\1/.test(text) && /\bafter\b/.test(text)) {
      for (const finding of testLintFacts(file, text, 'T1').result.findings.filter(f => f.rule === 'file-after')) {
        console.log(`file after census (report only): ${finding.file}:${finding.line} ${finding.message}`);
      }
    }
    if (file === 'hub/test/until.ts') continue; // The shared default is the census boundary.
    for (const finding of fixedTestWaits(file, text)) {
      fixedCount++;
      console.log(`fixed test wait (report only): ${finding.file}:${finding.line} ${finding.message}`);
    }
  }
} catch {
  fixedComplete = false;
  console.log('test helper censuses incomplete (report only); no admission or exit-status effect');
}
console.log(`fixed test waits outside shared helper (report only): ${fixedComplete ? fixedCount : `unknown; partial count ${fixedCount}`}`);
if (args.includes('--shrink')) await shrinkTestLint(cwd);
for (const line of testLintReport(await lintTests(cwd), { detailedReachable: true, summaryOnly: !details })) console.log(line);
const reports = await testLintPolicy(cwd, { reportOnly: true });
console.log(`condition wait growth (report only): ${reports.length}`);
for (const finding of reports) console.log(`test lint report: ${finding.file}:${finding.line} [${finding.rule}] ${finding.message}`);
const findings = await testLintPolicy(cwd);
console.log(`test lint refusals: ${findings.length}`);
for (const line of lintRefusalLines(findings)) console.log(line);
if (!details) console.log('test lint detail: npm run test:lint -- --details');
if (findings.length) process.exitCode = 1;
