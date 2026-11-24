// One final record, after executor collection and derived reports have settled.
import { rename } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { suiteTextLines } from './suite-log.ts';
import type { Platform, ExecutorKind } from './executor/executor.ts';
import { suiteAccounting } from './suite-accounting.ts';
import type { SuiteJob } from './hub/suites.ts';

type Provenance = { head: string; tree?: string | null; executor: ExecutorKind; platform?: Platform; occasion?: string; cached?: unknown } & Pick<SuiteJob, 'machine' | 'workers' | 'size' | 'packageClosure'>;
const metricsUnavailable = 'machine metrics unavailable: run interrupted before collection';
// Regenerate this run's disclosure only. A parent without its own closure
// receipt must retain the disclosures copied from its interrupted children.
const generatedFooter = (line: string, ownMetrics: boolean) => line.startsWith('suite provenance ') || line.startsWith('suite accounting ') || ownMetrics && line.startsWith(metricsUnavailable);
export function suiteProvenance(input: Provenance, lines: Iterable<string>) {
  let browser: { binary: string | null; version: string | null } = { binary: null, version: null };
  const skips: Array<{ file?: string; name?: string; reason: string | null }> = [];
  for (const line of lines) {
    try {
      if (line.startsWith('suite browser ')) browser = JSON.parse(line.slice('suite browser '.length));
      if (line.startsWith('suite skip {')) {
        const row = JSON.parse(line.slice('suite skip '.length));
        skips.push({ file: row.file, name: row.name, reason: typeof row.reason === 'string' && row.reason.trim() && row.reason !== 'test marked skip without a reason' ? row.reason : null });
      }
      if (line.startsWith('suite web phase ')) {
        const row = JSON.parse(line.slice('suite web phase '.length));
        if (row.status === 'not-run') skips.push({ name: 'Web phase', reason: row.reason || null });
      }
    } catch { /* An unusable diagnostic is not proof of browser execution. */ }
  }
  return `${input.packageClosure ? metricsUnavailable + '; cause: package closure incomplete; foreground exit ' + (input.packageClosure.nativeExit ?? 'unknown') + '\n' : ''}${input.machine ? 'suite accounting ' + suiteAccounting(input) + '\n' : ''}suite provenance ${JSON.stringify({ head: input.head, tree: input.tree ?? null, executor: input.executor, platform: input.platform ?? null, occasion: input.occasion ?? null, cached: input.cached ?? null, machine: input.machine ?? null, browser, skips, skipReasonCheck: { mode: 'report', missing: skips.filter(row => !row.reason).length } })}\n`;
}

const finalizations = new Map<string, Promise<void>>();
/** Hold shared legacy paths through artifact publication, not only the rename. */
export function appendSuiteProvenance(path: string, input: Provenance, evidence: string, publish: () => Promise<void>): Promise<void> {
  return withSuiteLogPublication(path, async () => {
    await finalizeSuiteProvenance(path, input, evidence);
    await publish();
  });
}

/** Retried publication keeps the same shared-path serialization as finalization. */
export function withSuiteLogPublication(path: string, publish: () => Promise<void>): Promise<void> {
  const previous = finalizations.get(path) ?? Promise.resolve();
  const work = previous.catch(() => {}).then(async () => {
    await publish();
  }).finally(() => { if (finalizations.get(path) === work) finalizations.delete(path); });
  finalizations.set(path, work);
  return work;
}

async function finalizeSuiteProvenance(path: string, input: Provenance, evidence: string): Promise<void> {
  // Atomic streaming replacement also removes predecessor footers on cache reuse.
  // Bound ordinary unterminated lines; retain neither raw logs nor duplicate copies.
  async function* chunks() {
    let pending = '', streaming = false, dropping = false;
    const inputStream = createReadStream(path, { encoding: 'utf8' });
    try {
      for await (const chunk of inputStream) {
        const text = chunk as string;
        let start = 0, end: number;
        while ((end = text.indexOf('\n', start)) !== -1) {
          const part = text.slice(start, end);
          if (streaming) { if (!dropping) yield part + '\n'; }
          else { pending += part; if (!generatedFooter(pending, !!input.packageClosure)) yield pending + '\n'; }
          pending = ''; streaming = false; dropping = false; start = end + 1;
        }
        if (streaming) { if (!dropping) yield text.slice(start); }
        else {
          pending += text.slice(start);
          if (pending.length >= 65536) {
            dropping = generatedFooter(pending, !!input.packageClosure);
            if (!dropping) yield pending;
            pending = ''; streaming = true;
          }
        }
      }
      if (pending && !generatedFooter(pending, !!input.packageClosure)) yield pending;
      yield '\n' + suiteProvenance(input, suiteTextLines(evidence));
    } finally { inputStream.destroy(); }
  }
  await pipeline(chunks(), createWriteStream(path + '.provenance.tmp', { mode: 0o600 }));
  await rename(path + '.provenance.tmp', path);
}
