// T1: pure receipt eligibility, without a hub, executor or native launcher.
import test from 'node:test';
import assert from 'node:assert/strict';
import { memberVerificationReason, batchT1Summary } from '../src/batch-member-verification.ts';
import { tierReceipt, type TierReceipt } from '../src/verification-tier-receipts.ts';
import type { SuiteJob } from '../src/hub/suites.ts';

const member = { item: 'T-1', branch: 't/1', head: 'head' };
const plan = [{ name: 'check', command: 'check' }, { name: 'T1', command: 'unit' }, { name: 'T2', command: 'component' }] as const;
const rows = () => plan.map(step => tierReceipt({ id: 'run', tree: 'tree' }, step, 0));
function receipt(changes: Partial<SuiteJob> = {}): SuiteJob {
  return { id: 'run', ...member, mode: 'auto', tree: 'tree', reported: true, artifact: 'A-1', outcome: { code: 0, cause: 'completed' },
    commands: { check: 'check', test: 'test', prepare: '', plan: [...plan] }, tierReceipts: rows(),
    selection: { mode: 'full', reason: 'task', files: [], tiers: ['T1', 'T2'] }, ...changes } as SuiteJob;
}

test('printed tier lines without producer receipts never authorize T1 omission', () => {
  const job = receipt({ tierReceipts: [] });
  job.outcome!.cause = 'verification step binding {"run":"run","tree":"tree","command":"check"}\ntier T0: exit 0; duration 1 s; output tail: passed\ntier T1: exit 0; duration 1 s; output tail: passed\ntier T2: exit 0; duration 1 s; output tail: passed';
  assert.ok(memberVerificationReason(member, job));
});

test('complete mode-free producer receipts cover a pinned member', () => {
  assert.equal(memberVerificationReason(member, receipt()), null);
  assert.match(batchT1Summary(), /legacy/);
  assert.doesNotMatch(batchT1Summary(), /skipped/);
});

for (const [name, changes] of Object.entries({
  'older head': { head: 'old' }, 'explicit mode': { mode: 'all' }, 'different member': { item: 'T-2' },
  'missing artifact': { artifact: null }, 'unreported result': { reported: false }, 'failed result': { outcome: { code: 1, cause: 'failed' } },
  'cancelled result': { cancelled: true }, 'unavailable Web': { webPhase: { status: 'not-run', reason: 'unavailable' } },
  'missing plan': { commands: { check: 'check', test: 'test', prepare: '' } }, 'partial tiers': { selection: { mode: 'full', reason: 'partial', files: [], tiers: ['T1'] } },
} as Record<string, Partial<SuiteJob>>)) test(`${name} retains batch T1`, () => {
  assert.ok(memberVerificationReason(member, receipt(changes)));
});

test('missing failed incomplete or foreign producer records retain T1', () => {
  for (const bad of [
    rows().slice(1), rows().map(row => row.tier === 'T2' ? { ...row, exit: 1 } : row),
    rows().map(row => row.tier === 'T2' ? { ...row, exit: null, completion: 'incomplete' as const } : row),
    rows().map(row => ({ ...row, tree: 'other' })), rows().map(row => ({ ...row, run: 'other' })),
    rows().map(row => ({ ...row, command: 'other' })),
  ]) assert.ok(memberVerificationReason(member, receipt({ tierReceipts: bad })));
});

test('only ordered same-owner and same-command receipts supersede interrupted attempts', () => {
  const aborted: TierReceipt = { ...rows()[0]!, exit: 143 };
  assert.equal(memberVerificationReason(member, receipt({ tierReceipts: [aborted, ...rows()] })), null);
  for (const changed of [{ run: 'other' }, { tree: 'other' }, { command: 'other' }]) {
    assert.ok(memberVerificationReason(member, receipt({ tierReceipts: [{ ...aborted, ...changed }, ...rows()] })));
  }
  assert.ok(memberVerificationReason(member, receipt({ tierReceipts: [...rows(), aborted] })));
  assert.ok(memberVerificationReason(member, receipt({ tierReceipts: [{ ...aborted, exit: 1 }, ...rows()] })));
});

test('same-tree cache proof belongs to its source without borrowing source member identity', () => {
  const source = receipt({ item: 'T-2', branch: 't/2', head: 'older' });
  const cached = receipt({ id: 'cached', cached: { run: 'run', head: 'older', tree: 'tree' }, tierReceipts: [] });
  assert.equal(memberVerificationReason(member, cached, source), null);
  assert.ok(memberVerificationReason(member, cached));
  assert.ok(memberVerificationReason(member, cached, receipt({ tree: 'different' })));
  assert.ok(memberVerificationReason(member, cached, receipt({ outcome: { code: 1, cause: 'failed' } })));
});
