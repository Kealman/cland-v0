---
id: T-166
kind: task
title: Inbox notifications newest first, capped at the last N with a count of earlier ones
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-110
blocked_by: []
topic: null
branch: null
created: 2026-10-10T09:19:59.990Z
updated: 2026-10-10T09:19:59.990Z
---

## Parent

T-110 (Threads that read). A lower-priority follow-up the human reported with the needs-you bug.

## What to build

The inbox's notifications list shows every notification, oldest first (407 on the live build). Show the newest first, and only the last N, with a line saying how many earlier ones there are and how to see them (the Agents log). N is a constant documented in nvim/README.md; 50 is a reasonable default.

## Acceptance criteria

- [ ] Notifications are listed newest first.
- [ ] Only the last N show, followed by a line naming the count of earlier ones and where they live.
- [ ] A headless test covers ordering and the cap.
- [ ] `npm run typecheck && npm run test:nvim` pass.

## Notes

Size S. Low priority.
