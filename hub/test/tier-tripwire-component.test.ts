// T2: real refusal controls with fake native launch boundaries; no child starts.
import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { promisify } from 'node:util';
import { fakeOnlyFixture } from './fake-only-fixture.ts';
import { installTierTripwire } from './tier-tripwire.ts';
import { launchRefusalControl } from './launch-refusal-control.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { beforeDirectories, guardDirectoryRemoval, fenceFixtureCleanup } from './process-cleanup.ts';
import { testSetupWaitMs } from './until.ts';

for (const mode of ['report-only', 'enforce'] as const) test(`refusal controls stay distinct from unguarded launches in ${mode}`, async t => {
  const cleanup = fenceFixtureCleanup(t);
  const deadlines = caseDeadlines(t, {
    timeoutMs: testSetupWaitMs(),
    ownership: { beforeDirectories, guardDirectoryRemoval },
  });
  await deadlines.wait('tripwire component sequence', () => deadlines.run(async admit => {
    const saved = Object.getOwnPropertyDescriptors(cp);
    const prototype = cp.ChildProcess.prototype as unknown as { spawn(options: unknown): unknown };
    const spawn = prototype.spawn;
    const exitCode = process.exitCode;
    cleanup.release(() => {
      Object.defineProperties(cp, saved);
      prototype.spawn = spawn;
      process.exitCode = exitCode;
      syncBuiltinESMExports();
    });
    let launches = 0;
    let failure: Error | undefined;
    for (const key of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork'] as const) {
      const fake = () => { if (failure) throw failure; launches++; return {}; };
      // Custom implementations must reach the guard just as Node's originals do.
      Object.defineProperty(fake, promisify.custom, { configurable: true, writable: true, value: () => prototype.spawn.call(new cp.ChildProcess(), {}) });
      Reflect.set(cp, key, fake);
    }
    prototype.spawn = () => { launches++; return {}; };
    const lines: string[] = [];
    installTierTripwire('hub/test/control.test.ts', 'T2', mode, line => lines.push(line));
    let step = 0;
    await fakeOnlyFixture(deadlines.fixtures, async () => {}, async operation => {
      const name = ['native refusal guard setup', 'fixture root setup', 'fixture body action'][step++]!;
      const original = admit(operation);
      try { return await deadlines.wait(name, () => original); }
      catch (error) {
        // A deadline observes failure; the original producer still owns its root.
        await original.catch(() => {});
        throw error;
      }
    });
    assert.deepEqual(lines.filter(line => line.startsWith('tier-mismatch {')), []);
    assert.equal(lines.filter(line => line.startsWith('tier-refusal-control {')).length, 4);
    assert.equal(launches, 0, 'positive controls reach the refusal before the native boundary');
    failure = new Error('native launch forbidden in fake-only fixture');
    // Identical text from another producer is still a mismatch, even in a control.
    // cland-allow-child-env: this launcher is the installed fake boundary and never creates a child or reads an environment
    assert.throws(() => launchRefusalControl(() => Reflect.apply(cp.exec, cp, ['synthetic'])), mode === 'enforce' ? /T2 forbids/ : /native launch forbidden/);
    assert.equal(lines.filter(line => line.startsWith('tier-mismatch {')).length, 1);
    assert.equal(lines.filter(line => line.startsWith('tier-refusal-control {')).length, 4);
    failure = undefined;
    for (const key of ['exec', 'execFile'] as const) {
      // cland-allow-child-env: fake callback/custom positive controls never launch a child or read an environment
      for (const call of [() => Reflect.apply(cp[key], cp, ['synthetic']), () => promisify(cp[key])('synthetic')]) {
        if (mode === 'enforce') assert.throws(call, /T2 forbids/);
        else await call();
      }
    }
    const rows = lines.filter(line => line.startsWith('tier-mismatch {')).map(line => JSON.parse(line.slice('tier-mismatch '.length)));
    assert.deepEqual(rows.map(row => row.resource), ['child_process.exec', 'child_process.execFile']);
    assert.equal(launches, mode === 'enforce' ? 0 : 4);
  }));
});
