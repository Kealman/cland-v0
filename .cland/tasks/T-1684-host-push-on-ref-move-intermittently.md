---
id: T-1684
kind: task
title: host-push-on-ref-move intermittently reports 'native push identity unknown' after agent SIGKILL on Linux
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
regression_of: T-1609
topic: null
branch: null
created: 2026-11-05T06:46:38.762Z
updated: 2026-11-05T06:50:31.049Z
---

## Summary

`hub/test/host-push-on-ref-move.test.ts` fails intermittently on Linux x64 droplets. "killed producer without result stays named and fenced until a later successful leased head" and "interrupted admitted native push survives agent SIGKILL and recovery publishes only the current head" either fail with `watch …: native push identity unknown`, or, once, time out waiting 5 s for current-head publication. The file and `host/agent/ref-push.ts` were last changed by T-1609. macOS and Linux arm64 Docker never reproduced it.

## Evidence

- dev, periodic dev T3 92a80874 at c360484b (A-16807): the killed-producer case failed with 'native push identity unknown'. The other runs on dev passed: A-16739, A-16747, A-16773, A-16788.
- T-1613 heads: 6380ee28 at 42286ab7 (A-16761) failed both cases with identity unknown; 59a9a571 at d6d8c791 (A-16777) failed with the line 113 publication timeout; 3b59b7d5, 682f7d2e and the T-1613 batch passed.
- `observe` in ref-push.ts returns a bare unknown from four branches: receipt pending, candidate mismatch, receipt read error, unobservable target. T-1613 (if landed) adds a distinct cause per branch and failure-only boot, ledger and receipt diagnostics, so the next red names its branch.

## What to build

1. Name the branch that produces the unknown, and its cause, with a deterministic reproduction. Suspects: an ESRCH or /proc race on vanished descendants (an unobservable target), and a receipt-pending or ledger race after SIGKILL.
2. Fix it at the source. An unknown must be a real unknown, never a race in observation. Never weaken the fence or the assertion.

## Acceptance criteria

- [ ] C1. The failing branch and its cause are named with a deterministic reproduction (test, red before the fix).
- [ ] C2. After the fix, both cases pass with assertions and fences unchanged, and host-push-on-ref-move passes 20/20 on Linux under load (evidence).

## Comments

### coord · 2026-11-05T06:50:31.049Z

The hub's failing-file rerun 985870fe at the same head c360484b (A-16808, Linux x64, peak load 1.0) passed host-push-on-ref-move 4/4. That makes it red under full-suite load (dev-t3 peak 6.6) and green alone, the same load-sensitive pattern as T-1673. Fix it at the cause; never stop at "passes alone".
