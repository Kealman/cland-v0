---
id: T-1579
kind: task
title: Publish the v0.3.1 article update for 0.3.2 (Telegram stall fixed)
state: open
status: backlog
size: XS
labels: []
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-11-01T07:40:55.508Z
updated: 2026-11-01T07:40:55.508Z
---

## Summary

Publish the v0.3.1 build-log article's update for 0.3.2 at /log/v0-3-1-a-fifth-of-the-memory/. The source is brand/identity commit 2b7da7511: one file, +9 −5. It turns "Known issue" into "Fixed in 0.3.2", marks the landing notice fixed, makes the OpenCode 2.2 line precise and points "What's next" at 0.4. The human approved it on 2026-11-01 at 07:40Z via Discord (ask f093fb73: «Да, публиковать (cland publish)»).

## Acceptance criteria

- [ ] C1. `cland publish brand/identity --item` with this item publishes 2b7da7511 to GitHub main and the site, and the updated article is live at https://cland.app/log/v0-3-1-a-fifth-of-the-memory/ with the "Fixed in 0.3.2" section.
