import { testLintPolicy, TestLintError, TestLintReadError } from './test-lint-policy.ts';
import { MergeError, MergeLintReadError } from './merge.ts';

/** Retry only unavailable reads of the same immutable inputs; findings refuse immediately. */
export async function requireMergeTestLint(root: string, options: Parameters<typeof testLintPolicy>[1]): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      const findings = await testLintPolicy(root, { ...options, readFailures: 'throw' });
      if (findings.length) throw new TestLintError(findings);
      return;
    } catch (error) {
      if (error instanceof TestLintReadError) {
        if (attempt < 3) continue;
        throw new MergeLintReadError(`test lint read failed after ${attempt} attempts: ${error.message}`);
      }
      throw new MergeError('merge-test-lint', error instanceof Error ? error.message : String(error), error instanceof TestLintError ? error.files : undefined);
    }
  }
}
