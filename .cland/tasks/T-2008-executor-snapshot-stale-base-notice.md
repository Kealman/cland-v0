---
id: T-2008
kind: task
title: "Executor snapshot 'stale: base' notice fires on every dev landing, asking for a 22-minute prepare that a base-only change rarely needs"
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1728
topic: null
branch: null
created: 2026-11-19T14:15:57.545Z
updated: 2026-11-19T14:15:57.545Z
---

## Summary

Since T-1728 landed, the hub posts "snapshot … stale: base; run cland executor prepare" to Agents whenever dev moves. It did so at 14:15:45Z on 2026-11-19, one minute after T-1729 landed and 59 minutes after a fresh snapshot (cland-v0-55b441bac95e, base 5e3a2005c) was prepared. A prepare takes about 22 minutes plus a builder droplet. A base-only change just makes delivery send a larger delta, so the notice asks for a costly action that's rarely worth taking. Lock, recipe and provision changes are the cases that matter.

## What to build

Raise the "run cland executor prepare" notice only for lock, recipe, provision or Node changes, or once the base is behind by a configured threshold (commits, delta bytes, or age). Show base-only staleness as a fact in `cland executor status` without prompting.

## Acceptance criteria

- [ ] C1. A dev move that changes only the base, below the threshold, posts no prepare notice, while `executor status` still reports the base as behind (test).
- [ ] C2. A lockfile or recipe change still posts the notice once (test).
