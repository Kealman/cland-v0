---
id: T-467
kind: task
title: codex-adapter steer-recovery case (:718) misses the expected turn/steer injection under load
state: open
status: review
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
updated: 2026-10-15T14:11:37.493Z
---

## Summary

`hub/test/codex-adapter.test.ts:718` (steer recovery) missed the expected turn/steer injection in T-335's gate A-2794, 2026-10-15. The whole file passed 5/5 alone at a8a8ac33 (A-2798 to A-2807). This is likely the same short-turn staging class T-389 fixed for another Codex steer case with an explicit 300 ms opt-in (A-2540). Stage the steer against an observed busy state.

## Acceptance criteria

- [x] C1. The case stages its steer against an observed state, not a fast turn's timing, keeps its assertions, and the file passes 5/5 beside a local full run.
  - done: impl-467 · 2026-10-15T14:10:52.212Z

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
