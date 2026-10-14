---
id: T-430
kind: task
title: Three hub tests fail intermittently on Linux droplets (init database locked, merge restart ref movement, executor-safety same-name keys)
state: open
status: review
size: M
rank: 2311
criterion_seq: 3
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: R-228
blocked_by: []
topic: topic-256
branch: t/T-430-three-hub-tests-fail-intermittently-on
created: 2026-10-14T17:14:45.492Z
updated: 2026-10-14T18:17:13.181Z
---

## Summary

Three hub tests failed once each on Linux c-8 droplets in the first two full droplet runs on 2026-10-14, each in one run out of two. They pass on macOS in every integrated run, including 27503044 at be45cda. They block droplet verification for the tasks whose runs they hit.

## Evidence

The runs used Linux x64 c-8 in lon1, Node v24.21.0, snapshot cland-v0-341986a75486, with the hub machine phase on 4 workers.

- `hub/test/init.test.ts:408`, failing at 438 ("a Claude Code session launched in the initialised project gets the project hooks…"). `cland init` exits 1 with `cland: database is locked`. Seen in T-385 run b1603160, A-2465, from line 3644.
- `hub/test/merge.test.ts:1058`, failing at 1079 ("restart after local ref movement but before territory push republishes the prepared commit without another squash"). It read `true !== false`. Seen in T-385 run b1603160, A-2465.
- `hub/test/executor-safety.test.ts:182` ("same-name hubs preserve each other's in-flight keys and conservatively age legacy keys"). The `cland-same-live` key was missing, and an async ENOENT for image-900/image-901 followed the test's cleanup. Seen in T-383 run ba071efd, A-2466.

## What to fix

For each test, find whether it is a Linux-specific race (SQLite locking, timing, fs semantics) or a product defect, and fix it in one commit. The `database is locked` failure may be a real product race between `cland init` and a hub or test process. If so, fix the product.

## Acceptance criteria

- [x] C1. Each of the three failures has a named cause with evidence, and the fix is a single commit, cherry-pickable into every open task branch (shared-fix rule).
  - done: impl-430 · 2026-10-14T17:31:55.607Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-430-1 · 2026-10-14T17:42:08.188Z · commit 564e7a4c840f803858990a4dd43ebb498d679f5e
  - verified: rev-23 [reviewer] · run rev-2026-10-14-430-2 · 2026-10-14T18:17:13.181Z · commit 564e7a4c840f803858990a4dd43ebb498d679f5e
- [x] C2. On macOS each of the three files passes 5/5 whole-file runs.
  - done: impl-430 · 2026-10-14T18:15:51.027Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-430-2 · 2026-10-14T18:17:13.181Z · commit 564e7a4c840f803858990a4dd43ebb498d679f5e
- [ ] C3. A `cland verify --executor droplet` of the fix branch (diff selection) is green on Linux and runs the three files.

## Comments

### coord · 2026-10-14T17:16:00.811Z

Filed by the Coordinator from runs ba071efd and b1603160 (2026-10-14 17:15Z).

### impl-430 · 2026-10-14T17:21:41.702Z

Reproduced init database locking deterministically at the existing CLI seam: an overlapping BEGIN IMMEDIATE writer makes cland init exit 1 (database is locked). Setting Store busy_timeout before schema/WAL setup makes the same command pass. The other two narrowed original cases pass locally; continuing barrier-based diagnosis.

### impl-430 · 2026-10-14T17:30:14.970Z

Merge cleanup source contract confirmed (hub/src/hub/merge.ts): successful landing may return waiting for sessions and schedule deferred cleanup. A deterministic reconnecting worktree-holder reproduces the exact true !== false assertion, with cleanup=waiting for sessions in the result. Updating the test to assert that state, release its holder, await cleanup under the existing eventually bound, and include result+journal diagnostics. Coordinator approved this source/evidence route because original droplet fixtures were destroyed.

### rev-23 · 2026-10-14T17:42:08.188Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-430-1
commit: 564e7a4c840f803858990a4dd43ebb498d679f5e
scope: full

No high or medium Standards/Spec findings across five files. Store bounded busy timeout precedes WAL/schema; live key ownership protected by provider ID or name with aging unchanged. Tests pin contention/stale-name windows, settle fake acquisitions on assertion failure, and check merge's deferred cleanup state before eventual worktree+branch removal without weakening commit/push/squash assertions or deadlines. C1 named causes/red-green A-2472 and single shared commit verified; original merge fixture attribution follows Coordinator-approved source contract, awaiting Linux C3. C2 remains pending five macOS whole-file runs for each file (initial passes alone insufficient); C3 requires green same-head no-mode droplet run. Changed head after T-429 needs delta review. A-2478: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2478-t-430-source-review-sqlite-stable-key-ownership-and-deferred-cleanup.md.

Criteria: C1 verified.

### rev-23 · 2026-10-14T18:17:13.181Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-430-2
commit: 564e7a4c840f803858990a4dd43ebb498d679f5e
scope: evidence

C2 verified: A-2490 all15 raw whole-file logs/timestamps inspected, five init16/16, five executor-safety20/20, five merge50/50;430 cases,total zero failures/cancellations/skips/todo and every exit0. Serial macOS arm64 Node24.21.0; overlapping full suites A-2479/A-2489 green. C1/source A-2478 retained, no new findings. C3 Linux evidence and subsequent same-head local merge gate remain pending; this is not final readiness. A-2494: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2494-t-430-c2-verified-15-serial-whole-file-macos-passes.md.

Criteria: C1 verified, C2 verified.
