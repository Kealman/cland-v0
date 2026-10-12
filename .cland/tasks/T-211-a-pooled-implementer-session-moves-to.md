---
id: T-211
kind: task
title: A pooled Implementer session moves to the next item's worktree on reuse
state: open
status: review
criterion_seq: 3
labels:
  - tech-debt
  - ready-for-agent
assignee: impl-211
parent: T-229
blocked_by: []
topic: topic-160
branch: t/T-211-a-pooled-implementer-session-moves-to
created: 2026-10-11T05:00:24.480Z
updated: 2026-10-12T00:06:04.521Z
---

## What to build

Split from T-182 (2026-10-11). crew.toml allows a `pool` policy for Implementers. No harness adapter can move a running session's working directory between task worktrees, so T-182 reuses across items only for the root-based Reviewer and QA pools; an Implementer pool counts toward the cap but launches fresh per worktree.

Design and build a worktree handoff for pooled Implementers. Either relaunch the harness in the new worktree while keeping its context (resume by harness session id), or run Implementers from a stable directory with per-item worktrees passed in. Choose one and document it.

## Acceptance criteria

- [x] C1. An Implementer pool member, once its item merges, takes the next item in that item's worktree with the context policy that keep_context says.
  - done: impl-211 · 2026-10-11T23:47:55.555Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-211-1 · 2026-10-11T23:50:37.000Z · commit 51fe5ef5b3e8f04f6fe34d0e21ec985ad5aa644a
  - verified: rev-18 [reviewer] · run rev-18-20261012-211-2 · 2026-10-12T00:06:04.521Z · commit fc6afcd2ed79a408c5b1ecc7efc320b8bd176d5b
- [x] C2. Protocol and fake-harness tests cover reuse across two items.
  - done: impl-211 · 2026-10-11T23:47:55.751Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-211-1 · 2026-10-11T23:50:37.000Z · commit 51fe5ef5b3e8f04f6fe34d0e21ec985ad5aa644a
  - verified: rev-18 [reviewer] · run rev-18-20261012-211-2 · 2026-10-12T00:06:04.521Z · commit fc6afcd2ed79a408c5b1ecc7efc320b8bd176d5b
- [ ] C3. `npm run typecheck && npm test` pass.

## Notes

Not for v0.1 unless the human promotes it.

## Comments

### coord · 2026-10-11T05:01:38.705Z

Scope from impl-182 (T-182): either define adapter cwd relocation or a safe replacement/handoff protocol; transfer the item claim to the next item; release the previous worktree without losing context.

### impl-211 · 2026-10-11T23:38:50.037Z

Chosen handoff: restart an idle pooled Implementer's harness in the next task worktree. Keep native conversation id only for keep_context=true; every restart gets a new cland identity/launch token and uses existing launch admission, cleanup and brief delivery. Confirmed seam from assignment: protocol session.launch with fake harnesses across two items, claims, clean previous worktree and second brief.

### impl-211 · 2026-10-11T23:46:49.776Z

Implemented restart handoff for pooled Implementers across task worktrees. Added six protocol cases (Claude Code/Codex/OpenCode × kept/reset context), claim/cap/clean-worktree checks, text/artifact brief delivery, invalid-brief preflight and overlapping lifecycle admission checks. Launch-recovery targeted regression: 4/4 pass; typecheck passes. Final crew-launch targeted run is in progress before commit/review/full suite.

### rev-18 · 2026-10-11T23:50:37.000Z

verdict: review
result: clear
by: rev-18 [reviewer]
run: rev-18-20261011-211-1
commit: 51fe5ef5b3e8f04f6fe34d0e21ec985ad5aa644a

No high or medium findings. Handoff validates brief/cwd, reserves an idle unclaimed member, verifies stop and reuses existing fresh-credential launch/failure/claim paths. Native context is kept/reset independently of cland identity; primary Claude/OpenCode documentation supports resume/move semantics, with OpenCode location confirmation before delivery. Six protocol fake-harness cases cover all three harnesses and both policies, plus claim/cap/brief/cleanup/lifecycle checks. C1/C2 checked from source and docs; A-1448 targeted summaries are supplementary and do not qualify C3. Await exact-head supported full suite. Details: A-1450 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1450-t-211-review-at-51fe5ef-pooled-worktree-handoff-clear.md

Criteria: C1 verified, C2 verified.

### impl-211 · 2026-10-12T00:04:17.819Z

Managed all suite 9b66b9cf at 51fe5ef passed typecheck, then stopped at shard admission: unclassified hub/test/launch-recovery.test.ts (durable log A-1455). Applied the coordinator-authorized exact machine entry as separate commit 271b4e5. Fetched and merged current origin/dev fae0e78; new pushed exact head dacf691. Requesting fresh review and full suite; C3 remains pending.

### impl-211 · 2026-10-12T00:05:07.903Z

Second managed all run dbc64372 passed typecheck and then found the other inherited manifest omission: hub/test/termination-ownership.test.ts (A-1458). Classified it as machine in separate commit fc6afcd. Complete npm run test:shards now passes: 5 free files / 118 machine files. Latest origin/dev fetched and already merged; pushed head fc6afcd. No handoff implementation edits. Fresh review/full rerun requested; C3 pending.

### rev-18 · 2026-10-12T00:06:04.521Z

verdict: review
result: clear
by: rev-18 [reviewer]
run: rev-18-20261012-211-2
commit: fc6afcd2ed79a408c5b1ecc7efc320b8bd176d5b

No high or medium current-head source findings. All handoff implementation and fake/protocol test files are byte-identical to reviewed 51fe5ef; dev integration retains that behavior. Manifest now covers all 123 hub test files (5 free/118 machine), correcting both inherited admission omissions without disabling lint. C1/C2 freshly checked from unchanged source/docs/coverage. C3 remains pending complete supported exact-head managed verification; A-1455/A-1458 passed typecheck but never ran tests. Details: A-1462 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1462-t-211-integrated-re-review-at-fc6afcd-c1-c2-clear.md

Criteria: C1 verified, C2 verified.
