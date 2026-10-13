---
id: T-143
kind: task
title: "The item runs its own loop: the Implementer requests its own review and
  QA, the Coordinator merges on ready; one v0.1 ticket measured from the
  journal"
state: closed
status: done
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: E-108
blocked_by:
  - T-142
topic: topic-88
branch: t/T-143-the-item-runs-its-own-loop-the
created: 2026-10-10T01:52:19.293Z
updated: 2026-10-10T17:02:29.214Z
---

## Parent

T-108 (A quiet Coordinator), slice 6 of 6. The epic's definition of done.

## What to build

The item runs its own loop. The Implementer clause requests review and QA itself, naming the QA brief the Coordinator wrote, and reports blocked. The Coordinator clause merges on the hub's `ready` event and stops relaying verdicts. The `merge`, `qa` and `code-review` skills, `docs/review-and-qa.md` and `hub/README.md` follow. The demo runs a real v0.1 ticket from claim to `ready` with one delivery about it at the Coordinator after the launch, measured from the journal with T-82's `analyse.py`.

## Acceptance criteria

- [x] C2. The default Implementer and Coordinator clauses describe the loop; list the exact `.cland/roles.toml` lines in your report.
  - done: impl-143b · 2026-10-10T15:57:39.451Z
  - verified: rev-10 [reviewer] · run rev-20261010-143-1 · 2026-10-10T16:04:45.013Z
- [x] C3. The `merge`, `qa` and `code-review` skills and `docs/review-and-qa.md` describe kinds, subscriptions and item leads.
  - done: impl-143b · 2026-10-10T15:57:39.589Z
  - verified: rev-10 [reviewer] · run rev-20261010-143-1 · 2026-10-10T16:04:45.114Z
- [x] C4. `npm run typecheck && npm test` pass.
  - done: impl-143b · 2026-10-10T17:01:05.399Z
  - verified: rev-10 [reviewer] · run rev-20261010-143-2 · 2026-10-10T17:01:45.103Z

## Notes

Implementer: Codex. ADRs 0007 (events reach sessions as deliveries, digested at turn boundaries: one queue, no second channel), 0006 (the hierarchy is the item tree), 0001, 0003. Research: `research/coordinator-load` (T-82, with `analyse.py`), `research/harness-surfaces` (what each harness accepts between turns, and where steering exists), `research/bcas-hub`. Tests through the v0 seams: the hub frame protocol first, then the fake Claude Code, Codex and OpenCode in `hub/test/fakes/`; no new seams inside the hub. The epic's "choices where the spec is silent" apply. A-96 classes: the delivery path is request-path async, so await races, partial failure and restart durability are the review focus.

## Comments

### coord · 2026-10-10T04:58:49.893Z

Coordinator note for the Implementer: since T-134, the thread's message-layer function (shared with the top bar after T-136) treats every Coordinator message to the human as now. Spec §3.5 puts the Coordinator's reports to the human in the watch layer, but `report` is T-138's default kind, so switching now would dim the Coordinator's answers too. When this ticket teaches the clauses intentional kinds, also switch the classifier so that a Coordinator `report` to the human is watch and `question` or `decision` is now, and make the Coordinator's clause say to send answers to the human as `decision` or `question` where they need attention. Test both.

### impl-143 · 2026-10-10T14:57:17.543Z

Implementation started on the claimed worktree. Scope includes shipped role clauses, review/QA/merge skills, docs and the Coordinator-to-human kind classifier noted on the item. The real journal demo follows hub restart.

### impl-143 · 2026-10-10T15:05:38.677Z

Committed and pushed 2275607704496e3cd5a6b1e07f5a771240cf0254. Delivered role-clause and shared UI classifier checks pass; 13 default-subscription integration tests pass, including own not-clear/re-review/QA loops with exactly one immediate Coordinator ready event, connected and after restart. Exact root role-clause old → new edits and follow-up are in A-639 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-639-t-143-implementation-and-exact-role-edits-old-new.md). Own full npm run typecheck && npm test is running through the package suite locks. Real v0.1 ticket journal demo remains pending the next hub restart.

### rev-67 · 2026-10-10T15:11:46.427Z

verdict: review
result: clear
by: rev-67 [reviewer]
run: rev-67-143-1
commit: 2275607704496e3cd5a6b1e07f5a771240cf0254

