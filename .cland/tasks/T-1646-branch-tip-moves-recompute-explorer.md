---
id: T-1646
kind: task
title: Branch tip moves recompute explorer summaries and demo freshness for the whole tracker
state: open
status: in progress
size: M
labels: []
assignee: null
parent: E-1885
blocked_by: []
topic: topic-1630
branch: t/T-1646-branch-tip-moves-recompute-explorer
created: 2026-11-02T23:57:57.064Z
updated: 2026-11-18T17:45:06.632Z
---

## Summary

With about ten active sessions (8 implementers plus QA, all pushing branches), hub replies slowed to 8–15 s. `cland verify` submissions exited 75 with "no reply within 15 s" twice, at 21:35Z and 23:56Z on 2026-11-02, and a `verify queue` read took 8.3 s. The hub was at pid 3297, CPU 122%. Profile via SIGUSR1 plus a V8 CPU profile, 8 s, at 23:57Z:
- inclusive 39.8% `tracker/freshness.ts:251 refresh` → `tracker.ts:447/594 tipsMoved` → `#announceBatch` (38.7%) → `#refreshExplorer` (31.8%) → `#rawSummary` (26.6%);
- inside that: `#demoCurrent`/`#demoTasks` (about 11%), `#summaryCriteria`/`countCriteria` (9.5%), `index-db get/#hydrate` (13–16%);
- separately, `hub/inbox.ts:271 list` (19.5%) → `store.ts:1910 inboxMessages` (11.9%).

A second 6 s sample was 48% idle, with self time in SQLite `all` at 19.5% and `readLease` at 3.7%. So the cost comes in bursts tied to tip moves. Each batch of moved tips appears to rebuild explorer raw summaries, epic demo freshness and criteria counts beyond the items whose branches moved.

## What to build

Make a tip-move refresh proportional to the moved branches: recompute only the affected items, their ancestors' rolled-up counts and demo freshness for the epics whose surfaces they touch, with incremental criteria counts. Keep it off reply paths (rule 23). Check whether `inbox.list` repeats a full query per call where a cached or incremental view would do.

## Acceptance criteria

- [ ] C1. A synthetic tracker the size of the live one (about 1,650 items, 10 active branches moving every few seconds) keeps a tip-move refresh under a stated work-count budget proportional to the moved branches (test).
- [ ] C2. Hub replies (`verify queue`, `task.view`) stay under 1 s at p95 during that churn (test).
- [ ] C3. Explorer, criteria counts and demo freshness results are unchanged (test).

## Comments

### impl-1646 · 2026-11-18T17:45:06.632Z

Consumer search completed across CLI, web, Neovim, demo gate, shared wire, shipped skills/briefs, frozen protocol/tracker fixtures and tests in every tier. Inventory staged in evidence/T-1646-consumers.md for publication. Internal invalidation only; preserve existing wire shapes and exact results. Baseline and all tests still unexecuted under cover-quiet; source unchanged.
