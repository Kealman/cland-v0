// A separate file stream lets the runner discover names while the phase is busy.
import { loadDiagnostic, redactLoadDiagnostic, redactLoadDiagnosticLines, type LoadDiagnostic } from '../src/suite-load-diagnostics.ts';
import type { TestEvent } from 'node:test/reporters';
import { reporterCaseFile } from './reporter-file.ts';
import { Transform, type TransformCallback } from 'node:stream';

export type LoadGateEvent = { file: string; name: string; passed?: boolean; skipReason?: string; diagnostic?: LoadDiagnostic; diagnosticLine?: string };
export default class LoadGateReporter extends Transform {
  readonly #env: NodeJS.ProcessEnv;
  readonly #owners = new Map<string, string>();
  #diagnosticBytes = 0;
  constructor(env: NodeJS.ProcessEnv = process.env) { super({ writableObjectMode: true }); this.#env = env; }
  override _transform(event: TestEvent, _encoding: BufferEncoding, callback: TransformCallback): void {
    if (event.type === 'test:diagnostic') {
      // Diagnostic events omit the name. Match the producer location captured
      // from its result; unrelated file-level summaries have no owner.
      const owner = this.#owners.get(this.#location(event.data));
      if (owner === undefined || !event.data.file) return callback();
      const remaining = 65_536 - this.#diagnosticBytes;
      if (remaining <= 0) return callback();
      const record = redactLoadDiagnosticLines({ file: reporterCaseFile(event.data, process.env.TEST_SUITE_CWD ?? process.cwd()), name: owner, diagnosticLine: event.data.message }, this.#env);
      const text = record.diagnosticLine;
      // Bound each candidate before JSON encoding; count encoded UTF-8 bytes,
      // including names and escaping, rather than collecting an unbounded log.
      record.diagnosticLine = text.slice(0, remaining);
      let line = JSON.stringify(record) + '\n';
      if (text.length > remaining || Buffer.byteLength(line) > remaining) {
        let low = 0, high = Math.min(text.length, remaining);
        while (low < high) {
          const middle = Math.ceil((low + high) / 2);
          record.diagnosticLine = text.slice(0, middle) + '[truncated]';
          if (Buffer.byteLength(JSON.stringify(record) + '\n') <= remaining) low = middle;
          else high = middle - 1;
        }
        record.diagnosticLine = text.slice(0, low) + '[truncated]';
        line = JSON.stringify(record) + '\n';
        if (Buffer.byteLength(line) > remaining) return callback();
      }
      this.#diagnosticBytes += Buffer.byteLength(line);
      return callback(null, line);
    }
    if (event.type !== 'test:enqueue' && event.type !== 'test:pass' && event.type !== 'test:fail') return callback();
    if (!event.data.file) return callback();
    if (event.type !== 'test:enqueue') this.#owners.set(this.#location(event.data), event.data.name);
    const topLevel = event.data.nesting === 0 && event.data.line !== undefined && event.data.name !== event.data.file;
    if (!topLevel && event.type !== 'test:fail') return callback();
    const record: LoadGateEvent = { file: reporterCaseFile(event.data, process.env.TEST_SUITE_CWD ?? process.cwd()), name: event.data.name };
    if (event.type === 'test:fail') record.diagnostic = loadDiagnostic(event.data.details.error);
    if (topLevel && event.type !== 'test:enqueue') {
      record.passed = event.type === 'test:pass' && !event.data.skip && !event.data.todo;
      if (event.type === 'test:pass' && !event.data.todo && typeof event.data.skip === 'string' && event.data.skip.trim()) record.skipReason = event.data.skip;
    }
    if (record.diagnostic) record.diagnostic = redactLoadDiagnostic(record.diagnostic, this.#env);
    callback(null, JSON.stringify(record) + '\n');
  }
  #location(data: { file?: string; line?: number; column?: number; nesting: number; entryFile?: string }): string {
    return JSON.stringify([data.entryFile ?? data.file, data.file, data.line, data.column, data.nesting]);
  }
}
