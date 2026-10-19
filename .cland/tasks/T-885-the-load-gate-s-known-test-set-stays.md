---
id: T-885
kind: task
title: The load gate's known-test set stays current under the merge queue without a stage-close refresh
state: open
status: review
size: M
criterion_seq: 3
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: topic-620
branch: t/T-885-the-load-gate-s-known-test-set-stays
created: 2026-10-19T16:16:37.559Z
updated: 2026-10-19T19:45:20.884Z
---

## Summary

The load gate treats every T1/T2 identity missing from hub/test/durations.json's tests baseline as new and repeats it five times. Only a stage-close refresh adds to that baseline. Under the merge queue stages rarely close, so by 2026-10-19 16:15Z the baseline was 30 hours old: about 480 already-landed identities were repeated in every task run, costing 617–778 s of 920–1170 s (A-6175, A-6178, A-6181, A-6187, A-6193, A-6195). Separately, `durations.ts refresh` drops every test absent from the newest log, so a batch log (T1+T3) or a task log (T0–T2) cannot refresh it alone.

## Acceptance criteria

- [x] C1. (T1, known-identity admission test) A T1/T2 identity that passed its five load-gate repetitions in the task run of an item that has since landed on dev is not repeated by later task runs, with no manual baseline refresh. A test over the gate's known-identity set shows this, and an identity introduced by an unlanded branch is still repeated.
  - done: impl-885 · 2026-10-19T19:37:04.075Z
  - verified: rev-31 [reviewer] · run rev-20261019-885-integration-final · 2026-10-19T19:38:32.635Z · commit d3918a60039ab3422b03c85f788f4be582b852b2
- [x] C2. `node hub/test/durations.ts refresh` given logs that each cover only some tiers keeps the previous baseline entries of files that appear in none of the given logs, and still drops tests that vanished from files the newest log ran (T1 test over refreshDurations).
  - done: impl-885 · 2026-10-19T19:37:07.290Z
  - verified: rev-31 [reviewer] · run rev-20261019-885-integration-final · 2026-10-19T19:38:32.635Z · commit d3918a60039ab3422b03c85f788f4be582b852b2
- [x] C3. (T0, docs inspection) docs/agents/tests.md describes the known-identity rule and the partial-log refresh in place of the stage-close-only rule.
  - verified: rev-31 [reviewer] · run rev-20261019-885-source-2 · 2026-10-19T16:26:14.684Z · commit d2c9890f799b544e30c571141988ec716788f164
  - verified: rev-31 [reviewer] · run rev-20261019-885-final · 2026-10-19T17:10:17.524Z · commit d2c9890f799b544e30c571141988ec716788f164
  - verified: rev-31 [reviewer] · run rev-20261019-885-integration-source · 2026-10-19T19:15:32.144Z · commit e5d0abef240b47e29f8812ca841664e46b5d625f
  - verified: rev-31 [reviewer] · run rev-20261019-885-shared-source · 2026-10-19T19:26:35.174Z · commit d3918a60039ab3422b03c85f788f4be582b852b2
  - done: impl-885 · 2026-10-19T19:37:09.584Z
  - verified: rev-31 [reviewer] · run rev-20261019-885-integration-final · 2026-10-19T19:38:32.635Z · commit d3918a60039ab3422b03c85f788f4be582b852b2
  - verified: rev-31 [reviewer] · run rev-20261019-885-integration-source-2 · 2026-10-19T19:45:20.884Z · commit d4792e4831895f2a7defdb8eeac38e811a3012ca

## Comments

### impl-885 · 2026-10-19T16:17:55.344Z

Implementation seams: C1 T1 Suites admission/known-identity set with fake executor and reopened store; durable exact-head load proofs become known only after matching dev landing receipt. C2 T1 direct refreshDurations, latest log per observed file with retention of unobserved files. C3 docs inspection. No new real hub processes.

### rev-31 · 2026-10-19T16:23:49.810Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-885-source-1
commit: 959bcd26e36c46b6d2785000faa7afb9530c065b
scope: full
findings: [{"severity":"medium","text":"M1 / C2: Observed files are derived only from timing records. If a later green log runs a file after its final test was removed, its ordinary file completion has no suite timing row; latestByFile is never set for that file, so lines 104–110 retain all vanished tests and the stale file total. Use ordinary file-execution receipts to distinguish a completed empty file from an unexecuted tier, and add a direct refresh regression with another timed file plus the empty file envelope.","file":"hub/test/durations.ts","line":91},{"severity":"medium","text":"M2 / C2: Unobserved allowance retention additionally requires previous.files[file], so a valid allowance for a new file with no measured baseline disappears on an unrelated partial refresh. The reviewed manifest already has hub/test/setup-machine.test.ts::setup machine keeps inherited harness state untouched in allow but no setup-machine file baseline. Retain unobserved allowances independently of a previous file baseline (and retain their artifact provenance); add a no-baseline allowance control.","file":"hub/test/durations.ts","line":115}]
finding_counts: {"high":0,"medium":2,"low":0}

