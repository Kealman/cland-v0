---
id: T-1167
kind: task
title: The inbox as home on the phone
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-419
blocked_by:
  - T-1165
topic: null
branch: null
created: 2026-10-23T07:00:02.411Z
updated: 2026-10-23T07:00:15.502Z
---

## Summary

At phone width the inbox is home: the four sections in order with 44 px fold buttons and their counts, empty sections kept at 0, "Nothing needs you" when every section is at 0, the events and archive lines closing the list, and a tapped message unfolding in place with a reply.

## Parent

E-419 (§3.6 the inbox as home, P40 and P42; the waiting plan as a row; the last part of tracer step 1).

## What to build

- **The title** reads Inbox with "N need you", or "Nothing needs you" in green with its check when every section is at 0.
- **Sections.** Asks and approvals, Plan approvals, Requests to you and Messages to you, in that order; each header is a full-width fold button at least 44 px tall with its name and count, its fold remembered per browser as on the desktop; an empty section keeps its header with 0. Rows are two lines at 390 px (glyph, subject, sender in the role colour and the age; then the first line of the text or the command), with no drawer at this width.
- **Message and request rows.** A tap unfolds the row in place with its text and a one-line reply to the sender in the row's topic (the composer's reply mode), with Open topic and Mark read or Decline; the reply's draft is the per-topic draft that already survives a reload.
- **A waiting plan** shows as a row with its stage, lane and item counts and no approve control and no Open Plan: plan approval needs the desktop's Plan view (said in the row's tooltip). The notification for it comes with the notifications ticket.
- **Ask and approval rows** keep the desktop's in-place unfolding until the sheet ticket replaces it.
- **The close of the list.** The events line and the archive line close the list as 44 px controls; the events line opens Events and the archive line opens the archive in place.

## Acceptance criteria

- [ ] C1. At 390x844 the inbox shows its four sections in order, each header a fold button at least 44 px tall with its count, and an empty section keeps its header with 0 (Web test).
- [ ] C2. With every section at 0 the title reads "Nothing needs you" with its check, and a new ask from a fake session brings back the count (Web test).
- [ ] C3. A tapped message row unfolds in place with a reply to its sender in the row's topic, and a draft typed there survives a reload (Web test).
- [ ] C4. A waiting plan shows as a row with its counts and offers no approve or Open Plan control at 390x844 (Web test).
- [ ] C5. The events line and the archive line close the list as controls at least 44 px tall, and the events line opens Events (Web test).
- [ ] C6. `web/README.md` describes the inbox as home on the phone (docs).
