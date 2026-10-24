// Execution-order progress is written as it arrives; skip details retain their
// historical exit summary. Ordered pass/fail events can wait behind a hung file.
import { fileEnvelope, reporterFile } from './reporter-file.ts';
import type { TestEvent } from 'node:test/reporters';
import { relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import { realClock, type Clock } from '../src/hub/clock.ts';
import type { TestProgress } from '../src/suite-progress.ts';

type Execution = { testId?: number; parentId?: number };
export default async function* skipReporter(source: AsyncIterable<TestEvent>, options: { cwd?: string; clock?: Clock; timings?: boolean; scope?: 'load-gate' } = {}): AsyncGenerator<string> {
  const cwd = options.cwd ?? process.env.TEST_SUITE_CWD ?? process.cwd();
  const clock = options.clock ?? realClock;
  const timings = options.timings ?? process.env.CLAND_TEST_TIMING_RECEIPTS === '1';
  const scope = options.scope ?? (process.env.CLAND_LOAD_GATE_START ? 'load-gate' : undefined);
  const phase = randomUUID();
  let sequence = 0;
  const active = new Map<string, TestProgress[]>();
  const names = new Map<string, string>();
  const skips: Array<{ file: string; name: string; reason: string }> = [];
  for await (const event of source) {
    if (event.type === 'test:dequeue' || event.type === 'test:complete') {
      const data = event.data as typeof event.data & Execution;
      if (event.type === 'test:dequeue') yield `suite start ${JSON.stringify({ file: data.file, name: data.name })}\n`;
      if (data.file) {
        const file = reporterFile(data.file, cwd);
        // Recent Nodes carry per-worker IDs. Location queues also support the
        // minimum Node release, whose execution events predate those IDs.
        const key = JSON.stringify([file, data.testId, data.line, data.column, data.nesting, data.name]);
        const pending = active.get(key) ?? [];
        if (event.type === 'test:dequeue') {
          const parent = data.parentId === undefined ? undefined : names.get(JSON.stringify([file, data.parentId, data.nesting - 1]));
          const name = parent ? `${parent} > ${data.name}` : data.name;
          names.set(JSON.stringify([file, data.testId, data.nesting]), name);
          const row: TestProgress = { event: 'start', id: `${phase}:${++sequence}`, file, name, at: clock.now().getTime(), nesting: data.nesting, ...(scope ? { scope } : {}), type: fileEnvelope(data, cwd) ? 'file' : event.data.type };
          pending.push(row); active.set(key, pending);
          yield `suite progress ${JSON.stringify(row)}\n`;
        } else if (event.type === 'test:complete') {
          const first = pending.shift();
          if (!pending.length) active.delete(key);
          const error = event.data.details.error as (Error & { failureType?: string }) | undefined;
          const cancelled = ['cancelledByParent', 'testAborted', 'testTimeoutFailure'].includes(error?.failureType ?? '');
          const row: TestProgress = { event: 'finish', id: first?.id ?? `${phase}:${++sequence}`, file, name: first?.name ?? data.name, at: clock.now().getTime(), nesting: data.nesting, ...(scope ? { scope } : {}),
            ...(error?.failureType === 'testTimeoutFailure' ? { timedOut: true } : {}),
            ...(first?.type || event.data.details.type ? { type: first?.type ?? event.data.details.type! } : {}), outcome: event.data.skip ? 'skip' : event.data.todo ? 'todo' : cancelled ? 'cancelled' : event.data.details.passed ? 'pass' : 'fail', seconds: event.data.details.duration_ms / 1000 };
          const timing = timings && row.type !== 'file' && data.nesting === 0 && data.line !== undefined ? `suite timing ${JSON.stringify({ file, name: data.name, seconds: row.seconds, outcome: row.outcome })}\n` : '';
          yield `suite progress ${JSON.stringify(row)}\n${timing}`;
        }
      }
    }
    if (event.type !== 'test:pass' || !event.data.skip) continue;
    skips.push({
      file: event.data.file ? relative(cwd, event.data.file) : '(unknown file)',
      name: event.data.name,
      reason: typeof event.data.skip === 'string' ? event.data.skip : 'test marked skip without a reason',
    });
  }
  yield `suite skip details ${skips.length}\n`;
  for (const skip of skips.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name))) {
    yield `suite skip ${JSON.stringify(skip)}\n`;
  }
}
