---
id: T-1128
kind: task
title: Notifications while the page is open
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by:
  - T-1123
topic: null
branch: null
created: 2026-10-22T15:16:14.550Z
updated: 2026-10-22T15:16:14.550Z
---

## Summary

While the page is open and the human is not looking at it, the web raises browser notifications for now-layer items only, behind two switches, "needs you" and "finished", each naming the session, the item and what it waits on.

## Parent

E-417 (§3.6 notifications; choices "Needs you and finished" and "The switches and the permission"; tracer step 6, the notifications half).

## What to build

"Needs you" fires when a row enters the inbox; "finished" fires when a task of the now layer reaches done. Nothing fires while the page is visible and focused, and nothing fires for watch or background events. A notification names the session, the item and what it waits on (the question, the command, the plan); each inbox row or task raises at most one, using the row as its tag. A click focuses the page and opens the inbox row, or for "finished" the item's card. The two switches are per browser, since the permission belongs to a device and an origin; until E-418 places them beside the profile they are palette actions showing their state. The permission is asked when the first switch is turned on, a user gesture; a denied permission turns the switches off and shows why in their tooltip. No service worker and no push: the page must be open.

## Acceptance criteria

- [ ] C1. With the page hidden and "needs you" on, a new ask raises one notification naming the session, the item and the question, and its click opens the inbox row (Web test).
- [ ] C2. With the page visible and focused, or with "needs you" off, a new ask raises none, and a watch-layer event never raises one (Web test).
- [ ] C3. With "finished" on and the page hidden, a now-layer task reaching done raises one notification whose click opens the item's card (Web test).
- [ ] C4. The switches are palette actions kept per browser across a reload, and the permission is requested only when the first switch is turned on (Web test).
