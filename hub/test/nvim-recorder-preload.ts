// Loaded only by test:nvim-fixtures (T3 maintenance). Production/default tests
// never import this producer. Synchronous calls retain the stub's frame bursts.
import { appendFileSync } from 'node:fs';
import { recordedOutput } from './nvim-frame-source.ts';
import { createFrameRecorder } from './nvim-frame-recorder.ts';
const path = process.env.TEST_NVIM_RECORDINGS_PATH;
if (path) Reflect.set(globalThis, Symbol.for('cland.nvim.frameRecorder'), createFrameRecorder(recordedOutput, record => {
  appendFileSync(path, JSON.stringify(record) + '\n');
}));
