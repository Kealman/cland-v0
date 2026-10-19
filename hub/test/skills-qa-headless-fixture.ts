#!/usr/bin/env node
// Scripted headless CLI edge for qa-record.sh. The native headless/stdio
// contract lives in nvim/test/qa.test.ts; these tests own recording and recovery.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
const [flag, qa, path, out, directory] = process.argv.slice(2);
assert.equal(flag, '--headless');
assert.equal(qa, '--qa');
assert.ok(path);
assert.ok(path.startsWith('qa/cases/'));
assert.equal(out, '--out');
assert.ok(directory);
const id = basename(path, '.lua');
if (id !== 'SHELL-001') {
  console.log(JSON.stringify({ result: 'BLOCKED', evidence: [] }));
  process.exitCode = 2;
} else {
  await mkdir(directory, { recursive: true });
  const evidence = [join(directory, `${id}.screen.txt`), join(directory, `${id}.state.json`)];
  await writeFile(evidence[0]!, 'General\n');
  await writeFile(evidence[1]!, '{}\n');
  console.log(JSON.stringify({ result: 'PASS', evidence }));
}
