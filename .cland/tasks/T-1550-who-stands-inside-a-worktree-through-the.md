---
id: T-1550
kind: task
title: Who stands inside a worktree, through the Host
state: open
status: ready
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1549
topic: topic-1303
branch: t/T-1550-who-stands-inside-a-worktree-through-the
created: 2026-10-31T23:47:42.340Z
updated: 2026-11-01T18:06:38.575Z
---

## Summary

`cland worktree list` and prune decide which sessions stand inside a worktree through the Host's occupants operation, including the last check before Git removes it. Worktree identity checks before removal also go through the Host.

Hot files: `hub/src/hub/worktrees.ts`

## Acceptance criteria

- [x] C1. The list's sessions, prune's refusals and the last check before removal come from the Host's occupants (test).
  - verified: rev-35 [reviewer] · run rev-35-1550-final-1 · 2026-11-01T16:36:58.995Z · commit 95b208038b3668b406ba5099bf6e733627609be8
  - done: impl-1550 · 2026-11-01T17:48:46.076Z
  - verified: rev-35 [reviewer] · run rev-35-1550-final-2 · 2026-11-01T18:06:37.951Z · commit 4a9e5102e74d9eb2789eba58235e580796f470a5
- [x] C2. `TaskWorktrees` no longer calls `realpath` or `stat` on session cwds or worktree paths itself: identities come from the Host's statDirectory.
  - verified: rev-35 [reviewer] · run rev-35-1550-source-1 · 2026-11-01T16:18:41.496Z · commit 95b208038b3668b406ba5099bf6e733627609be8
  - verified: rev-35 [reviewer] · run rev-35-1550-final-1 · 2026-11-01T16:36:58.995Z · commit 95b208038b3668b406ba5099bf6e733627609be8
  - done: impl-1550 · 2026-11-01T17:48:46.198Z
  - verified: rev-35 [reviewer] · run rev-35-1550-source-2 · 2026-11-01T17:49:37.874Z · commit 4a9e5102e74d9eb2789eba58235e580796f470a5
  - verified: rev-35 [reviewer] · run rev-35-1550-final-2 · 2026-11-01T18:06:37.951Z · commit 4a9e5102e74d9eb2789eba58235e580796f470a5
- [x] C3. With a recording Host that reports a session inside, a prune is refused even when the session's recorded cwd string differs from the worktree path (test).
  - verified: rev-35 [reviewer] · run rev-35-1550-final-1 · 2026-11-01T16:36:58.995Z · commit 95b208038b3668b406ba5099bf6e733627609be8
  - done: impl-1550 · 2026-11-01T17:48:46.320Z
  - verified: rev-35 [reviewer] · run rev-35-1550-final-2 · 2026-11-01T18:06:37.951Z · commit 4a9e5102e74d9eb2789eba58235e580796f470a5
- [x] C4. The task-worktrees and worktree-cli test files pass with no test edited.
  - verified: rev-35 [reviewer] · run rev-35-1550-final-1 · 2026-11-01T16:36:58.995Z · commit 95b208038b3668b406ba5099bf6e733627609be8
  - done: impl-1550 · 2026-11-01T17:48:46.645Z
  - verified: rev-35 [reviewer] · run rev-35-1550-final-2 · 2026-11-01T18:06:37.951Z · commit 4a9e5102e74d9eb2789eba58235e580796f470a5

## Comments

### impl-1550 · 2026-11-01T14:45:37.172Z

Consumer inventory: TaskWorktrees #observe (list, prunable, prune admission and final pre-Git validator) owns containment/identity checks; production construction in hub/start.ts, fake WorktreeGit callers in hub/src/hub/worktrees.test.ts and hub/test/task-worktrees.test.ts, native callers in worktree-host/task-worktrees-lifecycle/worktree-cli/territory-lock tests. Host occupants/realpath/statDirectory signatures and WorktreeEntry wire shape remain unchanged; downstream CLI/web/nvim, fixtures and persisted readers require no migration. Implementing at the supplied recording Host seam.

### impl-1550 · 2026-11-01T14:46:17.603Z

Inventory correction after repository search: production construction is hub/src/hub/dispatch.ts (default local Host), not hub/start.ts. Searches covered occupants/resolvedOccupants/realWorktreePath/statDirectory/new TaskWorktrees/WorktreeEntry/worktree.list/worktree.prune across source, tests, wire, skills and QA docs. Host contract tests and session-host tests use the existing signatures; no contract or serialized field changes.

### impl-1550 · 2026-11-01T15:27:38.382Z

