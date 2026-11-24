---
id: T-2003
kind: task
title: Item verifies bundle the live worktree after T0, so an untracked file written meanwhile fails delivery
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: null
branch: null
created: 2026-11-19T10:53:04.604Z
updated: 2026-11-24T09:00:13.759Z
---

## Summary

An item `cland verify` bundles the live worktree after its local T0, so any untracked file written into the worktree between T0 and delivery fails the run with "dirty or changed worktree cannot be bundled for droplet". T-1728's run 81d5f3dc died that way on 2026-11-19 after a native test log landed in the worktree. T-1652 already made soak and periodic runs bundle the submitted commit's objects instead of the live root.

## What to build

Item verifies bundle the head commit that was submitted, captured at admission, from Git objects. Untracked or later working-tree changes neither enter the bundle nor fail delivery. A head that moved after admission is still refused, with its own message. Report-only notes may name untracked files seen at bundling.

## Acceptance criteria

- [ ] C1. An untracked file created in the item worktree after T0 doesn't fail or enter the delivered bundle; the droplet receives exactly the submitted commit's tree (test with a fake executor).
- [ ] C2. A commit made to the item branch after admission is refused with a distinct "head moved" diagnostic (test).
- [ ] C3. Every bundle path is listed with whether it pins the submitted commit (rule 41), building on T-1652's census.
