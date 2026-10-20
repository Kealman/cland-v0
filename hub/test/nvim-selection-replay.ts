// Retrospective T-709 import selection evidence over the last 40 task landings.
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { nvimHubImporters, nvimHubImports, chooseSuiteMode } from '../src/suite-selection.ts';
// cland-allow-child-env: manual read-only Git replay inspects the selected repository; no cland, account or modifying Git command
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const ref = process.argv[2] ?? 'origin/dev';
const { tests } = JSON.parse(await readFile(new URL('./tiers.json', import.meta.url), 'utf8'));
const t2 = new Set(Object.keys(tests).filter(file => file.startsWith('nvim/') && (tests[file]?.tier ?? tests[file]) === 'T2'));
const importers = await nvimHubImporters(process.cwd());
const imports = Object.keys(importers);
const t2Imports = await nvimHubImports(process.cwd(), [...t2]);
const landings = git('log', '--first-parent', '--format=%H%x09%s', ref).trim().split('\n').filter(line => /\(T-\d+\)$/.test(line) && !line.includes('\tTracker:')).slice(0, 40);
if (landings.length !== 40) throw new Error(`need 40 task landings, found ${landings.length}`);
console.log(`T-709 Neovim selection replay; current importer graph; ${ref} at ${git('rev-parse', ref).trim()}; last 40 task landings.`);
console.log(`T2 files: ${t2.size}; T2 runtime hub import closure: ${JSON.stringify(t2Imports)}.`);
console.log('| Landing | Item | Package mode | Import-selected Neovim files | Import-selected T2 files |');
console.log('| --- | --- | --- | --- | --- |');
let count = 0;
for (const line of landings) {
  const [sha, subject] = line.split('\t');
  const paths = git('diff', '--name-only', '-z', '--no-renames', `${sha}^1`, sha!).split('\0').filter(Boolean);
  const mode = chooseSuiteMode(paths, imports);
  // An import can decide only after the shared infrastructure/mixed-path rules.
  const imported = mode === 'full' && chooseSuiteMode(paths, []) === 'hub-only' ? [...new Set(paths.flatMap(path => importers[path] ?? []))] : [];
  const selectedT2 = imported.filter(file => t2.has(file));
  count += selectedT2.length;
  console.log(`| ${sha!.slice(0, 8)} | ${subject!.match(/\((T-\d+)\)$/)?.[1]} | ${mode} | ${imported.length} | ${selectedT2.length} |`);
}
console.log(`nvim test import decides ${count} T2 Neovim selections across 40 landings. Shared contract/infrastructure and mixed-path full selections remain intact.`);
if (count || t2Imports.length) process.exitCode = 1;
