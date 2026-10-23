---
id: T-1164
kind: task
title: "web/README.md: add the thread r row and drop the remaining stand-in and snapshot-client sentences"
state: open
status: planned
size: XS
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: E-417
blocked_by: []
topic: null
branch: null
created: 2026-10-23T06:56:38.871Z
updated: 2026-10-23T07:33:37.086Z
---

## Summary

E-417 stage-3 QA (qa-676, E417S3-11 at f2899a3e) found web/README.md still stale after the Inbox and composer landed: the thread key table (~209–220) omits `r` "Reply to Inbox sender", which keymap.ts declares and ~294 describes; ~661–662 says the snapshot client has not landed and calls the drawer and pane a stand-in; ~642 says other areas show ID/title, contradicted by the Inbox drawer; and ~53–54 overstates what remains a stand-in (~328–329 correctly narrows it to Events).

## What to build

web/README.md lists every thread and Inbox key the keymap declares, and describes only Events (until E-417 stage 4 lands it) as pending, with no stand-in or not-yet-landed wording for the Inbox, drawer, pane or snapshot client.

## Acceptance criteria

- [ ] C1. web/README.md's thread key table lists `r` (Reply to Inbox sender) with its context, matching web/src/keymap.ts (docs).
- [ ] C2. web/README.md has no sentence calling the Inbox, drawer, pane or snapshot client a stand-in or not yet landed, and names Events as the only pending area until T-1127 lands (docs).
