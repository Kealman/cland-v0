// T3: the delivered worker must finish and publish its measurements even when mounting tmpfs fails.
// Real shell execution proves root setup, runner temp inheritance and the completion receipt boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, readFile, realpath, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture } from './remote-fixture.ts';
import { projectHub } from './harness.ts';

for (const mounted of [true, false]) test(`remote worker completes with ${mounted ? 'a capped tmpfs temp root' : 'an explicit disk fallback'}`, async t => {
  const f = await fixture(t, { hub: projectHub,
    test: `node -e "const fs=require('fs'),os=require('os');fs.writeFileSync(process.env.HOME+'/temp-observed.json',JSON.stringify({root:os.tmpdir(),cwd:process.cwd()}));console.log('# tests 1');console.log('# pass 1')"` });
  // Only the fake machine sees this mount executable; it never mounts the host filesystem.
  const mount = join(f.api.stateRoot, 'bin/mount');
  await writeFile(mount, `#!${process.execPath}\nconst fs=require('fs');fs.writeFileSync(process.env.HOME+'/mount-observed.json',JSON.stringify(process.argv.slice(2)));process.exit(${mounted ? 0 : 1});\n`);
  await chmod(mount, 0o700);
  const job = await f.launch('--executor', 'droplet');
  // This case proves completed health/fallback receipts, not startup latency.
  // Its real SSH processes use the fixture's process budget (T-746); await the
  // terminal report before inspecting retained files, without another pgid wait.
  const result = await f.result(job.id);
  assert.match(result.text, /auto exit 0/);
  assert.match(result.text, /Machine health: disk fsync .*SQLite .*iowait .*steal /);
  assert.equal(f.api.machineDirs.size, 1, 'one completed machine retains its receipt directory');
  const home = join(f.api.machineDirs.values().next().value!, 'home/runner');
  const observed = JSON.parse(await readFile(join(home, 'temp-observed.json'), 'utf8'));
  assert.equal(observed.root, join(home, 'tmp'));
  assert.equal(observed.cwd, await realpath(join(home, 'cland')), 'repository remains outside the temp mount');
  const args = JSON.parse(await readFile(join(home, 'mount-observed.json'), 'utf8')) as string[];
  assert.deepEqual(args.slice(0, 3), ['-t', 'tmpfs', '-o']);
  const cap = Number(/size=(\d+)k/.exec(args[3]!)![1]);
  assert.ok(cap > 0 && cap <= 4194304, 'tmpfs is capped at at most 4 GiB');
  assert.equal(args.at(-1), join(home, 'tmp'));
  assert.match(result.text, mounted ? /tmpfs.*cap / : /disk fallback: tmpfs mount unavailable/);
  const receipt = JSON.parse(await readFile(join(f.root, '.cland/run/suites', job.id, 'result.json'), 'utf8'));
  assert.equal(receipt.health.temp.kind, mounted ? 'tmpfs' : 'disk');
  assert.equal(typeof receipt.health.storage.disk.fsyncMs, 'number');
  assert.equal(typeof receipt.health.storage.temp.sqliteMs, 'number');
  await f.stop();
  const entries = (await readFile(join(f.root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(entries.find(entry => entry.event === 'suite-result' && entry.id === job.id).health, receipt.health);
});
