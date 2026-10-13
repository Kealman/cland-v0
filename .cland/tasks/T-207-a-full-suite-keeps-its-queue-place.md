---
id: T-207
kind: task
title: A full suite keeps its queue place between the hub and Neovim phases
state: closed
status: done
criterion_seq: 4
labels:
  - high
  - ready-for-agent
assignee: impl-207
parent: E-19
blocked_by: []
topic: topic-109
branch: t/T-207-a-full-suite-keeps-its-queue-place
created: 2026-10-10T22:56:33.438Z
updated: 2026-10-11T01:28:27.407Z
closed: 2026-10-10T23:09:38.933Z
---

## What to build

Since T-201 (83f0698), run-suite releases the machine lease after the hub phase and queues a new ticket for the Neovim phase (hub/test/run-suite.ts around line 305: 'Release and sweep the previous phase before waiting for the next phase's lock'). Each full run's Neovim phase therefore waits behind every other run's hub phase. Seen on 2026-10-10: T-184's run finished its hub phase at 22:45Z and re-queued behind T-179 (22:25Z) and T-203 (22:35Z). With five full runs queued, one item takes over an hour to finish.

A `run-suite all` should keep its place: hold the machine lease from the hub phase into the Neovim phase, and take the Neovim lock jointly while still holding the machine lease, instead of releasing it and queueing again. Single-phase runs (`hub`, `nvim`) keep today's behaviour.

## Acceptance criteria

- [x] C1. A `run-suite all` runs its Neovim phase directly after its hub phase, with no other run's phase in between, and the queue order of other waiters is unchanged.
  - done: impl-207 · 2026-10-10T23:01:03.176Z
  - verified: rev-14 [reviewer] · run rev-20261011-207-1 · 2026-10-10T23:04:07.607Z
  - verified: rev-14 [reviewer] · run rev-20261011-207-2 · 2026-10-10T23:07:03.601Z
- [x] C2. A crash between the phases still releases both locks and leaves no ticket behind.
  - done: impl-207 · 2026-10-10T23:01:03.311Z
  - verified: rev-14 [reviewer] · run rev-20261011-207-1 · 2026-10-10T23:04:07.607Z
  - verified: rev-14 [reviewer] · run rev-20261011-207-2 · 2026-10-10T23:07:03.602Z
- [x] C3. A real-process regression covers three queued `all` runs finishing in order, each with both phases back to back.
  - done: impl-207 · 2026-10-10T23:01:03.436Z
  - verified: rev-14 [reviewer] · run rev-20261011-207-1 · 2026-10-10T23:04:07.607Z
  - verified: rev-14 [reviewer] · run rev-20261011-207-2 · 2026-10-10T23:07:03.602Z
- [x] C4. `npm run typecheck` and the runner's own tests pass (hub/test/suite-runner.test.ts and the queue cases, including a two-phase `all` run against a small fixture). Exception decided 2026-10-10: the full-suite evidence is the next integrated dev suite, which runs on the new runner; if it misbehaves, fix forward within the hour.
  - done: impl-207 · 2026-10-10T23:08:59.517Z
  - verified: rev-14 [reviewer] · run rev-20261011-207-3 · 2026-10-10T23:09:26.155Z

## Notes

Size S. Follow-up to T-201.

## Comments

### coord · 2026-10-10T22:57:16.260Z

Exception (stand-in decision, 2026-10-10 23:00Z): T-207 changes only the test runner, and the runner proves itself. It merges on typecheck plus the runner's tests, including a two-phase fixture run, not on its own full suite queued behind an hour of other items. The next integrated dev suite runs on the new runner and is its full-suite evidence. If that run misbehaves, fix forward within the hour (as with T-173). C4 is amended accordingly.

### impl-207 · 2026-10-10T22:57:23.864Z

Claimed in provisioned T-207 worktree; read T-201 handover A-785 and lock/test docs. Adding real-process full-run FIFO and between-phase crash coverage. T-207 scoped validation exception from coord aa6bd1bf applies: typecheck plus runner tests, no full suite; integrated dev run supplies full-suite evidence.

### impl-207 · 2026-10-10T23:01:03.558Z

Pushed 742b6b28f1c574e429e7089d5a029d4533d4dcd4 on t/T-207-a-full-suite-keeps-its-queue-place; fetched/merged origin/dev (already current). Full runs now use one admission and jointly reserve both locks before hub starts, preserving A-785 legacy Neovim-first compatibility. Leases span both phases; each phase sweeps its processes/root and publishes the next planned distinct root before creation. A-863 records the pre-fix FIFO failure; A-864 passes SIGKILL at both before-old-root-removal and after-new-root-creation boundaries; A-865 typecheck passes. C1–C3 done; final complete runner file is running on the committed head before review/C4.

### rev-14 · 2026-10-10T23:04:07.607Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-207-1
commit: 742b6b28f1c574e429e7089d5a029d4533d4dcd4

No high/medium source findings in Standards or Spec. Full runs retain one FIFO admission and both locks across hub/Neovim while sweeping distinct phase roots. Initial joint admission preserves T201 legacy Neovim-first drain; planned root publication and interruption/recovery paths are sound. A-863 red and A-866 green real-process FIFO proof, plus A-8642/2 crash boundaries support C1-C3.
C4 remains pending complete runner-file evidence at this head. The Coordinator's amended scoped criterion explicitly substitutes runner tests/typecheck for a separate task full package suite; next integrated dev full suite is follow-up evidence. No Reviewer tests run.
A-869 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-869-t-207-code-review-clear-at-742b6b2-final-runner-evidence-pending.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-207 · 2026-10-10T23:06:00.907Z

Diagnosed A-868's sole guard fixture failure. Captured stderr showed guard.release() timing out on .reaper.break; repeated unmodified timing reproduced it, and forcing A's SIGSTOP immediately after installing that transient guard reproduced the exact failure on supported Node24 (A-870). Fixed only fixture coordination: A now self-stops at its first queue diagnostic, after all recovery guards are released, still while the external admission guard blocks every ticket. Captures guard stderr for future failures. Fixed targeted proof passes; temporary reproducer deleted. Pushed test-only delta9f371a4. Worktree shell had selected Node25 despite repo engine; final typecheck and runner checks now explicitly pin Node24. Production runner unchanged from reviewed742b6b2. Fresh complete runner file is running; C4 remains pending.

### rev-14 · 2026-10-10T23:07:03.602Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-207-2
commit: 9f371a4961913f211bb1f0090a6e3b7b9fe245af

No high/medium findings in test-only correction; both axes clear. A now pauses after transient recovery guards release, while external contention still spans all ticket registrations. Assertions still require B/C to wait and exact A/B/C completion. A-870 reproduces prior fixture failure on Node24; runner implementation/docs remain unchanged from A-869.
C1-C3 reverified; C4 awaits complete passing Node24 runner-file evidence. Previous A-86836/37 does not qualify. A-874 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-874-t-207-fixture-re-review-clear-at-9f371a4-c4-pending.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-207 · 2026-10-10T23:08:59.651Z

Final validation passes on unchanged clean pushed9f371a4961913f211bb1f0090a6e3b7b9fe245af: Node24 typecheck exit0 (A-872), complete runner file37/37 with zero fail/cancel/skip/todo (A-875). Includes both legacy-drain modes, contended-guard registration, mixed FIFO/dead waiter cases, fresh phase roots, three queued all runs with contiguous phases and SIGKILL at both root boundaries. C4 marked done under the scoped exception; no package full suite run. Final C4 verification requested directly from rev-14; keeping claim/head for the readiness/merge gate.

### rev-14 · 2026-10-10T23:09:26.155Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-207-3
commit: 9f371a4961913f211bb1f0090a6e3b7b9fe245af

No high/medium findings; unchanged A-874 Standards/Spec code clearance remains current. A-872 typecheck has no errors and lead reports Node24 exit0. Complete A-875 runner file passes37/37 with zero fail/cancel/skip/todo, including corrected contention fixture, all FIFO/legacy-drain and both phase-boundary crash cases; lead reports Node24 exit0 on unchanged clean head.
C4 verified under the Coordinator's explicit amended criterion; C1-C3 retain prior verification. Next integrated dev full suite supplies the agreed follow-up evidence. A-876 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-876-t-207-c4-verified-node-24-runner-37-37-at-9f371a4.md.

Criteria: C4 verified.

### coord · 2026-10-10T23:09:38.789Z

Merged 01ea28d385de1b94915641dc0957c4762e24920f onto dev.

### coord · 2026-10-11T01:28:27.407Z

Full-suite evidence (per the exception): the integrated dev suite at a619490 ran on T-207's runner and passed, hub 1099/1099 and Neovim 252/252, with zero failed, cancelled or skipped. It took 1008s after a 2720s lock wait at peak load 16.9 (A-950). No fix-forward needed.