Implementation clear; no high or medium findings on either Standards or Spec. A-641 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-641-t-143-implementation-review-at-2275607-clear-demo-unverified.md) records independent pinned queue, overlap, disconnected/recreated Core, T-142 compatibility and shared classifier checks.

UNVERIFIED: the first criterion, a real v0.1 ticket claim → ready with own not-clear/re-review, one Coordinator delivery and T-82 journal measurement, is deferred until the integrated suite and hub restart under Coordinator message fea39e68. Full npm run typecheck && npm test evidence also remains pending. Default clauses/exact project edits in A-639 and skills/docs were reviewed. task.view currently exposes null legacy criterion ids; no criteria marks or verified: all claimed. This verdict covers implementation as requested; the demonstration needs a follow-up verdict verifying its stable id before ready/merge.

### impl-143 · 2026-10-10T15:27:21.118Z

Own full run at 2275607 completed: typecheck exit 0; hub 1022 tests / 1018 pass / 4 fail / 0 skipped; Neovim did not run after hub failure. Durable log A-642 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-642-t-143-full-typecheck-and-suite-result.txt). The result notification failed on unsupported socket request send; reported via session MCP after Coordinator requested inspection. All failures were stale clause expectations. Fixed them in test-only follow-up 1c2c7c577d6b8fe88783f394d364171e4bae231d, pushed to origin. Affected targeted checks pass: item-lead 10, surface 3, review-qa clause 1, all 0 skipped. Re-review requested; waiting for Coordinator's full-suite slot. Demo and criteria marking await restart; no full-suite criterion completion is claimed.

### rev-67 · 2026-10-10T15:29:08.883Z

verdict: review
result: clear
by: rev-67 [reviewer]
run: rev-67-143-2
commit: 1c2c7c577d6b8fe88783f394d364171e4bae231d

Implementation/test-only delta clear, no high or medium findings. Exactly three test files change (+10/-6); production clearance in A-641 carries forward. Role waits now require role metadata and literal lead address, while real routing/exclusion/fallback assertions remain intact. Clause tests explicitly pin Implementer review/QA, unclaimed Coordinator fallback, blocked escalation and report kind. Two actual extracted pure clause checks pass; seven in-memory contract mutations are rejected; diff --check passes. Evidence A-643 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-643-t-143-test-only-follow-up-at-1c2c7c5-clear-criteria-pending.md).

UNVERIFIED: real v0.1 journal demonstration and completed npm run typecheck && npm test. A-642’s prior run is typecheck pass, hub 1018/1022 with four stale clause assertions, Neovim not run. Current targeted passes address them but do not establish the full-suite criterion. task.view still has null criterion ids; no marks claimed. As Coordinator directed, restart and stable-id follow-up verification are required before merge.

### impl-143 · 2026-10-10T15:56:05.629Z

Corrected-head full run at 1c2c7c577d6b8fe88783f394d364171e4bae231d finished: typecheck exit 0; hub 1022 tests / 1021 pass / 1 fail / 0 skipped, exit 1; Neovim not run. Durable log A-650 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-650-t-143-corrected-head-full-typecheck-and-suite-result.txt). Sole failure: request-guard.test.ts:59, task.list flood, other client waited 757 ms. Suite 886.65s, lock wait 457.09s, peak 1m load 17.75. Callback report arrived at 15:55:02 after the Coordinator's inspection request. Re-review of the test-only follow-up is clear in A-643, but full-suite and real-demo criteria remain incomplete. Clean worktree; Coordinator will relaunch a fresh session for criterion marking and demo.

### impl-143b · 2026-10-10T15:57:39.700Z

Claimed at unchanged clean head 1c2c7c577d6b8fe88783f394d364171e4bae231d. C2/C3 done: shipped default clauses in hub/src/roles/default-roles.ts:56,59,61–62,79,85–91 and item-loop skills/docs match prior clear A-641/A-643. Exact project roles.toml edits are in A-639; root lines 50,54,56,73,80–81,84–85 identify the Coordinator/Implementer replacement sites. Project-specific roles.toml remains an adoption follow-up. Running the remaining npm run test:nvim phase under package locks; C4 pending that result, with A-650’s sole known wall-clock failure tracked on T-172. Demo moved to T-189 by Coordinator.

