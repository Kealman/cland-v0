// Offline evaluation only. Native Git runs in a disposable independent mirror.
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fixtureEnvironment } from './fixture-environment.ts';
import { batchInteractionSelection, importingTestsFromSource } from '../src/suite-interactions.ts';

const [evidence, output] = process.argv.slice(2);
if (!evidence || !output) throw new Error('usage: t3-interaction-replay.ts <A-15009.md> <output.json>');
const scratch = await mkdtemp(join(tmpdir(), 't3-replay-'));
const repository = join(scratch, 'repository.git');
const env = fixtureEnvironment(scratch, process.env);
const gitAt = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'gc.auto=0', ...args], { cwd, env, encoding: 'utf8', maxBuffer: 3 * 1024 * 1024 }).trimEnd();
const git = (...args: string[]) => gitAt(repository, ...args);
try {
  gitAt(scratch, 'clone', '--quiet', '--mirror', '--no-hardlinks', '--', process.cwd(), repository);
  const candidate = join(scratch, 'candidate');
  await mkdir(join(candidate, 'hub/test'), { recursive: true });
  const baseline = JSON.parse(git('show', '552255bebf5518ce476fa308b72a43405579ec24:hub/test/durations.json'));
  const replay = async (label: string, tree: string, heads: string[], noDelta = false) => {
    await rm(candidate, { recursive: true, force: true });
    await mkdir(candidate, { recursive: true });
    git('archive', '--output', join(scratch, 'source.tar'), tree);
    execFileSync('tar', ['-xf', join(scratch, 'source.tar'), '-C', candidate], { cwd: scratch, env });
    const known = new Set(git('ls-tree', '-r', '--name-only', tree).split('\n'));
    const sources = new Map<string, Promise<string>>();
    const scan = async (_cwd: string, changed: readonly string[], files: readonly string[], unknown?: (file: string, error: unknown) => void) => importingTestsFromSource(changed, files,
      async file => {
        if (!known.has(file)) return undefined;
        let source = sources.get(file);
        if (!source) { source = readFile(join(candidate, file), 'utf8'); sources.set(file, source); }
        return source;
      }, unknown);
    const selection = await batchInteractionSelection(candidate, { mode: 'full', tiers: ['T1'], web: 'none', files: [], reason: 'offline T1-only replay' }, heads,
      async (...args) => noDelta ? '' : git(...args.map(arg => arg === 'HEAD' ? tree : arg)), scan);
    const t3 = selection.batchInteraction!.t3!;
    const missing = t3.files?.filter(file => typeof baseline.files?.[file]?.seconds !== 'number') ?? [];
    const seconds = t3.files?.map(file => baseline.files?.[file]?.seconds as number) ?? [];
    const serial = t3.files !== null && !missing.length ? seconds.reduce((a, b) => a + b, 0) : null;
    const scenario = t3.files?.map(file => baseline.files?.[file]?.seconds ?? 120) ?? [];
    const scenarioSerial = scenario.reduce((a: number, b: number) => a + b, 0);
    return { label, tree, heads, t3, missing, serialSeconds: serial, idealTwoWorkersSeconds: serial === null ? null : Math.max(serial / 2, ...seconds, 0),
      budgetScenarioSerialSeconds: scenarioSerial, budgetScenarioIdealSeconds: Math.max(scenarioSerial / 2, ...scenario, 0) };
  };
  const positives = [
    await replay('T-1484 x T-1453 exact final reviewed heads', '18f57f55f', ['c6366488369174df5bf5f8a522854e706c7e7dae', 'a7b4ba04b95a3b4fbe76661dfd0e5b079e31b5d7']),
    await replay('T-1645 single-member consumer miss beside T-1817', 'b17f61463d1d2f4d468eebe59d9dcdb368cc029e', ['18e3f2d0a435728ff6a8a921c406730f9be48aca', '62a454de152517ade91626fcb6c4b389597a5dc3']),
  ];
  await writeFile(output, JSON.stringify({ positives }, null, 2) + '\n');
  // A-15009 contains one bounded JSON block per original receipt. No DB reads.
  const rows: Array<{ head: string; run: string; path: string; provenance: { tree: string }; recordedReport: string }> = [];
  let block: string[] | undefined, kept = 0;
  for await (const line of createInterface({ input: createReadStream(resolve(evidence)), crlfDelay: Infinity })) {
    if (line === '```json') { block = []; kept = 0; }
    else if (line === '```' && block) {
      const row = JSON.parse(block.join('\n')); if (row.head && row.run) rows.push(row); block = undefined;
    } else if (block) { kept += Buffer.byteLength(line) + 1; if (kept > 1024 * 1024) throw new Error('evidence block exceeds 1 MiB'); block.push(line); }
  }
  const batches = [];
  for (const row of rows) {
    const item = /: (T-\d+); tree/.exec(row.recordedReport)?.[1];
    const landing = git('log', '--first-parent', '--max-count=1', '--since=2026-10-30T16:00:00Z', '--until=2026-10-31T17:15:00Z', '--format=%H', '--fixed-strings', '--grep', `(${item})`, 'dev').split('\n')[0];
    if (!landing) throw new Error(`missing landing for ${item}`);
    let originalSelection = '';
    let lineNumber = 0;
    for await (const line of createInterface({ input: createReadStream(row.path), crlfDelay: Infinity })) {
      if (++lineNumber === 2) { originalSelection = line; break; }
    }
    const noDelta = originalSelection.startsWith('mode full; --all / all forces full; batch interaction report only: --all / all forces full; deciding files ');
    // Original synthetic objects have expired. Explicitly reconstruct using the
    // retained squash landing and its parent (one-member batches in this window).
    batches.push({ run: row.run, originalHead: row.head, originalTree: row.provenance.tree,
      reconstruction: noDelta ? 'synthetic zero-delta control at retained landing; historical T3 projection unknown' : 'retained squash landing versus first parent; not original candidate/member delta',
      originalEmptyImporterLine: noDelta,
      ...await replay(item!, landing, [noDelta ? landing : `${landing}^`], noDelta) });
    await writeFile(output, JSON.stringify({ positives, batches }, null, 2) + '\n');
  }
  await writeFile(output, JSON.stringify({ baseline: '552255bebf5518ce476fa308b72a43405579ec24', positives, batches }, null, 2) + '\n');
} finally {
  // All Git invocations synchronously observe native close before removal.
  await rm(scratch, { recursive: true, force: true });
}
