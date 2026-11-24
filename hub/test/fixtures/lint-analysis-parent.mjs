import { startLintAnalysis } from '../../src/test-lint-worker-runner.ts';
let analysis;
let stopping = false;
process.on('SIGTERM', () => { stopping = true; void analysis?.close(); });
const held = process.argv.includes('--hold-close-receipt');
let release;
const released = new Promise(resolve => { release = resolve; });
if (held) process.stdin.on('data', () => release());
try {
  if (stopping) throw new Error('parent cancelled before analysis admission');
  analysis = startLintAnalysis([{ file: 'hub/test/planted.test.ts', text: 'sleep(10);', entry: 'T1' }]);
  void analysis.ready.then(pid => console.log(JSON.stringify({ type: 'started', pid })), () => {});
  const receipt = await analysis.result;
  console.log(JSON.stringify({ type: 'result', heapSizeLimitBytes: receipt.heapSizeLimitBytes, files: receipt.files }));
} catch (error) {
  console.error(JSON.stringify({ code: error.code, message: error.message }));
  process.exitCode = 1;
} finally {
  const exit = analysis ? await analysis.closed : { code: null, signal: null };
  if (held) {
    console.log(JSON.stringify({ type: 'close-held' }));
    await released;
  }
  console.log(JSON.stringify({ type: 'nested-closed', exit }));
  if (held) process.stdin.destroy();
}
