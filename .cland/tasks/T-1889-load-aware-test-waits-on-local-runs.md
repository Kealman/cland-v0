---
id: T-1889
kind: task
title: Load-aware test waits on local runs
state: open
status: in progress
size: S
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1534
branch: t/T-1889-load-aware-test-waits-on-local-runs
created: 2026-11-16T07:29:44.705Z
updated: 2026-11-16T07:32:46.300Z
---

## Summary

`until` scales only by `CLAND_TEST_LOAD_FACTOR` (default 1 locally, 2 on droplets), and `eventually` never scales. Nothing sets the factor. run-suite derives a factor from load and workers for setup waits, as `remoteWaitMs` already does. Source: §7 #2 and #1.

Kind: product (test infra). Triage ticket H-1 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Acceptance criteria

- [ ] C1. run-suite exports a load factor ≥ 1 from the 1-minute load and workers on local and droplet runs, and `until` and `eventually` setup waits use it (test).
- [ ] C2. Waits on an injected clock or a named behaviour bound keep their exact value (test).
- [ ] C3. Two macOS covers before and after name the load-timing failures each had (evidence).

## Dependencies

none; lands first in A1 stage 1 (`hub/test/until.ts`, `harness.ts`)
