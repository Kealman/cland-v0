---
id: T-1843
kind: task
title: A finished suite with no lease stays in verify queue as an active remote run and holds a remote slot across restarts
state: open
status: review
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1543
branch: t/T-1843-a-finished-suite-with-no-lease-stays-in
created: 2026-11-13T12:41:29.355Z
updated: 2026-11-16T14:55:55.968Z
---

## Summary

Periodic dev-t3 run b33e7940-f94b-4916-9181-13c0dec731f7 (started 2026-11-12 23:02:11Z on droplet cland-v0-58c69f29, lon1) ended without a posted result. Since then `cland verify queue` keeps listing it as an active remote run ("remote n/8 … ETA 0s") and counting it against the remote budget, across hub restart #71. `cland verify cancel` refuses it with "suite already finished", and the droplet no longer exists (executor status tags only the live lease). So a finished suite holds a remote slot that no permitted action clears.

## What to build

A suite that has finished, or whose lease and droplet are gone, leaves the active remote list and releases its slot. That holds at hub start too, where a restored run record with no live lease and a finished state is reconciled as finished instead of active. A run that ended without a posted result still gets one posted result naming why (lost collection, missing receipt), and the heartbeat's "ended without a posted result" row clears once that result is posted.

## Acceptance criteria

- [x] C1. A remote run whose suite record is finished and whose lease is gone is absent from `cland verify queue` and does not count against `remote_budget`, both live and after a hub restart (test).
  - verified: rev-35 [reviewer] · run rev-35-1843-final-1 · 2026-11-16T09:29:13.317Z · commit ae5664ce0e9c6788bb7eb4176ca32af91766b24a
  - verified: rev-35 [reviewer] · run rev-35-1843-merge-delta-1 · 2026-11-16T09:55:24.336Z · commit f66be0d2f1818458c7d400e6fb09aff918eebc09
  - done: impl-1843 · 2026-11-16T14:22:11.753Z
- [x] C2. A run that ended without a posted result gets exactly one posted result naming the missing receipt, after which the heartbeat no longer lists it (test).
  - verified: rev-35 [reviewer] · run rev-35-1843-final-1 · 2026-11-16T09:29:13.317Z · commit ae5664ce0e9c6788bb7eb4176ca32af91766b24a
  - verified: rev-35 [reviewer] · run rev-35-1843-merge-delta-1 · 2026-11-16T09:55:24.337Z · commit f66be0d2f1818458c7d400e6fb09aff918eebc09
  - done: impl-1843 · 2026-11-16T14:22:12.003Z

## Comments

### impl-1843 · 2026-11-16T08:25:44.576Z

Consumer sweep before implementation: suite.queue/verification.queue/VerificationQueue/remoteBudget and suite-jobs/suiteJobSummaries/outcome/reported searched across hub/src, hub/test (T1–T4), nvim, web, shared, QA briefs and skills. CLI hub/src/cli/suite.ts, heartbeat hub/src/hub/heartbeat.ts, core/dispatch/web-authority, Neovim state/hub/actions/explorer/init and web connection/sessions/verification consume existing queue shapes; no wire field changes. Store/daemon/startup diagnostics, suite-worker, budget, git-maintenance and executor droplet readers keep their formats. QA T-230/T-268/T-275/T-386/E-412/E-418/E-419/E-426/E-676 and implement skill examples remain valid; only terminal no-lease remote membership changes. Existing queue/client regressions retain previous wire shapes. Full path inventory will be in the evidence artifact. Tests target suite-persistence and existing remote-budget/accounting/heartbeat client coverage; no process boundary changes.

### rev-35 · 2026-11-16T08:34:54.074Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1843-source-1
commit: 0954a8ccd6c0b981514016f97a13e3a6498ef9b5
scope: full
findings: [{"severity":"medium","text":"Missing result/log receipts do not prove non-execution. Unconditionally adding notRun:'infrastructure' makes dispatch/periodic reporting falsely say no tests executed and suppresses available failing identities for a previously executed run. Preserve known execution/outcomes and use notRun only with original positive pre-execution proof.","file":"hub/src/hub/suites.ts","line":1437}]
finding_counts: {"high":0,"medium":1,"low":0}

Complete full source pass A-19885: one confirmed medium C2 classification finding; no separate C1 source finding. A-19886 arrived afterward and is retained as supplement: original 120 hits, conservative 1402-row inventory and explicit candidate/raw-capture limitations; no runtime coverage inferred. C1 pending fresh source/configured evidence, not failed for authorized pending checks. No Reviewer runtime work. Hold released for consolidated correction and fresh source review before verification.

