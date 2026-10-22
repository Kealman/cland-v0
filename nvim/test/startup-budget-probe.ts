// Manual C4 evidence only; never selected as a suite test. Source files are read/copy-only.
// node nvim/test/startup-budget-probe.ts /absolute/project/.cland/tasks
import test from 'node:test';
import assert from 'node:assert/strict';
import { isAbsolute } from 'node:path';
import { tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip } from './harness.ts';
import { copyStartupTracker, measureStartup, enforceStartupBudget } from './startup-budget-support.ts';

const source = process.argv[2];
assert.ok(source && isAbsolute(source), 'pass an absolute source tracker directory; it is only copied');
assert.equal(process.platform, 'darwin', 'C4 requires local macOS evidence');
const found = await nvimOrSkip();
assert.ok('bin' in found, 'C4 requires the real Neovim binary');
test('local macOS copied-tracker startup evidence', async t => {
  const root = await tempProject(t);
  const fixture = await copyStartupTracker(source, root);
  const result = await measureStartup(t, found.bin, root, fixture);
  assert.ok(result.payloadBytes <= 120*1024, `first item payload margin: ${result.payloadBytes} bytes > 122880 bytes`);
  enforceStartupBudget(result);
});
