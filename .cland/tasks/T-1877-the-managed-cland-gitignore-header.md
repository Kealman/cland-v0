---
id: T-1877
kind: task
title: The managed .cland/.gitignore header rewrite after a version bump moves the dev tree off its green covers before release
state: open
status: planned
size: S
labels: []
assignee: null
parent: E-1888
blocked_by: []
topic: null
branch: null
created: 2026-11-15T23:32:23.381Z
updated: 2026-11-16T07:31:25.173Z
---

## Summary

On 2026-11-15 the hub restarted on the 0.4.0 build (restart #76) and rewrote the managed header of `.cland/.gitignore` from "managed by cland 0.3.2" to "0.4.0". A release needs a clean root, so the Coordinator committed the header (2939ccc59). The committed tree then left the tree the green stage covers matched (d642982363 → 12278d46): tracker files under `.cland/tasks/` are excluded from that identity, but `.cland/.gitignore` is not. `cland release --item R-1530 --dry-run` refused with `release-t3: no green T3 covers release head`, and the release waited about 45 minutes for one more full release-occasion suite, because of a comment line.

## What to build

Choose and implement one fix. Either the managed header carries no version, so a version bump never rewrites it, or cover and release tree identity excludes `.cland/.gitignore` the same way it excludes the tracker files. Check the other managed files that cland rewrites on start, if any, and say which tree-identity rule covers each.

## Acceptance criteria

- [ ] C1. A hub restart on a new version leaves the dev tree's cover identity unchanged, shown by a test with a fake version bump (test).
- [ ] C2. Every file cland rewrites on hub start is listed in the item, with its tree-identity handling (test or doc).