Criteria: C2 failed (Missing-evidence recovery falsely classifies previously executed runs as not-run and drops available execution/failure identities from reporting.).

### rev-35 · 2026-11-16T08:40:14.095Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1843-source-2
commit: 5f9cb4cc1356bee53fa17708edb1032fc85c1c43
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Replacement full source clear, A-19895. A-19885 classification finding resolved: no invented notRun, known nonzero failure and surviving identities preserved; four controls cover production periodic/result-summary semantics including prior genuine refusal. C1 occupancy/restart/report flow unchanged. C1/C2 pending configured same-head named/file evidence. A-19886/A-19891 capture/consumer limits retained; terminal lint receipt93cd27ed noted. No Reviewer runtime work. Hold released for authorized mode-free verify.

### rev-35 · 2026-11-16T08:51:03.151Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1843-evidence-1
commit: 5f9cb4cc1356bee53fa17708edb1032fc85c1c43
scope: evidence
findings: [{"severity":"medium","text":"Recovery precedes normal first result materialization for genuine pre-execution refusals and invents collection-loss text. A-19909 has five existing shard/periodic cause regressions. Preserve original proven refusal causes and distinguish expected receipt absence from lost execution evidence.","file":"hub/src/hub/suites.ts","line":1426},{"severity":"medium","text":"Both new T1 queue tests invoke real LocalExecutor.holder native compatibility/lock inspection; A-19909:11366–11367 records child_process.spawn tripwires. Fake this pure scheduler boundary while retaining real queue assertions.","file":"hub/test/suite-persistence.test.ts","line":47}]
finding_counts: {"high":0,"medium":2,"low":0}

Failed-evidence pass completed, A-19911/A-19909. Ordinary1705pass/5fail,218passing/2failing T1 files; separate245load tests/files positive. T2/Web unexecuted, browser provenance null. Six new case passes do not override reached failures/tripwires. Both gaps confirmed by implementer; no flake/retry classification. Prior source clear retained as history. No Reviewer runtime work. Hold released for consolidated correction and fresh source review before a new authorized verification.

Criteria: C1 failed (New T1 queue controls reach native holder inspection instead of an isolated semantic fake.), C2 failed (Configured T1 has five own-change failures because recovery corrupts original pre-execution refusal causes before first result materialization.).

