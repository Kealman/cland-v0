// A separate file stream lets the runner discover names while the phase is busy.
import type { TestEvent } from 'node:test/reporters';
import { relative } from 'node:path';
import { Transform, type TransformCallback } from 'node:stream';

export type LoadGateEvent = { file: string; name: string; passed?: boolean; skipReason?: string };
export default class LoadGateReporter extends Transform {
  constructor() { super({ writableObjectMode: true }); }
  override _transform(event: TestEvent, _encoding: BufferEncoding, callback: TransformCallback): void {
    if (event.type !== 'test:enqueue' && event.type !== 'test:pass' && event.type !== 'test:fail') return callback();
    if (event.data.nesting !== 0 || !event.data.file || event.data.line === undefined || event.data.name === event.data.file) return callback();
    const record: LoadGateEvent = { file: relative(process.env.TEST_SUITE_CWD ?? process.cwd(), event.data.file), name: event.data.name };
    if (event.type !== 'test:enqueue') {
      record.passed = event.type === 'test:pass' && !event.data.skip && !event.data.todo;
      if (event.type === 'test:pass' && !event.data.todo && typeof event.data.skip === 'string' && event.data.skip.trim()) record.skipReason = event.data.skip;
    }
    callback(null, JSON.stringify(record) + '\n');
  }
}
