// Suite receipts retain semantic records, never arbitrary command output.
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { loadProofIdentities } from './suite-load-gate-plan.ts';

/** Shared with legacy load-proof backfill. Ordinary lines are bounded to the
 * displayed excerpt width, including output without newlines. Semantic records
 * remain complete; their size is proportional to the reported test evidence.
 */
export async function* suiteLogLines(path: string): AsyncGenerator<string> {
  const input = createReadStream(path, { encoding: 'utf8' });
  let partial = '';
  const retained = (line: string) => {
    const prefix = line.replace(/\x1b\[[0-9;]*m/g, '');
    return evidence.test(prefix) || prefix.startsWith('suite command ');
  };
  const add = (part: string) => {
    if (partial.length < 200 || retained(partial)) partial += part;
    if (!retained(partial)) partial = partial.slice(0, 200);
  };
  try {
    for await (const chunk of input) {
      const text = chunk as string;
      let start = 0, end: number;
      while ((end = text.indexOf('\n', start)) !== -1) {
        add(text.slice(start, end));
        yield partial.endsWith('\r') ? partial.slice(0, -1) : partial;
        partial = ''; start = end + 1;
      }
      add(text.slice(start));
    }
    if (partial) yield partial;
  } finally { input.destroy(); }
}

/** Iterate a supplied string without a repository-sized split array. */
export function* suiteTextLines(text: string): Generator<string> {
  let start = 0, end: number;
  while ((end = text.indexOf('\n', start)) !== -1) {
    yield text.slice(start, end); start = end + 1;
  }
  if (start < text.length) yield text.slice(start);
}

export async function retainedLoadProofs(path: string): Promise<string[]> {
  const known = new Set<string>();
  for await (const line of suiteLogLines(path)) {
    if (line.startsWith('load gate: ')) for (const identity of loadProofIdentities(line)) known.add(identity);
  }
  return [...known].sort();
}

/** Records consumed by summaries, timings, failures, quarantine and interruption reports.
 * Storage scales with test receipts/diagnostics, not ordinary command output.
 */
const evidence = /^(?:suite (?:web phase |browser |provenance |timing |progress |skip |interruption |test failures |quarantine |admission timeouts |machine health |duration |budget overhead |command excerpt )|(?:#|ℹ) (?:tests|pass|fail|cancelled|skipped|todo) \d+\s*$|\s*not ok \d+|✖ |test at |duration (?:budget:|regression |check:|allowance stanza )|shard[- ]|verification queue wait |total cost |occasion |--- close shards ---|tier |typecheck: |load gate|quarantine load gate: |test lint |budget|T3 ratchet)/;
export class SuiteLogEvidence {
  readonly #records: string[] = [];
  readonly #commands = new Map<string, { name: string; line: string; tail: string[]; blanks: string[] }>();
  #command: string[] = [];
  push(raw: string): void {
    const line = raw.replace(/\x1b\[[0-9;]*m/g, '');
    if (line.startsWith('suite command excerpt ')) this.#command = [line];
    const end = /^suite command end (\S+) (\d+)$/.exec(line);
    const command = end && this.#commands.get(end[1]!);
    if (command && end) {
      this.#command = ['suite command excerpt ' + JSON.stringify({ summary: `${command.name} exited ${end[2]}: ${command.line}`, ...(end[2] !== '0' ? { output: command.tail.map((line, i, lines) => i === lines.length - 1 ? line.trimEnd() : line) } : {}) })];
      this.#commands.delete(end[1]!);
    }
    for (const active of this.#commands.values()) {
      if (!line.trim()) { active.blanks.push(line.slice(0, 200)); if (active.blanks.length > 20) active.blanks.shift(); }
      else { active.tail.push(...active.blanks, line.slice(0, 200)); active.tail = active.tail.slice(-20); active.blanks = []; }
    }
    if (line.startsWith('suite command start ')) {
      try {
        const row = JSON.parse(line.slice('suite command start '.length));
        if (typeof row.id === 'string' && !this.#commands.has(row.id) && typeof row.line === 'string' && (row.name === 'check' || row.name === 'test' || /^(?:T[1-4]|Web)$/.test(row.name))) this.#commands.set(row.id, { name: row.name, line: row.line, tail: [], blanks: [] });
      } catch { /* ordinary output */ }
    }
    if ((!line.startsWith('suite command excerpt ') && evidence.test(line)) || /failureType: ['"]testTimeoutFailure['"]/.test(line)) this.#records.push(line);
  }
  text(): string { return '\n' + this.#records.concat(this.#command).join('\n') + '\n'; }
}

export function suiteEvidence(text: string): string {
  const result = new SuiteLogEvidence();
  for (const line of suiteTextLines(text)) result.push(line);
  return result.text();
}

export async function readSuiteEvidence(path: string): Promise<string> {
  const result = new SuiteLogEvidence();
  for await (const line of suiteLogLines(path)) result.push(line);
  return result.text();
}

/** Copy raw output with bounded buffers, including a single unterminated line.
 * Failure annotations need only the line prefix; suffixes wait for its newline.
 */
async function* copiedLines(path: string, shard?: string): AsyncGenerator<string> {
  const input = createReadStream(path, { encoding: 'utf8' });
  let pending = '', continued = false, suffix = '';
  const begin = (line: string) => {
    suffix = shard && /^\s*(?:not ok \d+|✖ |duration budget: )/.test(line) ? ` [${shard}]` : '';
    return shard ? line.replace(/^tier ((?:T[1-4]|Web):)/, `${shard} tier $1`) : line;
  };
  try {
    for await (const chunk of input) {
      const text = chunk as string, output: string[] = [];
      let start = 0, end: number;
      while ((end = text.indexOf('\n', start)) !== -1) {
        const part = text.slice(start, end);
        if (continued) output.push(part + suffix + '\n');
        else {
          pending += part;
          if (!shard && pending === '--- close shards ---') { yield output.join(''); return; }
          output.push(begin(pending) + suffix + '\n');
        }
        pending = ''; continued = false; start = end + 1;
      }
      if (continued) output.push(text.slice(start));
      else {
        pending += text.slice(start);
        if (pending.length >= 65536) { output.push(begin(pending)); pending = ''; continued = true; }
      }
      if (output.length) yield output.join('');
    }
    if (continued) yield suffix;
    else if (pending) yield begin(pending) + suffix;
  } finally { input.destroy(); }
}

/** Atomic caller-owned replacement keeps collection retries from duplicating shards.
 * Only one shard is open at once; pipeline backpressure bounds pending writes.
 */
export async function aggregateSuiteLogs(path: string, shards: Array<{ log: string; shardName?: string }>, footer: string): Promise<void> {
  async function* chunks() {
    yield* copiedLines(path);
    yield '\n--- close shards ---\n';
    for (const shard of shards) {
      yield `--- ${shard.shardName} ---\n`;
      try { yield* copiedLines(shard.log, shard.shardName); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      yield '\n';
    }
    yield footer;
  }
  await pipeline(chunks(), createWriteStream(path + '.shards.tmp', { mode: 0o600 }));
}
