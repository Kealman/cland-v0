---
id: T-1848
kind: task
title: The suite command's process observer drops inspection failures without a receipt
state: open
status: ready
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1587
branch: t/T-1848-the-suite-command-s-process-observer
created: 2026-11-14T02:03:07.406Z
updated: 2026-11-17T08:19:44.083Z
---

## Summary

The suite command's periodic process observation drops every inspection failure without a trace. `hub/src/suite-command.ts:45` runs `capture().catch(() => { /* failed inspection establishes no new ownership */ })` and retries after 1 s while the command stays open. A probe that keeps failing leaves the command's descendants unobserved until stall teardown or the census, and nothing records that observation was failing. Found aside by T-1846 while diagnosing the suite-timeouts fast-exit hang (A-19248). That diagnosis remains inferred, because the fixture contents were disposed.

## What to build

A failed process inspection in the suite command's observer leaves one bounded, deduplicated diagnostic receipt in the run log, naming the failure and how many consecutive attempts failed, and the run's result says when ancestry went unobserved for longer than a named bound. Ownership semantics stay as today: a failed inspection still establishes no new ownership and retains earlier proofs.

## Acceptance criteria

- [x] C1. A fake inspector that fails N times then succeeds produces one deduplicated failure receipt with the count, and observation resumes on success without new ownership from failed rounds (test).
  - verified: rev-35 [reviewer] · run rev-35-1848-final-1 · 2026-11-17T05:36:42.930Z · commit 0fa58ed98f7565c7b9d512835c73f0588959e6b2
  - verified: rev-35 [reviewer] · run rev-35-1848-final-2 · 2026-11-17T06:19:29.570Z · commit 12d730d45aa8c33103459a6f1af8e8ea53a95cd0
  - verified: rev-35 [reviewer] · run rev-35-1848-final-3 · 2026-11-17T07:18:35.868Z · commit 23e9f14f51a711810339d7fb04a2a001fde503e6
  - done: impl-1848 · 2026-11-17T07:46:52.780Z
  - verified: rev-35 [reviewer] · run rev-35-1848-final-4 · 2026-11-17T08:19:41.445Z · commit f48ac45eb7d82492e4d1d73fad93ca560e46bbcf
- [x] C2. A run whose inspection never succeeds reports, in its result, that descendants went unobserved past the named bound (test).
  - verified: rev-35 [reviewer] · run rev-35-1848-final-2 · 2026-11-17T06:19:29.570Z · commit 12d730d45aa8c33103459a6f1af8e8ea53a95cd0
  - verified: rev-35 [reviewer] · run rev-35-1848-final-3 · 2026-11-17T07:18:35.868Z · commit 23e9f14f51a711810339d7fb04a2a001fde503e6
  - done: impl-1848 · 2026-11-17T07:46:53.219Z
  - verified: rev-35 [reviewer] · run rev-35-1848-final-4 · 2026-11-17T08:19:41.445Z · commit f48ac45eb7d82492e4d1d73fad93ca560e46bbcf

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

### rev-35 · 2026-11-17T05:37:46.102Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1848-final-1
commit: 0fa58ed98f7565c7b9d512835c73f0588959e6b2
scope: evidence
findings: [{"severity":"medium","text":"Configured report33314 enters execFile's native promisify.custom wrapper from worker checkHead. The callback mock does not replace/clear that symbol, so native delegation is not excluded and the fake-only durable-result regression is not isolated. Lead confirms no other interception owner; repair callback/custom seam while retaining atomic-result assertions.","file":"hub/test/suite-command.test.ts","line":185}]
finding_counts: {"high":0,"medium":1,"low":0}

Final review not clear despite configured01e7e8c7/A-20655 exit0; A-20658. I missed the native custom-promisifier route in source review; callback mock alone cannot dismiss report33314 as false positive. C1 independently verified from recovery28291/28299 plus5/5 proofs28415/28529; C2 normal summary28303 and actual durable result28295 pass but fixture isolation unproven. No production metadata regression or credential exposure inferred.6558ordinary/707file positives plus270load positives; T0/all224T1/all428T2/55Web green,269T3/17T4 unexecuted. Provenance38039 pins normalizedda07ceeb..., uncachedLinuxx64/Node24.21/Nvim0.12.5; actual browser35446 HeadlessShell1248/CfT156. Report-only diagnostics/budgets/skip checks and earlier raw/native/hash/scan limits retained. Fix both callback/custom fake paths, fresh source review before further verification. No Reviewer runtime/edit.

