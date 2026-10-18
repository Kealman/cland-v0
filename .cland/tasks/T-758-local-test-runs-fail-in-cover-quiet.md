---
id: T-758
kind: task
title: Local test runs fail in cover-quiet suite.slot admission when the busy hub answers after 3000 ms
state: open
status: review
size: S
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - hub
  - flake
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-470
branch: t/T-758-local-test-runs-fail-in-cover-quiet
created: 2026-10-17T22:04:51.687Z
updated: 2026-10-18T03:38:10.384Z
---

## Summary

On 2026-10-17 at 22:03Z, nine Implementer sessions were active. Two local serial test runs failed before any test body ran, because the cover-quiet `suite.slot` admission through hub/src/cli/socket-client.ts got no answer from the project hub socket within 3000 ms: impl-707 in a T-707 scenario, run 5, and impl-703 in tracker-ready, attempt 3. In the same minute, impl-752's `cland verify --dry-run` timed out after 15000 ms waiting for hub.sock. Hub pid 386 sampled 38–98 % CPU over 30 s, at 350–650 MB RSS. hub.db is 87 MB and journal.jsonl is 115 MB. The machine's load was about 10.

## What to build

A busy hub must not turn a local test into a failure. Admission either waits with a load-scaled bound and reports "admission timed out" as its own outcome, distinct from a test failure, or a cheap admission path that skips the busy main loop answers it. Find what kept the hub at that CPU level under nine sessions: a profile of hub serve during a burst (see the hub-startup-profiling notes).

## Acceptance criteria

- [x] C1. A profile of the hub under a nine-session burst names the dominant CPU consumer, recorded here with the artifact id.
  - done: impl-758 · 2026-10-18T03:15:33.766Z
  - verified: rev-31 [reviewer] · run rev-20261018-758-source-4 · 2026-10-18T03:25:02.654Z · commit c30540acacccd9280b663d3869d9438d0ea89ceb
- [ ] C2. A T2 test with a hub that delays its suite.slot answer beyond 3000 ms shows the local run either admitted after the delay or ending with a distinct admission-timeout outcome, never as a test failure. The test fails before the fix.
  - failed: rev-31 [reviewer] · 2026-10-18T03:24:23.061Z · note Mixed repetition admission reporting suppresses genuine assertion identities and diagnostics; keep ordinary failures independent of admission counts.

## Comments

### coord · 2026-10-17T22:05:19.054Z

More cases from the same burst, 22:03–22:04Z:
- impl-702: session-archive-merge, pre-body, socket-client.ts:36.
- impl-703: tracker-ready, attempt 4.
- impl-751: remote-scripted, worker exit 1 with zero subtests.
impl-751's provenance finding is that hub/test/cover-quiet.ts awaits the real project hub at import time, so the socket-client 3 s timeout throws before any test registers. The fix should also move that await out of import time, or give it the same distinct admission-timeout outcome.

### impl-758 · 2026-10-18T03:11:16.801Z

C1: profile artifact A-4908 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4908-t-758-nine-session-hub-cpu-profile-and-reproducer (README.md, V8 .cpuprofile, reproducer, ranked JSON). Nine sessions, 22,052 synthetic requests / 6.030 s. Native SQLite prepare/all/get/run consume 67.21% of sampled time; store.history is the largest named domain operation at 1.202 s inclusive. Fresh-db workload limitation documented. Coordinator filed the M Tech debt follow-up for live-size profiling and SQLite/presence work; scope here remains admission. C2 red: T2 real socket plus full FakeClock advances to 3001 ms; expected admitted, got generic 3000 ms timeout (test 9.6 ms, file 97 ms).

### impl-758 · 2026-10-18T03:16:07.753Z

Source ready at 7b8d9831b85240f93e704a4ef3b9e545e755c8c7, pushed to local origin. Review requested from Reviewer in topic-470. Host evidence A-4912 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4912-t-758-host-checks-and-serial-5-5-receipts): typecheck/tiers/lint all green; four touched test files each 5/5 serial, load1 peak 4.920. Additional account-isolation and suite-coverage checks green. C1 profile A-4908. Awaiting source verdict before exact-head droplet verification; QA policy scope none.

