---
id: T-1008
kind: task
title: "The Neovim workbench settles: no periodic full re-reads"
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1006
blocked_by: []
topic: topic-756
branch: t/T-1008-the-neovim-workbench-settles-no-periodic
created: 2026-10-20T17:01:24.864Z
updated: 2026-10-20T17:02:01.675Z
---

## Summary

The Neovim workbench settles after startup. Today it re-reads `hub.status`, `task.list`, `topic.history`, `events.list`, `session.list`, `artifact.list`, `rule.list` and `account.list` about every 30 s and never settles. Its header shows "no coordinator" and "sessions 0" until every read finishes.

## What to build

- Find what drives the 30 s full re-read: a timer, an event storm (for example tracker events caused by `.conflict` capture writes), or a failed read that retries everything. Name it with evidence in the item topic.
- After startup, apply hub events (`task`, `session`, `topic`, `message`, `event` frames) to the local state. Re-read only the object an event names, never the whole list.
- Startup reads run independently. The header shows the Coordinator and the sessions as soon as `session.list` answers, without waiting for `task.list`.
- A reconnect re-reads once, then settles.

## Acceptance criteria

- [ ] C1. The cause of the 30 s re-read loop is named in the item topic with evidence from a run against a copy of the live tracker (local evidence).
- [ ] C2. After startup, with a fake clock advanced 10 minutes and no hub change, Neovim sends none of `task.list`, `topic.history`, `events.list`, `session.list`, `artifact.list`, `rule.list` or `account.list` (test counting frames).
- [ ] C3. A `task` event updates the explorer's row without a full `task.list` (test).
- [ ] C4. With `task.list` delayed, the header shows the Coordinator and the session count as soon as `session.list` answers (test).
- [ ] C5. A reconnect re-reads each list once and then sends no further full reads (test).
- [ ] C6. `nvim/README.md` describes what the workbench reads at startup and how it stays current.
