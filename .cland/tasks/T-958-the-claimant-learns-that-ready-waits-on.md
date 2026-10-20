---
id: T-958
kind: task
title: The claimant learns that ready waits on its own done marks
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-952
blocked_by: []
topic: topic-734
branch: t/T-958-the-claimant-learns-that-ready-waits-on
created: 2026-10-20T09:53:32.957Z
updated: 2026-10-20T11:25:06.682Z
closed: 2026-10-20T11:25:06.682Z
---

## Summary

On 2026-10-20 around 00:07Z, three implementers (T-905, T-909, T-920) waited for ready with every criterion verified, but none had marked a criterion done. Nothing told them ready waits on the claimant's done marks.

## What to build

When the gate's only missing evidence for ready is claimant done marks, the hub tells the claimant. It sends one notice in the item topic naming the unmarked criteria and the command that marks them. It sends the notice again only if the set of unmarked criteria changes. The Implementer clause gains one line: mark every criterion done before requesting the final review. This comes from the residue of the rule batch (A-7281), which the human approved on 2026-10-20.

## Acceptance criteria

- [x] C1. An item whose criteria are all verified but some not done, with clear verdicts, gets one notice to the claimant naming the criteria; no notice repeats while the set is unchanged.
  - verified: rev-26 [reviewer] · run rev-20261020-958-final-3 · 2026-10-20T11:08:59.932Z · commit fd8b08b17a654054ec0f0bcb479877ceb5729d21
  - done: impl-958 · 2026-10-20T11:09:13.949Z
  - verified: rev-26 [reviewer] · run rev-20261020-958-final-4 · 2026-10-20T11:20:31.187Z · commit 9733b21fdb3df82ff5fcfbf23ae5ab35c18c677e
- [x] C2. The Implementer clause carries the done-marks line within its byte reserve.
  - done: impl-958 · 2026-10-20T10:33:26.293Z
  - verified: rev-26 [reviewer] · run rev-20261020-958-source-2 · 2026-10-20T10:41:19.542Z · commit 18e2e44d99c42b474fe5ef0f504fd9352bdc0dd8
  - verified: rev-26 [reviewer] · run rev-20261020-958-final-1 · 2026-10-20T10:49:30.991Z · commit 18e2e44d99c42b474fe5ef0f504fd9352bdc0dd8
  - verified: rev-26 [reviewer] · run rev-20261020-958-source-3 · 2026-10-20T10:52:13.143Z · commit fd8b08b17a654054ec0f0bcb479877ceb5729d21
  - verified: rev-26 [reviewer] · run rev-20261020-958-final-3 · 2026-10-20T11:08:59.932Z · commit fd8b08b17a654054ec0f0bcb479877ceb5729d21
  - verified: rev-26 [reviewer] · run rev-20261020-958-source-4 · 2026-10-20T11:12:17.451Z · commit 9733b21fdb3df82ff5fcfbf23ae5ab35c18c677e
  - verified: rev-26 [reviewer] · run rev-20261020-958-final-4 · 2026-10-20T11:20:31.187Z · commit 9733b21fdb3df82ff5fcfbf23ae5ab35c18c677e

## Comments

### impl-958 · 2026-10-20T10:32:24.759Z

Implemented missing-done readiness notices through the existing gate evaluation and topic delivery path. Last missing-id set and notice commit atomically in hub storage, so unchanged checks/restarts do not repeat. Updated both Implementer clauses, implement skill provenance/workflow, CLI help, README and agent/review docs. Targeted T1 clause reserve/wording checks passed on the working tree (local macOS); T2 readiness delivery/restart coverage is being finalized before source review.

### rev-26 · 2026-10-20T10:38:33.662Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261020-958-source-1
commit: fcccbe7b944d439e929d276dfd04b96e0e03030f
scope: full
findings: [{"severity":"medium","text":"Missing-done suppression is keyed only by item and criterion IDs: after claim handoff with the same missing set, the new claimant gets no notice. Include stable claimant identity and cover handoff while retaining same-claim restart suppression.","file":"hub/src/hub/core.ts","line":656}]
finding_counts: {"high":0,"medium":1,"low":0}