Standards: no independent findings. Spec: M1/C2 at durations.ts:91 derives executed files only from test timings, retaining all old names when the latest run completes that file with zero tests. M2/C2 at durations.ts:115 drops an unobserved allowance unless previous.files contains its file; the current setup-machine allowance has no such baseline. Add direct refresh controls for an empty completed file beside another timed file, and an unobserved no-baseline allowance, preserving provenance and existing assertions. C1 landed-proof admission/recovery and occasion separation have no source findings; C3 documents the requested behavior. Source not clear. See detailed source review artifact in topic-620; a corrected head needs fresh source review before verification.

Criteria: C2 failed (Partial refresh cannot recognize completed empty files and drops unobserved allowances lacking a prior file baseline.).

### rev-31 · 2026-10-19T16:26:14.684Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-885-source-2
commit: d2c9890f799b544e30c571141988ec716788f164
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. Spec: M1/M2 resolved. Ordinary passing file-completion receipts now distinguish empty executed files from unexecuted tiers, including empty-only logs; repetition envelopes are excluded. Unobserved allowances survive without a file baseline and retained metadata keeps source artifacts. Direct T1 controls cover both; original CLI assertions remain. C1 admission/proof/recovery code is unchanged and source clear. C3 docs verified by inspection. C1/C2 final execution verification remains pending the unchanged-head mode-free task gate. A-6210 reports durations-refresh 3/3, durations CLI 17/17, typecheck/static checks green. See corrected source review artifact in topic-620. Source clear permits task verification at this exact head.

Criteria: C3 verified.

### impl-885 · 2026-10-19T16:48:43.350Z

Verification b5279fc6 (Linux droplet, 1260s/$0.0875), A-6249, at reviewed d2c9890f: all 5 T-885 regression identities passed their 5/5 load repetitions; ordinary hub phase 1588/1588. Run red solely on nvim/test/launcher-component.test.ts::failed or empty model answers keep free text with a one-line reason, repetition 1; 4/5 passed. Blocker reported to supervising Lead for shared-defect triage/retry direction; no head change or unrelated launcher diagnosis.

### rev-31 · 2026-10-19T16:49:35.796Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-885-runtime-1
commit: d2c9890f799b544e30c571141988ec716788f164
scope: evidence
findings: [{"severity":"medium","text":"Runtime blocker: A-6249 exits 1 because failed or empty model answers keep free text with a one-line reason fails load repetition 1 (10.450247559 s, screen never showed free text retains its reason); final gate is 4/5. This is outside the T-885 source diff; cause unclassified. A red configured receipt cannot establish final acceptance.","file":"nvim/test/launcher-component.test.ts","line":213}]
finding_counts: {"high":0,"medium":1,"low":0}

Runtime not clear for b5279fc6 / A-6249 at the unchanged source-clear head. Independently parsed 1588 ordinary passes; all five owned cases and 25 repetitions pass with no owned budget/resource violation. The sole nonpassing repetition is launcher-component free-text reason at log :59262; diagnostic :59265; 4/5 gate at :59324. Source fixes remain accepted and C3 static verification remains current; C1/C2 are blocked only on accepted runtime evidence. The cause of the outside identity is unclassified. Replacement c080353f is admitted but not yet passing evidence. Full external budget/trip inventory is retained in the runtime assessment artifact in topic-620.

Criteria: C1 failed (Final runtime acceptance blocked by A-6249's launcher repetition failure; owned known-proof controls pass.), C2 failed (Final runtime acceptance blocked by A-6249's launcher repetition failure; all owned refresh controls pass.).

### rev-31 · 2026-10-19T17:10:17.524Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-885-final
commit: d2c9890f799b544e30c571141988ec716788f164
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear on authorized same-head retry c080353f / A-6271. Independently parsed 1588 ordinary passes and all 508 gates 5/5. All five owned C1/C2 controls pass plus 25 repetitions; maxima 0.140093347 s ordinary and 0.137806980 s repeated, no owned budget/resource violations. C3 docs remain source-verified; all criteria verified. Independently read Coordinator 0abb374d authorizing the retry and filing prior launcher failure as T-889. That identity now passes ordinary plus 5/5; A-6249 remains retained as failed evidence. A-6210 host native CLI evidence remains disclosed; Linux T3 is the landing gate. The final artifact retains 27 external budget rows, four known onboarding trips (T-877 overlap), roles-editor overlap T-875 and report-only whole-plan T1 projection 122.628 > 120 s with missing baselines. No source change or further run required for this item evidence.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-31 · 2026-10-19T19:15:32.144Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-885-integration-source
commit: e5d0abef240b47e29f8812ca841664e46b5d625f
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized integration delta clear; no Standards/Spec findings. Independently read Coordinator 2c3f70ba authorizing this single dev merge. Combined conflict hunks retain dev's batchTiers selection and dev-t3 baseline exclusion alongside the separate ordinary task-only landed-proof attachment. Docs combine both policies; C3 verified at the new head. Proof helper, duration refresh and new T1 controls are byte-unchanged from prior final-clear head; dev's duration/config changes remain intact. A-6360 reports both-project typecheck and four targeted files 30/30 green. C1/C2 need fresh unchanged-head mode-free task evidence; prior A-6271 is stale for execution. See integration delta artifact in topic-620.

