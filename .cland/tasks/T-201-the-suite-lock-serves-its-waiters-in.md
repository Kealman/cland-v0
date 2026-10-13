---
id: T-201
kind: task
title: "The suite lock serves its waiters in order: the oldest waiter takes it next"
state: closed
status: done
criterion_seq: 4
labels:
  - ready-for-agent
  - high
assignee: impl-201
parent: E-19
blocked_by: []
topic: topic-105
branch: t/T-201-the-suite-lock-serves-its-waiters-in
created: 2026-10-10T17:49:08.493Z
updated: 2026-10-10T21:37:18.559Z
closed: 2026-10-10T21:37:18.642Z
---

## What to build

The machine-wide suite locks (/tmp/cland-suite.lock and /tmp/cland-suite-nvim.lock, T-175) are taken by polling, so there is no order among waiters. On 2026-10-10 T-176's full suite waited from 16:34Z and lost the lock twice, first to T-143's and then to T-183's run (runner started 17:46Z), which had started waiting later. A long waiter can starve while newer runs go ahead.

Give the lock a queue: each waiter writes a ticket (its pid, start time and worktree) under the lock's directory, and the oldest live ticket takes the lock when it frees. Dead waiters' tickets are swept. `npm test` prints its place in the queue while it waits.

## Acceptance criteria

- [x] C1. Three waiters started in order A, B, C take the lock in that order, whatever their poll timing.
  - done: impl-201 · 2026-10-10T20:32:27.040Z
  - verified: rev-14 [reviewer] · run rev-20261010-201-3 · 2026-10-10T20:34:35.289Z
- [x] C2. A waiter that dies leaves no ticket that blocks the others.
  - done: impl-201 · 2026-10-10T20:19:38.592Z
  - verified: rev-14 [reviewer] · run rev-20261010-201-1 · 2026-10-10T20:25:30.803Z
  - verified: rev-14 [reviewer] · run rev-20261010-201-3 · 2026-10-10T20:34:35.289Z
- [x] C3. A waiting run reports its queue position and the holder's worktree.
  - done: impl-201 · 2026-10-10T20:19:39.046Z
  - verified: rev-14 [reviewer] · run rev-20261010-201-1 · 2026-10-10T20:25:30.960Z
  - verified: rev-14 [reviewer] · run rev-20261010-201-3 · 2026-10-10T20:34:35.289Z
- [x] C4. `npm run typecheck && npm test` pass.
  - done: impl-201 · 2026-10-10T21:36:25.309Z
  - verified: rev-14 [reviewer] · run rev-20261010-201-4 · 2026-10-10T21:36:58.055Z

## Notes

Size S. Reported by the stand-in on 2026-10-10. The human named a hub queue for shared resources as a v0.1.1 theme; this is the local fix for the suite. Interim: the Coordinator holds new suite launches when a run has waited over 30 minutes.

## Comments

### coord · 2026-10-10T19:17:55.617Z

Second cause seen 19:17Z (T-204): the nested locks. A Neovim run takes the Neovim lock, then waits for the machine lock while it keeps the Neovim lock, which blocks every other run's Neovim phase. The queue should cover both locks as one ordered resource, or a run should take the machine lock first and the Neovim lock inside it.

### impl-201 · 2026-10-10T20:15:03.114Z

Claimed; implementing in the provisioned T-201 worktree. The machine queue will admit phases FIFO and take the Neovim lock inside the machine lease, so no Neovim waiter reserves its phase lock while queued for the machine.

### impl-201 · 2026-10-10T20:20:38.746Z

Implemented and pushed ddead0a7e1c15422fa89a46b1f358480719252b2. Atomic FIFO tickets persist beside ownership directories, live identity checks sweep dead/reused waiters, and queue output includes canonical holder worktree. Neovim now takes machine first; docs and role text agree. A-771 targeted checks passed 7/7, including stopped-oldest mixed-phase FIFO and killed waiter recovery; all 28 preexisting runner checks passed earlier. Typecheck clean. Fetched/merged origin/dev before final suite (already current). Callback dummy delivery proved in A-768. C1-C3 done; C4 pending full typecheck+hub+Neovim suite via the new lock.

### rev-14 · 2026-10-10T20:25:30.319Z

verdict: review
result: not clear
by: rev-14 [reviewer]
run: rev-20261010-201-1
commit: ddead0a7e1c15422fa89a46b1f358480719252b2

Medium — hub/test/run-suite.ts:77: Ticket order begins only after the polled reaper guard succeeds; actual-source memory probe starts A before B but records tickets/admission B,A, violating C1. Assigning/publishing the waiter's order must not depend on winning that poll; current tests serialize registration and miss this case.
Medium — hub/test/run-suite.ts:267: Old pinned runners acquire Neovim then machine; new runners acquire machine then Neovim. Actual old/new acquire probes retain Neovim for old and machine for new, with both waiting indefinitely on live owners. Provide a compatible transition or enforced drain before reversing the shared-lock order.
Standards axis clear. C2 and C3 checked separately; C4 remains pending. Evidence and schedules: A-773 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-773-t-201-fifo-review-registration-inversion-and-mixed-version-deadlock.md.