Medium M1 — hub/src/hub/core.ts:656–659: A notice sent to claimant A suppresses delivery to replacement claimant B with the same missing criterion IDs; Tracker.claim schedules a recheck but the checkpoint ignores recipient identity. Scope deduplication to the stable claimant identity and add an unchanged-set handoff regression plus same-claim restart suppression. C1 fails. No separate Standards finding. C2 wording is present in both Implementer clauses; unchanged reserve tests are retained. A-7487 has the two-axis source audit; A-7481 preserves original local targeted receipts (T1 roles-clauses 27/27, T2 tracker-ready 11/11), which do not establish integrated execution. No Reviewer tests were run. Corrected source needs fresh review before verification.

Criteria: C1 failed (After claim handoff, unchanged missing IDs suppress the notice to the new claimant.).

### rev-26 · 2026-10-20T10:41:19.542Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-958-source-2
commit: 18e2e44d99c42b474fe5ef0f504fd9352bdc0dd8
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. Persisted signature uses existing normalized stable claimant identity plus sorted missing IDs; atomic notice/checkpoint and both role-clause copies/reserve guard remain intact. Docs and skill agree. Spec: M1 resolved; both QA variants now release/reassign/reclaim to a replacement identity and observe that claimant's notice for unchanged missing IDs, then reopen under the replacement and retain final no-extra-notice/ready assertions. Full task source rechecked against retained 13e652a7; authoritative evidence/QA gate unchanged. A-7501 records audit, A-7497 exact-tree local original T2 11/11, T1 clauses 27/27 plus requested native T3 roles 4/4 and static check exit 0 (test lint report-only). C2 verified; C1/final execution pending accepted mode-free receipt at 18e2e44d. Reviewer ran no tests or edits.

Criteria: C2 verified.

### rev-26 · 2026-10-20T10:49:30.991Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-958-final-1
commit: 18e2e44d99c42b474fe5ef0f504fd9352bdc0dd8
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. A-7513 pins reviewed head; host check output inspected, later 6a6af881 reference explicitly not repeated remotely. Existing lint/budgets/ratchet report-only; five missing baselines and incomplete T3 timing basis disclosed. Own tracker-ready 11/11 base pass, all <2 s; 27 T1 clause cases pass, including both Implementer reserve/wording checks. Spec: accepted 2805809a at 18e2e44d exits 0, 2010/2010 passed, no failure/skip/cancel. QA=false/true claimant notice cases cover missing-set changes, handoff and restart and each has five passing repetitions (max 1.027749 s). Linux c-8 lon1, two workers, lifetime 406 s/$0.0282; T1/all T2 fallback includes Neovim, T3 deferred/not claimed. C1/C2 verified. A-7515 contains evidence audit. Reviewer ran no tests or edits.

Criteria: C1 verified, C2 verified.

### rev-26 · 2026-10-20T10:52:13.143Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-958-source-3
commit: fd8b08b17a654054ec0f0bcb479877ceb5729d21
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. Authorized merge bdaeb075 checked; sole manual skill metadata conflict retains full parent union, incoming dictionary guidance and done-marks paragraph. Imported Coordinator baseline instruction does not overlap the Implementer done line. Spec: notice transaction/claimant signature, gate/tracker/listener code and both readiness regressions are byte-identical to 18e2e44d. C2 source renewed. A-7523 retains exact merged-tree local 27 T1 + 11 T2 + four requested native T3 passes, isolated workers and root check exit 0 (existing test lint report-only). A-7525 records audit. C1/final pending new accepted mode-free evidence at fd8b08b1; old A-7513 is not new-head execution. Reviewer ran no tests or edits.

Criteria: C2 verified.

### rev-26 · 2026-10-20T11:01:17.106Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261020-958-final-2
commit: fd8b08b17a654054ec0f0bcb479877ceb5729d21
scope: evidence
findings: [{"severity":"medium","text":"Accepted current-head gate 2ac4658e/A-7534 exits 1: append CPU 7.096 ms * 8 exceeds rewrite 51.484 ms. Actual assertion failure blocks final acceptance; attribution to T-958 is not established.","file":"nvim/test/thread.test.ts","line":692}]
finding_counts: {"high":0,"medium":1,"low":0}

