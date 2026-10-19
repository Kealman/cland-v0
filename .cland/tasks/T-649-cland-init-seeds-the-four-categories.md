---
id: T-649
kind: task
title: "cland init seeds the four categories: Bugs, Tech debt, Follow-ups and Ideas"
state: closed
status: done
size: S
criterion_seq: 6
labels:
  - v0.1.4
  - init
assignee: null
parent: E-612
blocked_by:
  - T-646
topic: topic-544
branch: t/T-649-cland-init-seeds-the-four-categories
created: 2026-10-16T16:24:00.181Z
updated: 2026-10-19T02:34:21.423Z
closed: 2026-10-19T02:34:21.423Z
---

## Summary

Every role clause files work into the categories, yet a new project has none: only `cland task migrate` seeds them (v0.1.2 §3.10). `cland init` now seeds the four, Bugs, Tech debt, Follow-ups and Ideas, so a new project's first `cland task list --kind category` lists them, and an init that makes the first commit includes them in it (spec v0.1.4 §3.2, "Categories"; Q-600 resolution 3).

## What to build

- **One list.** The four titles become one exported constant, used by `planMigration` in `hub/src/tracker/migrate.ts` and by init, so the two never drift.
- **The seeding**, in `hub/src/init/provision.ts` after `.cland/tasks/` exists and before ticket T-646's first commit: each title missing as an open root category is created through the tracker's own create path (the `Tracker` over the project's `hub.db`, as `provision` already opens the store for the General and Agents topics), never as a hand-written item file, so ids come from the tracker's shared numbering (`C-1` to `C-4` in a new project). A title already present as an open root category is kept; nothing is renamed, converted or closed.
- **Init only.** `cland update` does not seed.
- **The report** names each category created, or `unchanged` with "the four categories are present".
- **Docs.** The hub README's init section and managed set list the categories.

## Acceptance criteria

- [x] C1. After `cland init` in an empty folder, `cland task list --kind category` lists Bugs, Tech debt, Follow-ups and Ideas, each with no parent (init-categories.test.ts, on the scratch machine of ticket T-639).
  - done: impl-649 · 2026-10-19T02:02:48.679Z
  - verified: rev-30 [reviewer] · run rev-20261019-649-final · 2026-10-19T02:34:14.539Z · commit 58038de6100a2432bd5a817b5b2549aed0e14cdf
- [x] C2. Their four item files are in init's first commit, and `git status --porcelain` stays empty.
  - done: impl-649 · 2026-10-19T02:02:49.356Z
  - verified: rev-30 [reviewer] · run rev-20261019-649-final · 2026-10-19T02:34:14.539Z · commit 58038de6100a2432bd5a817b5b2549aed0e14cdf
- [x] C3. A second `cland init` creates no category, and the project's item count is unchanged.
  - done: impl-649 · 2026-10-19T02:02:50.032Z
  - verified: rev-30 [reviewer] · run rev-20261019-649-final · 2026-10-19T02:34:14.539Z · commit 58038de6100a2432bd5a817b5b2549aed0e14cdf
- [x] C4. In a project that already has an open root category Ideas, init creates only the other three and leaves Ideas byte-identical.
  - done: impl-649 · 2026-10-19T02:02:50.582Z
  - verified: rev-30 [reviewer] · run rev-20261019-649-final · 2026-10-19T02:34:14.539Z · commit 58038de6100a2432bd5a817b5b2549aed0e14cdf
- [x] C5. `cland update` on a project without categories creates none.
  - done: impl-649 · 2026-10-19T02:02:51.276Z
  - verified: rev-30 [reviewer] · run rev-20261019-649-final · 2026-10-19T02:34:14.539Z · commit 58038de6100a2432bd5a817b5b2549aed0e14cdf
- [x] C6. `planMigration` and init read the same constant (a unit test compares the titles migrate seeds with init's).
  - done: impl-649 · 2026-10-19T02:02:51.998Z
  - verified: rev-30 [reviewer] · run rev-20261019-649-final · 2026-10-19T02:34:14.539Z · commit 58038de6100a2432bd5a817b5b2549aed0e14cdf

## Comments

### impl-649 · 2026-10-19T02:00:44.079Z

Implemented category seeding through Tracker.create before the first commit, with DEFAULT_CATEGORIES shared by init and planMigration. Test-first failures observed for empty tracker seeding, first-commit membership, already-provisioned category membership and custom ladders. Coordinator decision: when category is not a configured root, preserve the ladder and report skipped. Host typecheck and lint pass; targeted checks underway before source review. Init-only options keep update and generic provisioning fixtures from seeding.

### rev-30 · 2026-10-19T02:06:53.968Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-649-source
commit: 58038de6100a2432bd5a817b5b2549aed0e14cdf
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no Standards or Spec findings. A-5719 records the production, async-caller and fixture audit. Shared category titles, Tracker.create seeding before first commit, byte-preserved existing roots, update exclusion and Coordinator-authorized custom-ladder skip behavior are consistent. C1–C6 remain unverified pending accepted exact-head post-clear runtime evidence; QA scope none.

### impl-649 · 2026-10-19T02:33:50.452Z

Exact-head post-source-review verification 49e4d2f6-a11d-464d-8a19-d22368124b89 passed at 58038de6100a2432bd5a817b5b2549aed0e14cdf: 2382 passed, 5 skipped, 0 failed. Configured droplet executor, Linux x64 / Node v24.21.0 / Neovim v0.12.5, c-8 lon1, lifetime 1565s, cost $0.1087. Durable log A-5726. Head unchanged; awaiting Reviewer's final same-head verdict. No further run requested.

### rev-30 · 2026-10-19T02:34:14.539Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-649-final
commit: 58038de6100a2432bd5a817b5b2549aed0e14cdf
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear from source A-5719 and accepted exact-head gate 49e4d2f6/A-5726; raw evidence audit A-5728. Hub-only plus Neovim smoke: 2382 passed, 5 skips, zero failures/cancellations. Category 7/7, first-commit 9/9 and all 80 corresponding repetition bodies pass; changed init/role/worktree/doctor carriers pass. Exact roots, first-commit membership/clean status, repeat count, byte-preserved Ideas, update exclusion and shared migration titles established. Custom-ladder exception remains covered. Three known T-803 report-only trips and other diagnostics remain disclosed. No findings; C1–C6 verified; QA scope none.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-19T02:34:21.423Z

Merged 12d3c5abdeffe4866a7e99304add5eb1149befe1 onto dev.
