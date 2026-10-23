---
id: T-1127
kind: task
title: The events view with the hub's filter, day groups and the last look
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by:
  - T-1123
topic: null
branch: null
created: 2026-10-22T15:16:14.417Z
updated: 2026-10-23T07:33:36.674Z
---

## Summary

The Events area shows events newest first in day groups, at most the newest 200 that match the filter with older ones on demand, filters through the hub, and sets the human's last look when opened.

## Parent

E-417 (v0.1.2 §3.7 the events view; §3.6 the last look; tracer step 6, the events half).

## What to build

Rows are newest first in day groups with day rules; a day folds. A row is the time, a glyph, the kind, the subject and one line; bookkeeping rows are dimmed and equal events merged by the hub show ×N. At most the newest 200 rows matching the filter show; a control and `A` load 200 older ones from the journal. The filter keys work as in Neovim in the events context: `1` to `8` by kind, `0` all, `w` warnings only, `s` a subject through the palette, `F` clears; the filter goes through the hub's events filter (T-1055) on the subscription and the page reads, and the browser keeps it. Enter opens the subject (a card, a session, a topic, an artifact). Opening the view sets the human's last look in the hub, and rows newer than the previous look are marked; the inbox's events line then counts from the new look. Nothing still waiting in the inbox repeats here.

## Acceptance criteria

- [ ] C1. The Events area lists rows newest first in day groups with day rules, at most 200, and loads 200 older ones on demand (Web test).
- [ ] C2. `w` shows only warnings and `2` only task events through the hub's filter, and `F` restores every row (Web test).
- [ ] C3. Bookkeeping rows are dimmed, merged events show ×N, a day folds, and Enter opens the subject (Web test).
- [ ] C4. Opening the view sets the human's last look, which a frame client reads, and the inbox's events line drops to 0 (Web test).
