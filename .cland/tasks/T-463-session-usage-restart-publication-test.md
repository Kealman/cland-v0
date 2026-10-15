---
id: T-463
kind: task
title: session-usage restart publication test counts 2 publications against 1 under load (T-389's 100 ms window)
state: open
status: ready
size: XS
criterion_seq: 1
labels:
  - v0.1.3
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-389
topic: topic-292
branch: t/T-463-session-usage-restart-publication-test
created: 2026-10-15T08:37:18.553Z
updated: 2026-10-15T13:26:44.699Z
---

## Summary

`hub/test/session-usage.test.ts:165` counted 2 restart publications where it expects 1 (line 176), in T-455's gate 1ea1e21d (A-2777), 2026-10-15. The whole file passed 5/5 alone at 9c90591b (A-2785). The case was last changed by T-389's c28bf3c4, which set the 100 ms usage window (startUsageDaemon). Under load, two publications land inside one count window. Count publications against an observed coalescing boundary rather than a wall-time window.

## Acceptance criteria

- [x] C1. The restart case counts publications against the observed coalescing boundary, keeps its assertion's meaning, and the file passes 5/5 beside a local full run.
  - done: impl-463 · 2026-10-15T12:59:12.986Z
  - verified: rev-31 [reviewer] · run rev-20261015-463-final · 2026-10-15T13:26:42.801Z · commit 2ddc0d8655ed89b796eb7e321e63495ba79d34b2

## Comments

### coord · 2026-10-15T11:13:42.707Z

Second signature in this file, moved here from T-486, whose adapter fix doesn't bound launch latency. It is session-usage.test.ts:31, 'Codex journals changed totals...': in T-447's droplet gate 463ee26b (A-2919), session.launch timed out on its 5 s response before the idle and usage observation. Diagnose it alongside the restart publication count.

### impl-463 · 2026-10-15T12:32:26.894Z

Quiet baseline command `node --test hub/test/session-usage.test.ts`: 8/8 passed, 25.9 s. The current file includes three newer cost/launch-item cases beyond the original five. Diagnosing initial rate-limit vs token publication staging and session.launch's generic 5 s FrameClient deadline. Holding further local tests pending Coordinator's serial Mac window decision.

### impl-463 · 2026-10-15T12:59:13.546Z

Implementation committed and pushed as cb405377866dd879a2e3e2a2dab23e806d49eb36 after integrating origin/dev e2d9a940. Evidence A-2997 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2997-t-463-boundary-reproduction-and-five-quiet-passes contains the deterministic 2 !== 1 reproduction and all five quiet file logs (8/8 each; 40/40). Startup limits are gated until the first token publication is observed; restart must append exactly one row and preserve the full prior journal. Only Codex launch client deadlines align to the existing product deadline at hub/src/adapters/codex.ts:344 (#spawnDeadlineMs default 30_000), per Coordinator decision 989864ed; every other bound is unchanged. No per-item QA scope/brief is required. Requesting source review before the exact-head droplet run.

### rev-31 · 2026-10-15T13:00:50.462Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261015-463-source
commit: 2ddc0d8655ed89b796eb7e321e63495ba79d34b2
scope: full

Source review clear at 2ddc0d8655ed89b796eb7e321e63495ba79d34b2. No high, medium or low findings.

## Standards
No findings against AGENTS.md, docs/agents/tests.md, hub/README.md testing guidance, or the code-review smell baseline. Positive waits observe frames/journal state; the fake gate stages the specific race without adding a wall-time wait.

## Spec
hub/test/session-usage.test.ts:173-193 stages tokens and limits across an observed publication boundary and asserts both journal rows. Lines 198-206 require exactly one appended restart row, deep equality of the complete prior journal, absent replayed totals, preserved session/limits, and exactly one final record. The old one-row startup assumption is removed without weakening the restart contract.
Lines 13,42,76,125,177 align only four Codex launch client deadlines with hub/src/adapters/codex.ts:344's existing 30_000 ms startup deadline, allowed by Coordinator 989864ed. No other bound changes.

A-2997 README/repro.log and all five quiet logs checked: exact 2 !== 1 reproduction; five whole-file 8/8 passes (40/40), labelled quiet. Coordinator 1ba48602/7ccb5be2 and E-482's 12:32 comment replace beside-full-run evidence with five quiet serial passes plus the task droplet gate. Intermediate dev integration leaves this test and launch/usage code unchanged.

Replacement-head delta is solely the T-486 pick: stable patch-id ae778e4f6aff3742cba1b279251e628bd2cf3e00 matches merged 4db6ed9c; session-usage test unchanged. Reviewed eventSequence guard preserves completed-turn idle while retaining pre-turn busy fallback. T-486 final review and green Linux 9330be77/A-2996 checked in task.view. No local retest needed for this shared pick under the Coordinator's explicit instruction.

C1 source aspects established, but the composite criterion remains unverified pending exact-head post-source droplet verification. No Reviewer tests or edits.
Standards: 0 findings. Spec: 0 findings; Linux run evidence pending.

### coord · 2026-10-15T13:09:47.694Z

More signatures in this file from T-395's droplet run e54c3004 (A-3003), checked against your boundary fix:
- session-usage.test.ts:42, totals 12 vs 24, which looks like a doubled publication;
- session-usage.test.ts:78, totalTokens undefined.
Name in your review request whether your fix covers each one. If one isn't covered, report it.

### impl-463 · 2026-10-15T13:10:37.251Z

Coverage clarification requested by Coordinator 93124e8d: inspected A-3003 failure traces. The :42 signature is `12 !== 24` at the first test's latest.total assertion; helper turn() still accepts any following session.usage frame without requested-turn correlation. The :78 TypeError arises in the second test's journal.map reading r.total.totalTokens, demonstrating an initial row without totals. Current 2ddc0d86 changes only restart publication boundaries and Codex launch client deadlines, so neither new signature is covered. Reported uncovered signatures and possible size S / Bugs to lead as directed; no scope expansion or source change. Source-review request supplemented, verify 8645a36a still running.

### rev-31 · 2026-10-15T13:26:42.801Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261015-463-final
commit: 2ddc0d8655ed89b796eb7e321e63495ba79d34b2
scope: evidence

Final review clear at unchanged 2ddc0d8655ed89b796eb7e321e63495ba79d34b2. No unresolved high/medium findings in the agreed T-463 scope.

## Standards
Source verdict rev-20261015-463-source stands; no new findings. No source changes since that review, confirmed against the branch tip.

## Spec
C1 verified: hub/test/session-usage.test.ts:173-206 counts observed startup publications and proves exactly one restart append, unchanged complete history, no replayed totals and exactly one final. A-2997 contains the exact 2 !== 1 reproduction and five labelled quiet whole-file passes, 8/8 each. Coordinator decisions 1ba48602/7ccb5be2 and E-482's 12:32 evidence rule explicitly replace beside-full-run Mac evidence with five quiet serial passes plus the task droplet gate.

Accepted gate: 8645a36a-623e-41d3-9c98-380a59627584 / A-3022 is green at the exact source-reviewed/current branch head: Linux x64 c-8, host and remote typecheck pass, hub plus Neovim smoke complete, exit 0, 1751 pass / 0 fail / 3 platform skips / 0 cancelled. All eight session-usage cases pass (A-3022:2539-2546; restart 6.226 s). Four machine workers, peak 1m load 11.55; Neovim smoke 12/12. Three platform skips are two sandbox-exec cases and the macOS sleep inhibitor; no usage case skipped. Existing-identity duration notices do not fail this receipt. No flake exception needed.

Coverage limit retained: helper turn() and startup limits-only journal assumptions are not fixed by T-463. Coordinator 1b21300e explicitly split those signatures into T-495, blocked by T-463; task.view confirms that scope. The first two tests passing in this run does not establish a fix for T-495.

Standards: 0 new findings. Spec: 0 unresolved findings in T-463 scope; C1 verified. No Reviewer tests or edits.

Criteria: C1 verified.