Criteria: C1 failed (An earlier waiter delayed by the registration guard can receive a later ticket; mixed old/new Neovim lock orders can deadlock live waiters.).

### rev-14 · 2026-10-10T20:26:40.447Z

verdict: review
result: not clear
by: rev-14 [reviewer]
run: rev-20261010-201-2
commit: ddead0a7e1c15422fa89a46b1f358480719252b2

Medium — hub/test/run-suite.ts:77: Earlier waiter registration can lose to a later waiter after guard contention; C1 finding from rev-20261010-201-1 remains unresolved at this head.
Medium — hub/test/run-suite.ts:267: Opposite old/new Neovim lock orders can leave both live runners waiting on each other; prior finding remains unresolved at this head.
Validation: complete A-775 log shows typecheck exit 0, npm test exit 143 after partial hub execution and cleanup, with no complete hub/Neovim totals. C4 remains unchecked; this interruption establishes no assertion regression. C1 remains failed; C2/C3 remain verified by the prior run. Evidence: A-776 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-776-t-201-interrupted-full-validation-at-ddead0a-c4-pending.md

### impl-201 · 2026-10-10T20:30:44.166Z

A-773 review fixes implemented: tickets publish before any recovery-guard polling; one machine ticket now admits all phase locks together only when every lock is free, keeping both locks unowned while queued and allowing live Neovim-first runners to drain. A-780 passes 6/6 focused real-process checks, including guard contention through A/B/C registration and the mixed-version drain schedule. Superseded ddead0a suite was cancelled by SIGTERM to its verified runner; cleanup and its one result are A-775 (exit 143), C4 remains pending. Full runner file is now being verified on supported Node 24 before committing/re-review and fresh package validation.

### impl-201 · 2026-10-10T20:32:59.723Z

Pushed replacement head 5adb8f7b8a01ac3864d7b7d8d5d9eadff4a5b8f5. Both A-773 findings fixed with pre-guard ticket publication and one joint-admission machine queue that holds neither phase lock while waiting. A-784 passes the entire runner file 33/33 on Node 24, including contended-guard A/B/C registration and live legacy Neovim-first drain, with no skip/cancel/todo. Typecheck/diff checks clean. Fetched/merged origin/dev immediately before new full validation (already current). C1 marked done again, C4 pending; requesting rev-14 re-review and launching fresh typecheck+hub+Neovim through the proven persistent callback.

### rev-14 · 2026-10-10T20:34:35.289Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261010-201-3
commit: 5adb8f7b8a01ac3864d7b7d8d5d9eadff4a5b8f5

No high or medium findings. Standards and Spec axes clear. Pre-guard ticket publication fixes registration inversion; joint admission holds neither suite lock while blocked and allows legacy Neovim-first holders to drain. Actual-source memory probes verify both schedules plus second-lock rollback/manual-lock preservation and interruption ticket cleanup. A-784 retained complete runner log passes 33/33, zero fail/cancelled/skipped/todo. C1–C3 verified; C4 remains unchecked pending the final-head full package log. Evidence: A-786 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-786-t-201-re-review-clear-at-5adb8f7-c4-pending.md

Criteria: C1 verified, C2 verified, C3 verified.

### impl-201 · 2026-10-10T21:36:33.130Z

Fresh full package validation passed at unchanged clean reviewed head 5adb8f7b8a01ac3864d7b7d8d5d9eadff4a5b8f5: Node 24 typecheck exit 0, npm test exit 0; hub 1061/1061 and Neovim 238/238, zero failures/cancellations/skips/todos. A-810 stores the complete log at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-810-t-201-full-suite-at-5adb8f7.log. The callback marked C4 done and requested rev-14 verification directly; C1-C3 already verified in rev-20261010-201-3. Keeping the unchanged head and claim for the readiness/merge gate.

### rev-14 · 2026-10-10T21:36:58.055Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261010-201-4
commit: 5adb8f7b8a01ac3864d7b7d8d5d9eadff4a5b8f5

No outstanding high or medium findings. C4 verified from complete A-810: typecheck exits 0; npm test completes hub 1061/1061 and Neovim 238/238, both zero fail/cancelled/skipped/todo, final exit 0. Both admission regressions pass in the full run. HEAD/origin independently match reviewed 5adb8f7; clean worktree. Prior A-786 Standards/Spec clearance and C1–C3 verification remain applicable. Final evidence review: A-812 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-812-t-201-c4-verified-complete-full-suite-at-5adb8f7.md

Criteria: C4 verified.

### coord · 2026-10-10T21:37:18.559Z

Merged 83f06985dbf9b5014faf00341704ac8834a0143e onto dev.
