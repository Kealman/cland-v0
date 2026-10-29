// Refresh observed files from green logs; retain baselines for unobserved files.
import { glob, readFile, writeFile } from 'node:fs/promises';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMap, isNode, parseDocument } from 'yaml';
import { readTierAssignments } from '../src/suite-shards.ts';
import type { TestProgress } from '../src/suite-progress.ts';
import { DURATION_MANIFEST, fileTimings, readDurationManifest, timingKey, type DurationManifest, type TestTiming } from '../src/suite-durations.ts';

const median = (values: number[]) => {
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle]! : (values[middle - 1]! + values[middle]!) / 2;
};
const rounded = (seconds: number) => Number(seconds.toFixed(6));
const sorted = <T>(entries: Array<[string, T]>): Record<string, T> => Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));

// Old spec logs have no duration reporter. The start reporter supplies identities;
// only column-zero result lines count, because children are included in their parent.
export function logTimings(log: string, legacyFile?: (name: string) => string | undefined): TestTiming[] {
  const lines = log.replace(/\x1b\[[0-9;]*m/g, '').split('\n');
  const records = lines.filter(line => line.startsWith('suite timing ')).map(line => JSON.parse(line.slice('suite timing '.length)) as TestTiming);
  if (records.length) return records;
  const cwd = /^Worktree (.+)$/m.exec(log)?.[1];
  const starts = new Map<string, string[]>();
  for (const line of lines) {
    if (!line.startsWith('suite start ')) continue;
    const start = JSON.parse(line.slice('suite start '.length)) as { file: string; name: string };
    const file = cwd ? relative(cwd, start.file) : start.file;
    const files = starts.get(start.name) ?? [];
    files.push(file); starts.set(start.name, files);
  }
  for (const line of lines) {
    const match = /^[✔﹣] (.+) \(([\d.]+)ms\)(?:\s.*)?$/.exec(line);
    if (!match) continue;
    const name = match[1]!;
    const candidates = starts.get(name);
    if (candidates && new Set(candidates).size > 1) throw new Error(`ambiguous legacy test: ${name}; spec results have no file identity`);
    const file = starts.get(name)?.shift() ?? legacyFile?.(name);
    if (!file) throw new Error(`cannot map legacy test to a file: ${name}`);
    records.push({ file, name, seconds: Number(match[2]) / 1000 });
  }
  return records;
}

// Ordinary completed file envelopes prove execution even after the final test
// was removed. Load-gate processes and interrupted/skipped files prove no such thing.
function completedFiles(log: string): string[] {
  const files = new Set<string>();
  for (const line of log.split('\n')) {
    if (!line.startsWith('suite progress ')) continue;
    let row: Partial<TestProgress>;
    try { row = JSON.parse(line.slice('suite progress '.length)); } catch { continue; }
    if (row?.event === 'finish' && row.type === 'file' && row.outcome === 'pass'
      && row.scope === undefined && row.nesting === 0 && typeof row.file === 'string' && row.file.endsWith('.test.ts')
      && typeof row.id === 'string' && Number.isFinite(row.at) && Number.isFinite(row.seconds) && row.seconds! >= 0) files.add(row.file);
  }
  return [...files];
}

async function sourceTitles(cwd: string): Promise<(name: string) => string | undefined> {
  const ts = await import('typescript');
  const titles: Array<{ file: string; pattern: RegExp }> = [];
  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for await (const file of glob(['hub/src/**/*.test.ts', 'hub/test/**/*.test.ts', 'nvim/test/**/*.test.ts', 'web/test/**/*.test.ts'], { cwd })) {
    const source = ts.createSourceFile(file, await readFile(join(cwd, file), 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = (node: import('typescript').Node) => {
      if (ts.isCallExpression(node) && /^(?:test|it|describe)(?:\.(?:skip|todo|only))?$/.test(node.expression.getText(source))) {
        const title = node.arguments[0];
        if (title && (ts.isStringLiteral(title) || ts.isNoSubstitutionTemplateLiteral(title))) titles.push({ file, pattern: new RegExp(`^${escape(title.text)}$`, 's') });
        else if (title && ts.isTemplateExpression(title)) titles.push({ file, pattern: new RegExp(`^${escape(title.head.text)}${title.templateSpans.map(span => `.*?${escape(span.literal.text)}`).join('')}$`, 's') });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return name => {
    const files = [...new Set(titles.filter(title => title.pattern.test(name)).map(title => title.file))];
    if (files.length > 1) throw new Error(`ambiguous legacy test: ${name}; matches ${files.join(', ')}`);
    return files[0];
  };
}

const usage = 'usage: node hub/test/durations.ts refresh [--add-only] <green integrated log>…';

// Splice only additions into the JSON maps. Re-serialization would change old
// number spellings (and hand formatting), even when their values stay equal.
function addOnlyText(text: string, manifest: DurationManifest, previous: DurationManifest): string {
  const document = parseDocument(text);
  const edits: Array<{ start: number; end: number; text: string }> = [];
  const source = document.get('source', true);
  if (!isMap(source) || !source.range) throw new Error('invalid duration source');
  edits.push({ start: source.range[0], end: source.range[1], text: JSON.stringify(manifest.source, null, 2).replaceAll('\n', '\n  ') });
  for (const section of ['files', 'tests'] as const) {
    const entries = Object.entries(manifest[section]).filter(([key]) => !Object.hasOwn(previous[section], key));
    if (!entries.length) continue;
    const map = document.get(section, true);
    if (!isMap(map) || !map.range) throw new Error(`invalid duration ${section}`);
    const last = map.items.at(-1)?.value;
    const end = isNode(last) ? last.range?.[1] : undefined;
    const at = end ?? map.range[0] + 1;
    const added = entries.map(([key, value]) => `    ${JSON.stringify(key)}: ${JSON.stringify(value, null, 2).replaceAll('\n', '\n    ')}`).join(',\n');
    edits.push({ start: at, end: at, text: `${end === undefined ? '' : ','}\n${added}${end === undefined ? '\n  ' : ''}` });
  }
  for (const edit of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
  return text;
}

export async function refreshDurations(cwd: string, logs: string[], options: { addOnly?: boolean } = {}): Promise<DurationManifest> {
  if (!logs.length) throw new Error(usage);
  const previous = await readDurationManifest(cwd);
  const tiers = await readTierAssignments(cwd);
  const skipped = new Set<string>();
  const owned = (file: string, key: string): boolean => {
    if (!tiers || tiers.has(file)) return true;
    if (!skipped.has(key)) console.log(`duration skipped (not tier-owned): ${key}`);
    skipped.add(key);
    return false;
  };
  const samples = new Map<string, { test: TestTiming; seconds: number[] }>();
  const artifacts: string[] = [];
  let commit = '';
  let legacyFile: ((name: string) => string | undefined) | undefined;
  const latestByFile = new Map<string, Set<string>>();
  for (const path of logs) {
    const log = (await readFile(path, 'utf8')).replace(/\x1b\[[0-9;]*m/g, '');
    if (!/^Finished: exit 0\s*$/m.test(log)) throw new Error(`not a green integrated log: ${path}`);
    const artifact = /^A-\d+/.exec(basename(path))?.[0];
    if (artifact) artifacts.push(artifact);
    commit = /^Head (\S+)/m.exec(log)?.[1] ?? commit;
    if (!/^suite (?:timing|start|progress) /m.test(log)) legacyFile ??= await sourceTitles(cwd);
    const records = logTimings(log, legacyFile);
    const executed = completedFiles(log);
    if (!records.length && !executed.length) throw new Error(`no test timings in ${path}`);
    // Smoke repeats within one run contribute one sample to its median.
    const run = new Map<string, { test: TestTiming; seconds: number[] }>();
    for (const test of records) {
      if (!test.file || typeof test.name !== 'string' || !Number.isFinite(test.seconds) || test.seconds < 0) throw new Error(`invalid test timing in ${path}`);
      const key = timingKey(test);
      if (!owned(test.file, key)) continue;
      const sample = run.get(key) ?? { test, seconds: [] };
      sample.seconds.push(test.seconds); run.set(key, sample);
    }
    const observed = new Map<string, Set<string>>(executed.filter(file => owned(file, file)).map(file => [file, new Set<string>()]));
    for (const [key, sample] of run) {
      const names = observed.get(sample.test.file) ?? new Set<string>();
      names.add(key); observed.set(sample.test.file, names);
    }
    for (const [file, names] of observed) latestByFile.set(file, names);
    for (const [key, sample] of run) {
      const collected = samples.get(key) ?? { test: sample.test, seconds: [] };
      collected.seconds.push(median(sample.seconds)); samples.set(key, collected);
    }
  }
  const tests = [...samples].filter(([key, sample]) => latestByFile.get(sample.test.file)?.has(key)).map(([, sample]) => ({ ...sample.test, seconds: rounded(median(sample.seconds)) }));
  // Partial-tier logs say nothing about files they did not execute.
  for (const [key, seconds] of Object.entries(previous?.tests ?? {})) {
    const split = key.indexOf('::');
    const file = key.slice(0, split);
    if (!latestByFile.has(file)) tests.push({ file, name: key.slice(split + 2), seconds });
  }
  const files = fileTimings(tests);
  for (const file of latestByFile.keys()) files[file] ??= { seconds: 0, tests: 0 };
  for (const [path, file] of Object.entries(previous?.files ?? {})) if (!latestByFile.has(path)) files[path] = { ...file };
  for (const file of Object.values(files)) file.seconds = rounded(file.seconds);
  const budget = previous?.budget ?? { testSeconds: 5, fileSeconds: 60 };
  const allow: DurationManifest['allow'] = {};
  for (const [key, entry] of Object.entries(previous?.allow ?? {})) {
    if (key !== 'T3' && !latestByFile.has(key.split('::')[0]!)) allow[key] = { ...entry };
  }
  for (const test of tests) {
    if (!latestByFile.has(test.file)) continue;
    const key = timingKey(test);
    if (previous?.allow[key] || (test.seconds > budget.testSeconds && previous?.tests[key] === undefined)) allow[key] = { ...previous?.allow[key], seconds: test.seconds, reason: previous?.allow[key]?.reason ?? 'TODO' };
  }
  for (const [path, file] of Object.entries(files)) {
    if (!latestByFile.has(path)) continue;
    if (previous?.allow[path]?.file || (file.seconds > budget.fileSeconds && previous?.files[path] === undefined)) allow[path] = { ...previous?.allow[path], file: true, seconds: file.seconds, reason: previous?.allow[path]?.reason ?? 'TODO' };
  }
  if (previous?.allow.T3) allow.T3 = previous.allow.T3;
  const retained = [...Object.keys(previous?.files ?? {}), ...Object.keys(previous?.tests ?? {}), ...Object.keys(previous?.allow ?? {})]
    .some(key => key === 'T3' || !latestByFile.has(key.split('::')[0]!));
  const sources = [...new Set([...(retained ? previous?.source.artifacts ?? [] : []), ...artifacts])];
  let manifest: DurationManifest = { version: 1, source: { artifacts: sources, commit }, budget,
    files: sorted(Object.entries(files)), tests: sorted(tests.map(test => [timingKey(test), test.seconds])), allow: sorted(Object.entries(allow)) };
  if (options.addOnly) manifest = { ...manifest,
    source: { artifacts: [...new Set([...(previous?.source.artifacts ?? []), ...artifacts])], commit },
    files: { ...manifest.files, ...previous?.files }, tests: { ...manifest.tests, ...previous?.tests }, allow: previous?.allow ?? {} };
  const path = join(cwd, DURATION_MANIFEST);
  const text = options.addOnly && previous ? addOnlyText(await readFile(path, 'utf8'), manifest, previous) : JSON.stringify(manifest, null, 2) + '\n';
  await writeFile(path, text);
  return manifest;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--help')) { console.log(usage + '\nWith a tier manifest, skips and prints log identities outside its owned files; without one, retains legacy unfiltered refresh.\n--add-only adds missing test/file baselines, preserving existing entries and all allowances.'); process.exit(0); }
  if (process.argv[2] !== 'refresh') throw new Error(usage);
  const args = process.argv.slice(3);
  if (args.some(arg => arg.startsWith('--') && arg !== '--add-only')) throw new Error(usage);
  const addOnly = args.includes('--add-only');
  const previous = addOnly ? await readDurationManifest(process.cwd()) : null;
  const manifest = await refreshDurations(process.cwd(), args.filter(arg => arg !== '--add-only'), { addOnly });
  if (addOnly) for (const section of ['files', 'tests'] as const) for (const key of Object.keys(manifest[section])) {
    if (!Object.hasOwn(previous?.[section] ?? {}, key)) console.log(`duration added ${section}: ${key}`);
  }
  console.log(`duration manifest: ${Object.keys(manifest.files).length} files, ${Object.keys(manifest.tests).length} tests, ${Object.keys(manifest.allow).length} allowances; replace TODO reasons before admission`);
}
