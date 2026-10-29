---
id: T-1440
kind: task
title: web Items tree claims-and-holds case times out on task.edit at 5 s once in a loaded task run
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1423
topic: null
branch: null
created: 2026-10-29T12:24:33.567Z
updated: 2026-10-29T12:24:33.567Z
---

## Summary

`web/test/items.test.ts:134 :: claims and verifier holds arrive in the task and ancestor rows` failed on T-1439's mode-free run c6ea21e7 (A-13685, Linux c-8 nyc1) with `Error: no result for task.edit within 5000ms` (harness.ts:682) after 7.7 s; its parent case failed with it. On dev at 76d63539 it passes 5/5 alone on macOS. This is the third Items-tree hub-request timeout under load: T-1419 (a verifier-hold row within 3 s) and T-1423 (`task.comment` at 5 s) were fixed per case.

## What to build

Find why a hub request from the Items-tree fixture can wait more than 5 s under a loaded Web shard: the copied live tracker, the hub's request queue, or the browser. Fix the cause for the whole file rather than per case, or bound the harness wait by the hub's observed progress. Keep every assertion.

## Acceptance criteria

- [ ] C1. The claims-and-holds case passes 5/5 under two busy workers, and so do the cases fixed by T-1419 and T-1423.
- [ ] C2. The item names the cause, with a measurement of where the 5 s went.
