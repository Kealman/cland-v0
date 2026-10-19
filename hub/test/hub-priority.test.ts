// T2: startup logging and public CLI reports through one in-process project hub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { runHub } from '../src/cli/hub.ts';
import { captureCli } from './cli-in-process.ts';
import { doctor, report, toolchain, check } from './doctor-fixture.ts';

test('inherited low priority appears in the startup log and CLI diagnostics', async t => {
  const root = await tempProject(t);
  const tools = await toolchain(t);
  const entries: Record<string, unknown>[] = [];
  let probes = 0;
  await projectHub(t, root, {}, {
    clock: new FakeClock(),
    priorityProbe: () => { probes++; return 5; },
    log: entry => entries.push(entry),
  });
  const warnings = entries.filter(entry => entry.event === 'hub-priority-warning');
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]!.nice, 5);
  assert.match(String(warnings[0]!.detail), /nice 5.*BG_NICE/);
  assert.match(String(warnings[0]!.fix), /restart at nice 0/);

  const status = await captureCli(write => runHub(['status', '--json'], root, { out: write, err: write }));
  assert.equal(status.code, 0, status.stderr);
  const priority = JSON.parse(status.stdout).priority;
  assert.equal(priority.nice, 5);
  assert.equal(priority.warning.detail, warnings[0]!.detail);
  assert.equal(priority.warning.fix, warnings[0]!.fix);
  const text = await captureCli(write => runHub(['status'], root, { out: write, err: write }));
  assert.equal(text.code, 0, text.stderr);
  assert.ok(text.stdout.includes(`warning: ${priority.warning.detail}; fix: ${priority.warning.fix}`));

  const diagnosis = check((await report(root, tools.env)).report, 'hub priority');
  assert.deepEqual(diagnosis, { name: 'hub priority', verdict: 'warn', ...priority.warning });
  const plain = await doctor(root, tools.env);
  assert.match(plain.stdout, /warn\s+hub priority\s+.*nice 5.*BG_NICE.*fix:.*restart at nice 0/);
  assert.equal(probes, 1, 'reports reuse the startup observation');
});
