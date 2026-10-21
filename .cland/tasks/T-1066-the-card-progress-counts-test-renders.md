---
id: T-1066
kind: task
title: The card progress-counts test renders wrong counts under load
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1061
topic: topic-812
branch: t/T-1066-the-card-progress-counts-test-renders
created: 2026-10-21T15:28:00.813Z
updated: 2026-10-21T15:46:59.830Z
---

## Summary

T-1061's new test `nvim/test/progress-counts-component.test.ts` "release and epic cards include closed children in progress and preserve open blocker counts" fails under load. In the E-415 stage 3 Linux cover 21dee14f at dev 296a5457, the load gate passed 4 of 5 repetitions (A-8519 line 6557, line 6708). The failed repetition rendered the release card's PROGRESS section with counts that do not match the expected ones. The render probably races the snapshot or a child_counts delta.

## Acceptance criteria

- [x] C1. The test waits for the state it asserts (child_counts applied, card rendered from it) rather than for time. The cause of the bad repetition is named in the item topic.
  - done: impl-1066 · 2026-10-21T15:31:05.546Z
  - verified: rev-23 [reviewer] · run rev-20261021-1066-source · 2026-10-21T15:32:35.274Z · commit 89730092e582f40ab2cf83a90219d63afb295ef5
  - verified: rev-23 [reviewer] · run rev-20261021-1066-final · 2026-10-21T15:46:59.741Z · commit 89730092e582f40ab2cf83a90219d63afb295ef5
- [x] C2. The test passes 20 sequential repetitions under the load gate (workers 2) in a scratch clone at the task head, and a mode-free `cland verify` at the head shows its load-gate repetitions at 5/5 (evidence in the item topic).
  - done: impl-1066 · 2026-10-21T15:45:49.812Z
  - verified: rev-23 [reviewer] · run rev-20261021-1066-final · 2026-10-21T15:46:59.741Z · commit 89730092e582f40ab2cf83a90219d63afb295ef5

## Comments

### impl-1066 · 2026-10-21T15:31:05.535Z

A-8519 line6557 records a wrapped breakdown, not evidence of wrong aggregate values: release PROGRESS ends `backlog, [redacted]\nblocked`; stack identifies line84, raw substring assertion. Snapshot wait already lands the aggregate; card key alone does not observe geometry/content. Patch observes exact child_counts, selected/drawn identity, physical card width and rendered PROGRESS fields; whitespace normalization preserves semantic assertions and forced42-cell R-1 covers wrapping every run. Coordinator approved this approach and identity rename. No local tests executed: cover-quiet remains in force. Source review precedes C2 execution/final review.

### rev-23 · 2026-10-21T15:32:35.274Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1066-source
commit: 89730092e582f40ab2cf83a90219d63afb295ef5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; exact origin89730092/tree614f474d, two-file diff versus dev296a5457. A-8519:6557 actual failure ends 'backlog, [redacted]\nblocked', stack oldtest84 raw substring. Values redacted, so no claim of incorrect aggregates; visual wrapping explains rejected prose. Revised bounded observer arms before resize/selection and checks matching child_counts, selected/drawn identity, valid window/exact physical width and actual card-buffer PROGRESS values. Whitespace normalization scoped to PROGRESS; all prior fractions/breakdowns/blockers and unloaded-closed assertions retained. Wide72/narrow42 case requires actual release breakdown wrap; identity rename approved Coordinator3d35eb10 and fresh5/5 planned. Product code unchanged, README worked observation guidance added. C1 verified by source/recorded diagnosis, not runtime pass. C2 pending20 sequential workers2 scratch repetitions plus same-head mode-free/new5/5; intentionally not done. No local tests run under cover-quiet; wait explicit Coordinator lift before approved execution. Preserve raw stdout/exits/head/tree and each repeat; fresh source review if any allowance/source edit. No Reviewer execution/delegation; QA none.

Criteria: C1 verified.

### impl-1066 · 2026-10-21T15:46:08.632Z

C2 complete at unchanged source-reviewed89730092/tree614f474d. A-8543 retains20 individual sequential load-gate passes (four rounds5/5, workers2, scratch clone, local Darwin arm64 Node24.21.0 Neovim0.12.5; starts3.3325–3.4805<15; max0.640871s). A-8529 retains original red mutation diff/stdout exit1, restored full-file6/6 exit0, typecheck0 and scratch/credential-isolation runner. Mode-free configured verify75439bbf exited0 at exact head; A-8545:5225 explicitly names renamed identity5/5, individual gate passes at5086/5119/5147/5178/5218, max0.784518453s; ordinary card0.718032717s. Linux x64 c-8 lon1 droplet Node24.21.0 Neovim0.12.5 workers2, lifetime222s cost$0.0154. Actual T1, Neovim T2 and Web smoke completed; reported1029/1029 aggregate counts include reporter nesting/repetitions, not1029 distinct ordinary identities. Host check gate4e244506 not repeated on droplet. Duration/lint/ratchet warnings report-only; no enforcing duration pass or T3/T4 claim. C1/C2 both marked done; final Reviewer evidence settlement requested. No further head changes or dev merge.

### rev-23 · 2026-10-21T15:46:59.741Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1066-final
commit: 89730092e582f40ab2cf83a90219d63afb295ef5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear, C1/C2 verified. Source A-8523 applies; origin89730092 unchanged. A-8529 exact-head hermetic clone controller prints deterministic raw-substring red mutation (exit1 wrapped breakdown), restores pristine source, fullfile6/6/typecheck0. A-8543 independently parsed20unique loadtest/file passes, four5/5 rounds workers2, all targetstarts after priorfinish, originalmanifestsreport/resource report-only and runnerjointleases; startloads3.3325–3.4805<15,max0.640871s onlocalDarwinarm64. A-8545/75439bbf actualLinuxc8lon1 autoexit0: allT1, selectedNeovim-onlyT2(39files),Websmoke1file;1029ordinarytest/160file passes plus5loadtest/file passes, zero failure/cancel/skip/todo. Renamedidentity five distinctfinishes5086/5119/5147/5178/5218, explicit5/5at5225,max0.784518453s. Host4e244506 reusednotremote; lint132/59,duration/ratchetreportonly unrelatedoveragesretained,newidentitygatepasses/noallowance. NoHubT2/allpackages/T3/T4/integrated/QA claim. Life222s/$0.0154estimate. No remainingfindings,QA none; no Reviewer execution.

Criteria: C1 verified, C2 verified.
