---
id: T-710
kind: task
title: cland merge enqueues a reviewed head into a hub-owned merge queue, behind [merge] queue
state: open
status: ready
size: M
criterion_seq: 5
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-678
blocked_by: []
topic: topic-488
branch: t/T-710-cland-merge-enqueues-a-reviewed-head
created: 2026-10-16T19:59:43.498Z
updated: 2026-10-18T10:46:26.438Z
---

## Summary

Decision 1: a hub-owned merge queue lands reviewed heads in batches of up to three, runs T3 once per batch and bisects red by file; the Coordinator's manual covers retire when it lands (memo §4 option c, §5.2.5). Today `cland merge` squashes a ready task onto `dev` at once, under the territory lock (`hub/src/hub/merge.ts` `TaskMerges.merge`). This ticket adds the queue's durable entries and their lifecycle; nothing lands from the queue until T-711.

## What to build

- **The switch.** `[merge] queue = false | true` in `.cland/config.toml`, default `false`. With `false`, `merge` behaves exactly as today.
- **Enqueue.** With `true`, `merge` (CLI and MCP) runs today's verdict gate and lane holds first. A task whose change touches only the override paths (tracker and docs, `MERGE_OVERRIDE_PATHS`) lands at once as today, and so does a human-shell override. Any other task becomes a durable entry `{ item, branch, head, verdict base, enqueued, by }` in the hub's database. The reply is `queued <position>`, and `task view` shows `merge queue <position> since <time>`. The item stays `ready` until it lands.
- **Visible.** `cland merge queue [--json]` lists the entries in order, and `hub status --json` includes them.
- **Dropped entries.** An entry is dropped with a `merge-queue-dropped` notice to its requester and lead, naming the reason, when its branch head changes, a not-clear verdict arrives, the item closes, or the requester's lead or the Coordinator runs `cland merge T-n --cancel`.
- **Durable.** Entries and their order survive a hub restart.

## Acceptance criteria

- [x] C1. With `queue = true`, merging a reviewed code task replies `queued 1`, and `task view` and `cland merge queue` show the entry, proved by a merge test on `projectHub`.
  - done: impl-710 · 2026-10-18T10:16:46.957Z
  - verified: rev-30 [reviewer] · run rev-20261018-710-final · 2026-10-18T10:46:24.213Z · commit 0b70662f62863acaa65d33c0852d21ce6b2d11a5
- [x] C2. With `queue = true`, a tracker-and-docs-only task and a human-shell override land at once with today's receipts, proved by merge tests.
  - done: impl-710 · 2026-10-18T09:31:56.291Z
  - verified: rev-30 [reviewer] · run rev-20261018-710-final · 2026-10-18T10:46:24.213Z · commit 0b70662f62863acaa65d33c0852d21ce6b2d11a5
- [x] C3. A head change, a not-clear verdict, an item close and `--cancel` each drop the entry with `merge-queue-dropped` and the reason, proved by tests.
  - done: impl-710 · 2026-10-18T09:42:08.630Z
  - verified: rev-30 [reviewer] · run rev-20261018-710-final · 2026-10-18T10:46:24.213Z · commit 0b70662f62863acaa65d33c0852d21ce6b2d11a5
- [x] C4. Entries and their order survive a hub restart, proved by a restart test.
  - done: impl-710 · 2026-10-18T09:32:00.898Z
  - verified: rev-30 [reviewer] · run rev-20261018-710-final · 2026-10-18T10:46:24.213Z · commit 0b70662f62863acaa65d33c0852d21ce6b2d11a5
- [x] C5. With `queue = false` the existing merge-gate, merge-recovery and merge-checkout tests pass unchanged.
  - done: impl-710 · 2026-10-18T09:32:02.458Z
  - verified: rev-30 [reviewer] · run rev-20261018-710-final · 2026-10-18T10:46:24.213Z · commit 0b70662f62863acaa65d33c0852d21ce6b2d11a5

## Comments

### impl-710 · 2026-10-18T09:20:40.341Z

Implementation started. Proposed seams sent to supervising Lead for confirmation: projectHub T2 public merge/tool rules and in-process Store reopen for durability. Investigating existing verdict/lane gate and Git fact port; expected no shared suites.ts/suite-candidate.ts/territory.ts edits.

