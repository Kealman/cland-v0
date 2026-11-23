import assert from 'node:assert/strict';
import type { ItemView } from '../src/tracker/tracker.ts';
import { eventually, type inProcessSpoke } from './harness.ts';
import { mergeStep } from './merge-case.ts';

/** Observe setup through the same public view as clients; never retry a merge effect. */
export async function waitMergeReady(rev: Awaited<ReturnType<typeof inProcessSpoke>>, id: string, advance?: () => Promise<void>) {
  const view = await mergeStep('reviewed task readiness setup', () => eventually('reviewed task ready with current review', async () => {
    const reply = await mergeStep('public ready/current observation', async () => {
      await advance?.();
      return rev.call<{ ok: boolean; error?: string; item: ItemView }>('task.view', { id });
    });
    assert.equal(reply.ok, true, reply.error);
    const review = reply.item.verdicts.findLast(v => v.source === 'hub' && v.verdict === 'review');
    return reply.item.status === 'ready' && review?.current === true ? reply.item : undefined;
  }));
  assert.equal(view.status, 'ready');
  assert.equal(view.verdicts.findLast(v => v.source === 'hub' && v.verdict === 'review')?.current, true);
}
