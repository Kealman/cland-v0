---
id: T-1232
kind: task
title: A throw in the merge batch's blocked-report path crashes the hub
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - bug
  - ready-for-agent
assignee: null
parent: E-1193
blocked_by: []
topic: topic-978
branch: t/T-1232-a-throw-in-the-merge-batch-s-blocked
created: 2026-10-24T10:52:41.334Z
updated: 2026-10-24T12:56:36.500Z
closed: 2026-10-24T12:56:36.500Z
---

## Summary

Hub pid 78479 died at about 10:49:13Z on 2026-10-24 from an uncaught throw. The batch had landed T-1209 and its follow-up failed ("stop sessions: ps failed or timed out"). `MergeBatches.tick`'s catch handler then called `boundary.report`, which addressed `lead T-1209` for a closed item. At that dev build `#itemLead` threw for a closed item; T-1209 fixed that. The throw inside the `.catch` handler became an unhandled rejection and ended the process.

## What to build

A failure inside the batch's blocked-report path is logged and retained on the batch. It never escapes as an unhandled rejection. The same applies to the other fire-and-forget hub timers that report through `noticeTo`.

## Acceptance criteria

- [x] C1. A batch whose blocked report throws keeps the hub serving, logs the report failure and keeps the batch blocked with its reason (test).
  - done: impl-1232 · 2026-10-24T12:33:14.511Z
  - verified: rev-26 [reviewer] · run rev-20261024-1232-final-1 · 2026-10-24T12:49:53.972Z · commit de5e7edc9e8d08592e65da651abfd939e4d99ccd
- [x] C2. The hub's interval/tick loops catch report errors; an audit lists them in the ready report (test where reachable).
  - done: impl-1232 · 2026-10-24T12:33:14.603Z
  - verified: rev-26 [reviewer] · run rev-20261024-1232-final-1 · 2026-10-24T12:49:53.972Z · commit de5e7edc9e8d08592e65da651abfd939e4d99ccd

## Comments

### impl-1232 · 2026-10-24T12:30:08.840Z

Red→green: injected batch blocked report produced `Got unwanted rejection. Actual message: "report boundary failed"`; injected T3-search blocked report produced `Actual message: "blocked notice failed"`; nightly/periodic skip callbacks produced `Error: skip notice failed`. All now contained. Local macOS arm64 targeted files passed individually: merge-batches (63 tests), dev-t3-search (5), suite-scheduling (7); hub typecheck passed. Implemented additive retained batch.reportError plus logging and terminal guards. Audit in progress; full verification waits for source review.

### rev-26 · 2026-10-24T12:34:58.342Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1232-source-1
commit: de5e7edc9e8d08592e65da651abfd939e4d99ccd
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1232 full source review — clear

Head de5e7edc9e8d08592e65da651abfd939e4d99ccd; tree18ff22e764204b31ead81fd41a583445f152296b. Fixed base/merge-base d76d69fb79ccb2ede084dd04f75a3854a1a66df1, merged before first source review. Reviewed git diffd76d69fb...de5e7edc,15files149+/4−, task C1/C2, adjacent timer/report code and A-10994 audit. Both axes assessed in-session without delegation/runtime execution.

## Standards
No findings. Changes stay at existing controller/report boundaries. Optional LogFn injection uses the existing Dispatcher logger; no new dependency/command/configuration/grant. Durable reportError is additive to MergeBatch and separate from failed. Original retryLanding classification is retained. Terminal catches guard logger throws and finally releases the in-flight work field.
Three existing T1 files cover policy/controller behavior using FakeClock and durable stores; the existing T2 merge-queue fixture covers actual public socket frames with injected repository/process boundaries. No new native hub/Git/provider/worker starts, wall-clock delay, assertion/cap reduction or tier change. Fault observer log callbacks are installed before triggers; exact log receipt precedes queue/status assertions. Mocked prototype method is scoped to the test context. Existing fixture cleanup remains responsible for its owned work/root, and joined ticks settle new work.
Matching README/shared test guidance and exact path-headed indexed guides describe injected seams and recovery assertions. No guide-heading mismatch.

