---
id: T-1202
kind: task
title: Merge batches whose candidate touches web/ also run the Web tier
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1193
blocked_by: []
topic: null
branch: t/T-1202-merge-batches-whose-candidate-touches
created: 2026-10-24T06:46:04.922Z
updated: 2026-10-24T09:08:06.998Z
---

## Summary

Batches run T1 only; a Web regression from two members green alone could land red (T-1136 with T-1111 in v0.2). Retro A-10321, triage A-10327.

## Acceptance criteria

- [ ] C1. A batch whose candidate has a web/ path runs the Web tier after T1, and is red and bisected when Web fails, shown with two members green alone and red together (test).
- [ ] C2. The batch result names the Web step and its duration (test).
