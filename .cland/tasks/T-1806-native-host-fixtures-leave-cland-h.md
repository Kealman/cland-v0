---
id: T-1806
kind: task
title: Native host fixtures leave cland-h-* socket directories in /tmp, and /tmp holds about 90 historical native-fixture roots
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-10T18:13:37.516Z
updated: 2026-11-10T20:55:02.899Z
---

## Summary

A run of `hub/test/host-create-ready.test.ts` (12/12 pass, macOS, 2026-11-10 18:13Z, at T-1780's 678733ec5) left ten new `cland-h-*` entries in `/tmp`, though the per-user TMPDIR and the fixture roots (`hc-`, `lwb-`) stayed 0 → 0. Host socket directories created outside the fixture's scratch root therefore survive the file. `/tmp` also holds about 90 older native-fixture roots (`cland-suite-*`, `hc-`, `sf-`, `cland-ssh`, receipt directories); the newest seen was dated 2026-11-09 16:51Z. They are the T-1676 class and belong to no running item.

## Evidence

- impl-1780's exact before/after name sets in topic-1467: `/tmp` went 17929 → 17939, ten added `cland-h-*`, none removed.
- impl-1778's and impl-1779's scoped inventories (83, then 86 historical roots); the stage-2 brief draft's census found 92 `cland-suite-*` entries.

## Acceptance criteria

- [ ] C1. Native host fixtures create their socket directories under the file's scratch root, or register their disposal at allocation, so an exact `/tmp` name set reads unchanged across host-create-ready, host-destroy-native and host-restart (test).
- [ ] C2. A one-off cleanup removes only the historical roots that a census proves dead (no live process, no open file, owner absent), by literal path, and keeps a receipt listing each path (test).
- [ ] C3. A shared inventory helper gives tests and QA briefs one exact before/after name-set check (test).

## Comments

### coord · 2026-11-10T20:55:02.899Z

More evidence (qa-678, E-1535 stage-2 QA at 121ec8bef, 2026-11-10 20:54Z): 21 new dead `/private/tmp/cland-h-*` directories across native rows 60 and 64–73, each holding agent.sock, ctl.sock and git.sock or empty, with no open PID. The producer is `records.ts` `hostPaths` (lines 66–74), reached through `createHost` from `host-create-fixture.ts` and from `host-provision-gate.test.ts` (`tempProject(t,'pg-','/tmp')`); the fixtures' own roots are removed. C1 should place `hostPaths`' socket directory under the caller's scratch root, or register its disposal at allocation.