Criteria: C3 verified.

### impl-885 · 2026-10-19T19:22:05.801Z

Integration-head task verification ed9edc8a at e5d0abef failed (A-6387): two hub/test/verify-tool.test.ts identities failed ordinary and all five load repetitions, 12 total completed failures; ordinary hub phase 1387/1389. Reported to supervising Lead for existing T-891 shared-fix guidance. No local unrelated diagnosis, edits or retry. Linux c-8 lon1, 329s/$0.0229. Reviewed head unchanged.

### rev-31 · 2026-10-19T19:26:34.016Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-885-integration-runtime
commit: e5d0abef240b47e29f8812ca841664e46b5d625f
scope: evidence
findings: [{"severity":"medium","text":"A-6387 exits 1: both verify-tool identities fail ordinarily and all five repetitions because fixture verification commands are missing (T-891, Coordinator 7ed14ccf). Owned five cases and 25 repetitions pass, but the configured gate is red.","file":"hub/test/verify-tool.test.ts","line":43}]
finding_counts: {"high":0,"medium":1,"low":0}

Complete-log evidence audit: ordinary 1387 pass/2 fail; two shared gates 0/5; all five owned controls and 25 repetitions pass. No tier mismatches; nine external report-only duration diagnostics retained in the companion artifact. Head e5d0abef remains not clear on runtime evidence; subsequent authorized shared-fix head requires its own source review and gate.

Criteria: C1 failed (Required integration task receipt A-6387 is red on the two shared T-891 fixture identities.), C2 failed (Required integration task receipt A-6387 is red; positive owned refresh controls do not establish a passing configured gate.).

### rev-31 · 2026-10-19T19:26:35.174Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-885-shared-source
commit: d3918a60039ab3422b03c85f788f4be582b852b2
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. Exact Coordinator-authorized +7/-1 delta only verify-tool.test.ts supplies real fixture verification commands and cland-shaped candidate files through the existing helper. Fake candidate/clock seams and every assertion remain. Spec: no findings; preserves injected selection for claimed/explicit cwd, validation and empty queue controls. T-885 production changes and docs unchanged; C3 re-established at this head. C1/C2 await a new mode-free configured task receipt; old A-6387 remains failed and is not reused as green. Companion artifact records the complete runtime and source audit.

Criteria: C3 verified.

### rev-31 · 2026-10-19T19:38:32.635Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-885-integration-final
commit: d3918a60039ab3422b03c85f788f4be582b852b2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear on c66154e4-a5b3-4eb7-98d2-43fbea693f22 / A-6437 at the unchanged current source-clear head. Independently parsed 1624 ordinary passes and all 36 load groups 5/5, with no failures or tier mismatches. All five original C1/C2 controls pass ordinarily: three duration refresh rows :35660/:35665/:35670 and two landed-proof rows :37825/:37834. Ordinary maximum 0.092609498 s, file totals 0.042542687 s and 0.176532628 s. Each has five repetitions (25). All three shared verify-tool identities also pass ordinarily and five times each (15), combined repeated maximum 0.239549398 s. No tier-mismatch row anywhere. C3 docs remain source-verified at this head. Source/spec requirements and all criteria checked across the source chain and this receipt. Complete external report-only budget inventory retained in A-6448; none owned, no unrelated diagnosis. T3 remains periodic/integrated evidence, not part of this task claim. Earlier red receipt remains retained.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-31 · 2026-10-19T19:45:20.884Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-885-integration-source-2
commit: d4792e4831895f2a7defdb8eeac38e811a3012ca
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta clear, no Standards/Spec findings. Independently read Coordinator 79b3a85f allowing this one dev merge after conflict. Only manual conflict is Dispatcher Suites construction beside the newly landed DevT3Probes/DevT3Search setup. Combined diff and comparison to pinned dev show the complete dev constructor/search wiring retained, with only the existing taskLanding callback added: closed item summary supplies its exact merge receipt, otherwise null. Proof planner, refresh implementation, three refresh controls and two landed-load controls are byte-unchanged from the prior final-clear head. C3 docs still describe exact landed-head 5/5 proof admission, partial-log unobserved retention/empty-file pruning/provenance; reverified at this head. Separate targeted 2+3+17+8 checks and both-project typecheck reported green, functional timing only. Earlier final receipt is stale for this new head; C1/C2 await fresh mode-free configured task execution. See integration delta artifact A-6480.

Criteria: C3 verified.
