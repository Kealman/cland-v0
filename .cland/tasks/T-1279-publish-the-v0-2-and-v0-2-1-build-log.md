---
id: T-1279
kind: task
title: Publish the v0.2 and v0.2.1 build-log post on cland.app
state: closed
status: done
size: XS
labels: []
assignee: null
parent: C-326
blocked_by: []
topic: topic-1026
branch: null
created: 2026-10-25T09:51:41.216Z
updated: 2026-10-25T09:55:59.980Z
closed: 2026-10-25T09:55:59.980Z
---

## Summary

The marketing session's build-log post covering v0.2.0 and v0.2.1 is one commit, 789a993f on brand/identity, adding site/src/content/log/v0-2-the-browser-and-a-free-model.mdx. It goes out with `cland publish brand/identity` after the human approves it, the same way T-1013 did for v0.1.4.

## Acceptance criteria

- [ ] C1. The post is published through `cland publish` at the commit the human approved, and the public tip is recorded here (docs).

## Comments

### coord · 2026-10-25T09:55:52.293Z

Published marketing brand/identity at 789a993f48e2988cb944c58ac0f43e2903edb918 (GitHub default branch and site); dev 593c82023e96feba06d0d0140608f63e92be2288.

### coord · 2026-10-25T09:55:59.980Z

Published with `cland publish brand/identity` on the human's approval (ask 57755862, 09:52:33Z). GitHub main and site are at 789a993f48e2988cb944c58ac0f43e2903edb918, exactly the previewed commit (A-11670). dev merged it at 593c8202. The dev tip differs from the preview's only by tracker commits made in between.
