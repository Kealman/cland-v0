---
id: T-1630
kind: task
title: Merge bisect blocks when the failing test file belongs to the omitted member
state: open
status: ready
size: S
criterion_seq: 3
labels: []
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1586
branch: t/T-1630-merge-bisect-blocks-when-the-failing
created: 2026-11-02T07:20:05.309Z
updated: 2026-11-17T05:39:38.024Z
---

## Summary

When a merge batch fails on a test file that one member introduced, the bisect's omit-that-member candidate cannot run the failing file (it does not exist there), and the hub blocks the whole batch with `unknown explicit hub shard file: <file>` and "Waiting for human or Coordinator action". The remaining members are innocent by construction but stall until a Coordinator intervenes.

## Evidence

Batch 6874db04 (T-1621, T-1587, T-1589), run 18d544e5 at candidate 2915b42b, 2026-11-02 07:17Z: T1 failed only `hub/test/state-paths-lint.test.ts` (added by T-1621). The diagnosis job omit-0 (without T-1621) blocked at 07:19:16Z with `unknown explicit hub shard file: hub/test/state-paths-lint.test.ts`. Coordinator cancelled T-1587 and T-1589 (07:19:29Z/07:19:31Z) and re-enqueued them; a batch 30449177 of the same two members then ran on run b21c2e05.

## What to build

A failing file that is absent from an omit candidate attributes the failure to the omitted member: the omitted member is dropped with that reason and the remaining members continue to their landing run, without a human or Coordinator action. Cancelling and re-enqueueing members of a blocked batch must not leave a duplicate batch and queue entry for the same heads.

## Acceptance criteria

- [x] C1. A batch whose only failing file was added by one member drops that member with a reason naming the file and lands the others after their own run, with no blocked state (test).
  - done: impl-1630 · 2026-11-17T05:02:14.549Z
  - verified: rev-35 [reviewer] · run rev-35-1630-final-1 · 2026-11-17T05:39:37.813Z · commit fb00b18811274c5de2ef9707f000f98fc8867edf
- [x] C2. The blocked notice for a genuinely unrunnable candidate names the members and the recovery command (test).
  - done: impl-1630 · 2026-11-17T05:02:15.320Z
  - verified: rev-35 [reviewer] · run rev-35-1630-final-1 · 2026-11-17T05:39:37.813Z · commit fb00b18811274c5de2ef9707f000f98fc8867edf
- [x] C3. Cancelling a member of a blocked batch and re-enqueueing it leaves exactly one queue entry or batch membership for that head (test).
  - done: impl-1630 · 2026-11-17T05:02:15.892Z
  - verified: rev-35 [reviewer] · run rev-35-1630-final-1 · 2026-11-17T05:39:37.813Z · commit fb00b18811274c5de2ef9707f000f98fc8867edf

## Comments

### coord · 2026-11-02T08:06:27.539Z

Follow-up evidence (coord, 2026-11-02 08:07Z): batch 30449177 (T-1587 and T-1589, run b21c2e05) finished green at 08:01Z but landed nothing. Both members had been cancelled and re-enqueued while that batch was forming, so its result was discarded. A new batch, f57a84aa (T-1627, T-1587, T-1589, run 4dfec4ec), then re-ran the same heads, which cost about 40 min of droplet time and the queue position. C3 should cover this case. Either a green batch whose members were re-enqueued at unchanged heads lands them, or the re-enqueue joins the batch that is forming.

### impl-1630 · 2026-11-17T04:42:59.324Z

Consumer inventory before outcome/policy change: MergeBatches diagnostic admission and hold/report paths; MergeQueue.enqueue/drop and Store merge_queue persistence; hub/core batch projection and merge-landing-reports; suite-shards ShardManifestError; merge-batches T1, merge-queue T2 (same-head cancel/re-enqueue expectation), store tests; CLI merge usage; hub/README running reference, docs/hub/running.md, docs/agents/tests.md and per-file merge-batches guide; shipped merge skill. Searches covered merge-batch, merge-bisected, BatchBoundary, unknown explicit hub shard file, enqueueMerge and cancel/re-enqueue across production, tests, skills and docs. No wire shape change; old client projections remain unchanged. Plan: missing-file attribution only after positive ENOENT on an explicit-shard refusal; unchanged-head re-enqueue rejoins retained batch identity instead of invalidating its receipt.

### impl-1630 · 2026-11-17T04:48:55.728Z

C1 implemented at explicit shard admission: ENOENT for a failing file on an omit candidate drops the omitted member with the file named; survivors get their own full run. Existing files and other admission errors stay held with members/commands. C3 reuses captured request identity for matching branch/head/base and restarts a held batch only after worker drainage, atomically recording recovery intent. Existing wire projections unchanged; optional internal retryRequested defaults absent for old persisted batches. Consumer follow-up search across all tiers, web/nvim, QA briefs and shipped skills found historical batch evidence readers and reference docs unaffected; migrated public merge-queue same-head test and duration identity, updated operational docs/help/merge skill. Local macOS Node24: T1 merge-batches 85/85, T2 merge-queue 38/38, hub typecheck passed. Full verification pending source review/window; no T3/T4/Web run.

