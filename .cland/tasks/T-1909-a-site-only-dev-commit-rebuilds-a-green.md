---
id: T-1909
kind: task
title: A site-only dev commit rebuilds a green merge batch whose tiers never run the site tests
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: null
branch: null
created: 2026-11-16T10:35:08.568Z
updated: 2026-11-25T13:02:27.161Z
---

## Summary

At landing, batch 2003cd37 (T-1878, T-1876, T-1731; green run f55eb067, A-19971) was rebuilt because `cland publish` had merged one `site/src/content/log/*.mdx` file into dev ("commit 35e9b71d0 changed batch test inputs"). The batch tiers are T1 and T3, which don't run the site's own tests, so a rerun of about 45 minutes bought no coverage.

## What to build

The batch's test-input check counts a changed path only when a test in the batch's configured tiers can read it. A `site/**`-only change does not rebuild a hub batch unless a selected tier covers site files. Tracker and docs paths stay exempt, as now.

## Acceptance criteria

- [ ] C1. A dev commit that changes only `site/**` while a batch is running lands the green batch without a rebuild, when no selected tier reads site files (test, red before the fix).
- [ ] C2. A commit that changes a file a selected tier reads still rebuilds the batch, as today (test).
