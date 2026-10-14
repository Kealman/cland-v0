---
id: T-411
kind: task
title: "Two explorer-compose tests fail on Linux droplets (card m/M topic binding): blocks the switch to droplet verification"
state: open
status: in progress
size: S
rank: 2350
labels:
  - v0.1.2
  - nvim
  - ready-for-agent
  - qa-found
assignee: null
parent: R-228
blocked_by: []
regression_of: T-355
topic: topic-251
branch: t/T-411-two-explorer-compose-tests-fail-on-linux
created: 2026-10-14T15:13:32.520Z
updated: 2026-10-14T15:14:08.764Z
---

## Summary

Two explorer-compose tests from T-355 fail deterministically on a Linux droplet: "card m includes its cursor line; M creates a bound topic then reuses it" (explorer-compose.test.ts:90 expects no topic and gets 'topic-3') and "m and M promote category work by message with the category container in the context". They pass on macOS in every integrated run. Once D28 moves verification to droplets, every Neovim-touching run fails on them, so this blocks the switch.

## Evidence

- T-347 C6 attempt 4 on 2026-10-14 (the Coordinator's scratch, A-2420 at f238d824): two c-8 lon1 droplets (linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5) ran nvim-only suites. Both runs failed exactly these two tests (runs 859ad4d6 and 04c1517c; logs in T-347's C6 evidence artifact).
- On macOS the same tests pass, including in integrated runs 5ba471df and b5d562f6.
- The failing assertion at line 90 is `assert.equal(<topic>, undefined)`, which got 'topic-3'. A topic exists where the test expects none, so this may come from test ordering, shared stub state or Linux timing.

## Acceptance criteria

- [ ] C1. The cause is established and written down: platform behaviour (path, locale, timing or ordering) or a test isolation gap, reproduced on Linux.
- [ ] C2. The fix makes both tests pass on Linux and macOS without weakening their assertions. If it's a product bug, the product is fixed.
- [ ] C3. One commit. The Linux proof is a nvim-only `cland verify --executor droplet` once T-347 is merged and executor droplets are configured, run by the Coordinator; until then, a reproduction in a Linux container or a description of the cause.
