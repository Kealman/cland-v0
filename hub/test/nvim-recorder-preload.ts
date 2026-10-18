// Loaded only by test:nvim-fixtures (T3 maintenance). Production/default tests
// never import this producer. Synchronous calls retain the stub's frame bursts.
import { appendFileSync } from 'node:fs';
import { recordedOutput } from './nvim-frame-source.ts';
const path = process.env.TEST_NVIM_RECORDINGS_PATH;
if (path) Reflect.set(globalThis, Symbol.for('cland.nvim.frameRecorder'), (operation: string, input: unknown) => {
  const output = recordedOutput(operation, input);
  appendFileSync(path, JSON.stringify({ operation, input, output }) + '\n');
  return output;
});