Criteria: C2 failed (Green worker-result assertions do not establish the fake-only boundary: retained custom-promisifier stack bypasses the callback mock; native delegation exclusion is unproved.).

### rev-35 · 2026-11-17T05:47:34.803Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1848-source-3
commit: 12d730d45aa8c33103459a6f1af8e8ea53a95cd0
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Custom-route correction source clear; A-20664. A-20658 medium resolved by replacing entire execFile binding with own callback/custom fake, positive synthetic inherited-custom control/count1, explicit callback/custom counters and fail-fast native ChildProcess.spawn guard. Whole body/worker joins and original atomic-result assertions retained; restoration covers manual binding and ESM. Production unchanged, two test/guide paths only, no dev merge. A-20661 preserves incomplete first control, deterministic24/25red then instrumented/final25/25green; evidence hash matches109f2c... . Final lint0/0refusals now123report findings60files/tier-process9 includes synthetic control; typing predates comment only. Raw/native/scan limits retained. Standards/Spec0 findings. Both C1/C2 unverified at changed head; prior C1 mark stale and old green A-20655 not new-head proof. Request new Coordinator window; no Reviewer runtime/edit or final configured claim.

### rev-35 · 2026-11-17T06:19:29.571Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1848-final-2
commit: 12d730d45aa8c33103459a6f1af8e8ea53a95cd0
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Same-head final evidence clear; A-20697 reconciles A-20692/run e5297f8d with current source clearance A-20664. Head/source tree unchanged; normalized verification tree 397655c793ae40be93ac5903963288a94e791d4a, uncached Linux x64 droplet/Node24.21.0, actual isolated Headless Shell1248 / Chrome for Testing156.0.8078.4. T0/T1/all-T2 fallback/Web exit0. Semantic census6558 ordinary test passes/707 files, separate270 load passes; all224 T1/428 T2/55 Web files complete;269 T3/17 T4 unexecuted. All four required inspection identities have ordinary pass plus5/5 load proofs. Durable-result case positively asserts synthetic native boundary/custom and callback fake counters plus atomic receipt across cleanup rejection; no own-case tier warning. Structured warning comparison: no added rows, old own warning removed;64 unrelated report-only rows retained. Test lint123/60, timing/ratchet/skip checks remain report-only; no skips/missing skip reasons. C1/C2 verified at this exact head. No findings or new Reviewer runtime/probe/edit; historical local/incomplete/old-head limitations retained.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-17T06:21:52.222Z

Rule 36 preflight (coord, 06:20Z): head 12d730d45 merged with origin/dev conflicts in suite-worker.ts, suite-command.ts, suite-log.ts and suite-command.test.ts. Not enqueued. Requested a dev merge (rule 11), a fresh review and a new verify. T-1850 shares suite-worker code, so the two are serialized.

### rev-35 · 2026-11-17T06:40:21.834Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1848-source-4
commit: 23e9f14f51a711810339d7fb04a2a001fde503e6
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized dev-merge delta source clear, source tree65a6f2b773217ed417b9b2f61233a449222f90bd; A-20709. Parents12d730d45 +04d1f6a0f confirmed; Coordinator item comment authorizes rule11 exception. Four conflict resolutions preserve both infrastructure/notRun and finalized inspection result callback/metadata, both semantic log prefixes and both test branches; whole-callback/custom-fake positive controls retained. No findings. A-20706 note hash independently matches984fe3c8..., targeted local141 T1/T2+187 T3 passes under recorded slot/full typecheck/lint0 remain scoped evidence, not full configured/new-head/Web/T4/load proof. C1/C2 prior marks stale; both unverified at merged head, no new verified marks in this source pass. Old green A-20692/A-20697 belongs only to12d730d45. No Reviewer runtime/probe/edit. Follow Coordinator's new verification window.

