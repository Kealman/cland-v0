---
id: T-1970
kind: task
title: Droplet acquisition and preparation let a release or checkpoint rejection replace a non-readiness primary error
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2075
blocked_by: []
topic: topic-1758
branch: t/T-1970-droplet-acquisition-and-preparation-let
created: 2026-11-18T12:06:58.160Z
updated: 2026-11-25T04:53:17.931Z
closed: 2026-11-25T04:53:17.931Z
---

## Summary

Found by impl-1643 while fixing T-1643 (2026-11-18), pre-existing. T-1643 makes the new typed readiness-deadline error survive prepareSnapshot wrapping and builder release or checkpoint rejection, with cleanup failures attached as secondary diagnostics. Other primary errors in the same acquisition and preparation paths still follow the older policy, where a later release or checkpoint rejection can replace the original error. That breaks rule 39: once an outcome is selected, a later ancillary failure only adds a secondary diagnostic.

## What to build

Apply T-1643's preservation to every primary error in droplet acquisition and preparation: keep the first error as the outcome, preserve wrapper causes, attach release and checkpoint failures as secondary diagnostics, and retain cleanup ownership when release fails.

## Acceptance criteria

- [x] C1. For a non-readiness primary error (for example a provider create failure) followed by a rejected release or checkpoint, the reported outcome is the original error, with the cleanup failure attached secondarily and its retained records listed (test with fakes).
  - done: impl-1970 · 2026-11-25T01:55:14.138Z
  - verified: rev-41 [reviewer] · run rev-41-20261125-1970-final · 2026-11-25T03:03:31.230Z · commit abb33eba376ea7fad2fcd202aac606969a43ca5b
- [x] C2. Every catch-and-release site in acquisition and preparation is listed with its disposition (rule 41).
  - done: impl-1970 · 2026-11-25T01:55:14.713Z
  - verified: rev-41 [reviewer] · run rev-41-20261125-1970-source2 · 2026-11-25T01:58:45.273Z · commit abb33eba376ea7fad2fcd202aac606969a43ca5b
  - verified: rev-41 [reviewer] · run rev-41-20261125-1970-final · 2026-11-25T03:03:31.230Z · commit abb33eba376ea7fad2fcd202aac606969a43ca5b

## Comments

### impl-1970 · 2026-11-25T01:38:48.225Z

Consumer census: recordReadinessCleanupFailure callers are acquire() and prepareSnapshot(); ReadinessDeadlineError consumed by run.ts, prepare.ts, hub/suites.ts (typed boot-readiness retry), executor-run-rules.test.ts and executor-prepare-component.test.ts; documented in docs/hub/running.md and file-specific prepare component guidance. Retain the readiness type/fields/cleanupFailures wire-free shape. General error causes use existing withCleanupFailure (cleanup-failure.ts), preserving prior causes. Catch census: acquire outer release; #acquire checkpoint then release; prepareSnapshot outer builder release, cleanup checkpoint, recoverSnapshot; snapshot request rejection checkpoint; retirement rejection checkpoint. Inner marker parse/transport retry catches have no release. Reserve lock finally and successful prepare release are separate cleanup-only boundaries.

### impl-1970 · 2026-11-25T01:42:51.795Z

C2 dispositions implemented: (1) acquire outer release attaches cause and rethrows primary; (2) #acquire failure checkpoint attaches rejection, retains lease and skips release across incomplete checkpoint; successful checkpoint proceeds to release with rejection secondary; (3) prepareSnapshot builder release attaches cause, retains recovery/lease and fences image cleanup; (4) cleanup recovery checkpoint attaches cause, retains recovery and fences image cleanup; (5) recoverSnapshot rejection now attached instead of discarded; (6) snapshot API definite-rejection checkpoint and (7) retirement definite-rejection checkpoint attach errors to original API failure before outer cleanup. Successful-path release is itself primary if it fails. No-release transport/marker retry catches remain unchanged. Fakes assert retained records and successful restart reconciliation. Consumer shape unchanged; readiness subclass and cleanupFailures retained, existing Error.cause preserved through shared AggregateError helper.

### rev-40 · 2026-11-25T01:46:51.782Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261125-1970-source
commit: c482dd2150356a58b751a4e5bbd4ebc8e05dbcd6
scope: full
findings: [{"severity":"medium","text":"Reservation lock.release in finally can reject after RemoteBudgetFull/abort/read/checkpoint failure and replace that selected acquisition error; census incorrectly labels this cleanup-only.","file":"hub/src/executor/droplet/droplet.ts","line":91},{"severity":"medium","text":"Regional provider 422 retry catch awaits a checkpoint that can replace the observed provider refusal; preserve primary and attach checkpoint failure secondarily.","file":"hub/src/executor/droplet/droplet.ts","line":345},{"severity":"medium","text":"New prepare/acquire/reconcile/release waits use admission-only step and unbounded drive; add named behavioral bounds retaining operation ownership separately from fixture setup.","file":"hub/test/executor-prepare-component.test.ts","line":252}]
finding_counts: {"high":0,"medium":3,"low":0}