### rev-35 · 2026-11-17T04:56:53.206Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1630-source-1
commit: 101074d818f1d2a0f02fa0596d3de4579704eae1
scope: full
findings: [{"severity":"medium","text":"The four new controller cases and changed public merge-queue callback acquire fixtures without a whole-callback owner. Partial/resource/Suites/runner close hooks do not join late setup/body continuations before roots/storage/mocks are disposed; lead confirms no earlier fence or exception.","file":"hub/test/merge-batches.test.ts","line":81},{"severity":"medium","text":"The two new MERGE_USAGE policy lines were not migrated to fixtures/cli-usage/commands.json:31. frozenUsage therefore disagrees with production in cli-usage-compatibility's all-export deep equality and cli-help's frozen composition; retain those assertions and migrate the missed consumer.","file":"hub/src/cli/usage/merge.ts","line":2}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source not clear; A-20630. Standards2medium: whole-callback ownership and stale frozen MERGE_USAGE consumer. Lead60443643/986699fa confirms no prior owners/exceptions. Spec0 independently confirmed nominal algorithm defects: positive ENOENT attribution, fresh survivor plan, member/recovery notices and transactional captured-request/held recovery paths otherwise accepted. All runtime criteria remain unverified. A-20629 corrects A-20622: old full85/85 predates final atomic/fixture changes; affected selections2/2 and3/3 later, public old37/38 then selected1/1 and full38/38, queue-unit8/8, final hub typing/lint0. Raw/native/hash/tree/scan-control limits and incomplete consumer census retained; no configured/Web/T3/T4 proof. Exact help equality consumer is cli-usage-compatibility via frozenUsage, not native cli-usage-merge. No Reviewer runtime/edit. Consolidate corrections and request fresh committed source review before verification.

Criteria: C1 failed (New missing-file regression lacks whole-callback cleanup ownership before fixture acquisition.), C2 failed (New blocked-notice regression lacks callback ownership, and matching frozen CLI help bytes remain stale.), C3 failed (Added/reworked cancel/re-enqueue regressions lack whole-callback setup/body cleanup ownership.).

### impl-1630 · 2026-11-17T05:00:42.116Z

Addressing rev-35-1630-source-1: added T1 callbacks now enroll pure fixtureWork before fixture acquisition, proxy late cleanup registrations behind owner.close, and fence asynchronous body steps. Public T2 case uses caseDeadlines with shared beforeDirectories/guardDirectoryRemoval and root adoption; original positive assertions retained. Migrated only the MERGE_USAGE frozen commands.json bytes; compatibility/help comparisons remain exact. Local macOS Node24 working-tree checks: affected T1 4/4; public same-head T2 1/1; cli-usage-compatibility first reproduced stale-byte deepEqual red then 1/1 green; cli-help T2 9/9; hub typecheck exit0. Coordinator decision 66f73034 permits these attributed local finding-fix reruns. Whole-source lint pending. No new dev merge or configured verify.

### rev-35 · 2026-11-17T05:09:29.927Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1630-source-2
commit: fb00b18811274c5de2ef9707f000f98fc8867edf
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Consolidated source clear; A-20643. Both A-20630 mediums resolved: pure fixtureWork/late-hook joins fence four T1 callbacks before acquisition; public T2 uses caseDeadlines shared normal/signal owner, proxy hooks/root adoption and fenced body. Original nominal assertions retained. Frozen MERGE_USAGE now statically equals production exactly; only that block/two policy lines changed, exact compatibility/help assertions unchanged. Production/duration/docs/skill basis unchanged, no dev merge. A-20635 correction partial4T1/1T2, compatibility red→1/1green, CLI-help9/9, hub typing0 and reported lint0/0refusals remain precommit working-tree evidence with unknown raw/hash/native-signal/scan controls. Standards/Spec findings none; C1-C3 unverified test criteria pending configured same-head evidence. No Reviewer runtime or final verification claim.

### impl-1630 · 2026-11-17T05:36:02.813Z

Configured same-head receipt: run 108d24cb-1100-4c14-88d0-cfd78f7338b5, A-20656, head fb00b18811274c5de2ef9707f000f98fc8867edf / tree 0a88e91dbe5c61387121a6666d35a2a76751b123. Exit0; 6558 tests passed, zero fail/cancel/skip. T0, all T1, fallback all T2 and Web completed; no T3/T4 in this task run (remaining T3 deferred to batch/integrated coverage). Droplet Linux x64 6.8.0-147-generic, Node24.21, Neovim0.12.5; isolated Chrome Headless Shell / Google Chrome for Testing156.0.8078.4. New four merge-batches named cases have 5/5 load receipts; changed public same-head merge-queue case has a positive pass receipt. Duration/lint/budget findings are report-only, retained in the log, including merge-batches file 13.373s >10s. Droplet lifetime1375s, cost$0.0955. Source unchanged. Reviewer received same result and will settle final criteria/verdict.

### rev-35 · 2026-11-17T05:39:37.813Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1630-final-1
commit: fb00b18811274c5de2ef9707f000f98fc8867edf
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; A-20660.108d24cb/A-20656 exit0 matches clean reviewedfb00b1881 and normalized0a88e91d... . C1file-owner/survivor policy pass4043/proof4277; C2present-file held notice4052/proof4224; C3running/held request cases4058/4065 with5/5proof4426/4489 and public case23536 pass. Frozen-help compatibility1135 pass; nominal/source assertions retained, no matched required-case tier diagnostic. Parsed6558ordinary/707file plus270load positives, nofail/cancel/skip; T0/all224T1/all428T2/55Web green,269T3/17T4 unexecuted. Provenance38008 uncachedLinuxx64/Node24.21/Nvim0.12.5, actual browser35438 HeadlessShell1248/CfT156. Delivered1375s/$0.0955 provider interval separate from test wall; report-only lint/budget/ratchet/skip advisories and historical provenance limits retained. Standards/Spec0 findings; C1-C3 verified. No Reviewer runtime, real production batch landing or integrated/QA claim.

Criteria: C1 verified, C2 verified, C3 verified.