Medium execution-gate finding — nvim/test/thread.test.ts:692 fails append * 8 <= rewrite (7.096 ms versus 51.484 ms). A-7534 current-head 2ac4658e exits 1, so final acceptance is not clear. Own notice source has no new established defect: tracker-ready 11/11, both QA variants 5/5 repetitions each (max 1.074662 s), all 27 clause tests pass. C2 source verification remains; C1 run-dependent acceptance blocked, not a demonstrated notice regression. Linux c-8 lon1 two workers, 430 s/$0.0299, T1/T2 reaches Neovim, T3 deferred. Hub reports 2015/2014/1; separate interruption summary says 2025/2024/1, retained with labels in A-7535. Existing report-only lint/budget diagnostics do not waive this assertion. Lead has Bugs/S report and will seek shared-fix/retry disposition; no automatic rerun/threshold edit requested. Reviewer ran no tests or edits.

Criteria: C1 failed (Final run-dependent acceptance blocked by failed current-head gate A-7534 (thread cost assertion); own notice cases pass and attribution is unresolved.).

### rev-26 · 2026-10-20T11:08:59.932Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-958-final-3
commit: fd8b08b17a654054ec0f0bcb479877ceb5729d21
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no remaining finding. Coordinator 7672de05 filed prior A-7534 thread ratio failure as T-963 and authorized one unchanged-head retry. Accepted dae0e495/A-7539 exits 0 at fd8b08b1, 2015/2015 passed with no fail/skip/cancel; exact prior thread identity now passes. No source/assertion/threshold changed. Host check output inspected; later host reference not repeated remotely. Existing lint/budgets/ratchet report-only, six missing baselines and incomplete T3 basis disclosed. Spec: readiness 11/11 and clauses 27/27 pass; both notice/handoff QA variants have five passing repetitions each, max .845756 s. C1/C2 verified. Linux c-8 lon1 two workers, lifetime 356 s/$0.0247, T1/all T2 including Neovim; T3 deferred/not claimed. A-7542 retains prior failed receipt/disposition and new acceptance attribution. Claimant C1 done mark needs restoration after prior failure. Reviewer ran no tests or edits.

Criteria: C1 verified, C2 verified.

### rev-26 · 2026-10-20T11:12:17.451Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-958-source-4
commit: 9733b21fdb3df82ff5fcfbf23ae5ab35c18c677e
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings in requested delta. Authorized merge a693a037 preserves all skill provenance/body guidance; manual default-role conflict keeps exact done-before-final-review line plus incoming QA lint preflight. Both project/built-in copies retain T-561/T-794 pointers, done instruction and unchanged reserve/wording checks. Spec: T-958 notice/gate/tracker/listener code and both readiness regressions are byte-identical to fd8b08b1. C2 source renewed. A-7544 retains exact-tree local 27 T1 + 11 T2 + four requested native T3 passes (42/42), isolated fixtures, root check exit 0 with existing test lint report-only. No cap/assertion relaxation. A-7545 records audit. C1/final pending fresh mode-free evidence at 9733b21f; old A-7539 covers only fd8b08b1. Reviewer ran no tests or edits.

Criteria: C2 verified.

### rev-26 · 2026-10-20T11:20:31.187Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261020-958-final-4
commit: 9733b21fdb3df82ff5fcfbf23ae5ab35c18c677e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no findings. A-7553 pins reviewed head and host check; enforcing static/dictionary guards green, later host reference not repeated remotely. Existing lint/budgets/ratchet report-only, ten missing baselines/incomplete T3 timing basis disclosed. All 27 clause T1 and 11 readiness T2 base cases pass within tier budgets. Spec: accepted 6a3819ee at 9733b21f exits 0, 2048/2048 passed, no fail/skip/cancel. Both notice/handoff/restart QA variants pass with five repetitions each (max 1.043975 s); prior thread ratio identity also passes. Current claimant done marks retained. Linux c-8 lon1 two workers, lifetime 400 s/$0.0278, T1/all T2 including Neovim; T3 deferred/not claimed. C1/C2 verified. A-7556 records fresh acceptance; old A-7534 remains a separate T-963 failed receipt, not relabelled. Reviewer ran no tests or edits.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T11:25:06.681Z

Merged bf7fdca2dac23b4e7d6837ed6f135adcd872f8be onto dev.
