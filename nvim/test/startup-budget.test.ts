// T3: production socket startup through real headless Neovim; no hub/harness subprocesses.
// The boundary is welcome delivery through rendered explorer, Coordinator header and sessions.
// Tracker projection and settling rules are covered by tracker-summary and shell-component at T1/T2.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempProject } from '../../hub/test/harness.ts';
import { nvimOrSkip } from './harness.ts';
import { generateStartupTracker, measureStartup, enforceStartupBudget, STARTUP_MS, FIRST_PAYLOAD_BYTES } from './startup-budget-support.ts';

const found = await nvimOrSkip();
const skip = 'skip' in found ? found.skip : false;
const bin = 'bin' in found ? found.bin : '';

test('thousand-item workbench startup fits the time and first-payload budgets', { skip }, async t => {
  const root = await tempProject(t);
  const fixture = await generateStartupTracker(root);
  assert.equal(fixture.total, 1000);
  assert.equal(fixture.open.length, 200);
  enforceStartupBudget(await measureStartup(t, bin, root, fixture));
});

test('a slowed task.list trips the rendered startup time budget', { skip }, async t => {
  const root = await tempProject(t);
  const result = await measureStartup(t, bin, root, await generateStartupTracker(root), 'slow-list');
  assert.ok(result.startupMs > STARTUP_MS);
  assert.ok(result.payloadBytes <= FIRST_PAYLOAD_BYTES, 'only the time budget is exceeded');
  assert.throws(() => enforceStartupBudget(result), error => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /startup budget: .* > 3000 ms/);
    t.diagnostic(`expected budget failure: ${error.message}`);
    return true;
  });
});

test('bodies added to the first task.list trip the payload byte budget', { skip }, async t => {
  const root = await tempProject(t);
  const result = await measureStartup(t, bin, root, await generateStartupTracker(root), 'bodies');
  assert.ok(result.startupMs <= STARTUP_MS, 'only the byte budget is exceeded');
  assert.ok(result.payloadBytes > FIRST_PAYLOAD_BYTES);
  assert.throws(() => enforceStartupBudget(result), error => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /first item payload budget: .* > 131072 bytes/);
    t.diagnostic(`expected budget failure: ${error.message}`);
    return true;
  });
});


test('an oversized non-item startup reply trips the per-reply byte budget', { skip }, async t => {
  const root = await tempProject(t);
  const result = await measureStartup(t, bin, root, await generateStartupTracker(root), 'oversized-reply');
  assert.throws(() => enforceStartupBudget(result), /startup reply budget: rule.list .* > 262144 bytes/);
});
