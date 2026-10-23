---
id: T-1142
kind: task
title: The notification switches beside the profile
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1135
  - T-1128
topic: null
branch: null
created: 2026-10-22T15:16:16.594Z
updated: 2026-10-23T02:19:51.323Z
---

## Summary

The "needs you" and "finished" switches move from the palette, where E-417 offers them, to the profile block in the Accounts area.

## Parent

E-418 (§3.6 beside the profile; tracer step 5). Ordered after E-417's notifications, which own the switches and the permission.

## What to build

The profile block gains E-417's two switches, "needs you" and "finished", per browser as E-417 stores them, with the notification permission asked when the first one is turned on. The palette actions E-417 offered until now go away. Turning a switch off stops that kind of notification in this browser only.

## Acceptance criteria

- [ ] C1. "finished" turned off in the profile block stays off after a reload (Web test).
- [ ] C2. The profile block shows both switches, the palette no longer offers them, and the first switch turned on asks for the notification permission (Web test).
- [ ] C3. `web/README.md` describes the switches beside the profile (docs).
