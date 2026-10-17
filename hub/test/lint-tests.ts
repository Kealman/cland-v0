import { fileURLToPath } from 'node:url';
import { lintTests, testLintReport } from '../src/test-lint.ts';
for (const line of testLintReport(await lintTests(process.argv[2] ?? fileURLToPath(new URL('../../', import.meta.url))), { detailedReachable: true })) console.log(line);
