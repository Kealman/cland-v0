---
id: T-2065
kind: task
title: 'A `cland merge` right after a clear review verdict can refuse "review-pending: … still checking freshness; try again", a user-facing retry papercut'
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1725
branch: t/T-2065-a-cland-merge-right-after-a-clear-review
created: 2026-11-23T18:46:17.308Z
updated: 2026-11-24T09:02:55.897Z
---

## Summary

Found by impl-2064 on T-2064 (2026-11-23). An immediate public merge after a clear `task.comment` review verdict can return `review-pending: T-n: review is still checking freshness; try again`, because review freshness settles asynchronously. It reproduces through the UI dispatcher, and the CLI calls the same merge gate. Under load the window is long enough to hit by hand.

## What to build

Either have merge admission wait a short, bounded, load-scaled time for an in-flight freshness check on the same head before refusing. Or keep the refusal and name what the user should wait for (the item turning ready) and how to see it. Keep the refusal for a review that's genuinely stale.

## Acceptance criteria

- [ ] C1. `cland merge T-n` issued right after a clear verdict either lands, or refuses with guidance naming the ready state, without a bare "try again", while a truly stale review still refuses (test).
