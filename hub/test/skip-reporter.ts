// A second Node test reporter: count diagnostics remain owned by the ordinary reporter.
import type { TestEvent } from 'node:test/reporters';
import { relative } from 'node:path';

export default async function* skipReporter(source: AsyncIterable<TestEvent>): AsyncGenerator<string> {
  const skips: Array<{ file: string; name: string; reason: string }> = [];
  for await (const event of source) {
    if (event.type !== 'test:pass' || !event.data.skip) continue;
    skips.push({
      file: event.data.file ? relative(process.env.TEST_SUITE_CWD ?? process.cwd(), event.data.file) : '(unknown file)',
      name: event.data.name,
      reason: typeof event.data.skip === 'string' ? event.data.skip : 'test marked skip without a reason',
    });
  }
  yield `suite skip details ${skips.length}\n`;
  for (const skip of skips.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name))) {
    yield `suite skip ${JSON.stringify(skip)}\n`;
  }
}