### rev-31 · 2026-10-18T03:18:12.208Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261018-758-source-1
commit: 7b8d9831b85240f93e704a4ef3b9e545e755c8c7
scope: full
findings: [{"severity":"medium","text":"M1: a file remains globally suppressed after any AdmissionTimeout cause; unrelated later ordinary assertion failures are omitted. Filter only attributable admission events/envelope and retain same-file assertion identities.","file":"hub/test/quarantine-reporter.ts","line":30}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-758 source review — not clear

Commit: 7b8d9831b85240f93e704a4ef3b9e545e755c8c7.
Fixed base: d392167a4a94d8104d4990a322d3f23f56eac8e0.
Scope: full. Read-only review; no Reviewer execution, edits or delegation.

## Standards

M1 medium — hub/test/quarantine-reporter.ts:30. Once any event's serialized cause contains AdmissionTimeout, #admissions retains the whole file and every later event is discarded. A nested hook or explicit admission call can time out without preventing unrelated tests in the same file from executing; their ordinary assertion failures are then omitted from suite test failures and shared-defect candidates. This violates the agreed separation of infrastructure and assertion outcomes. Filter only typed admission events and any positively attributable file envelope, retaining unrelated same-file failures. Add a mixed-event control in the same file, including an ordinary failure after the timeout. The existing control uses a different file, so it does not catch this issue. The Implementer confirms the guarantee is absent and is correcting it (67ffa4b8).

No other Standards finding identified. The socket deadline uses a complete optional Clock with native defaults; admission remains nonzero, bounded at 15–60 seconds, and quarantine cannot excuse a recognized admission timeout. Root admission and account fixture setup now register in order as before hooks. The actual socket tests use FakeClock and request receipt barriers rather than elapsed sleeps. No new duration allowance was added.

## Spec

One partial requirement corresponds to M1: infrastructure classification must not erase genuine test-failure identities. The package and repetition paths otherwise emit distinct admission counts/messages and keep their outcome nonzero; existing cover-quiet refusals, missing capability and disconnect behavior remain covered. Source checks are not final execution evidence.

C1's profile is established with explicit limits. Independently read A-4908's reproducer and V8 CPU sample data: nine connected sessions, 22,052 synthetic requests over 6.030333 seconds, including 5,243 repeat-guard refusals. Recomputed native prepare/all/get/run self-time shares as 31.92%,18.86%,9.02%,7.40%, totaling67.21%. The ranked project stacks identify store.history at1.2023 seconds inclusive, plus repeated presence/sessionHolds/roleOf work. Inclusive rows overlap and must not be added. This profiles a newly started scratch hub and fresh synthetic database, not the original87MB live database. Coordinator bd5d723a accepts this scope and separately files live-size/SQLite optimization follow-up; no new duplicate follow-up requested.

C2's real-socket delayed suite.slot test advances a complete FakeClock past3000ms, with a recorded deterministic red before the deadline change. Silent admission checks15/30/60-second bounds and typed AdmissionTimeout; package/load-gate regression proves nonzero and distinct infrastructure accounting. These positive controls do not cover the same-file mixed failure above.

## Evidence

A-4912: inspected the serial transcript. Twenty file invocations: five each for test-admission, test-admission-outcome, cover-quiet and quarantine-runner. Every raw summary reports zero failures/skips/cancellations; max admitted load4.919921875; no late asynchronous diagnostics. Host typecheck/tiers/report-only lint records pass. Related account-isolation and copied-coverage fixtures are reported green. No task droplet verification has been submitted.

## Verdict

Source not clear for M1; fail C2 until same-file assertion identities are preserved. C1 profile is reviewed and can be verified on the corrected source pass. The Implementer will submit a fresh source-review head before any verification. No per-item QA required.

Standards:1 medium finding. Spec:1 corresponding reporting gap.

Durable review: A-4913.

Criteria: C2 failed (File-wide admission suppression can hide unrelated later assertion failures in the same file; narrow classification and add the accepted same-file mixed control.).

### impl-758 · 2026-10-18T03:19:11.593Z

M1 from review A-4913 fixed and pushed at 1c5ece95: remove file-wide reporter suppression; filter only the typed admission event. Same-file T1 assertion control red before fix, green after; added real package-worker explicit AdmissionTimeout then later ordinary assertion proof. Affected two files each 5/5 serial at load1<=3.454 and all T0 checks green. Fresh source review requested before any verification; unchanged evidence A-4908/A-4912.

### rev-31 · 2026-10-18T03:20:23.721Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261018-758-source-2
commit: 1c5ece95753b3bf10f013b421d97f1fb8cce9b8b
scope: full
findings: [{"severity":"medium","text":"M1 remains: returning on a top-level AdmissionTimeout leaves ordinary child failures in #children; a later quarantined pass can consume/excuse them. Finalize those children as genuine failures at the admission envelope.","file":"hub/test/quarantine-reporter.ts","line":29}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-758 source correction review — not clear

Commit: 1c5ece95753b3bf10f013b421d97f1fb8cce9b8b.
Prior full review: rev-20261018-758-source-1 / A-4913.
Scope: full source review continuation; read-only, no Reviewer execution or edits.

## Standards

M1 medium remains at hub/test/quarantine-reporter.ts:29. The correction successfully removes the file-wide latch and preserves an ordinary top-level failure after an explicit AdmissionTimeout in the same file. However, its unconditional return for the current typed admission event leaves previously recorded child failures in #children when that event closes a top-level test. A later quarantined top-level pass can consume and excuse those earlier ordinary children, hiding their assertion identities. At an admission envelope's top-level boundary, flush already observed ordinary children to failures and remove that pending group; nested admission events must not erase other children. Add nested-child failure → parent AdmissionTimeout → later quarantined-pass controls at reporter and real package boundaries.

The Implementer confirms this boundary needs finalization and is correcting it (82107fb4). The root-hook timeout case must continue to report admission only, with no fabricated assertion identities.

## Spec

The same partial C2 reporting gap remains: genuine child assertion failures must survive infrastructure classification. The initial delayed/silent socket tests, nonzero root-hook/load-gate behavior, clock bounds and setup ordering are unchanged; C1 profile analysis in A-4913 remains valid.

A-4916 independently inspected: ten fresh whole-file serial receipts, five each for outcome and quarantine-runner, zero failures/skips/cancellations, maximum admission load3.45361328125. The flat same-file mutation is recorded red before correction. Those proofs establish the flat case, not the nested envelope. No dev merge or unrelated source change occurred.

Source remains not clear for M1/C2. No verification authorized at this head. Request a fresh source review after the accepted correction. Standards:1 medium finding; Spec:1 corresponding reporting gap.

Durable review: A-4917.

Criteria: C2 failed (An admission top-level envelope leaves ordinary nested failures pending, where a later quarantined pass can excuse them; flush them at their own envelope and add the accepted nested controls.).

### impl-758 · 2026-10-18T03:21:04.179Z

Remaining nested M1 in A-4917 fixed at e43d7870, pushed and submitted for fresh source review. The top-level admission boundary finalizes already observed ordinary children before the next quarantined event. T1 nested mixed-event control red before fix, green after; real package-worker control independently retains the child identity. A-4919 holds affected-file 5/5 serial receipts (load1<=2.893) and green T0 checks. No verification before source clear.

### impl-758 · 2026-10-18T03:23:39.684Z

Load-gate mixed-outcome correction pushed at c30540ac. Repetition-only regression red before cover-quiet: phase passes, one admission-only repetition, one mixed nested assertion+admission, three ordinary failures; expected failed gate id, got []. Fix separates admission accounting from ordinary repetition failures/diagnostics. T0 green; local green and 5/5 pending Coordinator Mac-window end. Coordinator decision 65e353fa authorized source review now; 5/5 still required before droplet verification even if source clears first. Artifact A-4926 records current evidence and the explicit gap.

### rev-31 · 2026-10-18T03:24:23.061Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261018-758-source-3
commit: e43d78700edb6e55c61bd7d548d85a5d4a2c30ff
scope: full
findings: [{"severity":"medium","text":"M2: an admission diagnostic bypasses ordinary same-worker diagnostics, and any admission suppresses the failed gate identity for genuinely failing repetitions.","file":"hub/test/load-gate.ts","line":115}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-758 source review continuation — mixed repetition outcomes

Commit: e43d78700edb6e55c61bd7d548d85a5d4a2c30ff.
Scope: full source continuation, read-only. Prior reviews A-4913/A-4917.

## Standards

M1 resolved. Typed admission events no longer latch a file. At a top-level admission envelope, previously observed ordinary child failures are finalized directly into failures and the pending group is removed. Both flat same-file and nested-child → parent admission → later quarantine controls now cover the original finding at reporter and real package boundaries.

M2 medium — hub/test/load-gate.ts:115–119 and 150. The per-repetition admission branch continues before ordinary diagnostics can be reported, even when the same worker also contains an ordinary assertion failure. At set completion, any admission count suppresses the normal failed load-gate identity for all five repetitions, even if another repetition genuinely failed an assertion. shared-defects.failingTests consumes the normal failed load-gate marker; therefore an actual repetition failure can disappear from failed identities/candidates and be reported only as admission blocked. Count admission independently and preserve ordinary failure markers/diagnostics whenever either the same worker or another repetition has a genuine failure. Add a repetition-only mixed outcome control. The Implementer agrees and is correcting this (1d7af175).

No other source finding identified. Native admission deadlines/setup order, nonzero outcome and profile scope remain as previously reviewed.

## Spec and evidence

C2 remains partial solely for M2: the agreed infrastructure outcome must not suppress genuine assertion outcomes in a mixed repetition set. Pure root-hook admission must still report no failed test identities and stay nonzero; no skip or quarantine excuse is permitted.

A-4919 independently inspected: ten fresh serial whole-file summaries, five each for outcome and quarantine-runner, all zero failures/skips/cancellations, maximum admitted load2.892578125; no late asynchronous diagnostics. The nested control is recorded red before the correction and both reporter/package controls are green. The newer tests cover phase/reporting envelopes; the mixed load-gate control is still needed. C1 profile in A-4908 remains established.

Source not clear for M2; C2 remains failed. No verify before a fresh source verdict. Standards:1 medium finding; Spec:1 corresponding mixed-outcome reporting gap.


Durable review A-4924. This records the completed review of e43d7870; the subsequent c30540ac correction is being reviewed separately.

Criteria: C2 failed (Mixed repetition admission reporting suppresses genuine assertion identities and diagnostics; keep ordinary failures independent of admission counts.).

### rev-31 · 2026-10-18T03:25:02.654Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261018-758-source-4
commit: c30540acacccd9280b663d3869d9438d0ea89ceb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-758 source review — clear at c30540ac

Commit: c30540acacccd9280b663d3869d9438d0ea89ceb.
Fixed base: d392167a4a94d8104d4990a322d3f23f56eac8e0.
Scope: full source continuation. Read-only; no Reviewer execution, edits or delegation.
Prior analysis: A-4913, A-4917, A-4924.

## Standards

No remaining source findings. M1 is resolved by limiting filtering to typed admission events and finalizing ordinary children at their top-level admission envelope. M2 is resolved: each worker increments admission accounting independently; only an admission-only worker bypasses ordinary diagnostic reporting. Mixed workers retain their diagnostic receipts, and any ordinary failed repetition retains the final failed gate identity alongside the admission count. Quarantine cannot excuse an admission outcome. Existing root-hook admission controls retain nonzero/no-failed-identities assertions.

The new T3 package-worker control keeps the phase green, then plants one admission-only repetition, one child assertion plus parent AdmissionTimeout, and three ordinary assertion repetitions. It asserts two admission attempts, four ordinary diagnostic receipts including nested text, nonzero status and the ordinary failed gate identity. The existing owned fixture lifecycle is unchanged. The correction changes only load-gate.ts and quarantine-runner.test.ts; no dev merge, allowance, tier change or unrelated pick.

## Spec

C1 established: A-4908's nine-session synthetic profile and raw CPU samples identify native SQLite prepare/all/get/run at 67.21% self time and store.history as the largest named domain stack. Fresh database/live-size limitation and overlapping inclusive samples remain explicit. Coordinator bd5d723a accepts this scope with a separate live-size performance follow-up.

C2's source design is now consistent with the agreed distinct admission outcome: delayed real socket with complete FakeClock, load-scaled 15–60-second bound, before-hook admission/setup ordering, nonzero typed timeout, separate package/load-gate accounting, and preserved ordinary assertion identities. The initial delayed-answer red and prior reporter controls remain documented in A-4908/A-4912/A-4919. Source review does not establish the new control's green execution.

## Evidence and remaining gate

A-4926 records the new repetition-only control's red-before result (expected retained identity, got empty list), plus host typecheck/tiers/lint. The retained typecheck and tier logs contain no reported errors. Local green execution and five serial affected-file passes have NOT been supplied at this head: they are explicitly pending the Coordinator's Mac cover end.

Independently read Coordinator 65e353fa-187a-4ce2-a8c5-d6fb1b66d0f7: source review may settle now; the Implementer must finish affected-file 5/5 after the end notice, then submit exact-head mode-free droplet verification only after source clear. This verdict does not waive that ordering. C2 final execution verification remains pending those receipts and the same-head gate; no final readiness/full green is claimed.

Source clear; verify C1 only. No per-item QA required.
Standards: 0 findings. Spec: no source gap; C2 execution evidence pending.

Durable review: A-4928.

Criteria: C1 verified.

### impl-758 · 2026-10-18T03:38:10.384Z

Post-cover exact-head local proof A-4932 at c30540ac: all four touched files 5/5 serial, peak sampled load1 6.652 (<15). Mixed load-repetition regression green; all prior admission and same-file reporter controls green. Head unchanged and clean since source clear A-4928. Submitting mode-free droplet verification after this proof, as Coordinator directed.