### rev-35 · 2026-11-17T07:18:35.868Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1848-final-3
commit: 23e9f14f51a711810339d7fb04a2a001fde503e6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merged-head final evidence clear; A-20739 reconciles A-20734/runae86474d with delta source A-20709. Four required inspection identities ordinary pass+5/5load; positive durable-result callback/custom controls retained and passed, no own runtime warning. Structured tripwire set equals prior64 unrelated report-only rows, no additions. Infrastructure and both ticket-census controls pass;3mapped T3 guard files pass120selected identities once/no repetitions. T0/T1/all-T2/selected-T3/Web exit0;6713ordinary passes/710files, separate270load;224T1/428T2/55Web/3T3 complete,266T3/17T4 unexecuted. Exact head/source tree unchanged, normalized b8f1f3a03e38edf94b5b17c1be37b2c9d1fd8153, uncached Linux x64/Node24.21.0, actual HeadlessShell1248/ChromeTesting156.0.8078.4. Known T-1935 fixture prefix28727/28728 retained separately; terminal exit0/hub passed. Lint123/60, budgets/ratchet/skip checks remain report-only, skips[]/missing0. C1/C2 verified at23e9f14f5; no findings/Reviewer runtime/edit. All older head/evidence limits retained.

Criteria: C1 verified, C2 verified.

### rev-35 · 2026-11-17T07:49:40.779Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1848-source-5
commit: f48ac45eb7d82492e4d1d73fad93ca560e46bbcf
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear after Coordinator-authorized second merge, treefd0b2892babb40624a8aec0ddc1434a9dda70fbe; A-20751. Reviewed sole conflict suite-worker and incoming unchanged admission/completion owner. Native seam reaches admitted work; runWorkerWithAdmission remains sole admission/terminal owner with complete Clock and atomic writer. Finalized inspection callbacks survive rejected command/cleanup into admitted outcome, owner spread and actual durable result. Gate expiry/SIGTERM, infrastructure classification, callback/custom isolation controls and joined test ownership retained. Task command/log/test/guide unchanged from previously cleared parent; owner/cause tests unchanged from current dev. No findings. A-20750 local6+28+19=53targeted passes, full typecheck/lint0/refusals0, explicit native slot/startload6.92/180000ms/no retry recorded; note SHA256 independently matched4a4a0e76495397441e412557d9ccdc8243125a0b97288e457d9191a12cc6e70f, not raw stream hash. Report-only lint123/60/historical raw/signal limits retained. C1/C2 remain unverified at new head pending configured evidence; no verified marks. Old A-20734/A-20739 are pre-merge proof only. No Reviewer runtime/probe/edit/merge/submission. Follow Coordinator window.

### rev-35 · 2026-11-17T08:19:41.445Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1848-final-4
commit: f48ac45eb7d82492e4d1d73fad93ca560e46bbcf
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Same-head final clear; A-20775 reconciles A-20771/run7c75647a with source A-20751. All four inspection identities ordinary PASS+5/5load; actual worker metadata persistence after cleanup rejection and positive callback/custom isolation controls retained. Six admission/cause controls pass through merged owner. T0/T1/all-T2/three mapped T3/Web exit0,6738ordinary passes/711files plus230separate load passes,0fail/cancel/skip. Source clean/unchanged; normalized treeedf4d636309e5096d140560217c3a94cd9e65e56, uncached Linuxx64/Node24.21.0, isolated HeadlessShell1248/ChromeTesting156.0.8078.4. Three native files120top-level/127typed incl7nested, one base/no reps;266T3/17T4 unexecuted.64existing runtime warning identities unchanged; only two unrelated stack lines603→604, no own-case warning, positive guard assertions are primary evidence. Known exact T-1935 fixture pair retained separately from terminal Finished exit0/hub passed, no retry. Lint123/60/budget/ratchet/skip report-only; native179.668s selected phases excludes machine wait, billing lifetime not suite wall. C1/C2 verified, findings[]. Historical evidence limits retained; no Reviewer runtime/probe/edit/new run/merge.

Criteria: C1 verified, C2 verified.
