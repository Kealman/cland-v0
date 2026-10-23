---
id: T-1161
kind: task
title: web/README.md still describes messages, inline artifacts and the Inbox as stand-ins
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by: []
topic: null
branch: null
created: 2026-10-23T02:32:53.561Z
updated: 2026-10-23T03:28:05.999Z
---

## Summary

Writing the E-417 stage-2 QA brief at 269ea26f found stale statements in web/README.md after T-1119–T-1122 landed: line ~155 says HTML artifacts are chips "until the inline-artifact slice"; line ~214 says "Messages are plain sender/time/text blocks … in this slice"; line ~248 says "Inbox and Events keep their existing stand-ins"; and no key table lists Toggle agent run or the ask keys.

## What to build

web/README.md describes the landed message block, folded runs, inline HTML artifacts and ask cards as they are, with their keys in the key tables, and keeps any still-pending area (Events, until E-417 stage 4) named as such.

## Acceptance criteria

- [ ] C1. web/README.md has no sentence describing messages, inline HTML artifacts or ask cards as future or stand-in work (docs).
- [ ] C2. web/README.md's key tables list Toggle agent run and the ask keys (`1`–`9`, free answer, `d` decline) with their contexts (docs).
