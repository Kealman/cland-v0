// Side-file timings are retained by the parent before phase cleanup.
import { fileEnvelope, reporterFile } from './reporter-file.ts';
import type { TestEvent } from 'node:test/reporters';
import { EventEmitter } from 'node:events';
import { Transform, type TransformCallback } from 'node:stream';

export default class DurationReporter extends Transform {
  #overheadMs = 0;
  constructor() {
    super({ writableObjectMode: true });
    // This reporter is attached first, before the other two pipelines add their
    // end listeners. Adjust only their shared stream, keeping a finite ceiling.
    this.on('pipe', source => {
      const started = performance.now();
      if (source instanceof EventEmitter && source.getMaxListeners() > 0) source.setMaxListeners(Math.max(source.getMaxListeners(), 20));
      this.#overheadMs += performance.now() - started;
    });
  }
  override _transform(event: TestEvent, _encoding: BufferEncoding, callback: TransformCallback): void {
    const started = performance.now();
    let record: string | undefined;
    if (event.type === 'test:complete' && event.data.nesting === 0 && event.data.file && event.data.line !== undefined) {
      const file = reporterFile(event.data.file, process.env.TEST_SUITE_CWD ?? process.cwd());
      // test:complete also includes the file envelope that ordered pass/fail
      // suppresses when the file contains tests. Do not double its duration.
      if (!fileEnvelope(event.data, process.env.TEST_SUITE_CWD ?? process.cwd())) record = JSON.stringify({ file, name: event.data.name, seconds: event.data.details.duration_ms / 1000 }) + '\n';
    }
    this.#overheadMs += performance.now() - started;
    callback(null, record);
  }
  override _flush(callback: TransformCallback): void {
    callback(null, JSON.stringify({ overheadMs: this.#overheadMs }) + '\n');
  }
}
