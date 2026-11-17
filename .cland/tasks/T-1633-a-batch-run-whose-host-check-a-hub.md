---
id: T-1633
kind: task
title: A batch run whose host check a hub restart killed holds as inconclusive after a green rerun
state: closed
status: done
size: S
criterion_seq: 3
labels: []
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1595
branch: t/T-1633-a-batch-run-whose-host-check-a-hub
created: 2026-11-02T11:11:55.194Z
updated: 2026-11-17T11:51:25.220Z
closed: 2026-11-17T11:51:25.220Z
---

## Summary

Merge batch 5d4ff9c3 (T-1632, T-1566, T-1621) was admitted as run a18f9a6a at 10:21:53Z, 36 s before hub restart #69. The old hub's stop killed the host-gate check (`tier T0: exit 143; duration 35.33 s`). The new hub re-admitted the run and reran T0 (`exit 0; 72.984 s`), and every tier came back green: 6431 pass, 0 fail, wall 2880 s, $0.189 (log A-15797). The batch was still held: `original a18f9a6a inconclusive: aborted or unavailable worker result`. The Coordinator had to cancel and re-enqueue, which discarded 48 min of green evidence.

## What to build

- When the same run reruns a step after a restart, the later receipt supersedes the earlier aborted one, as long as both are bound to the same run, candidate tree and command.
- A batch whose final receipts are all passing lands. The superseded aborted attempt stays visible in the log and the notice.
- An aborted receipt with no later passing one still holds the batch as inconclusive.
- Separately: there is no Coordinator command to recover a held batch with its retained evidence. Recovery means cancel and re-enqueue. Cancelling members one by one lets the hub re-form a smaller batch from the remaining ones and start it at once: ac1986e3 started T-1632 alone at 11:11:23Z, between my cancel calls.

## Acceptance criteria

- [x] C1. A batch run whose T0 attempt is aborted by a hub stop and rerun green on the restarted hub, with all tiers green, lands without a hold. A component test restarts the hub during the host gate.
  - done: impl-1633 · 2026-11-17T06:52:35.178Z
  - verified: rev-35 [reviewer] · run rev-35-1633-final-1 · 2026-11-17T07:41:33.725Z · commit 4d4a159c1d4c8c2a5ea67adc98647813b817ad6b
  - verified: rev-35 [reviewer] · run rev-35-1633-final-2 · 2026-11-17T10:10:00.929Z · commit 4641adcfa742936590f903c3af5585f590a39c05
- [x] C2. An aborted T0 or tier receipt with no later passing receipt for the same run still holds the batch as inconclusive. The existing tests still pass.
  - done: impl-1633 · 2026-11-17T06:52:40.240Z
  - verified: rev-35 [reviewer] · run rev-35-1633-final-1 · 2026-11-17T07:41:33.725Z · commit 4d4a159c1d4c8c2a5ea67adc98647813b817ad6b
  - verified: rev-35 [reviewer] · run rev-35-1633-final-2 · 2026-11-17T10:10:00.929Z · commit 4641adcfa742936590f903c3af5585f590a39c05
- [x] C3. The landing notice and the log name the superseded aborted attempt, with its exit code and duration.
  - done: impl-1633 · 2026-11-17T06:52:41.141Z
  - verified: rev-35 [reviewer] · run rev-35-1633-final-1 · 2026-11-17T07:41:33.725Z · commit 4d4a159c1d4c8c2a5ea67adc98647813b817ad6b
  - verified: rev-35 [reviewer] · run rev-35-1633-final-2 · 2026-11-17T10:10:00.929Z · commit 4641adcfa742936590f903c3af5585f590a39c05

## Comments

### coord · 2026-11-02T11:54:41.978Z

The cost of the cancel/re-enqueue recovery is confirmed. Stale batch ac1986e3 held the cancelled 10:01:20 T-1632 entry, and its run b10b1e59 went green at 11:54Z (6108 pass, 0 fail, 2508 s, $0.174). It landed nothing, because `merge-batches.ts:164` matches a member by item, head and `enqueued`, and the re-enqueued entry is from 11:11:26. The hub then formed batch 3e1bfcbf with the same three heads. Total loss from one restart: two green runs (93 min of wall time, $0.36) and about 1.6 h of queue time. Coordinator `verify cancel` on the hub-owned run was refused, which is correct: only the human may cancel it.

Scope addition for the fix: a member whose queued request was cancelled and re-enqueued at the same head should keep its batch membership, or the hub should drop a batch at once when a member is cancelled before its run starts. It should never run a batch that can't land.

### impl-1633 · 2026-11-17T06:50:33.106Z

Consumer audit: verificationStepResults callers are merge-batches diagnosticResult, batchFailures and batch summary. Suites.#hostGate produces the new additive binding; SuiteLogEvidence must retain it. Existing tier logs and verificationStepCommand remain readable; unbound legacy interruptions stay inconclusive. Tests and docs searched across hub, nvim, web, docs and shipped skills. Same-head cancel/re-enqueue recovery remains T-1630 policy, covered by existing tests; no new CLI command.

