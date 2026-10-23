// Run from the repository root. A census uses the ordinary package runner locks.
import { fixtureEnvironment } from './fixture-environment.ts';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, createWriteStream, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { aggregate, compare, knownGaps, report } from './spawn-census/report.mjs';

const [mode, ...args] = process.argv.slice(2);
if (mode === 'compare' && args.length === 2) {
  process.stdout.write(compare(...args.map(file => JSON.parse(readFileSync(file, 'utf8')))));
} else if (mode === 'run' && args.length === 1) {
  const repo = fileURLToPath(new URL('../../', import.meta.url));
  const output = resolve(args[0]);
  mkdirSync(output, { recursive: true });
  const root = mkdtempSync(join(tmpdir(), 'cland-spawn-census-'));
  // cland-allow-child-env: read-only metadata identifies the repository being measured; no account or modifying Git command
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
  // cland-allow-child-env: read-only status identifies the repository being measured; no account or modifying Git command
  const dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' }).trim());
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const logPath = join(output, 'suite.log');
  const log = createWriteStream(logPath, { mode: 0o600 });
  const preload = new URL('./spawn-census/recorder.mjs', import.meta.url).href;
  const child = spawn('npm', ['test', '--', '--all'], { cwd: repo, env: fixtureEnvironment(root, process.env, { NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${preload}`, TEST_SPAWN_CENSUS_ROOT: root, TEST_SPAWN_CENSUS_REPO: repo }), stdio: ['inherit', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => { process.stdout.write(chunk); log.write(chunk); });
  child.stderr.on('data', chunk => { process.stderr.write(chunk); log.write(chunk); });
  const handlers = ['SIGINT', 'SIGTERM'].map(signal => {
    const handler = () => child.kill(signal);
    process.on(signal, handler);
    return { signal, handler };
  });
  let exitCode;
  try {
    exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve(code ?? (signal === 'SIGINT' ? 130 : 143))); });
  } finally {
    for (const { signal, handler } of handlers) process.off(signal, handler);
    await new Promise(resolve => log.end(resolve));
  }
  const suiteDuration = readFileSync(logPath, 'utf8').split('\n').filter(line => line.startsWith('suite duration ')).at(-1) ?? null;
  const data = aggregate(root, { head, dirty, platform: process.platform, node: process.version, startedAt, exitCode, wallSeconds: ((Date.now() - started) / 1000).toFixed(2), suiteDuration, gaps: knownGaps(repo), recordsRoot: root });
  writeFileSync(join(output, 'aggregate.json'), JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
  writeFileSync(join(output, 'report.md'), report(data), { mode: 0o600 });
  console.log(`Census report: ${join(output, 'report.md')}\nAggregate: ${join(output, 'aggregate.json')}\nAppend-only records: ${root}`);
  process.exitCode = exitCode;
} else {
  throw new Error('usage: node hub/test/spawn-census.mjs run <output-directory> | compare <before.json> <after.json>');
}
