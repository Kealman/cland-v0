---
id: T-1858
kind: task
title: Paid host offers can act on pool terms that changed after the human's yes
state: open
status: backlog
size: M
labels: []
assignee: null
parent: E-1884
blocked_by: []
topic: null
branch: null
created: 2026-11-14T18:10:52.958Z
updated: 2026-11-16T07:29:15.848Z
---

## Summary

Setup's paid offers (T-1831: `cland host prepare agents` and `cland login add <harness> --pool agents`) show the builder or pool terms (size, region, declared price) and then call host.prepare or login.add, which read the current config by pool name. If the config changes between the human's yes and the effect, the paid machine can differ from what was shown. T-1831 re-reads the terms after the yes and stops with `open` when they changed, which narrows but does not close the window. Pool config writes in T-1830 also have no compare-and-set. Found by T-1831's reviewer.

## What to build

Optional expected paid terms carried from the consenting client into the host.prepare and login.add admission owners, validated there against the same captured config used for the effect. A mismatch is refused with the current terms named, and nothing is started. Pool config writes take an expected prior value (compare-and-set). Existing callers that pass no expected terms keep today's behaviour.

## Acceptance criteria

- [ ] C1. host.prepare and login.add with expected terms that no longer match the pool's config refuse with the current terms and start no machine; without expected terms they behave as today (test).
- [ ] C2. A pool config write with a stale expected prior value is refused without writing (test).
