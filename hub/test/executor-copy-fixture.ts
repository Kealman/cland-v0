import type { TestContext } from 'node:test';
import { fixtureWork, type FixtureStep } from '../../test-support/fixture-work.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { fakeOnlyFixture } from './fake-only-fixture.ts';
import type { Clock } from '../src/hub/clock.ts';

/** Own only the copy cases: fence normal/signal closure before new acquisitions. */
export async function copyFixtureCase(t: TestContext, body: (root: string, setup: <T>(name: string, work: () => Promise<T>) => Promise<T>, step: FixtureStep) => Promise<void>, options: { clock?: Clock } = {}): Promise<void> {
  const owner = fixtureWork();
  const close = () => owner.close();
  t.after(close);
  const abort = () => { void close().catch(() => {}); };
  t.signal.addEventListener('abort', abort, { once: true });
  t.after(() => t.signal.removeEventListener('abort', abort));
  if (t.signal.aborted) abort();
  const deadlines = caseDeadlines(t, { timeoutMs: 5000, ...options });
  await owner.run(async step => {
    const setup = async <T>(name: string, work: () => Promise<T>): Promise<T> => {
      const original = step(work);
      try { return await deadlines.wait(name, () => original); }
      catch (error) {
        void close().catch(() => {});
        await original.catch(() => {});
        throw error;
      }
    };
    let acquisition = 0;
    await fakeOnlyFixture(t, root => step(() => body(root, setup, step)), operation => {
      // The third operation is the behaviour; bound guard and root separately.
      if (++acquisition === 1) return setup('copy native guard setup', operation);
      if (acquisition === 2) return setup('copy fixture root setup', operation);
      return step(operation);
    });
  });
}
