import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const rank = map => Object.entries(map).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count || a.source.localeCompare(b.source));
const increment = (map, key) => { map[key] = (map[key] ?? 0) + 1; };
export function aggregate(root, metadata = {}) {
  const counts = new Map();
  let truncatedLines = 0;
  const gapSources = Object.create(null);
  const gaps = new Set(metadata.gaps ?? []);
  for (const file of readdirSync(root).filter(file => file.endsWith('.jsonl')).sort()) {
    const text = readFileSync(join(root, file), 'utf8');
    const lines = text.split('\n');
    // A crash may leave the final append incomplete. Never discard earlier records.
    if (lines.at(-1)) { lines.pop(); truncatedLines++; }
    for (const line of lines.filter(Boolean)) {
      const record = JSON.parse(line);
      if (record.gap) { gaps.add(record.testFile); increment(gapSources, `${record.testFile} :: ${record.helper} (${record.gap})`); }
      let command = counts.get(record.command);
      if (!command) { command = { command: record.command, count: 0, testFiles: Object.create(null), helpers: Object.create(null), sources: Object.create(null), firstArguments: Object.create(null) }; counts.set(record.command, command); }
      command.count++;
      increment(command.testFiles, record.testFile);
      increment(command.helpers, record.helper);
      increment(command.sources, `${record.testFile} :: ${record.helper}`);
      increment(command.firstArguments, JSON.stringify(record.firstArgument));
    }
  }
  const commands = [...counts.values()].map(command => ({ ...command, testFiles: rank(command.testFiles), helpers: rank(command.helpers), sources: rank(command.sources), firstArguments: rank(command.firstArguments) })).sort((a, b) => b.count - a.count || a.command.localeCompare(b.command));
  return { version: 1, ...metadata, gaps: [...gaps].sort(), gapSources: rank(gapSources), total: commands.reduce((sum, command) => sum + command.count, 0), truncatedLines, commands };
}

// Static audit, deliberately conservative: descendants without the preload are invisible.
export function knownGaps(repo) {
  return ['hub/test', 'nvim/test'].flatMap(dir => readdirSync(join(repo, dir)).filter(file => /\.test\.ts$/.test(file)).filter(file => /NODE_OPTIONS|sandbox-exec/.test(readFileSync(join(repo, dir, file), 'utf8'))).map(file => `${dir}/${file}`)).sort();
}
const cell = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ').replaceAll('\r', ' ');
function table(rows, labels) {
  return [`| ${labels.join(' | ')} |`, `| ${labels.map(() => '---').join(' | ')} |`, ...rows.map(row => `| ${row.map(cell).join(' | ')} |`)].join('\n');
}
export function report(data) {
  const lines = ['# Suite spawn census', '', `Head: ${data.head}; dirty: ${data.dirty ?? false}. Platform: ${data.platform}; Node: ${data.node}.`, `Started: ${data.startedAt}. Exit code: ${data.exitCode}. Invocation wall time (including queue): ${data.wallSeconds}s.`, '', data.suiteDuration ?? 'No suite duration line: the package runner did not complete.', '', `Recorded spawns: ${data.total}. Incomplete final lines discarded: ${data.truncatedLines}.`, '', '## Coverage and comparison with the prototype', '', 'Counts cover child_process calls in preloaded Node processes, one record per outer call. exec and shell:true count the shell (sh -c); their shell commands are never recorded. Non-Node descendants (including git hooks and git-receive-pack) are invisible. The prototype used Linux process accounting and counted about 77,000 processes, including 36,000 git and 20,000 ps. Differences are expected: this macOS Node census has a narrower boundary, the current suite has changed, and Node test workers and suite-lock probes are included. A nonzero exit must be inspected before using the report as a baseline; its failure and any missing coverage must be stated.', '', 'Subtrees that replace or strip NODE_OPTIONS, or deny census log writes under sandbox-exec, have uncounted descendant spawns; the originating calls are still counted. The census fixture test also writes its descendant records to an isolated root. Test files from the conservative static NODE_OPTIONS/sandbox audit and observed child environments (values are never recorded; counts below name affected launches, not the unknown descendant totals):', '', ...(data.gaps ?? []).map(file => `- ${file}`), '', '### Observed launches with possible coverage gaps', '', table((data.gapSources ?? []).map(row => [row.source, row.count]), ['Source and gap', 'Launches']), '', '## Totals per command', '', table(data.commands.map(row => [row.command, row.count]), ['Command', 'Count'])];
  for (const command of data.commands) {
    lines.push('', `## ${command.command}: ${command.count}`, '', '### Ten largest sources (test file :: helper)', '', table(command.sources.slice(0, 10).map(row => [row.source, row.count]), ['Source', 'Count']));
    for (const [key, label] of [['testFiles', 'Test files'], ['helpers', 'Helpers']]) lines.push('', `### ${label} (all, ranked)`, '', table(command[key].map(row => [row.source, row.count]), ['Source', 'Count']));
  }
  return lines.join('\n') + '\n';
}
export function compare(before, after) {
  if (before.version !== 1 || after.version !== 1) throw new Error('unsupported census aggregate version');
  const rows = (left, right) => {
    const a = new Map(left.map(row => [row.source, row.count]));
    const b = new Map(right.map(row => [row.source, row.count]));
    return [...new Set([...a.keys(), ...b.keys()])].map(source => ({ source, before: a.get(source) ?? 0, after: b.get(source) ?? 0 })).sort((x, y) => Math.max(y.before, y.after) - Math.max(x.before, x.after) || x.source.localeCompare(y.source));
  };
  const format = values => table(values.map(row => [row.source, row.before, row.after, row.after - row.before, row.before ? `${((row.after - row.before) / row.before * 100).toFixed(1)}%` : 'new']), ['Source', 'Before', 'After', 'Change', 'Change %']);
  const lines = ['# Spawn census comparison', '', `Before: ${before.head}; after: ${after.head}.`, `Suite duration before: ${before.suiteDuration}; after: ${after.suiteDuration}.`, 'Coverage gaps before: ' + (before.gaps ?? []).join(', '), 'Coverage gaps after: ' + (after.gaps ?? []).join(', '), '', format(rows(before.commands.map(row => ({ source: row.command, count: row.count })), after.commands.map(row => ({ source: row.command, count: row.count }))))];
  for (const name of [...new Set([...before.commands, ...after.commands].map(row => row.command))].sort()) {
    for (const [key, label] of [['sources', 'test file :: helper'], ['testFiles', 'test file'], ['helpers', 'helper']]) lines.push('', `## ${name}: top sources by ${label}`, '', format(rows(before.commands.find(row => row.command === name)?.[key] ?? [], after.commands.find(row => row.command === name)?.[key] ?? []).slice(0, 10)));
  }
  return lines.join('\n') + '\n';
}
