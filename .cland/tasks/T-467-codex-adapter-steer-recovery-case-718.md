---
id: T-467
kind: task
title: codex-adapter steer-recovery case (:718) misses the expected turn/steer injection under load
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - v0.1.3
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: topic-297
branch: t/T-467-codex-adapter-steer-recovery-case-718
created: 2026-10-15T09:04:29.811Z
updated: 2026-10-15T15:04:58.453Z
closed: 2026-10-15T15:04:58.453Z
---

## Summary

`hub/test/codex-adapter.test.ts:718` (steer recovery) missed the expected turn/steer injection in T-335's gate A-2794, 2026-10-15. The whole file passed 5/5 alone at a8a8ac33 (A-2798 to A-2807). This is likely the same short-turn staging class T-389 fixed for another Codex steer case with an explicit 300 ms opt-in (A-2540). Stage the steer against an observed busy state.

## Acceptance criteria

- [x] C1. The case stages its steer against an observed state, not a fast turn's timing, keeps its assertions, and the file passes 5/5 beside a local full run.
  - done: impl-467 · 2026-10-15T14:10:52.212Z
  - verified: rev-30 [reviewer] · run rev-20261015-467-final · 2026-10-15T15:04:35.464Z · commit 02183aacc6378acb0bade9376174e4c0d01a7ca4

## Comments

### coord · 2026-10-15T09:56:13.818Z

Also seen: codex-adapter.test.ts:997 'a successful completion reconciles a late reject pending steer response' failed with 'impl present as idle: not within 15000 ms' in T-445's droplet gate d479c493 (A-2845). It is the same Codex steer-staging family; fix both together.

### coord · 2026-10-15T11:14:07.014Z

T-486 fixes the root cause of the Codex initial-idle signatures. Codex spawn ordering marked the session busy after the turn/start response, which overwrote the idle of a first turn that had already completed (deterministic repro A-2921). The fix covers codex-adapter.test.ts:813/:821 from A-2919. Check the remaining T-467 signatures (:880, :903, :997) against T-486's commit once it merges, before you diagnose them separately.

### impl-467 · 2026-10-15T14:03:22.752Z

Implementation started from dev 48cbe057, which contains T-486 (4db6ed9c). Applying E-482's 12:32Z evidence rule: five serial whole-file Mac passes, labelled quiet/loaded, followed by same-head post-review droplet verification.

### impl-467 · 2026-10-15T14:11:02.829Z

Committed/pushed 1efefd2b after fetching/merging origin/dev d6e222be. Existing fake approval barrier now holds the first turn until both steers are observed admitted. No assertion weakening or timeout changes. A-3047 captures deterministic old-red/new-green scheduler-pause repro; A-3058 summarizes five serial quiet Mac whole-file passes and typecheck. Source review requested from rev-30; same-head droplet verify follows clear.

### rev-30 · 2026-10-15T14:11:37.493Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-467-source
commit: 1efefd2baa1244757aeb3469d586dedff91a6a6c
scope: full

Source review clear at 1efefd2baa1244757aeb3469d586dedff91a6a6c; no high, medium or low findings.

Standards: no findings against repo positive-wait/fixture guidance or code-review smell baseline. The existing approval barrier replaces a fast-turn staging assumption; the added comment names why injection is insufficient. No production change, new sleeps, timeout increases or test identity changes.
Spec: hub/test/codex-adapter.test.ts:732–744 requests approval on the initial turn, observes waiting for approval, stages both steers and retains both turn/steer log assertions before release. The unchanged recovered-message, idle, journal redelivery, settled exactly-once, and Agents assertions at :746–764 still prove recovery; only the expected first pong text follows the approval trigger. Other late-response cases need no local delta because inherited T-486 covers their recorded initial-idle root.

A-3047 records deterministic old-red/new-green with a temporary 100ms scheduler pause removed from final code. A-3049/A-3051/A-3053/A-3055/A-3057 each show 35/35 whole-file passes with zero failures/skips/cancellations; A-3058 labels these quiet and explains the unchanged adapter/fake/test inputs after required dev integration. Coordinator 1ba48602 permits quiet repetitions.

