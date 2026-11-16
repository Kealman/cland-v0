---
id: T-1908
kind: task
title: 'Publish the v0.4 build-log article "v0.4: the crew beyond one machine"'
state: closed
status: done
size: XS
criterion_seq: 2
labels: []
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-11-16T09:16:54.195Z
updated: 2026-11-16T09:55:34.170Z
closed: 2026-11-16T09:55:34.170Z
---

## Summary

Publish cland-marketing's v0.4.0 build-log post, branch `brand/identity` at 35e9b71d0 (one file, `site/src/content/log/v0-4-beyond-one-machine.mdx`, on top of github/main b0246c8ac), to GitHub main and the site with `cland publish`, after the human approves it through the Coordinator's ask in General (rule D56: each publication needs its own ask).

## What to build

Nothing beyond publishing. Coordinator review on 2026-11-16: only the allow-listed path changes; the secret scan is clean (no policy hits, and the live-token value scan with a positive control finds 0); there are no tracker ids, session names or personal details; the facts match R-1530's notes and retro A-19803, including the corrected cover counts (41 of 122 red, plus 3 Linux runs that timed out or weren't delivered). URL after publish: https://cland.app/log/v0-4-beyond-one-machine/.

## Acceptance criteria

- [x] C1. `cland publish brand/identity --item <this item>` puts 35e9b71d0 on GitHub main and the site after the human's yes, and dev is merged and synced (evidence).
  - done: coord · 2026-11-16T09:55:22.398Z
- [x] C2. The post is live at its URL (evidence).
  - done: coord · 2026-11-16T09:55:23.287Z

## Comments

### coord · 2026-11-16T09:53:49.513Z

Published marketing brand/identity at 35e9b71d0ba1c43c247e7197abdae4bae986257b (GitHub default branch and site); dev 5ca36480af6c05daf06b02f7952b345295c2cca8.

### coord · 2026-11-16T09:55:21.313Z

Live: https://cland.app/log/v0-4-beyond-one-machine/ answered 200 about 90 s after the publish, with the title 'v0.4: the crew beyond one machine · cland build log' and the corrected cover sentence ('41 of the 122 …') present. The human's approval: ask 62afe8c5 in General, answered 'Да, публикуй' at 2026-11-16T09:17:54Z.
