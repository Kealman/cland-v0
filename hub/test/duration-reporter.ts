// File destination only: the parent retains these records before phase cleanup.
import type { TestEvent } from 'node:test/reporters';
import { relative } from 'node:path';
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
    if ((event.type === 'test:pass' || event.type === 'test:fail') && event.data.nesting === 0 && event.data.file && event.data.line !== undefined) {
      record = JSON.stringify({ file: relative(process.env.TEST_SUITE_CWD ?? process.cwd(), event.data.file), name: event.data.name, seconds: event.data.details.duration_ms / 1000 }) + '\n';
    }
    this.#overheadMs += performance.now() - started;
    callback(null, record);
  }
  override _flush(callback: TransformCallback): void {
    callback(null, JSON.stringify({ overheadMs: this.#overheadMs }) + '\n');
  }
}
