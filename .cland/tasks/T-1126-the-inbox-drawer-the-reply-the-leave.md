---
id: T-1126
kind: task
title: The inbox drawer, the reply, the leave rule and the archive
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by:
  - T-1123
  - T-1124
topic: null
branch: null
created: 2026-10-22T15:16:14.159Z
updated: 2026-10-23T03:28:05.902Z
---

## Summary

The drawer follows the selected inbox row with its topic's thread, scrolled to the row's message, and a one-line reply on `r`; an answered row stays folded until the human leaves the inbox and then shows in the archive on `A`.

## Parent

E-417 (v0.1.2 §3.7; §3.4 the answered ask and the inbox's leave rule; P19, P38; tracer step 3).

## What to build

With an inbox row selected the drawer shows the thread of its topic (the thread of the topics ticket, with its folds and cards), scrolled to the row's message, and at its foot the composer in its one-line form addressed to the row's sender; `r` focuses it. The drawer has Split and Close as elsewhere. A row that leaves the inbox because it was answered, approved, replied or read stays in place folded to its outcome (P38) while the human stays in the Inbox area, so rows never move under a finger; leaving the area drops them. `A` shows the inbox archive: what left in the last seven days and why, from the hub's departures. The archive line closes the list below the events line and stays when every section is empty.

## Acceptance criteria

- [ ] C1. Selecting a row shows its topic's thread in the drawer scrolled to the row's message, and `r` sends a one-line reply the fake sender receives (Web test).
- [ ] C2. An ask answered from the inbox stays folded with its outcome while the Inbox is shown, and after leaving and returning it is gone from its section (Web test).
- [ ] C3. `A` lists the answered ask in the archive with why it left, and the archive line stays when every section is empty (Web test).
