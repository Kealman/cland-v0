// Invoke a CLI module with a local output sink; never replace the test runner's stdout.
import type { CliResult } from './harness.ts';

export async function captureCli(run: (write: (text: string) => void) => Promise<number>): Promise<CliResult> {
  let stdout = '';
  try { return { code: await run(text => { stdout += text; }), stdout, stderr: '' }; }
  catch (error) { return { code: 1, stdout, stderr: error instanceof Error ? error.message : String(error) }; }
}
