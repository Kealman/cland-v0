// T3: scratch CLI initialization and repeat-init processes prove closing reports after the native Git lifecycle.
// PID/ps ownership and close drainage keep the scratch HOME until every command has stopped.
import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyFolder, initIn, scratchMachine } from './init-machine.ts';

for (const args of [[], ['--json']]) {
  test(`successful init names setup as its next step (${args.length ? 'JSON' : 'text'})`, async t => {
    const machine = await scratchMachine(t, { identity: true });
    const root = await emptyFolder(machine);
    // Both initial provisioning and an already-current init name the same next step.
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await initIn(machine, root, 'init', ...args);
      assert.equal(result.code, 0, result.stderr);
      if (args.includes('--json')) assert.equal(JSON.parse(result.stdout).next, 'cland setup');
      else assert.equal(result.stdout.trimEnd().split('\n').at(-1), 'next: cland setup');
    }
  });
}
