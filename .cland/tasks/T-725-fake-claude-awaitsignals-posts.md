---
id: T-725
kind: task
title: fake-claude awaitSignals posts PermissionRequest before arming its approval resolver, so an immediate SIGUSR1 can be lost
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - v0.1.4
  - flaky
  - hub
assignee: null
parent: E-677
blocked_by:
  - T-691
topic: topic-425
branch: t/T-725-fake-claude-awaitsignals-posts
created: 2026-10-17T06:33:35.124Z
updated: 2026-10-17T08:15:59.522Z
---

## Summary

In hub/test/fakes/claude-code/fake-claude.ts, `awaitSignals: true` posts PermissionRequest before it installs its approve resolver. A SIGUSR1 sent right after the UI's waiting-for-approval frame can therefore be lost, and the harness waits forever. T-691 found it while trying a faster frame fixture, and it kept the existing one-second turn instead.

## What to build

The fake installs its approval barrier (the signal handler and resolver) before it posts PermissionRequest, so an approval sent the moment the waiting frame appears is never lost. The permission-contract case can then drop its one-second turn and wait on the signal.

## Acceptance criteria

- [x] C1. With awaitSignals, an approval signal sent immediately after the waiting-for-approval frame is received, proved by a fake-harness test that signals with no delay, 20/20.
  - done: impl-725 · 2026-10-17T07:35:40.970Z
  - verified: rev-30 [reviewer] · run rev-20261017-725-final · 2026-10-17T08:15:50.844Z · commit fbcb7a557203a764c130da194b7f10988c4d4fe8
- [x] C2. The Claude Code permission contract case uses the barrier instead of its one-second turn, with its assertions unchanged in meaning.
  - done: impl-725 · 2026-10-17T07:35:41.320Z
  - verified: rev-30 [reviewer] · run rev-20261017-725-source · 2026-10-17T07:36:33.045Z · commit fbcb7a557203a764c130da194b7f10988c4d4fe8
  - verified: rev-30 [reviewer] · run rev-20261017-725-final · 2026-10-17T08:15:50.844Z · commit fbcb7a557203a764c130da194b7f10988c4d4fe8

## Comments

### impl-725 · 2026-10-17T07:28:36.763Z

Implementation plan: retain the existing T3 Claude Code binary-contract fixture and assertions. Replace turnMs:1000 with awaitSignals:true; use the already-discovered PID to send SIGUSR1 synchronously on the Edit waiting-for-approval frame. Arm the approval promise before publishing waiting status/PermissionRequest. The contract case supplies C1's fake-binary no-delay test (20 serial repetitions), avoiding a duplicate native-frame fixture. Collecting before/after 5/5 file timings at load <15; no duration baseline rewrite.

### impl-725 · 2026-10-17T07:35:41.602Z

Implemented and pushed fbcb7a557203a764c130da194b7f10988c4d4fe8. Evidence A-4361 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-4361-t-725-signal-barrier-red-green-and-serial-timing-evidence/README.md: red reproduction, before/after file 5/5, immediate-signal contract 20/20, typecheck and tiers green, assertion map. File median 26.539→25.595 s; contract median 8.092→4.012 s. No baseline/allowance edits. Merged origin/dev before first review. QA policy none/after-stage.

### rev-30 · 2026-10-17T07:36:33.045Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-725-source
commit: fbcb7a557203a764c130da194b7f10988c4d4fe8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source review T-725 at fbcb7a557203a764c130da194b7f10988c4d4fe8, fixed point a1f26b988a982817d10471a5843ec71da3799b82 (dev integrated before first review). Origin matches. Only fake-claude.ts and claude-code-adapter.test.ts change. Read-only review, no Reviewer execution.

## Standards
No findings. This retains the existing headed T3 native Claude binary/hook/mod contract fixture and adds no process, daemon, spoke or redundant fixture. The new approval observation has no sleep or I/O between the Edit waiting frame and synchronous SIGUSR1. Existing lifecycle ownership and teardown are unchanged. Removing the approval-time fake.sessions() call avoids an extra agents subprocess; the already-discovered PID belongs to the same launched native session, with no intervening relaunch. No duration baseline or allowance edits.

## Spec
No findings. The startup SIGUSR1 handler is already installed before turns begin. The approval promise now sets its resolver before both setStatus(waiting) and runHooks(PermissionRequest). An immediate signal during hook execution resolves that same retained promise, so the later await cannot miss it; the handler's existing one-shot clearing remains intact. The old ordering installed the resolver only after the awaited hook returned, which explains the reproduced lost approval.

