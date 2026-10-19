---
id: T-823
kind: task
title: "A closed epic stage reopens when dev moves: plan show re-evaluates stage covers against the current tree"
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-714
topic: null
branch: null
created: 2026-10-19T01:32:56.569Z
updated: 2026-10-19T01:32:56.569Z
---

## Summary

`cland task plan show E-678` reported stage 1 ("queue entries, occasions and budgets") closed on 2026-10-18 at 20:04Z, after the green Linux 8695f749 and macOS ca6342e6 stage runs at one tree. By 01:35Z 2026-10-19, after later merges, it reported stage 1 open again with "stage cover missing Linux droplet, macOS" at the current tree. A closed stage reopens whenever dev moves, so every stage has to be re-covered at the same tree before any later stage can count as closed.

## Acceptance criteria

- [ ] C1. Once a stage's cover is complete, the hub records the stage closed, naming the tree and both run ids, and `plan show` keeps reporting it closed after later dev commits; a component test closes stage 1, moves dev, and shows stage 1 closed and stage 2 open with its own cover state.
- [ ] C2. Advancing to the next stage uses the recorded closure, never a re-evaluation against the current tree.
