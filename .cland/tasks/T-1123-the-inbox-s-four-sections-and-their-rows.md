---
id: T-1123
kind: task
title: The inbox's four sections and their rows
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by:
  - T-1122
topic: null
branch: null
created: 2026-10-22T15:16:13.645Z
updated: 2026-10-23T03:28:05.496Z
---

## Summary

The Inbox area shows the now layer in its four sections with their rows, ages and folds; the selected row unfolds in place with real buttons, `d` removes a request or a message, Enter opens, and the events line closes the list.

## Parent

E-417 (v0.1.2 §3.7 the inbox; P17, P18; tracer step 3).

## What to build

The sections are asks and approvals, plan approvals, requests and messages to the human, in that order; a topic waiting without an ask shows its latest message among the messages. Each section is newest first and shows five rows, folding the rest into one line that names how many and the oldest wait; each header is a name and a count, and an empty section stays as one muted line (P18). A row is a glyph, the subject, the text, the sender in the role colour and the waiting age at the right (P17), ages updating while the page is open. The selected row unfolds in place: an ask's card from the asks ticket, a request's or message's full text with its buttons, a plan's stage and lane counts. `d` declines a request (its sender is told) or marks a message read, and the row leaves; Enter opens the row's topic at its message, and on a waiting plan opens the Plan view of its epic. Below the sections the events line reads the number of events newer than the human's last look and their warnings in the watch colour, and opens the Events area. The keys live in the inbox context.

## Acceptance criteria

- [ ] C1. The Inbox shows asks and approvals, plan approvals, requests and messages in that order, each newest first with each row's waiting age and a header of its name and count, and an empty section as one muted line (Web test).
- [ ] C2. A section with seven rows shows five and folds two into a line naming the count and the oldest wait (Web test).
- [ ] C3. The selected row unfolds in place with its buttons, and `d` declines a request, as its fake sender receives it, or marks a message read, and the row leaves (Web test).
- [ ] C4. Enter on a message row opens its topic at that message, and on a waiting plan opens the Plan view of its epic (Web test).
- [ ] C5. The events line counts the events newer than the human's last look and their warnings, and stays when every section is empty (Web test).