C2 verified in source. awaitSignals:true replaces turnMs:1000, using the existing hook/mod post draining boundary to retain pushed state observations. All 35 assertions remain with unchanged meaning: launch/session identities, two attaches, first clause, delivery/reply/history correlation, busy source, model/exact usage, Bash status-versus-hook separation, approval command and pending row, reply and waiting→busy→idle sequence, cleared approval, Edit/private-input redaction and capability table. Other eight declarations are unchanged.

C1 targeted proof audited in A-4361: twenty separate focused contract receipts, each one pass/zero failures, signal immediately following Edit waiting without intervening await; the old resolver ordering's red receipt reports failure to return idle within 15000 ms. The five before and five after whole-file receipts each pass nine cases. All thirty successful runs' admission records are exit zero and load below 15 (2.52–5.75). Claimant records typecheck/tier lint green. File median wall changes 26.539→25.595 s and contract median 8.092→4.012 s; these are local measurements, not a new integrated baseline or Linux result.

Source clear with no remaining findings. C1 final runtime settlement remains pending the normal mode-free exact-head droplet task receipt; C2 is source-verified. Per-item QA policy is none/after-stage. Task verification may proceed at this head.

Criteria: C2 verified.

### rev-30 · 2026-10-17T08:15:50.844Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-725-final
commit: fbcb7a557203a764c130da194b7f10988c4d4fe8
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review T-725 at fbcb7a557203a764c130da194b7f10988c4d4fe8, unchanged from source-clear A-4362 / rev-20261017-725-source. Origin branch and hub record match. Mode-free droplet ebe47f79-c63b-4c49-bc97-b8b214645ca2 / A-4391 exits zero, hub-only plus completed Neovim smoke. Read-only audit; no Reviewer execution.

## Standards
No findings. The source retains the existing T3 native contract fixture, adds no process or wall-clock wait, and preserves ownership/teardown. No hard duration-budget or failed load gate appears. Tier/legacy duration notices remain report-only.

## Spec
C1 verified: A-4361's twenty independent serial focused contract executions each pass with synchronous SIGUSR1 immediately after the Edit waiting frame, with no intervening await/I/O/sleep. Its controlled old-order red timed out awaiting idle, and all five corrected whole-file Mac runs pass nine cases. Those raw logs and admission receipts were independently audited in the source review. Current Linux executes the same contract successfully in 6.401496754 s, and all nine cases in the full native contract file pass (39.540171 top-level test-seconds). This is one task Linux execution; no unreported 20-run Linux repetition claim is made.

C2 verified: source-reviewed resolver installation precedes waiting status and PermissionRequest. awaitSignals replaces the artificial one-second turn and drains hook/mod posts, while all thirty-five contract assertions retain their meaning, including permission state/command, status exclusion, reply/sequence/clearing, Edit privacy, launch/attach/clause/delivery/usage and capability checks. All other eight declarations pass in the current Linux cover. No source/head change occurred after review.

Phase counters independently total 2091 tests, 2086 pass, zero failures/cancellations, five skips: free 52/52; machine 2022 pass/5 skip; Neovim smoke 12/12. Host typecheck completes with candidate-tree receipt 2d1afc83a2a336ebfac2e1169564e75325ad7266 reused remotely. Linux x64 c-8 lon1, Node 24.21.0/Neovim 0.12.5, two workers; wall 2246.46 s, peak one-minute load 10.12, lifetime 2313 s, cost $0.1606.

Final review clear; C1/C2 verified at the exact head, no remaining findings.

Criteria: C1 verified, C2 verified.

### impl-725 · 2026-10-17T08:15:59.522Z

Exact reviewed head fbcb7a557203a764c130da194b7f10988c4d4fe8 passed droplet ebe47f79-c63b-4c49-bc97-b8b214645ca2 (A-4391): 2086 pass, 0 fail, 5 skips, Linux c-8 workers 2; lifetime 2313 s, $0.1606. E-677 exact-head timings: claude-code-adapter.test.ts 39.540170632 summed test-seconds across nine cases; changed binary-contract case 6.401496754 s. Local before/after 5/5 and C1 20/20 are A-4361; Linux summary A-4392. Final review clear rev-20261017-725-final (A-4393), C1/C2 verified, no findings. No head changes.
