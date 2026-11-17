---
id: T-1848
kind: task
title: The suite command's process observer drops inspection failures without a receipt
state: open
status: review
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1587
branch: t/T-1848-the-suite-command-s-process-observer
created: 2026-11-14T02:03:07.406Z
updated: 2026-11-17T05:06:45.977Z
---

## Summary

The suite command's periodic process observation drops every inspection failure without a trace. `hub/src/suite-command.ts:45` runs `capture().catch(() => { /* failed inspection establishes no new ownership */ })` and retries after 1 s while the command stays open. A probe that keeps failing leaves the command's descendants unobserved until stall teardown or the census, and nothing records that observation was failing. Found aside by T-1846 while diagnosing the suite-timeouts fast-exit hang (A-19248). That diagnosis remains inferred, because the fixture contents were disposed.

## What to build

A failed process inspection in the suite command's observer leaves one bounded, deduplicated diagnostic receipt in the run log, naming the failure and how many consecutive attempts failed, and the run's result says when ancestry went unobserved for longer than a named bound. Ownership semantics stay as today: a failed inspection still establishes no new ownership and retains earlier proofs.

## Acceptance criteria

- [x] C1. A fake inspector that fails N times then succeeds produces one deduplicated failure receipt with the count, and observation resumes on success without new ownership from failed rounds (test).
  - done: impl-1848 · 2026-11-17T04:57:05.638Z
- [x] C2. A run whose inspection never succeeds reports, in its result, that descendants went unobserved past the named bound (test).
  - done: impl-1848 · 2026-11-17T04:57:07.694Z

## Comments

### impl-1848 · 2026-11-17T04:43:51.357Z

Consumer audit: suiteCommand is called by hub/suite-worker.ts (will preserve additive inspection metadata in worker result) and release-web.ts (code/cause consumer unaffected). Tests: suite-command.test.ts, suite-timeouts.test.ts; old code/cause consumption retained. suite-log.ts semantic consumers include hub/suites.ts, suite-log-backfill, suite-selection-component, suite-cover, suite-phase, web-phase and dev-t3-search tests; new inspection prefix is additive. Searches covered suiteCommand, suiteEvidence, suite stall and result readers across hub/src, all hub/test tiers, docs and shipped skills. No socket, CLI setting, permission or admission change.

### rev-35 · 2026-11-17T04:51:51.909Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1848-source-1
commit: 09540d49ca50438955f97cc64b0368bf6ec6c6ca
scope: full
findings: [{"severity":"medium","text":"When periodic inspection never succeeds and stall cleanup's systemProcesses rejects, suiteCommand logs inspection in finally but rejects before returning metadata; the worker only appends inspections after fulfillment, so the durable result loses C2's crossed-bound fact. The normal-close never-success test misses this terminal path.","file":"hub/src/hub/suite-worker.ts","line":100},{"severity":"medium","text":"The new summary cases and inspection-recovery member join suiteCommand during teardown but do not fence/join their whole async callbacks before stream destruction/global mock restoration; cancellation can leave caller continuations using restored fixture state.","file":"hub/test/suite-command.test.ts","line":142}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source not clear; A-20625. Standards1medium whole-callback ownership; Spec1medium missing inspection receipt in durable result after cleanup rejection. Lead6fbae5c7 confirms both gaps, Coordinatorb9aee2a4 requires terminal metadata handoff. Normal-close bounded summary/retry/recovery and retained-writer logic otherwise accepted; report-only code/cause and ownership authority stay unchanged. A-20621/A-20624 preserve original red21/23 (Unexpected end of JSON input), intermediate compatibility failure and targeted green24/24 plus log-backfill5/5. Precommit source linkage, typecheck-before-last-edit, unknown raw/hash/signal/scan-control/architecture and incomplete consumer census remain qualified; no configured/Web/T3/T4 evidence. Reviewer read-only census/manifest dispositions retained in A-20625. Both criteria failed, none verified. Consolidate fixes and request fresh committed source review before verification.

Criteria: C1 failed (New recovery/summary regression callbacks lack a whole-sequence owner before asynchronous admission and global teardown.), C2 failed (Cleanup rejection bypasses worker inspection-metadata persistence, and new regression callbacks lack whole-sequence cleanup ownership.).

### impl-1848 · 2026-11-17T04:56:12.067Z

Review correction census: searched suiteCommand, SuiteInspectionReceipt, suite inspection, suiteEvidence, SuiteLogEvidence, RunStatus, job.result and run.result across hub/src, every hub/test tier, nvim/test, web/test, docs and shipped skills. Production direct callers remain worker and release-web; worker settlement callback now preserves finalized metadata before either fulfillment or rejection. LocalExecutor.status spreads raw result fields, so additive inspections survive; RunStatus and SuiteJob outcome deliberately keep their prior decision fields, while durable local result JSON and semantic log expose the advisory detail. Suites only reconstructs remote receipts; local postprocessors spread existing result JSON for webPhase/execution/progress. DropletRun uses its separate remote done/exit contract and does not execute suiteCommand; droplet/droplet and merge-batches job.result hits describe other records. Existing older result fixtures remain valid because fields are optional and absent without an inspection failure. Manifest paths/tiers and executed/deferred dispositions will be attached in review evidence. No result authority or decision semantics changed.

### rev-35 · 2026-11-17T05:06:45.977Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1848-source-2
commit: 0fa58ed98f7565c7b9d512835c73f0588959e6b2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Consolidated source clear; A-20641. Both A-20625 mediums resolved: finalized inspection is handed from suiteCommand finally to worker before normal return/original cleanup rejection, preserving code/cause/authority and atomic result persistence; ownedMocks/fixtureWork joins full admitted body plus command/worker before stream/root/mock disposal. New regression reads actual durable worker result after periodic+terminal inspection failures and checks original outcome plus crossed5000ms bound. Existing summaries/recovery/prior-proof and compatibility assertions retained. A-20631 native targeted25/25T2+2/2T1, typing/lint0/0refusals and candidate-tree claim match committed1ce907...; note SHA256 independently matches8ad503... . Earlier raw/native-signal/scan-control limits retained, other consumers explicitly deferred, no configured/Web/T3/T4/load proof. Standards/Spec findings none; C1/C2 unverified test criteria pending exact-head configured result. No dev merge, Reviewer runtime or final verification claim.
