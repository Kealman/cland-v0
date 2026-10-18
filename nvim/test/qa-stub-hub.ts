#!/usr/bin/env node
// The human QA CLI accepts arbitrary, including read-only, scenarios. Its T3
// adapter uses hub-owned projections; T2 tests use stub-hub's committed JSON only.
import { recordedOutput } from '../../hub/test/nvim-frame-source.ts';
Reflect.set(globalThis, Symbol.for('cland.nvim.frameRecorder'), recordedOutput);
await import('./stub-hub.ts');
