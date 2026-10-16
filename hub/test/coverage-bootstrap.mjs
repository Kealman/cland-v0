// V8's startup directory is fixed before imports. Record the test PID and start
// time so the reducer can route its final receipt even when a PID is reused.
// Descendants receive their per-file directory before they start.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const raw = process.env.NODE_V8_COVERAGE;
const file = process.argv[1] && relative(process.env.TEST_SUITE_CWD ?? process.cwd(), process.argv[1]).replaceAll('\\', '/');
if (raw && file && /^hub\/(?:src|test)\/.+\.test\.ts$/.test(file) && process.env.NODE_TEST_CONTEXT === 'child-v8') {
  const dir = join(raw, Buffer.from(file).toString('base64url'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'owner.json'), JSON.stringify({ pid: process.pid, started: Date.now() }));
  process.env.NODE_V8_COVERAGE = dir;
}