### rev-35 · 2026-11-16T08:56:20.951Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1843-source-3
commit: d785a6c515d45144edb48004f5dc6bfe0a427640
scope: full
findings: [{"severity":"medium","text":"The notRun early return skips repair for a restored terminal refusal with both log/result lost. Terminal restore returns true, normal writing is skipped, and missing log reading fails before publication/heartbeat clearance. Materialize report inputs while preserving exact original refusal outcome/cause; cover both-files-missing restart recovery.","file":"hub/src/hub/suites.ts","line":1429}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source pass A-19918. Original refusal-cause and T1 holder-boundary findings resolved, but blanket notRun exclusion creates a remaining C2 recovery gap, confirmed source-only by implementer45b22a51. C1 source isolation corrected; final configured evidence still pending. A-19909 remains failed history; candidate A-19916 and capture/consumer limits retained. No Reviewer runtime work. Hold released for consolidated correction/fresh source review before verification.

Criteria: C2 failed (Restored terminal original notRun records with both report files lost still cannot publish or clear heartbeat.).

### rev-35 · 2026-11-16T09:02:27.469Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1843-source-4
commit: ae5664ce0e9c6788bb7eb4176ca32af91766b24a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, A-19926. A-19918 terminal-refusal missing-input gap resolved; reconstruction preserves exact outcome/cause/finish, log records missing inputs; fresh refusal normal materialization and surviving result preservation retained. Expanded four-case restart/refused control, previous periodic/execution controls and T1 holder fake align. C1/C2 await configured same-head named/file evidence. A-19909 remains failed history; candidate/provenance/consumer limits retained. No Reviewer runtime work. Hold released for new authorized mode-free verify window.

### rev-35 · 2026-11-16T09:29:13.317Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1843-final-1
commit: ae5664ce0e9c6788bb7eb4176ca32af91766b24a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head C1/C2 verified, A-19936/A-19935. Independently streamed6389base tests/700files and255separate load tests/files, all pass. Nine required new identities each ordinary+5; all five prior refusal failures now pass unchanged; no persistence tier-mismatch records. All selected220T1/425T2/55Web files positive, no missing receipt. Preserves120original hits/1402table rows and conservative manifest union1499; broader267T3/17T4 deferred. A-19909 remains failed own-change history; capture/report-only boundaries retained. Clean head unchanged; no Reviewer runtime work. Hold released; Coordinator landing gate remains.

Criteria: C1 verified, C2 verified.

### rev-35 · 2026-11-16T09:55:24.337Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1843-merge-delta-1
commit: f66be0d2f1818458c7d400e6fb09aff918eebc09
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta clear, A-19944. Coordinator575feeb6 in topic-1425 independently read: docs-only resolution verify waiver plus three merged-head checks. Parents match; own suites/test blobs unchanged; only running.md/README differ from both parent trees, documentation preserves both entries/policies. A-19941 reports sequential typecheck/lint/wording exit0 below load12; raw capture limits retained. C1/C2 prior verified evidence A-19933/A-19936 carries under explicit waiver, not fresh merged-head runtime. A-19909 remains failed history. Clean head, no Reviewer runtime/merge work; hold released.

Criteria: C1 verified, C2 verified.

### rev-35 · 2026-11-16T12:34:49.692Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1843-source-5
commit: 982d350da1750e2acdee6551366b343ff00e6c8b
scope: full
findings: [{"severity":"medium","text":"Proposed sixteen-file native producer has no enclosing failure owner: child-error rejection/capture exception bypasses timer clear, captured stop join, flush and terminal receipt. ownProcess(undefined,...) does not join that path; claimant confirms. Rule12: own launch/capture/completion/error/timeout through outer attempt-all finally, join captured cleanup before terminal receipt and label incomplete producer errors. Correct/review the future producer artifact before running; preserve existing normal receipts and original artifact, no provenance rerun.","file":".cland/artifacts/A-20039-t-1843-bounded-isolated-native-file-producer.mjs","line":34}]
finding_counts: {"high":0,"medium":1,"low":0}

Completed A-20068 full post-bisect pass. No new committed product/test Standards or Spec finding: narrowed recovery excludes cache/legacy report-only inputs while retaining terminal timestamped recovery/refusal repair. One medium blocks proposed native producer, not the product guard. Exact red/green normal-completion receipts A-20034/36/37/38 read; A-20035 setup failure excluded. A-20027 sixteen direct T3 consumers and new configured run remain pending; C1/C2 not newly verified or failed solely for pending evidence. Correct future producer artifact without moving product head if possible, request re-review before native work. Old failed landing/bisect and precommit/capture/lock limits retained. Hold released.

### rev-35 · 2026-11-16T12:42:14.886Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1843-source-6
commit: 982d350da1750e2acdee6551366b343ff00e6c8b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear A-20072 after artifact-only A-20070/A-20071 correction; product head remains unchanged. Prior sole medium is resolved: outer launch/capture/error/signal/timeout ownership, consumed callbacks, captured-birth cleanup join, separate exact-close observation, flush before receipt, explicit incomplete outcomes and retained roots. No native failure experiment or new runtime pass claimed. Product guard/test correction remains Standards0/Spec0 as read in A-20068. C1/C2 unverified at this head; prior raw/candidate/publication/lock and failed-landing limits retained. A-20027 sixteen direct T3 consumer files remain planned. Coordinator T-1859-first ordering, later authorized dev/README merge/delta review and final-head mode-free verify remain required. Capture actual clean head/tree around future slots; caller-supplied label alone is not immutable head proof. Hold released; no final-ready claim.

### impl-1843 · 2026-11-16T12:59:53.371Z

Completed accepted A-20027 native-consumer plan: all16 remaining direct result-line T3 files passed at clean982d350da/tree d9e7bfdb,130/130 tests, no fail/cancel/skip/timeout/producer errors. Per-file output+native receiptsA-20073–A-20088; reconciled path/tier/provenance packetA-20089. Reviewed producerA-20070, two checked exclusive slots, isolated account/provider fixture environments; no full runtime-suite claim. T-1859-first devmerge/delta review and new final-head verification remain pending. Prior failed batch/bisect and excluded setup receipt remain history.

### rev-36 · 2026-11-16T14:07:36.547Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1843-merge-source-2
commit: b49d84679978ef52258d8dd57489fe79b4075c74
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merge source clear; independent static ledger A-20129 and source note just published. Parents and automatic hub/src/test subtrees confirmed; README alone manually resolves both recovery/regional-capacity entries. Read inherited Suites timeout inventories, log/progress/stall diagnostics, provider/fake and cleanup interactions; no merge finding. Coordinator9036c7be supersedes carry: old sixteen native receipts do NOT carry, despite identical direct test blobs. C1/C2 not newly verified; fresh sixteen merged-head full files, terminal compiler/lint checks and final exact-head configured run required. A-20130 typecheck0 reported, lint pending; old reds/candidate/capture limits preserved. No Reviewer runtime. Hold released for authorized checks/slots.
