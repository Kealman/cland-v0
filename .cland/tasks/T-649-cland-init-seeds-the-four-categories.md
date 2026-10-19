---
id: T-649
kind: task
title: "cland init seeds the four categories: Bugs, Tech debt, Follow-ups and Ideas"
state: open
status: in progress
size: S
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
updated: 2026-10-19T01:56:05.750Z
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

- [ ] C1. After `cland init` in an empty folder, `cland task list --kind category` lists Bugs, Tech debt, Follow-ups and Ideas, each with no parent (init-categories.test.ts, on the scratch machine of ticket T-639).
- [ ] C2. Their four item files are in init's first commit, and `git status --porcelain` stays empty.
- [ ] C3. A second `cland init` creates no category, and the project's item count is unchanged.
- [ ] C4. In a project that already has an open root category Ideas, init creates only the other three and leaves Ideas byte-identical.
- [ ] C5. `cland update` on a project without categories creates none.
- [ ] C6. `planMigration` and init read the same constant (a unit test compares the titles migrate seeds with init's).