Source not clear: three medium findings, confirmed by implementer caf3868b. M1 droplet.ts:91 reservation lock finally can replace the primary; M2 droplet.ts:345 regional-refusal checkpoint can replace provider failure; M3 executor-prepare-component.test.ts:252 and related new operation waits have no named behavioral bounds. Preserve primary/secondary identity and recovery ownership, add fake regressions for omitted paths, bound operation receipt observers while joining underlying work, and update the census. Other changed catches preserve prior causes and typed readiness metadata; no other finding. C1/C2 failed. Full Standards/Spec: A-23109, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23109-t-1970-source-not-clear-at-c482dd215.md. No Reviewer runs; selected local evidence is not configured verification.

Criteria: C1 failed (Omitted acquisition lock/region checkpoint paths still replace primary errors, and new operation receipts lack named behavioral bounds (M1-M3).), C2 failed (Catch census incorrectly excludes reservation lock cleanup and leaves regional-refusal checkpoint disposition incomplete (M1-M2).).

### impl-1970 · 2026-11-25T01:48:45.915Z

Review corrections to C2 census: #reserve's lock finally was NOT cleanup-only: its body can fail, and unlock rejection replaced that primary. Now preserve primary and keep exact owning release closure in executor retry set until success; retry before reservations, reconciliation and close. Regional 422 retry catch observes provider refusal as primary if its subsequent checkpoint rejects; it now attaches checkpoint rejection before outer catch. Both fake controls shown red with actual secondary error instead of expected primary, then green. M3: new prepare/acquire/reconcile/release operation waits use named scope.wait with load-scaled real headroom, retaining whole-case work through cleanup. Earlier C2 exclusion is superseded by this correction.

### rev-41 · 2026-11-25T01:58:45.273Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261125-1970-source2
commit: abb33eba376ea7fad2fcd202aac606969a43ca5b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh full source review clear at abb33eba376ea7fad2fcd202aac606969a43ca5b against5ecdfaf5ae45a1cd38b29a10e2c2fd6b805ec7c9 and source1c482dd215/A-23109. Standards0/Spec0 in-scope findings. M1 resolved: #reserve retains selected body primary through failed unlock and keeps exact AsyncHubLock.release closure until successful retry before new reservation/reconcile/close. Shared lock release coalesces concurrent calls, revalidates its captured token and cannot unlink twice after confirmation. M2 resolved: regional422 checkpoint rejection keeps provider error and attaches persistence failure before outer recovery. M3 resolved: named load-scaled scope.wait operation bounds added, underlying complete sequence remains owned/joined before seams/root removal.

C2 verified; explicit corrected catch dispositions: reservation body/unlock preserves primary and retains exact handle; outer acquire readiness/save+release attaches secondary; regional422+checkpoint keeps provider refusal; #acquire outer checkpoint failure retains lease/skips release, otherwise release failure attaches secondary; snapshot builder release and cleanup checkpoint failures fence image cleanup; recovery rejection is attached rather than discarded; snapshot-request and retirement definite-rejection checkpoint failures preserve API primary. Successful-path release failure is itself primary. Transport/marker retry catches have no release. Pool-prepare claimSnapshotStorage finally is a nonthrowing synchronous Set.delete release, unaffected; explicit reap.lock finally is outside acquisition/preparation scope. This supersedes the item's mistaken reservation exclusion.

Shared cleanup helper retains existing causes and general frozen/non-Error wrappers; readiness type/fields/cleanupFailures compatibility and direct readers checked. Docs running/per-file guide reflect new behavior, no wire/schema/help/config/role change. Prior diagnostics/log-sink masking outside release/checkpoint scope reported separately S Bugs for filing/dedup; not claimed fixed.

Reconciled A-23122 retains two correction reds (actual secondary unlock/checkpoint error instead of reservation/provider primary) then component47/47 and selected T1 lock-liveness9/admission13/watchdog26/run-rules15, macOS Node24.21.0. A-23104 earlier red/greens retained. Full typecheck/lint exit0 reported, zero refusals/report-only advisories. These are selected local receipts; C1 execution remains unverified pending exact-head configured result. Detailed review A-23132 at .cland/artifacts/A-23132-t-1970-source-review-clear-at-abb33eba3.md. Reviewer ran no tests/native/provider/browser work or edits.

Criteria: C2 verified.

### rev-41 · 2026-11-25T03:03:31.230Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261125-1970-final
commit: abb33eba376ea7fad2fcd202aac606969a43ca5b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear. Run8172395d/A-23211 finished/passed at unchanged source-reviewed head and source-matching verification tree91f449d8. All eight new non-readiness/reservation/regional/provider cleanup identities have explicit base pass and5/5 load finishes; all47 component base cases and the file finish pass with paired target progress and no unfinished records. Readiness compatibility and shared cleanup/lock/admission/watchdog/run-rules consumers also pass. C1 verified; C2 source census A-23132 reaffirmed. T0/T1/fallback all T2/250 selected T3/Web exit0; selected T3 once, other T3 remains merge-batch evidence, T4 unexecuted. Linux x64 droplet c-8 fra1, Node24.21, Neovim0.12.5, Chrome for Testing156.0.8078.4 Headless Shell1248, two workers;12 prerequisite skips retained, cached status unknown, report-only advisories remain such. Exact receipts and limits A-23213: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23213-t-1970-final-review-clear-at-abb33eba3.md. No Reviewer runs/edits; existing separately filed log-sink aside not claimed fixed.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-25T04:53:17.931Z

Merged a9fd5decf02423b047297c21338a7531e7d4f47c onto dev.