Red/green progress on uncommitted tree, macOS local Node v24.21.0, no browser: alias-only occupant regression failed [] vs ['remote-worker']; occupancy migration then passed worktree-host 11/11. Expanded file passed locked admission and last pre-Git occupancy controls; both Host directory identity controls failed removed=1 vs expected 0 before statDirectory migration. Identity migration and existing-section docs now written. Latest full file rerun did not execute assertions: cover-quiet 5d0045cd-7415-4cd2-a55e-cb8734274174. Await registered wake-up. No preservation file/typecheck/lint/verify evidence yet; no review requested.

### rev-35 · 2026-11-01T16:18:41.496Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1550-source-1
commit: 95b208038b3668b406ba5099bf6e733627609be8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear. Standards/Spec no findings. Host occupants drive list, locked prune admission and repeated final validator immediately before removal; current item/session snapshots, alias paths and directory identities still revalidate. TaskWorktrees has no native realpath/stat path reads: C2 verified. New alias/late-occupant/Host-only inode controls retain directory/no-removal assertions and exact Host input facts. Existing C4 tests unchanged; contract/wire unchanged, docs/skill/provenance match behavior. C1/C3/C4 await exact-head verify and named runtime receipts. No Reviewer execution. QA after-stage separate.

Criteria: C2 verified.

### rev-35 · 2026-11-01T16:36:58.995Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1550-final-1
commit: 95b208038b3668b406ba5099bf6e733627609be8
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; Standards/Spec no findings. A-15316 same-head a7cd1047 exit0,4586pass,zero fail/cancel/skip/todo. All17 worktree-host named finishes pass including alias/locked/final occupancy and both Host identity cases; task-worktrees13 top-level pass. A-15317 compiled actual local native output: unchanged CLI4/lifecycle3/lock20/source worktrees6 pass,native0,no signal/timeout,exact head/source tree,macOS Node24.21.0,no browser. Remote Linux x64 droplet Node24.21.0,isolated Headless Shell1248/Chrome Testing156.0.8078.4. T0/T1/all fallback T2/Web/changed T3 complete; remaining T3/T4 deferred,not full integrated coverage. Snapshot/source equality outside .cland independently checked. Advisory budgets/lint/ratchet report-only,no cache/skips. C1–C4 verified; after-stage QA/merge batch separate. No Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-1550 · 2026-11-01T17:46:48.785Z

Refusal text consumer inventory for follow-up: hub/src/hub/worktrees.ts producer (final validator + locked admission); hub/src/cli/worktree.ts displays failed.error verbatim, no phrase parser; hub/src/hub/worktrees.test.ts exact-equals occupant-only error; hub/test/tracker-native-boundary.test.ts regex matches both identity-change and occupant phrases in separate native alias races; hub/test/worktree-host.test.ts matches those same phrases in recording Host controls. Search included all hub/nvim/web/shared/docs/shipped skills: no other runtime phrase consumers. hub/test/fixtures/tracker-snapshot/items.json has incidental retained historical prose, unaffected (not a runtime error matcher). Wire failed[].error remains a string and no outcome class changes. Existing clauses retained verbatim, combined only when both observed facts apply. Re-running every matching test file and CLI/lifecycle preservation.

### rev-35 · 2026-11-01T17:49:37.874Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1550-source-2
commit: 4a9e5102e74d9eb2789eba58235e580796f470a5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Fresh source clear; Standards/Spec no findings. Small validator delta evaluates session identity before occupant refusal and retains both existing clauses if both facts hold; ordinary single-fact messages unchanged. Same Host reads/awaits/current snapshot and worktree identity/confinement/removal guards. All tests byte-identical; known native alias-race expectations preserved. A-15341 failure/read-sequence diagnosis and consumer inventory inspected. C2 reverified; C1/C3/C4 await new exact-head queued run plus named native-boundary/CLI/source preservation outputs. Prior task/batch evidence stays prior-head and failed batch is not a pass. No Reviewer execution; after-stage QA separate.

Criteria: C2 verified.

### rev-35 · 2026-11-01T18:06:37.951Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1550-final-2
commit: 4a9e5102e74d9eb2789eba58235e580796f470a5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; Standards/Spec no findings. A-15349 same-head d6bbeb1f exit0,4586pass,zero fail/cancel/skip/todo. Named Host17 and task-worktrees13 top-level outcomes pass. Exact-head local macOS Node24.21.0 A-15346 native-boundary29/A-15347 CLI4 raw pass outputs and exits0; A-15350 source-worktrees6 actual named pass output,native child/wrapper0 closes exact-equality consumer. Both original alias diagnostics pass with assertions/fixtures unchanged. Historical lifecycle/lock receipts not relabeled current. Remote Linux x64 droplet Node24.21.0,isolated Headless Shell1248/Chrome Testing156.0.8078.4; T0/T1/all fallback T2/Web/changed T3 complete,remaining T3/T4/full integrated unexecuted. No cache/skips,advisories report-only. C1–C4 verified; original failed batch stays failed. No Reviewer execution; after-stage QA/merge batch separate.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
