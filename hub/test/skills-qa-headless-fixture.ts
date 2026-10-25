#!/usr/bin/env node
// Scripted headless CLI edge for qa-record.sh. The native headless/stdio
// contract lives in nvim/test/qa.test.ts; these tests own recording and recovery.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fixtureEnvironment } from './fixture-environment.ts';
import { basename, join } from 'node:path';
const [flag, qa, path, out, directory] = process.argv.slice(2);
if (flag === 'demo') {
  if (qa === 'status') console.log(JSON.stringify({ commit: 'abc1234', lifetimeMs: 10, costUsd: 0.001 }));
  else if (process.env.FAKE_DEMO_EXEC) {
    const executed = spawnSync(process.execPath, process.argv.slice(7), { cwd: process.cwd(), env: fixtureEnvironment(process.cwd(), process.env, { FAKE_DEMO_NATIVE: '1', PATH: process.env.PATH }), encoding: 'utf8' });
    process.stdout.write(executed.stdout ?? ''); process.stderr.write(executed.stderr ?? '');
    process.exit(executed.status ?? 2);
  }
  else if (process.argv.at(-1) === 'DEMO-001') process.stdout.write(await readFile(process.env.FAKE_DEMO_ENVELOPE!, 'utf8'));
  else await writeFile(`${process.env.FAKE_DEMO_ENVELOPE}.cleaned`, 'acknowledged');
  process.exit(0);
}
assert.equal(flag, '--headless');
assert.equal(qa, '--qa');
assert.ok(path);
assert.ok(path.startsWith('qa/cases/'));
assert.equal(out, '--out');
assert.ok(directory);
const id = basename(path, '.lua');
if (process.env.FAKE_DEMO_NATIVE) {
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, `${id}.facts.json`), JSON.stringify({ facts: { count: 0, replayed: false }, steps: [{ error: id === 'DEMO-ERROR-001' ? 'caught native step failure' : null }] }));
  console.log(JSON.stringify({ result: 'PASS', evidence: [] }));
} else if (id !== 'SHELL-001') {
  console.log(JSON.stringify({ result: 'BLOCKED', evidence: [] }));
  process.exitCode = 2;
} else {
  await mkdir(directory, { recursive: true });
  const evidence = [join(directory, `${id}.screen.txt`), join(directory, `${id}.state.json`)];
  await writeFile(evidence[0]!, 'General\n');
  await writeFile(evidence[1]!, '{}\n');
  console.log(JSON.stringify({ result: 'PASS', evidence }));
}
