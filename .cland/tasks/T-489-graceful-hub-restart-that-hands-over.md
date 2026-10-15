---
id: T-489
kind: task
title: Graceful hub restart that hands over state, so a code change costs seconds of downtime
state: open
status: backlog
size: L
labels:
  - needs-triage
assignee: null
parent: C-327
blocked_by: []
topic: null
branch: null
created: 2026-10-15T11:30:51.761Z
updated: 2026-10-15T11:30:51.761Z
---

## Idea

A graceful hub restart that hands its state over to the new process: queued and running verifications, droplet leases, session connections and pending deliveries. A code change would then cost seconds of downtime, instead of waiting for an empty verify queue and no droplets in flight. Today each hub restart is a coordinated pause of the whole crew; on 2026-10-15 the T-483 hotfix restart and the D31/D33 config changes all waited on it.

Raised by the human with D34, alongside the `cland hub reload` task in E-425, which covers config changes only.
