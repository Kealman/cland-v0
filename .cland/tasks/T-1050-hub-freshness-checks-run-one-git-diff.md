---
id: T-1050
kind: task
title: Hub freshness checks run one git diff-tree per commit for old epic demos, starving stage checks for minutes after a restart
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-21T12:59:03.163Z
updated: 2026-10-21T12:59:03.163Z
---

## Summary

impl-1049 found (T-1049, topic-799, 2026-10-21) that the hub's `Freshness.#work` serializes every freshness want. An older epic demo's `#compute`, via `epicDemoFreshness`, scans the intervening commits with one `git diff-tree` per commit, and runs before the stage ancestry checks. On a copy of the live project, the first 5 s ran 273 diff-tree calls and 1 rev-parse; by 10 s it had run 601 and still 1. After hub restart #37, stage covers stayed "missing Linux droplet" for about 16 minutes until the queue drained.

## What to build

Stage and merge-gate freshness facts are answered within seconds after a restart:
- Epic-demo freshness computes changed files over a range in one Git call, such as `git log --name-only` or `git diff --name-only <base>..<tip>`, instead of one diff-tree per commit.
- Stage and merge-gate ancestry wants run ahead of background demo scans, or in their own lane.
- Closed epics' demos are not rescanned at start.

## Acceptance criteria

- [ ] C1. On a generated repository with 1,000 commits since an old epic demo, a stage ancestry want issued after start resolves within 2 s, while the demo scan is outstanding (test).
- [ ] C2. Epic-demo freshness gives the same `current` and conflicting-file results as before, with at most a handful of Git calls per demo (test counting Git invocations).
- [ ] C3. On a copy of the live project, after a hub start, `task plan show` reports stage covers within 10 s (local evidence).
