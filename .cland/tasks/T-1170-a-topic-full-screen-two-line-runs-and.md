---
id: T-1170
kind: task
title: A topic full screen, two-line runs and artifact chips
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-419
blocked_by:
  - T-1165
  - T-1166
topic: null
branch: null
created: 2026-10-23T07:00:02.941Z
updated: 2026-10-23T16:51:24.159Z
---

## Summary

At phone width a topic opens full screen with a back control, its title, id and status and a button to the item's card; folded runs show two lines from the hub's facts and unfold in place; an inline HTML artifact is a chip that opens full screen.

## Parent

E-419 (§3.6 the thread screen, P31 and P32; the HTML artifact as a chip; the first half of tracer step 3).

## What to build

- **The screen.** A tap on a topic in the Topics list opens its thread full screen: a back control to Topics, the title, the topic's id and status, and a button to the item's card, which opens the read-only card of the More ticket full screen. The browser's back does what the back control does. The bar stays, with Topics current.
- **Fit.** Message blocks, verdicts with their criteria marks, chips and long ids fit 390 px; code blocks scroll inside themselves, never the page.
- **Folded runs** show two lines: the sessions and the message count; then the latest message's kind, its first words and its age. Both come from the run's facts the hub already sends (`participants`, `messageCount`, `latest`, `ageMs`), with no hub change. A tap unfolds the run in place and keeps the anchor line on top.
- **HTML artifacts** are chips at phone width instead of the 240 px iframe; a tap opens the artifact full screen in the same sandboxed iframe (`allow-scripts` alone) with a back control. File and folder artifacts stay chips as on the desktop.
- Every control on the screen is at least 44 px tall.

## Acceptance criteria

- [ ] C1. At 390x844 a tapped topic opens full screen with a back control, the title, the topic id, the status and a card button, and both the back control and the browser's back return to Topics (Web test).
- [ ] C2. The card button opens the item's card read-only full screen, and back returns to the thread at the same message (Web test).
- [ ] C3. A folded run shows two lines, the sessions with the message count and then the latest kind, first words and age, and a tap unfolds it in place with the anchor on top (Web test).
- [ ] C4. At 390x844 an HTML artifact in a message is a chip that opens full screen in an iframe whose `sandbox` is `allow-scripts` alone, with a back control (Web test).
- [ ] C5. A thread holding a verdict, a fenced code block and long ids scrolls only vertically at 390 px (Web test).
