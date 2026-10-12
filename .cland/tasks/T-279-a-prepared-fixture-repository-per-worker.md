---
id: T-279
kind: task
title: A prepared fixture repository per worker; the hub phase's repeated setup batched
state: open
status: backlog
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: T-268
blocked_by:
  - T-277
  - T-278
topic: null
branch: null
created: 2026-10-12T11:54:20.662Z
updated: 2026-10-12T11:54:39.308Z
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

- [ ] A shared helper prepares each fixture shape once per worker and gives each test its own copy or shared-object clone; a test proves two tests' copies do not share refs, index, config, hooks, worktrees or `.cland` state, and that writing objects in one copy leaves the prepared fixture unchanged.
- [ ] The census on the branch head, compared with slice 1's baseline, shows the full run's `git` spawns cut by at least half; the comparison artifact with both wall times is published in this item's topic and the figures are sent to the Coordinator for T-267.
- [ ] The T-220 check was run on the pinned Node and its outcome recorded in the item; a compile cache is enabled only if that check and a full suite with it pass.
- [ ] Each batching of repeated hub-phase setup is named in the item with the census line it cut.
- [ ] `hub/README.md` describes the prepared fixtures and their isolation rule.
- [ ] The suite is green on macOS through `cland verify`, and no test is weakened, skipped or retried.