Reviewed git diff d6e222bef3eb28eef84e24fb8113585a04b06f1a...1efefd2baa1244757aeb3469d586dedff91a6a6c, one commit/one test-only file, git diff --check green. Both Standards and Spec reviewed directly; role disables delegation. C1 source and repetition portions supported but left unverified until accepted same-head post-source default droplet verification. No Reviewer tests or edits.

### rev-30 · 2026-10-15T14:37:06.510Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-467-linux-first
commit: 1efefd2baa1244757aeb3469d586dedff91a6a6c
scope: evidence

Evidence review not clear at 1efefd2baa1244757aeb3469d586dedff91a6a6c; accepted gate pending.

Medium — hub/test/handover.test.ts:103: clause-opening regex expects “You are the Coordinator of this project” while inherited T-395 clause says “You are the Coordinator: lead the root of the item tree” (A-3072:3977–3983). Exact shared test-only fix b8ae050b announced by Coordinator 769d2e3c.
Medium — hub/test/orphan-servers.test.ts:346: second-connection fixture insert fails “database is locked”, SQLITE error 5 (A-3072:4052–4061). Direct T-499 summary confirms the exact OpenCode case and line. Both failures are outside the task diff.

Standards: source verdict rev-20261015-467-source stands; no new source findings or hard duration-budget failures.
Spec/evidence: touched codex-adapter file is green, repaired original steer 3.285 s; companion recovery/late-response cases pass. Five serial quiet Mac file passes remain supporting evidence. C1 remains unverified pending accepted gate; no criterion failure mark for outside failures.

e5f179a6/A-3072 matches source-reviewed/current head; host/remote typecheck green, Linux x64 c-8, exit 1, 1759 pass/2 fail/3 platform skips/0 cancelled. Neovim smoke not reached. Requester will integrate shared handover fix/current dev and request delta source review; any changed head needs source clearance before another verify. No Reviewer tests or edits.

### impl-467 · 2026-10-15T14:37:22.652Z

First Linux gate A-3072 at 1efefd2b: touched file all green; repaired steer 3.285 s. Only failures known handover:103 regex (shared b8ae050b) and exact T-499 orphan-servers:346 SQLITE_BUSY. No new duration-budget failure. Required current-dev integration includes handover fix and merged T-458; pushed 02183aac with unchanged task patch. Typecheck green. Delta source review requested before next droplet gate.

### rev-30 · 2026-10-15T14:37:44.384Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-467-delta
commit: 02183aacc6378acb0bade9376174e4c0d01a7ca4
scope: delta

Delta source review clear at 02183aacc6378acb0bade9376174e4c0d01a7ca4; no high, medium or low findings.

Standards: no findings. Shared handover regex is the exact b8ae050b change announced by Coordinator 769d2e3c and keeps the surrounding clause/handover assertions. No new local targeted run required for that shared test-only fix under 2f468079.
Spec: codex-adapter.test.ts is byte-for-byte unchanged from reviewed 1efefd2b. Its only task diff against merged dev 4095dd11 remains the approval barrier plus corresponding first-pong text; all recovery, exactly-once, journal, Agents and deadline assertions are retained. Inherited Rulebook T-458 c3a4f53b was just reviewed clear with full Linux evidence A-3068 and adds no task-local staging change.

Reviewed merge delta 1efefd2b..02183aac and net task diff 4095dd11...02183aac. Requester reports typecheck green; git diff --check passes. C1 source/five-repeat evidence stands, but final verification remains pending accepted new-head default droplet receipt. Old red A-3072 is preserved as evidence at its former head. Both review axes performed directly; no Reviewer tests or edits.

### rev-30 · 2026-10-15T15:03:28.836Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-467-linux-second
commit: 02183aacc6378acb0bade9376174e4c0d01a7ca4
scope: evidence

Evidence review not clear at 02183aacc6378acb0bade9376174e4c0d01a7ca4.

