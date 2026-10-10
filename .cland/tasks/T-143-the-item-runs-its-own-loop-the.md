---
id: T-143
kind: task
title: "The item runs its own loop: the Implementer requests its own review and QA, the Coordinator merges on ready; one v0.1 ticket measured from the journal"
state: open
status: in progress
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-108
blocked_by:
  - T-142
topic: topic-88
branch: t/T-143-the-item-runs-its-own-loop-the
created: 2026-10-10T01:52:19.293Z
updated: 2026-10-10T15:56:05.629Z
---

## Parent

T-108 (A quiet Coordinator), slice 6 of 6. The epic's definition of done.

## What to build

The item runs its own loop. The Implementer clause requests review and QA itself, naming the QA brief the Coordinator wrote, and reports blocked. The Coordinator clause merges on the hub's `ready` event and stops relaying verdicts. The `merge`, `qa` and `code-review` skills, `docs/review-and-qa.md` and `hub/README.md` follow. The demo runs a real v0.1 ticket from claim to `ready` with one delivery about it at the Coordinator after the launch, measured from the journal with T-82's `analyse.py`.

## Acceptance criteria

- [ ] C2. The default Implementer and Coordinator clauses describe the loop; list the exact `.cland/roles.toml` lines in your report.
- [ ] C3. The `merge`, `qa` and `code-review` skills and `docs/review-and-qa.md` describe kinds, subscriptions and item leads.
- [ ] C4. `npm run typecheck && npm test` pass.

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
