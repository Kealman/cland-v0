// T2: the CLI's closing text and JSON reports, on a scratch machine with isolated HOME and Git config.
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyFolder, initIn, scratchMachine } from './init-machine.ts';

test('successful init names setup as its next step', async t => {
  const machine = await scratchMachine(t, { identity: false });
  for (const args of [[], ['--json']]) {
    const root = await emptyFolder(machine);
    // Both initial provisioning and an already-current init name the same next step.
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await initIn(machine, root, 'init', ...args);
      assert.equal(result.code, 0, result.stderr);
      if (args.includes('--json')) assert.equal(JSON.parse(result.stdout).next, 'cland setup');
      else assert.equal(result.stdout.trimEnd().split('\n').at(-1), 'next: cland setup');
    }
  }
});
