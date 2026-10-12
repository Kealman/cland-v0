---
id: T-238
kind: task
title: What planned means, and release scope showing only the release's own items
state: closed
status: done
labels:
  - v0.1.2
  - ready-for-human
assignee: null
parent: T-228
blocked_by: []
topic: null
branch: null
created: 2026-10-11T17:49:01.112Z
updated: 2026-10-12T11:35:33.226Z
---

## Open question

Should 'planned' be set automatically (the stage in work of the epic plan, the top-N by rank, what the Coordinator has queued), or must the Coordinator's clause mark it? Also: release scope listed other containers and done items under unscheduled. Should it show only the release's own items, with the rest under the 'all' filter or a count line (observation 3)? Relates to spec §3.2.

Source: the human's observations during the v0.1 build, memory note cland-v011-scope (2026-10-10). Backlog by decision D21: needs the human's decisions or a design grilling before it becomes tickets.

## Comments

### human · 2026-10-12T08:59:32.477Z

Decided (2026-10-12, round 2): planned derives from the epic plan: the items of the current stage are planned, the rest of the epic stays backlog, and the hub moves the next stage to planned when a stage completes; without a plan the Coordinator or the human sets planned by hand as before. The release scope shows only the release's own items; other containers and unscheduled are reached through the all filter and one count line at the bottom. Recorded in docs/spec/v0.1.2.md §3.2.

### human · 2026-10-12T11:35:33.226Z

Decided on 2026-10-12: recorded in docs/spec/v0.1.2.md §3.2; built by T-270 Status, fields and instrumentation
