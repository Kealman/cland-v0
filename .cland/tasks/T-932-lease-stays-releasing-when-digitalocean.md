---
id: T-932
kind: task
title: Lease stays 'releasing' when DigitalOcean returns a destroying droplet with empty tags (identity guard refuses; demo lease 3781f5d9)
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-20T03:00:27.589Z
updated: 2026-10-20T03:00:27.589Z
---

## Summary

E-424's demo lease 3781f5d9 (droplet cland-v0-3781f5d9, id 610730338) was asked to stop at about 02:56Z on 2026-10-20. hub.log shows three `executor-release-identity-recheck` events at 02:56:49–54Z: DigitalOcean returned the droplet with matching id and name but `tags: []` instead of `["cland","cland-p-8a978a214ba5"]`. Then came `executor-release-unconfirmed` at 02:57:01Z: the T-462 identity guard refused to confirm it. DigitalOcean listed no cland droplet at 02:59Z, so the droplet was destroyed anyway, but the hub's lease row stayed "releasing" until its 03:50Z deadline. That holds a remote slot and its reserved spend.

## What to build

While a release is in progress, treat matching id and name with an empty tags array as a droplet being destroyed (DigitalOcean drops tags during destroy). Confirm release when a later list or get shows the id gone. Keep the guard strict for any non-empty, mismatched tag set.

## Acceptance criteria

- [ ] C1. A fake-provider T2 test: during release, a get with empty tags followed by a 404 confirms release and frees the slot and the reservation; a get with foreign tags still refuses.
- [ ] C2. A mode-free verify at the reviewed head is green.
