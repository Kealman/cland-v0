---
id: T-1177
kind: task
title: Tap filters for the Events view on the phone
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
topic: topic-1184
branch: t/T-1177-tap-filters-for-the-events-view-on-the
created: 2026-10-23T07:00:15.868Z
updated: 2026-10-29T15:57:20.666Z
---

## Summary

E-419 decided that in 0.2.0 the phone's Events view is read-only and unfiltered, newest first, because T-1127's filters are keyboard-only (`1`–`8`, `w`, `s`, `F`). This follow-up gives the phone tap filters for the same categories.

## What to build

At phone width the Events view offers its filters as tappable chips or a sheet with the same categories and counts as the desktop's keys, 44 px targets, remembered like the desktop filter.

## Acceptance criteria

- [ ] C1. At 390x844 with touch, tapping a filter shows only that category's events and the choice survives a reload (Web test).

## Comments

### impl-1177 · 2026-10-29T15:57:20.666Z

Seam: existing authenticated Web fixture at 390×844 with touch, native taps and rendered event IDs compared with events.list. Existing eventsFilter/setEventsFilter, guarded cland.ui.events.v1 storage and Subjects picker are reused; no wire/schema/admission contract changes. Counts remain the existing loaded-events footer, rather than inventing global per-category totals not supplied by desktop or hub.
