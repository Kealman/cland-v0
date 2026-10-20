---
id: T-1007
kind: task
title: The Neovim explorer loads item summaries, open items first
state: open
status: review
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1006
blocked_by: []
topic: topic-755
branch: t/T-1007-the-neovim-explorer-loads-item-summaries
created: 2026-10-20T17:01:23.939Z
updated: 2026-10-20T17:24:44.265Z
---

## Summary

The Neovim explorer loads item summaries without bodies: open items first, closed items when the human asks for them. Today a single `task.list` sends all 1,005 items with their full bodies (1.8 MB), and the hub and Neovim both choke on it.

## What to build

- `task.list` gets a summary projection: id, kind, title, state, status, size, labels, parent, blockers, claim, the latest verdict of each kind, and criteria counts. No body, no comments, no verdict history.
- The projection takes a state filter. The explorer asks for open items first, and fetches closed items only when the human expands a closed group or searches for them.
- Opening an item's card reads its body through `task.view`.
- A `task.list` without the projection answers as it does today, so the CLI and `--json` users keep working.
- Measure the projection's bytes on a copy of the live tracker and post the figure in the item topic.

## Acceptance criteria

- [x] C1. The summary projection returns no body, comments, verdict history, plans or verification, and on a 1,000-item fixture tracker with 100 open items the open-only first payload stays under 60 KB, with the all-items projection bytes recorded in the test output (test).
  - done: impl-1007 · 2026-10-20T17:18:25.842Z
- [x] C2. On start the explorer requests open items only, and closed items are requested when the human expands the closed group or searches (test on recorded frames).
  - done: impl-1007 · 2026-10-20T17:24:35.687Z
- [x] C3. Opening an item's card reads its body with `task.view` and renders it (test).
  - done: impl-1007 · 2026-10-20T17:24:36.312Z
- [x] C4. `task.list` without the projection answers as today, and the CLI's `task list --json` output is unchanged (test).
  - done: impl-1007 · 2026-10-20T17:18:27.625Z
- [x] C5. The projection's bytes and compose time on a copy of the live tracker are posted in the item topic (local evidence).
  - done: impl-1007 · 2026-10-20T17:18:28.165Z
- [x] C6. `hub/README.md` documents the projection, and `nvim/README.md` documents lazy loading of closed items.
  - done: impl-1007 · 2026-10-20T17:18:28.791Z

## Comments

### impl-1007 · 2026-10-20T17:10:38.540Z

Implementation progress: summary/open snapshot, demand-loaded closed summaries and task.view-backed card details are implemented; default request path is unchanged. T1 request/list test and new T2 recorded-frame scenarios are in place. Copied-live-tracker probe (1,011 items, macOS arm64/local): initial 112 open summaries 40,618 bytes, 16.418 ms median compose+serialize; all summaries 538,202 bytes/105.776 ms; default 1,459,822 bytes/118.859 ms. Probe excludes socket/visibility and is not a startup/suite pass. Full evidence artifact posted in item topic.

### rev-26 · 2026-10-20T17:21:55.010Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261020-1007-source-1
commit: 2a3af4c83556bf1848e8e8dafc46d8c5d9ead1c3
scope: full
findings: [{"severity":"medium","text":"Closed snapshot merge appends a stale closed row after a globally applied reopening event retained its open row; journal replay updates only the first duplicate and explorer by-id can still select the stale closed row. Merge by canonical identity and test held closed snapshot plus reopening event.","file":"nvim/lua/cland/init.lua","line":217},{"severity":"medium","text":"Criterion round_of uses latest-only summary verdicts overlaid on task.view detail, so marks from an earlier review run display r— although full history is available. Resolve historical rounds from detail and test compact latest summary plus earlier marked run.","file":"nvim/lua/cland/explorer_card.lua","line":185}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear. A-7782 records separate Standards/Spec audit against fixed 30fde40c base. Two medium Spec findings: closed-list snapshot installation duplicates an item reopened during the request under Client:snapshot's actual global-plus-journal contract, and detailed card criteria use compact summary verdicts to resolve historical runs. Preserve default CLI shape, payload bound and blocker events while correcting both boundaries with recorded component regressions. No independent Standards finding. Existing C1 projection test, C4 CLI JSON equality, C5 qualified copied-tracker measurements and C6 matching docs were inspected, but no verification marks settled on this failed source pass. A-7774 is a local targeted summary; retained original outputs requested without transcription reruns. T-1008's separate refresh loop remains outside scope. No Reviewer tests, edits or reproduction claims.

Criteria: C2 failed (Closed snapshot replay can leave duplicate open/closed rows for an item reopened while the snapshot is pending.), C3 failed (Task-view-backed cards lose historical criterion verdict rounds because latest-only summary verdicts overwrite detailed history.).
