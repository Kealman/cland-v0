---
id: T-279
kind: task
title: A prepared fixture repository per worker; the hub phase's repeated setup batched
state: open
status: review
criterion_seq: 6
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: T-268
blocked_by:
  - T-277
  - T-278
topic: topic-178
branch: t/T-279-a-prepared-fixture-repository-per-worker
created: 2026-10-12T11:54:20.662Z
updated: 2026-10-12T19:54:54.804Z
---

## Summary

Most of the suite's 36 thousand `git` spawns build the same repository and territory over and over, one `git` call at a time, in many test files' own `project()` and `repository()` helpers. This ticket builds those fixtures once per worker and gives each test a copy or a clone with shared objects, batches the other setup the census shows repeated, and records the suite's wall time and spawn counts before and after on T-267.

## Parent

T-268: Suite spend and Linux portability. Realises T-267 (the suite's spend) under epic T-268, slice 3 of 6; with this slice T-267's cuts are complete. Spec: docs/spec/v0.1.2.md §3.14 ("Before the executor").

## What to build

Fewer `git` calls per test, with each test still owning its repository.

- **Today.** Many hub test files build their own fixture with a sequence of `git` calls (`init`, `config` user name, email and signing, an initial commit, often `cland init`, which creates the territory, a bare repository with hooks, and the first push) inside a local helper (`project()`, `repository()`, `gitRepo()` and similar, in `merge`, `push`, `release`, `tracker-ready`, `task-worktrees`, `territory-cli`, `suite`, `init`, `lead-permissions` and others). The census of slice 1 names the largest of them.
- **After.** A shared test helper prepares each fixture shape the census shows to matter (at least: a repository with its initial commit; a repository after `cland init` with its territory) once per test worker process, in that worker's temporary root, and hands each test its own copy (a copied tree, or a clone with shared objects via `--shared`/alternates or `--reference`, whichever keeps the test's behaviour identical). The prepared fixture is read-only once made: each test gets its own refs, index, worktrees, hooks state, config and `.cland` state; the shared objects are never written by a test. The helper registers the copy with the same ownership and teardown as `tempProject`. Migrate the call sites the census ranks highest until the full run's `git` count is at least halved; a test that checks the building itself (for example `cland init` on an empty repository, or the territory's creation) keeps building its own.
- **Batching.** Where the census shows other setup repeated per test in the hub phase (for example identical CLI spawns before the test proper, or several `git` calls that one call can do), batch or share it with the same isolation rule. Name each batching in the item with its census line.
- **The compile cache.** Run the T-220 qualification check (`hub/test/compile-cache-check.ts`, `docs/node-compile-cache.md`) on the pinned Node. Enable a compile cache for the suite only if the check passes as that document requires, followed by a complete suite with that configuration; otherwise record in the item that the guard still forbids it, with the check's output (the local Node 24.21.0 is recorded as failing the guard, so a no-op outcome is expected and acceptable).
- **Measure and record.** Run the census on the branch head and compare it with slice 1's baseline; publish the comparison artifact in this item's topic with the wall time of both runs (the runner's `suite duration`, and the census's own). Post the before and after figures (wall time; `git`, `ps` and Node spawn counts) to the Coordinator (`to: coordinator`, in this item's topic) for T-267, which closes with them.
- **Doc.** `hub/README.md`'s Tests section says how to get a prepared fixture, its isolation rule, and when a test must build its own instead.

Demo, as the epic words it: the census shows the `git` count cut by at least half, with the wall time before and after recorded on T-267.

Out of scope: Linux (slices 4 to 6); the hub's verification queue and budget, which stay as v0.1.1 built them; changing what any test asserts.

Constraints:
- The epic's risk applies: a prepared fixture must not leak state between tests; shared objects are read-only and each test gets its own refs and worktrees. Prepared fixtures live in the worker's temporary root so the runner's sweep removes them.
- Tests go through the hub's frame protocol first and the fake harnesses second; no new seams inside the hub.
- A census run takes a queue slot like any suite run. Suites for review run through `cland verify`. Commit on the task branch, push to `origin`; `dev` only through `cland merge`. English everywhere.
- New or moved test files are classified in the hub's shard manifest.

## Acceptance criteria

- [x] C1. A shared helper prepares each fixture shape once per worker and gives each test its own copy or shared-object clone; a test proves two tests' copies do not share refs, index, config, hooks, worktrees or `.cland` state, and that writing objects in one copy leaves the prepared fixture unchanged.
  - done: impl-279 · 2026-10-12T19:37:08.827Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-279-1 · 2026-10-12T19:54:54.804Z · commit 5d92ef5fcc6306f6d262442b0acb8de74fbcfe4e
- [x] C2. A complete census on the branch, compared with slice 1's baseline (A-1535), records the measured cut with both wall times and the remaining sources named; the comparison artifact is published in this item's topic and the figures are sent to the Coordinator for T-267 (A-1610: git 32,341 → 21,111, ps 28,888 → 15,290, wall 905 → 706 s). The halving target was replaced by the measured cut on 2026-10-12 (the human's stand-in, D24, answering the Coordinator's ask); the remaining production sources are a Tech debt follow-up.
  - done: impl-279 · 2026-10-12T19:51:22.328Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-279-1 · 2026-10-12T19:54:54.804Z · commit 5d92ef5fcc6306f6d262442b0acb8de74fbcfe4e
- [x] C3. The T-220 check was run on the pinned Node and its outcome recorded in the item; a compile cache is enabled only if that check and a full suite with it pass.
  - done: impl-279 · 2026-10-12T19:37:09.445Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-279-1 · 2026-10-12T19:54:54.804Z · commit 5d92ef5fcc6306f6d262442b0acb8de74fbcfe4e
- [x] C4. Each batching of repeated hub-phase setup is named in the item with the census line it cut.
  - done: impl-279 · 2026-10-12T19:37:09.975Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-279-1 · 2026-10-12T19:54:54.804Z · commit 5d92ef5fcc6306f6d262442b0acb8de74fbcfe4e
- [x] C5. `hub/README.md` describes the prepared fixtures and their isolation rule.
  - done: impl-279 · 2026-10-12T19:37:10.346Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-279-1 · 2026-10-12T19:54:54.804Z · commit 5d92ef5fcc6306f6d262442b0acb8de74fbcfe4e
- [ ] C6. The suite is green on macOS through `cland verify`, and no test is weakened, skipped or retried.

## Comments

### impl-279 · 2026-10-12T19:21:56.754Z

Implementation seams: prepared fixture helper consumed by existing Git CLI/socket tests; isolation verified with public Git operations and hub frames. Full file copies avoid shared writable objects. Baseline A-1535's highest sources: merge territory 4,550; release territory 2,360; stage-qa territory 1,860; suite verification-tree 928; tracker-ready territory 728. Existing tests of init/territory construction retain fresh setup.

### impl-279 · 2026-10-12T19:24:50.992Z

C3 qualification: `node hub/test/compile-cache-check.ts shared 5` on pinned v24.21.0/darwin/arm64 exited 1: all five cold loads passed, all ten warm loads failed (private-brand TypeErrors or SIGSEGV). Output A-1604, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1604-t-279-node-24-21-0-shared-compile-cache-qualification.log. Guard remains in force; no compile cache enabled.

### impl-279 · 2026-10-12T19:31:41.812Z

C4 batching (A-1535 lines): (1) shared preparation replaces per-test init/config/Initial commit/cland init; largest relevant synchronous territoryGit sources merge 1,440, territory-native 704, release 612, tracker-ready 544; init/territory-construction assertions remain fresh. (2) release and release-item share the initial bare GitHub stand-in and remote setup (baseline git clone 39; release git helper 471). (3) taskBase reads cland.managed/taskBase with one Git config query and freshness uses its same-operation branch tips; baseline territory.ts async config 5,845 and rev-parse 3,819 (full command counts from raw records will be included in comparison). (4) releaseState resolves all six operation-marker paths with one rev-parse; baseline release territory async 2,360 and release-item 545. Coordinator authorized read-only per-operation batching in message 5b180c28-9dd8-46f2-a6e8-d86da07a92ee; no write changes or cross-operation cache. New protocol test moves a task during a held freshness read, verifies merge refusal, stale status and a subsequent fresh review/merge.

### impl-279 · 2026-10-12T19:32:00.787Z

Correction to the C4 source numbers above, now computed directly from A-1535's retained raw records: territory.ts async config = 5,473; async rev-parse = 4,829; release-item territory.ts async = 537. The previously quoted 5,845 / 3,819 / 545 were transcription errors. The batching descriptions and report source titles are unchanged.

### impl-279 · 2026-10-12T19:50:45.862Z

Complete census at clean pushed 5d92ef5: comparison A-1610 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1610-t-279-complete-census-and-before-after-comparison-at-5d92ef5/summary.md). Git 32,341→21,111 (-34.7%), ps 28,888→15,290 (-47.1%), Node 6,017→5,928; runner 905.46→706.18 s, invocation 1684.24→706.59 s (different queue waits). Both halving targets remain unmet; C2 stays open pending Coordinator/stand-in decision. Hub free 30/30, machine 1343/1343, Neovim 298/299; unchanged palette item-prefix case timed out in census, passed entire file 18/18 alone (A-1611). Named load flake; counts stand. Remaining sources are in A-1610. Origin/dev fetched/merged before final suite (already up to date); no code changes after census.

### rev-23 · 2026-10-12T19:54:54.804Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-279-1
commit: 5d92ef5fcc6306f6d262442b0acb8de74fbcfe4e

No high/medium findings. Private copied per-worker shapes, Git/frame isolation (second/third copies unchanged), retained construction assertions and shard/docs checked. Per-operation config/tip and release-path batching preserve write order/freshness; real-frame branch-move race refuses stale merge then accepts fresh review. Current revised C2 verified via completed A-1610 and D24 decision: Git32341→21111, ps28888→15290, Node6017→5928; runner905.46→706.18s, both invocation times/remaining sources and Coordinator delivery checked, no halving claim. A-1604 qualification fails warm loads; cache remains disabled. C1–C5 verified; C6 ordinary full d8e587d2 pending. A-1612: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1612-t-279-fixture-batching-and-census-review-clear-at-5d92ef5.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