### rev-30 · 2026-10-18T09:41:03.128Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-710-source
commit: 4ddb5f37edc939e927e1a588c438c879d637a55d
scope: full
findings: [{"severity":"medium","text":"M1: cancellation passes worktrees.serial directly to success-only later(). A queued caller losing current-session/merge authority makes authorize() throw asynchronously, so no result is sent and an unhandled rejection escapes. Convert rejection to a failure frame and add a queued authority-revocation regression that preserves the entry.","file":"hub/src/hub/dispatch.ts","line":947}]
finding_counts: {"high":0,"medium":1,"low":0}

Source audit A-5150: one medium finding M1. Queued --cancel rechecks authority inside worktrees.serial but passes its rejecting promise directly to later(), without the regular merge path's failure conversion. Role/current-session revocation while waiting produces an unhandled rejection and no result. Preserve the check, return Dispatcher.#failure and cover queued revocation. Remaining queue/bypass/durability/drop source paths audited with no additional findings; exact-head verification awaits corrected source.

Criteria: C3 failed (Queued cancellation can lose its reply and produce an unhandled rejection when authority changes while waiting; see M1/A-5150.).

### rev-30 · 2026-10-18T09:42:56.458Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-710-source-correction
commit: 1f2be3de137efb5818b18ce2d9199dc9be9a290b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-5155: M1/A-5150 closed. Cancellation converts asynchronous rejection to a failure frame while preserving the authority recheck. New public-frame regression proves queued authority revocation replies forbidden and retains the entry, with predecessor completion observed before result assertions and unconditional barrier cleanup. Exact two-file correction; no dev merge or further findings. Source clear for fresh exact-head droplet verification; all C1–C5 runtime marks remain pending that evidence.

### rev-30 · 2026-10-18T10:13:17.707Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261018-710-runtime
commit: 1f2be3de137efb5818b18ce2d9199dc9be9a290b
scope: evidence
findings: [{"severity":"medium","text":"M2: DOCUMENTED_TOOLS omits new merge.queue, breaking four exact public-tool census/count assertions in resilience, spoke-identity and surface. Add the new API to the shared expected census while preserving exact assertions and audit all carrier readers.","file":"hub/test/harness.ts","line":40}]
finding_counts: {"high":0,"medium":1,"low":0}

A-5188: A-5185 exit1 has four task-caused exact public-tool census failures from DOCUMENTED_TOOLS omitting merge.queue, plus a separate unclassified executor-safety two-project remote-result timeout. Preserve exact-list/count checks, update census/readers and request fresh source review. Queue/Store/policy/legacy merge carriers pass, and six owned new identities pass30/30 repetitions; retain that evidence. Separate timeout needs lead disposition; no same-head blind retry.

Criteria: C1 failed (New merge.queue tool is missing from shared public-tool census, causing four exact surface/identity/resilience failures (M2).).

### rev-30 · 2026-10-18T10:17:24.172Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-710-census-correction
commit: 0b70662f62863acaa65d33c0852d21ce6b2d11a5
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-5194: M2 source correction clear, exact one-line DOCUMENTED_TOOLS update; four exact consumer assertions preserved and independently audited. Actual resolved SHA is 0b70662f62863acaa65d33c0852d21ce6b2d11a5; request/A-5193 full SHA was malformed and needs labeling correction. No source findings. Coordinator e4e7e155 classifies separate timeout as T-797 and authorizes one second droplet receipt; C1–C5 final verification awaits that gate.

### impl-710 · 2026-10-18T10:45:56.927Z

Exact reviewed head 0b70662f62863acaa65d33c0852d21ce6b2d11a5 now has green full Linux droplet receipt 8f66df5b / A-5218: 2549 tests, 2541 pass, 0 fail, 8 skip; hub and Neovim suites complete. All five queue cases plus the reviewed-docs immediate-landing case passed their 5/5 load gates (30/30 owned repetitions); slowest queue case 1.175s. Census M2 correction and queued cancellation M1 remain in this unchanged clean head. Coordinator-authorized T-797 second receipt is green; awaiting Reviewer final criterion/verdict settlement.

### rev-30 · 2026-10-18T10:46:24.213Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-710-final
commit: 0b70662f62863acaa65d33c0852d21ce6b2d11a5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-5220: exact-head A-5218 passes full hub/Neovim, 2541 pass/0 fail/8 prerequisite skips. Queue5/5, Store18/18, policy13/13, all unchanged merge-gate/recovery/checkout and corrected surface carriers pass. Eight new owned groups pass40/40 repetitions; no owned trips/hard budgets. T-797 timeout case passes0.583s. All C1–C5 verified, including Coordinator-approved Store reopen seam for C4. No findings.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
