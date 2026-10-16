---
id: T-575
kind: task
title: "In-process hub, part 3: bring daemon starts per full run from 743 to under 600"
state: open
status: review
size: M
criterion_seq: 2
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-578
blocked_by: []
topic: topic-376
branch: t/T-575-in-process-hub-part-3-bring-daemon
created: 2026-10-16T06:12:55.788Z
updated: 2026-10-16T16:18:12.076Z
---

## Summary
T-466's full Mac census at 88a3630e (A-3775) measured 743 daemon starts per full run, 742 of them canonical. The E-387 target is under 600, so at least 144 more net removals are needed. A-3775's per-file table ranks the remaining files and marks the lifecycle cautions. Its biggest contributors include remote-fixture-lifecycle (60, mostly load-gate repetitions of new tests, which the next durations refresh removes), daemon (26) and planned-stage (17). Each migrated file needs the lifecycle audit T-393 and T-466 used.

## Acceptance criteria
- [x] C1. The next files from A-3775's ranking move to the in-process hub, with their lifecycle tests kept spawned and their assertions unchanged, and an audit posted.
  - done: impl-575 · 2026-10-16T16:15:12.948Z
  - verified: rev-30 [reviewer] · run rev-20261016-575-source · 2026-10-16T16:18:12.076Z · commit a8ddbb8c39e51ce26f8aab1c925d6c189b9b2524
- [ ] C2. A full-run spawn census after a durations refresh shows daemon starts under 600, with the per-file table recorded.

## Comments

### impl-575 · 2026-10-16T15:53:28.983Z

Ranked migrations underway; daemon 18/18, planned-stage 11/11, account-limited 10/10, suite-stage-cover 3/3, Neovim artifacts 9/9, account-poller 10/10, agents-journal 8/8 and artifact-browser 11/11 pass serial targeted runs. Restart, down-hub CLI, orphan/watchdog and instrumentation cases stay spawned. C2 measurement is assigned to the Coordinator after clear source review and green same-head diff-selected verify (decision 23a58883). No measured full-count claim yet.

### impl-575 · 2026-10-16T16:04:06.669Z

Source committed/pushed at e653452c8bae7a6008383de1439b2612f06696f8 after merging latest origin/dev. C1 audit A-3960 records 27 migrated test files + typed fixture forwarding, projected 156 ordinary-pass daemon removals, retained lifecycle cases, and exact preservation of 219 declarations / 1,767 assertion callsites. Serial whole-file targeted validation: 26 files green; task-worktrees timing case T-581 red twice (A-3942/A-3956), all eight other cases pass both times. Root typecheck at head exits 0. Coordinator decision 8e2aa2f4 holds review until its T-581 shared fix is posted/cherry-picked, then rerun task-worktrees. No full suite/census run; C2 is Coordinator-owned after source clear and green same-head diff-selected verify.

### rev-30 · 2026-10-16T16:18:12.076Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-575-source
commit: a8ddbb8c39e51ce26f8aab1c925d6c189b9b2524
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-575 source review

Commit a8ddbb8c39e51ce26f8aab1c925d6c189b9b2524; fixed point e335c91349288ea6a0762003d6fce99a77241050. Local and origin task tips agree. First review of 27 test-file migrations plus close-run-fixture.ts forwarding. Both axes performed in-session because role delegation is disabled.

## Standards
No findings. Existing projectHub remains the shared embedded fixture; no production source or harness implementation changes. It invokes serveProject with per-fixture environment, exposes real discovery/socket/WebSocket edges, owns the journal and flush barrier, stops before directory cleanup and checks owned resources. Tests keep separate CLI, MCP spoke, native fake harness, Git and Neovim processes. The skills-tracker CLI helper remains asynchronous, avoiding blocking an embedded server while its child waits for a reply.

close-run-fixture adds only a typed optional hub selector and forwards it to remote-fixture; the default remains startDaemon for unlisted callers. No generic helper silently migrates lifecycle consumers. No test identity, skip, timeout, assertion or duration allowance is removed. Diff whitespace check passes.

## Spec
C1 established. Reviewed all migration hunks and the lifecycle audit in A-3960, with parameter/helper callers checked rather than treating a changed callsite as one runtime instance.

Ordinary protocol, account scheduling, messaging, worktree/Git, rule/crew, artifact, release/push and live UI cases move to projectHub. Cases asserting native harness process behavior retain those child processes. Startup archive rows still pass through serveProject's startup path; client-only reconnect retains its client boundary.

Real daemon start idempotence, stale discovery/locks, stop/autostart grace, actual PID/socket cleanup and orphan-sweep instrumentation remain spawned in daemon.test.ts. Planned-stage restart/offline-plan cases and both QA startup-cover variants explicitly retain their first and successor hubs. Account restart/re-find, successful-minimum restart and account-poller network preload instrumentation remain spawned. Claude directory persistence and the long reconnect authentication latch retain spawned hubs. Journal loop-breaker/config/replay recovery, published release retry and Neovim artifact retention across restart remain spawned. Independent demo watchdog/dead-hub recovery and executor watchdog/restart paths remain spawned. Neovim stdio ownership, no-hub autostart, stale-hub replacement and hub restart remain process-based. In sharded-close recovery, only lost/cancel move; restart explicitly selects startDaemon before killing discovery.pid and starting its successor.

The suite-stage-cover preload is conditional on suite-worker argv and still reaches spawned workers through fixture env; it is not intended to instrument the embedded hub. Push's Git shim likewise remains in the fixture environment for Git subprocesses.

The only additional behavioral test seam is Coordinator-posted T-581, cherry-picked as a8ddbb8c. It matches the already-reviewed synchronous measurement scoping and deterministic inbox interleave; A-3965/A-3980 establish that shared fix's source and two-platform evidence. Its original assertions remain intact.

Independently parsed both pinned Git versions with TypeScript's AST, without executing project tests or the claimant's audit script: 28 files, 219 test declarations and 1,767 assertion callsites; every declaration's name/options arguments and every complete assertion call expression have identical source text. These are static counts, not runtime execution counts. A-3986's refreshed audit agrees.

## Validation and limits
Independently checked A-3960's retained per-file raw summaries: 26 files green, with the two task-worktrees T-581 reds honestly retained. A-3986 supplies the corrected current-head task-worktrees whole-file 9/9 receipt (51.547 seconds), making green targeted receipts available for all 27 touched files. Root typecheck completion is recorded in A-3986; no Reviewer test/compiler execution occurred. Earlier targeted files were tested before the shared fix, not all rerun at the final head.

The audit's projected 156 fewer ordinary canonical starts is source accounting only. It cannot be subtracted from the historical 743 to assert a measured result on a changed corpus. C2 remains unverified: it requires the Coordinator-owned durations refresh and queued full-run Mac spawn census with the per-file table and an actual count under 600. A normal same-head verification pass is also still pending. No performance target waiver or final readiness is inferred.

Source clear, C1 verified; C2 and final evidence pending. Per request, next verification uses no mode override and the droplet executor under Coordinator routing. No further dev merge without authorization.

Standards 0 findings; Spec 0 findings.
Artifact: A-3992 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3992-t-575-source-clear-27-migrations-retain-lifecycle-boundaries-and-assertions.md

Criteria: C1 verified.
