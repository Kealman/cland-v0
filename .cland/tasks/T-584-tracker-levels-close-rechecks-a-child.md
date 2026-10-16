---
id: T-584
kind: task
title: tracker-levels "close rechecks a child reopened during the parent temporary write" fails on a droplet since the in-process migration
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - bug
  - hub
  - flaky
assignee: null
parent: C-326
blocked_by: []
regression_of: T-466
topic: topic-367
branch: t/T-584-tracker-levels-close-rechecks-a-child
created: 2026-10-16T07:52:47.207Z
updated: 2026-10-16T08:20:27.739Z
---

## Summary
In T-470's droplet run 0d25c7a0 at 311933f1 (A-3842, lines 4466–4474), hub/test/tracker-levels.test.ts:87, the case "close rechecks a child reopened during the parent temporary write before rename", failed an equality assertion after 0.6 s. T-470 doesn't touch the tracker. On dev, on a quiet Mac, the case passed 3/3 alone. tracker-levels was the first file T-466 moved to the in-process hub, so the race between the child reopen and the parent's temp-write-and-rename may now run with different timing than under a spawned daemon.

## Acceptance criteria
- [x] C1. Find whether the case depends on spawned-daemon timing (a test issue) or exposes a real recheck race in close (a product issue), fix the cause, and record it on this item. The recheck assertion stays.
  - done: impl-584 · 2026-10-16T08:15:57.040Z
  - verified: rev-31 [reviewer] · run rev-20261016-584-source · 2026-10-16T08:17:51.958Z · commit a13cb1e5f7443e6b3397c4bc32b7f6c2d96046c2
- [x] C2. tracker-levels.test.ts passes 10/10 serially as a whole file on the Mac and once on a droplet.
  - done: impl-584 · 2026-10-16T08:20:15.643Z
  - verified: rev-31 [reviewer] · run rev-20261016-584-final · 2026-10-16T08:20:27.323Z · commit a13cb1e5f7443e6b3397c4bc32b7f6c2d96046c2

## Comments

### impl-584 · 2026-10-16T08:15:25.213Z

Diagnosis: the droplet line 87 failure is the final directory-wide no-.tmp assertion, not the close refusal at line 84. Existing taskWriteGate already deterministically holds the parent after its temp write and before child scanning/rename. The fixture changed child state closed→open while leaving status: done. The tracker watcher normalizes this to backlog through a legitimate child temp write; the final readdir can see that write. A temporary probe held that migration temp write for 300 ms and waited for its appearance: the exact true !== false failure reproduced after the close refusal, open-child error and unchanged-parent assertions all passed. With both state and status reopened consistently, the same probe passed with no migration triggered. No close defect found. Fix keeps the existing barrier and every assertion, changing only the fixture's hand reopen to update both workflow fields. All probe changes removed before serial proof.

### impl-584 · 2026-10-16T08:17:01.979Z

Mac proof complete: 10/10 serial whole-file tracker-levels.test.ts runs, 150/150 tests passed; PID guard clear before each run, one-minute load 1.81–2.69. Durable proof A-3859 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3859-t-584-mac-serial-proof-tracker-levels-10-10-150-passes.log); diagnosis A-3858. Fix committed/pushed as a13cb1e5f7443e6b3397c4bc32b7f6c2d96046c2. Branch remains based on frozen dev 54452778 per launch constraint; fetched origin/dev but did not merge later changes. C2 awaits fresh droplet execution after source review.

### rev-31 · 2026-10-16T08:17:51.958Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-584-source
commit: a13cb1e5f7443e6b3397c4bc32b7f6c2d96046c2
scope: full

Source clear, no findings in either axis. One fixture edit reopens status done→backlog along with state closed→open, eliminating unrelated workflow-migration temp writes. Parent temp-write gate/entered/release and every close refusal/error/unchanged-parent/no-.tmp assertion remain; no product close change or weakened bound. Tracker normalization confirms inconsistent open/done causes legitimate migration. A-3858 temporary probe reproduces exact cleanup assertion failure after recheck passed; probes absent from final diff. Coordinator d71fca50 accepts fixture diagnosis. C1 verified. A-3859 independently counts10 serial whole files/150passes/0fail, supports Mac portion C2; final C2 pending fresh exact-head droplet. Frozen54452778 retained per launch constraint, no later dev merge. Analysis A-3862: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3862-t-584-source-clear-at-a13cb1e5.md. No Reviewer edits/tests.

Criteria: C1 verified.

### impl-584 · 2026-10-16T08:20:15.941Z

C2 proof completed at reviewed head a13cb1e5f7443e6b3397c4bc32b7f6c2d96046c2. Mac serial whole-file proof: 10/10, 150 passes, A-3859. Fresh cland verify --executor droplet --fresh run 45b8a3ff-13b5-4355-aa7e-f40c2b606b32: exit 0, hub-selected plus Neovim smoke, 46/46 tests passed, zero fail/skip/cancelled. Linux x64 6.8.0-142-generic, Node v24.21.0, c-8 lon1, workers 4, suite wall 47.29s; executor lifetime/cost reported unknown by hub. Durable log A-3867 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3867-suite-45b8a3ff-13b5-4355-aa7e-f40c2b606b32-auto-at-a13cb1e.log). Awaiting Reviewer's final same-head evidence verdict; no source changes after source clear.

### rev-31 · 2026-10-16T08:20:27.323Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-584-final
commit: a13cb1e5f7443e6b3397c4bc32b7f6c2d96046c2
scope: evidence

Final clear at unchanged source-reviewed head. Fresh Linux A-3867/45b8a3ff selected hub34/34 plus Neovim smoke12/12, exit0/46pass/0fail/0skip. Whole tracker-levels file included; unchanged close-recheck case passes225.792ms with retained barrier/refusal/cleanup assertions. A-3859 Mac10serial wholefiles independently150passes/0fail. C2 verified, C1 current from A-3862; all2criteria verified. No findings/per-item QA/known-red exception. Receipt accurately selected, not full suite; accounting unknown not inferred. Artifact A-3868: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3868-t-584-final-clear-mac10-10-and-exact-head-linux-green.md. No Reviewer edits/tests.

Criteria: C2 verified.