## Spec
No findings. MergeBatches saves the original failed reason and retry classification before blocked publication. A thrown synchronous report records and persists reportError, then emits merge-batch-report-failed with original reason and secondary error. The final guarded catch contains errors in this failure handler/logger so a fire-and-forget tick cannot reject. The T1 regression starts the same background tick, joins it, checks both values and the log, reopens, and preserves no-land/no-drop assertions. T2 injects the noticeTo failure independently of the already-fixed closed-item lead-routing bug, then observes its failure log and proves public merge.queue/hub.status still serve the blocked member/reason.

DevT3Search preserves its original dev-t3-search-error before a secondary blocked-notice failure reaches the guarded terminal catch; its test releases the primary report fault and joins a later timer tick to prove durable reported completion. Both nightly and periodic suite skip paths log the original skip before publication and contain secondary publication errors. Their independent FakeClock tests assert both logs and subsequent reads.

The audit A-10994 enumerates MergeBatches, DevT3Search, nightly/periodic skip callbacks, ordinary suite reporting/accounting, fallback/reclaim/sharding notice callbacks, executor/demo reconciliation and account projection, distinguishing timer chains from queueMicrotask. Adjacent source inspection confirms suite report errors are contained by per-job inspection and accounting confirmation is retried by the scheduler; executor/demo notice failures end in their existing logging catches. These paths do not add another unguarded notice publication from their catch. Core heartbeat/configuration/retention/web timers do not directly use the noticeTo report seam. Carry this inventory into the ready report as C2 requires.

## Evidence and limits
A-10994 is a source/audit and local result summary: original batch report red "Got unwanted rejection...report boundary failed", search blocked notice red, separate soak/dev-t3 skip notice reds; individual macOS arm64 implementation runs report63/63 merge-batches,5/5 search,7/7 scheduling,14/14 public queue. Earlier suite-queue-policy8/8 is explicitly before moving the new pure cases lower. Typecheck/lint reported green, lint report-only. The summary distinguishes implementation runs from post-merge static checks; no complete raw command/stdout/exit/native-timing bundle or configured receipt has yet been audited here. Preserve available original returned records with exact source/platform, missing/truncated limits and no transcription reruns.

Disposition: full source clear at this exact head, findings[]. C1/C2 are run-dependent and left unverified until same-head configured evidence; C2 audit inventory must remain in ready report. Submit ordinary mode-free configured verification at this unchanged head, route result to Reviewer and lead, retain per-test timing/load identity receipts and report-only diagnostics. No full-suite green or per-item QA claim (none/after-stage policy). A changed head requires fresh review, and no post-review dev integration without Coordinator authorization. Standards0 findings; Spec0 findings.
Durable review A-11000.

### impl-1232 · 2026-10-24T12:49:53.034Z

Same-head verification bfe62441-cfab-4a7c-bdca-0c8eca862f9e passed at de5e7edc9e8d08592e65da651abfd939e4d99ccd. Linux x64 droplet c-8 lon1, Node v24.21.0 / Neovim v0.12.5; T0 exit 0 (26.306 s), T1 exit 0 (62 s), all-T2 fallback exit 0 (340 s), Web exit 0 (151 s); 2967 tests/pass, no failed/cancelled/skipped/todo. Five new regression identities each passed 5/5 load-gate repetitions. Budget/lint report-only overruns retained; T3/T4 not run. Machine lifetime 649 s, cost $0.0451. Evidence log A-11037; source/audit A-10994/A-11000; original local receipt limits A-11003. Evidence review requested through reviewer role, queued for next free verifier. Freshly fetched origin/dev 011db12c72f5d7d5ee8ca2eed68c637c0e6586a8 merges cleanly in read-only merge-tree check (tree a684d5df2ce3b4a6d279c5d8f98ca9170835ecc0); branch head unchanged and worktree clean.

### rev-26 · 2026-10-24T12:49:53.972Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261024-1232-final-1
commit: de5e7edc9e8d08592e65da651abfd939e4d99ccd
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1232 final same-head evidence review — clear