Medium — hub/test/codex-adapter.test.ts:561: pidAlive(qa.launched.pid) is still true immediately after acknowledged session.stop (A-3087:3979–3994). Exact known T-485 stop/exit observation, now in T-467's touched file; the green-own-files requirement is not met, so this receipt cannot clear under the standing two-red exception.
Medium — hub/test/merge-recovery.test.ts:49: existsSync(work.path) is true after retried merge reports no followUp, the item is closed, and one merge commit/comment is verified (A-3087:3997–4015). This is a worktree cleanup observation, not the test's earlier deliberately obstructed close write. No exact known ticket found; reported Bugs/S for lead classification.

Standards: source/delta verdict stands, no new T-467 source findings or duration-budget errors.
Spec/evidence: the repaired steer case passes 3.031 s; five quiet Mac file passes remain supporting evidence. C1 stays unverified pending accepted gate. No implementation criterion failure mark for the separate T-485/cleanup observations.

3fb93e0b/A-3087 matches reviewed/current head: host/remote typecheck green, Linux x64 c-8, exit 1, 1760 pass/2 fail/3 platform skips/0 cancelled. Neovim smoke not reached. Earlier e5f179a6/A-3072 remains red on known outside failures; changed head had a delta review, but this latest touched-file failure independently prevents final clear. Await lead disposition; no automatic retry directed by this review. No Reviewer tests or edits.

### impl-467 · 2026-10-15T15:03:31.810Z

Second Linux receipt A-3087 / 3fb93e0b at source-cleared 02183aac: repaired steer passes (3.031 s), but launch-policy :561 hits exact T-485 (QA PID alive immediately after acknowledged stop). Other failure merge-recovery:49 sees worktree still present after retry reports no follow-up and closes item; new Bugs/S aside sent to lead. This receipt has a different failure within the touched Codex file, so the green-own-files exception does not apply. No retry/source edit submitted; lead asked whether to wait for T-485 shared fix or expand scope.

### rev-30 · 2026-10-15T15:04:35.464Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-467-final
commit: 02183aacc6378acb0bade9376174e4c0d01a7ca4
scope: evidence

Final review clear at current reviewed head 02183aacc6378acb0bade9376174e4c0d01a7ca4 under Coordinator gate ruling c1dad316-ab07-4675-ac3b-b6ec93f946e7 (2026-10-15 15:03Z), applying the standing different-known-flake rule.

Standards: source/delta verdicts stand, no unresolved task source findings.
Spec: C1 verified. The changed steer case uses the observed approval barrier and preserves recovery/exactly-once/journal/Agents assertions and all deadlines. Five serial quiet Mac whole-file passes A-3049/A-3051/A-3053/A-3055/A-3057 are 35/35 each (quiet permitted by 1ba48602). The repaired case passes both Linux receipts: 3.285 s in A-3072 and 3.031 s in A-3087.

Accepted pair, accurately scoped:
- e5f179a6 / A-3072 at source-reviewed 1efefd2baa1244757aeb3469d586dedff91a6a6c remains overall red: 1759 pass/2 fail/3 platform skips. Failures are exact shared handover regex and T-499 orphan SQLite race.
- 3fb93e0b / A-3087 at delta-reviewed/current 02183aacc6378acb0bade9376174e4c0d01a7ca4 remains overall red: 1760 pass/2 fail/3 platform skips. Failures are T-485 immediate QA PID check at codex-adapter:561 and newly filed T-503 worktree-removal observation at merge-recovery:49.
Both Linux x64 c-8 runs pass typecheck and the task's changed case; task source is byte-identical across their heads. Delta review covers inherited shared handover fix and reviewed T-458 integration.

c1dad316 explicitly accepts these two receipts and clarifies that green-own-files means the cases the task changed; a different untouched case in the same file qualifies when tracked. This supersedes my earlier file-wide interpretation in rev-20261015-467-linux-second. The suites themselves are not green and their failures are not represented as fixed. Neovim smoke was not reached; this task's net diff is hub-only. No additional run required by this ruling.

Criteria: C1 verified. No Reviewer tests or edits.

Criteria: C1 verified.

### coord · 2026-10-15T15:04:58.453Z

Merged 71050454ce86d86ded69f63195657a6413bbd9d2 onto dev.
