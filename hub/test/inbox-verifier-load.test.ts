// T4 load: three 100-frame delivery/list bursts retain the original sustained-work proof.
// The same indexed-query and coalescing invariants run with eight frames in inbox-workload (T2).
import test from 'node:test';
import { verifierWorkload } from './inbox-archive-workload.ts';

test('100-frame verifier delivery bursts never scan retained message history', t => verifierWorkload(t, 100));