### rev-35 · 2026-11-17T07:08:29.389Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1633-source-1
commit: 4d4a159c1d4c8c2a5ea67adc98647813b817ad6b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, source tree f04de6a576a76014fada3549c6347448872947ec; A-20731 with evidence addendum A-20733/A-20732. Bound later pass supersedes only matching interrupted run/tree/command/step; old/missing/mismatched/unbound interruptions remain inconclusive, ordinary failures stay failures. Shared parser drives diagnosis/failure collection/reporting, preserving both receipts and numeric exit/duration with superseded label. Joined/bounded fake Suites/Store reopen proves component boundary without claiming native hub restart; no new command. No findings. C1-C3 remain unverified pending same-head configured evidence, no verified marks. A-20732 links final90-case one-file run/full typecheck to clean committed head; full lint exit0 overlapped final amendments, not immutable final lint snapshot;122/59 advisories retained. Two prior incomplete attempts/raw/hash/native-signal/publication-control limits stay explicit. No Reviewer runtime/probe/edit. Follow Coordinator verification-window policy.

### rev-35 · 2026-11-17T07:41:33.725Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1633-final-1
commit: 4d4a159c1d4c8c2a5ea67adc98647813b817ad6b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Same-head final evidence clear; A-20747 reconciles A-20743/run2fad0385 against A-20731 source and A-20732/A-20733 limits. All three new bound-retry/reopen/inconclusive controls have ordinary PASS plus five load passes; full merge-batches 90/90 and relevant evidence consumers passed. Numeric old exit143/duration35.33s and supersession notice retained. Component uses production Suites/Store/controller close-reopen with fake host gate/executor; no native hub restart or recovery latency claim. T0/T1/all-T2/Web exit0;6605 ordinary passes/707files plus225 separate load passes, no fail/cancel/skip. Head unchanged; normalized verification tree35bc70fcf5e1fda3af50e7a12af97c8dc9657acf, uncached Linux x64/Node24.21.0, HeadlessShell1248/ChromeTesting156.0.8078.4.269T3/17T4 files unexecuted. Known T-1935 fixture line pair retained separately from terminal Finished exit0/hub passed. Lint122/59, timing/ratchet/skip checks report-only, including merge-batches13.139s>10s. Earlier raw/hash/signal/lint-overlap limits preserved. Standards0/Spec0. C1-C3 verified. No Reviewer runtime/probe/edit/new run/merge.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-17T08:21:34.523Z

Coordinator, 08:21Z: removed from the merge queue. The head conflicts with T-1931 in suites.ts and suite-log.ts. T-1931 lands first; T-1633 then merges dev once, gets a delta review and a new verify (rule 6 serialization of hot files).

### rev-35 · 2026-11-17T09:22:56.060Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1633-source-2
commit: 4641adcfa742936590f903c3af5585f590a39c05
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-20817: authorized postT1931 merge delta clear at tree3137dff50b6de7f6b6edfd95350f17fcb68b499d; parents4d4a159c+9143ae841, Coordinator364446d6/assignment89d5ba68. Standards0/Spec0 findings. suites.ts retains interrupted-host binding and upstream soak calibration/timing imports/calls. suite-log central predicate preserves host bindings+ordinary evidence+shared strict marker for both ingestion/reducer; no broad alternate grammar. Prior bound run/tree/command supersession and negative controls retained. A-20813 localfourT1files131/131,full typing/lint0/refusals0/123report60files; candidate/commit tree match, rawhash/signals unavailable. No configured/T2/T3/T4/Web/native restart claim; priorgreen only4d4. C1-C3 pending final evidence. Coordinator serialization requires T1848 landing then another dev merge/fresh delta review BEFORE eventual verification window; this verdict does not bypass it. No Reviewer runtime/probe/edit.

### rev-35 · 2026-11-17T10:10:00.929Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1633-final-2
commit: 4641adcfa742936590f903c3af5585f590a39c05
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-20834 final exact-head clearance: sourceA-20817 + passed45f96062/A-20833 at4641adcfa, normtreea22a2c2d5cde244bc7f589e457821ad34fabeca4/prov38123. Coordinator3d97a70c supersedes earlier second-merge requirement;0f85c5b2 granted thisheadwindow. Independently6629ordinarytest/709file passes,225load passes separate; all224T1/429T2/55Web/1mappedT3 complete,no missing/nonpass/fail/cancel/skip; alltiers/Finishedexit0. Bound retry4026/stop-reopen4031/unmatched-abort4036 ordinary +5load each/proofs4207,4226,4335. Source assertions preserve superseded143/35.33s history and bound run/tree/command/step negatives; simulatedcontrollerreopen,notnativehubrestart/latency. Batch90/planner6/soak29/summary6 allpass,strictmarker10049 preserved.64warningsunchangedvsA-20823,123lint60files/budgets report-only. ExactT1935pair28591–92 fixturetextnotoutcome. LinuxNode24.21Nvim.12.5uncached; actualHeadlessShell1248/CfT156browser35509. OneT3file4passonce,noreps;14.151s selectedphasesexclwaitnotwall;268T3/all17T4unexecuted. C1-C3verified. No Reviewer runtime/probe/edit.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-17T11:51:25.220Z

Merged bb9613d63c7ae358c500f9c15f72b97f55d06792 onto dev.
