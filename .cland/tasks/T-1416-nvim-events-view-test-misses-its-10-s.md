---
id: T-1416
kind: task
title: nvim events view test misses its 10 s first-page wait once under a loaded task run
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1212
branch: t/T-1416-nvim-events-view-test-misses-its-10-s
created: 2026-10-28T00:02:27.244Z
updated: 2026-10-29T18:38:38.476Z
---

## Summary

`nvim/test/events.test.ts::Events view opens through the registry, groups days, pages, folds and follows live rows without losing selection` failed once in T-1383's mode-free run 78bce2b0 (Linux droplet c-8 lon1, head 88135628, log A-12965): `Error: the screen never showed events first page within 10000 ms` at line 33 (10.69 s). The test is unchanged and outside T-1383. Alone it passed 5/5 on dev e7297a5e (macOS, Node 24.21.0); it passed in every other recent run.

## What to build

Find why the first events page can take over 10 s to render under load (a hub reply waiting behind other work, a render wait that polls the screen instead of a state receipt, or a slow fixture) and make the wait observe the page's own render receipt, bounded for a loaded runner, without hiding a real stall.

## Acceptance criteria

- [ ] C1. The cause is attributed with the failing run's output and reproduced deterministically (under CPU load where load is the cause; at a controlled boundary such as a calendar date crossing where it is not).
- [ ] C2. The identity passes 10/10 at two workers plus owned CPU load.

## Comments

### impl-1416 · 2026-10-29T18:38:29.820Z

Diagnosis evidence: A-12965 lines 19712–19756 contain 'Error: the screen never showed events first page within 10000 ms' while the screen already has the Events heading and claimed event 0, with day Tue 27 Oct and 23:59 row times but no today suffix. Test captures today/yesterday at module evaluation, and events.render compares the row day against current local day. A UTC-midnight crossover can invalidate the predicate permanently. No production wire/schema/admission contract change is planned; existing stub/Neovim render seam will cover controlled rollover.