Headde5e7edc9e8d08592e65da651abfd939e4d99ccd; tree18ff22e764204b31ead81fd41a583445f152296b. Source A-11000 remains current. Audited original configured runbfe62441-cfab-4a7c-bdca-0c8eca862f9e / A-11037 and local original excerpts/provenance A-11003; task.view independently confirms exact-head passed result.

## Standards
No findings. Evidence review only, no tests/probes/source edits. A-11003 correctly distinguishes macOS implementation working-tree greens (became6db6c1cd before docs/dev merge) from exact-head post-merge hub typecheck/lint. Missing source hashes, omitted raw passing lines/stacks and asynchronous poll duration limits remain explicit; no transcription reruns or source reattribution. A-11037 supplies exact-head configured runtime independently.

## Criteria
C1 verified: batch blocked-report regression passes at0.024381652s, retaining original failed/reportError across reopen and no-land/no-drop assertions. Public merge-queue serving regression passes at0.971861412s, observing the exact failure log before asserting blocked queue member/reason and hub.status replies. Each passes5/5 actual repetitions (worst0.038481892s and1.008784364s respectively), below declared T1/T2 budgets.
C2 verified: search's primary-report + secondary-blocked-notice fault passes0.041044626s; nightly skip0.033783598s; periodic skip0.018929731s. Each also passes5/5 repetitions (worst0.037689312/0.054072791/0.054741584s). Full files pass: merge-batches63/63, dev-t3-search5/5, suite-scheduling7/7, merge-queue14/14, docs guard3/3.

Carry the checked timer audit into the ready report:
- MergeBatches start/tick→report/notice/drop→noticeTo: new durable failed/reportError and guarded secondary catch.
- DevT3Search start/tick→report/blocked→noticeTo: original search error retained, secondary log contained, later report retried.
- Suites nightly soak and periodic dev-t3 skip notices: original skip logged before publication, secondary notice error caught.
- Ordinary suite result/quarantine/shared-defect reporting: existing per-job inspection catch retains job error and retry.
- Accounting confirmation notice: existing per-job scheduler catch retains confirmation error for retry.
- Fallback, remote-reclaimed and sharding-skipped notices: existing launch/check/inspection catches contain publication failures.
- Executor recovery/minute reconciliation and tracker-triggered demo reconciliation: existing terminal failure logging, no notice from those catch handlers.
- Account projection queueMicrotask already catches publication; heartbeat/configuration/retention/web ping/keepalive timers do not directly invoke this noticeTo report seam.
This inventory is preserved in A-10994 and source-reviewed A-11000; it is source audit evidence, not separately executed fault injection for every unchanged path.

## Configured receipt and limits
Mode-free configured task run, mode full, exit0. T0 host check, all T1, fallback all hub/Neovim T2 and Web pass. Deduplicated native progress:2967 ordinary test passes,424 file passes,zero fail/cancel/skip;25 extra load-gate test passes for five identities5/5 each counted separately. No T3/T4 run; remaining T3 deferred to periodic dev/integrated occasions, not a passing general process cover.

Linux x64 6.8.0-142-generic droplet c-8 lon1 cland-v0-070d3e83, Nodev24.21.0, Neovimv0.12.5,configured workers2;lifetime649s,cost$0.0451. T0 host check26.306s; remote typecheck explicitly says matching host gate d3ca205e3dfd7a3353e370b0f25adafe77a46409 not repeated (Git confirms tree object). No remote repeated-typecheck claim.

Budget/lint/T3-ratchet diagnostics remain report-only:133lint findings/60files, one missing baseline, existing Web shell/items/connection and hub scale/Neovim artifact warnings; projected Web wall over40s. T3 ratchet2195.304s equals base. No enforce-mode duration success inferred from exit0.

Final evidence clear, findings[], C1/C2 all verified across current source plus exact-head runtime. QA none/after-stage needs no per-item run. Coordinator owns landing; retain normal read-only current-dev conflict check without changing this head. Standards0; Spec0 findings.
Durable review A-11038.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-24T12:56:36.500Z

Merged 16a7bbe526dc989c701b4bf20cc1676763fdea2a onto dev.
