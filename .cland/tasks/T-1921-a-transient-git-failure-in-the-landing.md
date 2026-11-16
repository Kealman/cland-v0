---
id: T-1921
kind: task
title: A transient git failure in the landing lint drops a green batch member and forces the remaining members to rerun the full batch on a new tree
state: open
status: planned
size: S
labels: []
assignee: null
parent: E-1883
blocked_by: []
topic: null
branch: null
created: 2026-11-16T16:50:10.827Z
updated: 2026-11-16T22:18:05.721Z
---

## Summary

On 2026-11-16 at 16:48Z, batch db99ae9e (T-1764, T-1861, T-1867, T-1904) went green on run c9c83d2d: T0, T1 and T3 exit 0, 3,833 pass, 44 min, $0.18. At landing the queue dropped T-1764 with `merge-test-lint: hub/test/lint-baseline.json:1 [lint-baseline] cannot read test lint policy: Error: Command failed: git cat-file --batch`. The root repository read that blob fine with `git cat-file --batch-check` a minute later (core.bare false), and the hub was under heavy CPU load at the time (T-1919). The hub then re-batched the other three members as b6b8ed80 on a new tree, which means a full rerun: the green result was discarded for all four items because of one failed git read.

## What to build

The landing lint tells an infrastructure failure (git or child-process errors reading the policy or baseline) apart from a lint finding. On an infrastructure failure it retries the read a bounded number of times, then holds the batch as blocked with the cause, keeping the green result. It never drops a member or rebuilds the batch for it. A genuine lint finding keeps today's drop behaviour.

## Acceptance criteria

- [ ] C1. A fake git that fails `cat-file --batch` once during the landing lint, then succeeds, lands every member of a green batch with no new batch run (test, red before the fix).
- [ ] C2. A persistent read failure leaves the batch blocked with its green result and the cause named, drops no member, and a genuine lint finding still drops its member (test).
