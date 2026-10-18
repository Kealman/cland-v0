// The parent reads this file before sweeping the phase root. Raw spec diagnostics
// remain in the log; only complete, accounted test failures can be excused.
import type { TestEvent } from 'node:test/reporters';
import { relative } from 'node:path';
import { Transform, type TransformCallback } from 'node:stream';
import type { QuarantineManifest, QuarantineReceipt } from '../src/suite-quarantine.ts';
import { admissionTimeoutMessage } from '../src/test-admission-outcome.ts';

export default class QuarantineReporter extends Transform {
  #manifest: QuarantineManifest = JSON.parse(process.env.CLAND_TEST_QUARANTINE ?? '{"version":1,"tests":{}}');
  #receipt: QuarantineReceipt = { complete: false, cancelled: 0, failures: [], results: [], excused: 0 };
  #children = new Map<string, Array<{ file: string; name: string; safe: boolean }>>();
  #admissions = new Map<string, string>();
  constructor() {
    super({ writableObjectMode: true });
    this.on('pipe', source => { if (source.getMaxListeners() > 0) source.setMaxListeners(Math.max(source.getMaxListeners(), 20)); });
  }
  override _transform(event: TestEvent, _encoding: BufferEncoding, callback: TransformCallback): void {
    if (event.type === 'test:summary' && event.data.file === undefined) {
      this.#receipt.complete = true;
      this.#receipt.cancelled = event.data.counts.cancelled;
    }
    if ((event.type === 'test:pass' || event.type === 'test:fail') && event.data.file) {
      const data = event.data;
      const file = relative(process.env.TEST_SUITE_CWD ?? process.cwd(), data.file!);
      const admission = event.type === 'test:fail' ? admissionTimeoutMessage(event.data.details.error) : null;
      // Classify only this event: an explicit admission call or a nested hook
      // must never suppress an ordinary assertion elsewhere in the same file.
      if (admission) {
        this.#admissions.set(file, admission);
        if (data.nesting === 0) {
          // This top-level envelope owns its already observed ordinary children.
          // They cannot be consumed by a subsequent quarantined test in the file.
          this.#receipt.failures.push(...(this.#children.get(file) ?? []).map(({ file, name }) => ({ file, name })));
          this.#children.delete(file);
        }
        callback(); return;
      }
      const pending = this.#children.get(file) ?? [];
      const failed = event.type === 'test:fail' && !data.todo && !data.skip;
      if (event.type === 'test:fail' && failed) {
        const error = event.data.details.error as Error & { failureType?: string };
        pending.push({ file, name: data.name, safe: data.line !== undefined && data.name !== data.file && ['testCodeFailure', 'subtestsFailed'].includes(error.failureType ?? '') });
      }
      if (data.nesting === 0) {
        const entry = data.line !== undefined && data.name !== data.file ? this.#manifest.tests[`${file}::${data.name}`] : undefined;
        if (entry) this.#receipt.results.push({ file, name: data.name, outcome: data.skip || data.todo ? 'skip' : failed ? 'fail' : 'pass', entry });
        if (entry && pending.every(failure => failure.safe)) this.#receipt.excused += pending.length;
        else this.#receipt.failures.push(...pending.map(({ file, name }) => ({ file, name })));
        this.#children.delete(file);
      } else this.#children.set(file, pending);
    }
    callback();
  }
  override _flush(callback: TransformCallback): void {
    if (this.#admissions.size) this.#receipt.admissionTimeouts = [...this.#admissions].map(([file, message]) => ({ file, message }));
    for (const pending of this.#children.values()) this.#receipt.failures.push(...pending.map(({ file, name }) => ({ file, name })));
    callback(null, JSON.stringify(this.#receipt));
  }
}
