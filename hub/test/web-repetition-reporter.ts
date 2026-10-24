// One terminal summary per fresh file process; partial output supplies no proof.
import type { TestEvent } from 'node:test/reporters';
import { loadDiagnostic } from '../src/suite-load-diagnostics.ts';
export default async function* report(events: AsyncIterable<TestEvent>) {
  for await (const event of events) {
    if (event.type === 'test:fail') process.stderr.write(JSON.stringify({ file: event.data.file, name: event.data.name, error: loadDiagnostic(event.data.details.error) }) + '\n');
    if (event.type === 'test:summary' && event.data.file === undefined) {
      const counts = event.data.counts;
      yield JSON.stringify({ complete: true, passed: counts.passed, failed: event.data.success ? 0 : 1,
        skipped: counts.skipped + counts.todo }) + '\n';
    }
  }
}