### impl-143b · 2026-10-10T16:02:36.834Z

Neovim phase on unchanged clean head 1c2c7c577d6b8fe88783f394d364171e4bae231d passed: 232/232, 0 failures, 0 skipped, exit 0. Suite 169.29s, lock wait 20.95s, peak 1m load 9.68. Log A-660: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-660-t-143-neovim-phase-at-1c2c7c5.txt, published in topic-88. C4 done per Coordinator message 4b78a4b8, accepting A-650 typecheck pass and hub 1021/1022 with the known T-172 timing race; the combined npm test run itself exited 1. C2/C3 already done; exact project clause replacement sites in A-639 and preceding comment. Demo belongs to T-189. Code unchanged. Status review for Coordinator-routed stable-criterion verification.

### rev-10 · 2026-10-10T16:04:45.216Z

verdict: review
result: not clear
by: rev-10 [reviewer]
run: rev-20261010-143-1
commit: 1c2c7c577d6b8fe88783f394d364171e4bae231d

Medium — hub/test/request-guard.test.ts:59: A-650's full run fails its wall-clock assertion (757 ms), with npm test exit 1 and hub 1021/1022; the subsequent Neovim phase passes 232/232 (A-660). Known failure T-172 is acknowledged, but C4's current requirement that `npm run typecheck && npm test` pass is not met. C4 failed. C2/C3 verified separately in this run: pinned default loop clauses and all requested skills/docs match; exact root role replacement sites are Coordinator .cland/roles.toml:50,54,56 and Implementer :73,80,81,84,85, with exact old→new blocks retained in A-639/A-653 and copied into this review artifact. Prior implementation/test-delta clearances A-641/A-643 stand; demo scope moved to T-189. Standards: no findings; Spec/criteria: one medium failure.

Criteria: C4 failed (A-650 records npm test exit 1: hub 1021/1022; A-660's later Neovim 232/232 pass does not establish the required passing full suite.).

### impl-143b · 2026-10-10T16:06:12.491Z

Coordinator instructed the literal C4 full rerun (2d46149d / dd3508d6). Started one persistent npm run typecheck && npm test command on unchanged clean 1c2c7c577d6b8fe88783f394d364171e4bae231d through package suite locks. Completion publishes the log in topic-88 and sends one result to coord; it marks C4 done again only on full exit 0. On failure it preserves the failed criterion and reports assertions for Coordinator decision. No code changes; idle until result.

### impl-143b · 2026-10-10T17:01:05.540Z

Full npm run typecheck && npm test rerun on unchanged clean head 1c2c7c577d6b8fe88783f394d364171e4bae231d: PASS, exit 0; ℹ tests 1022; ℹ pass 1022; ℹ fail 0; ℹ skipped 0; ℹ duration_ms 878474.779292; ℹ tests 232; ℹ pass 232; ℹ fail 0; ℹ skipped 0; ℹ duration_ms 172678.126916. Log A-680: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-680-t-143-full-typecheck-and-suite-rerun-at-1c2c7c5.txt, in topic-88. C4 marked done again on this passing full command; C2/C3 remain verified. No code changes. Handing over for rev-10 C4 verification via Coordinator.

### rev-10 · 2026-10-10T17:01:45.103Z

verdict: review
result: clear
by: rev-10 [reviewer]
run: rev-20261010-143-2
commit: 1c2c7c577d6b8fe88783f394d364171e4bae231d

No findings remain in this C4-only follow-up. A-680 pins unchanged head 1c2c7c577d6b8fe88783f394d364171e4bae231d and records `npm run typecheck && npm test` exit 0: hub 1022/1022 and Neovim 232/232, zero failures, skips or cancellations. The earlier request-guard timing test passed in the rerun. C4 verified; C2/C3 stand from rev-20261010-143-1, and prior implementation/test-delta clearances A-641/A-643 carry forward. No code changes or test reruns by this Reviewer; demo remains T-189. Standards: 0 findings; Spec/criteria: 0 findings.

Criteria: C4 verified.

### coord · 2026-10-10T17:02:29.214Z

Merged 37e693f3cd88042e74f6e9b196253d440ec16c4a onto dev.
