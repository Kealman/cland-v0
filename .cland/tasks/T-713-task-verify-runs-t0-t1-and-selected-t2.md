---
id: T-713
kind: task
title: Task verify runs T0, T1 and selected T2, and T3 runs only in merge batches and occasions
state: open
status: backlog
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - nvim
assignee: null
parent: E-678
blocked_by:
  - T-711
  - T-712
  - T-707
  - T-708
  - T-688
topic: null
branch: null
created: 2026-10-16T19:59:43.795Z
updated: 2026-10-16T20:00:24.897Z
---

## Summary

This is the protocol switch (memo §5.5 step 4; decisions 1–2). A task's verify becomes the fast hermetic gate: T0 check (typecheck and test lint), T1 whole and T2 selected by coverage. T3 runs once per merge batch (T-711, T-712) and at occasions (T-714). The Implementer never waits on a real-process run again, and a process-level regression waits at most for its batch.

## What to build

- **The task plan.** A task verify plans the check step, T1 whole, T2 selected by coverage with T-688's fallbacks (a fallback runs all of T2, never T3), and the Neovim T2 files the diff selects, with the load gate on new T1 and T2 identities. It plans no T3 or T4 file. The result says `T3: in the merge batch` with the queue's state.
- **Who still gets T3.** The Coordinator's `all`, integrated `dev` runs and occasions keep their tiers (T-714).
- **The switch.** The same change sets `[merge] queue = true` in this repository's `.cland/config.toml`, so no merge lands without a batch. Projects without the setting keep today's behaviour.
- **Evidence.** The result carries the tier lines (T-681) the Reviewer reads: a green T0–T2 result at the reviewed head plus the batch landing is the merge evidence.

## Acceptance criteria

- [ ] C1. A task verify plans the check step, all T1 files and coverage-selected T2 files, and no T3 or T4 file, proved by a selection test over this repository's `tiers.json`.
- [ ] C2. A T2 coverage fallback plans all T2 files and still no T3 file, proved by a selection test.
- [ ] C3. The Coordinator's `all` and an occasion request still plan T3, proved by the same tests.
- [ ] C4. This repository's config sets `[merge] queue = true` in the same change, and a merge after it enqueues, proved by a config test.
- [ ] C5. The median task-run body (check through collection) over the first 20 droplet task runs after the merge is 8 minutes or less on c-8 at workers 2, recorded on this item from the run results.

## Blocked by

T-707 (the T3 scenario set) and T-708 (retired files), so that T3 is curated before task runs stop running it; T-688 (selection fallbacks).
