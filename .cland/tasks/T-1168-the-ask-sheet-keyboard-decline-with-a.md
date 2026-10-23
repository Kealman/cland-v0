---
id: T-1168
kind: task
title: "The ask sheet: keyboard, Decline with a reason, no answer by accident"
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-419
blocked_by:
  - T-1167
topic: null
branch: null
created: 2026-10-23T07:00:02.549Z
updated: 2026-10-23T07:00:02.549Z
---

## Summary

At phone width an ask opens as a bottom sheet with full-width numbered options and a free answer; the sheet rides on the keyboard with 44 px options, Decline sits on the field's label row and needs a reason, and nothing answers on a swipe, the scrim or Escape.

## Parent

E-419 (§3.6 the ask sheet, P25 and P36 to P38; tracer step 2).

## What to build

- **Opening.** A tap on an ask row opens the sheet over a scrim, the row staying selected behind it. At phone width an ask card in a thread shows its question and an Answer button that opens the same sheet, so the sheet is the one place an ask is answered on the phone.
- **The sheet.** A header with the ask's item, sender and age, a link to its thread and a close button; the question; each option as a full-width button at least 48 px tall with its number; the free answer with its label row and Send answer.
- **The keyboard.** When the free answer takes focus the sheet follows the visual viewport and sits on its bottom edge; the question clamps to three lines and the options shrink to 44 px. The page has no virtual keyboard in the suite, so the test shrinks the viewport.
- **Decline** sits on the field's label row. It turns the label into the reason and Send answer into a red Decline that stays disabled until a reason is typed; Answer instead turns it back. The answer goes through `topic.answer` as on the desktop.
- **Closing.** Escape (through the key map), the close button and a tap on the scrim close the sheet without answering; there is no swipe gesture, so a swipe neither answers nor declines.
- **The answered row.** An answer from any client closes the sheet and folds the row in place to one line with the option, who answered and when; the row stays until the human leaves the inbox and then moves to the archive, by the existing leave rule.

## Acceptance criteria

- [ ] C1. At 390x844 a tapped ask row opens a bottom sheet with the question, each option as a full-width numbered button at least 48 px tall, and the free answer (Web test).
- [ ] C2. Focusing the free answer and shrinking the viewport keeps the sheet on the visual viewport's bottom with the question clamped to three lines and 44 px options (Web test).
- [ ] C3. Decline on the label row turns Send into a red Decline that stays disabled until a reason is typed, and the fake asker receives `declined` with the reason (Web test).
- [ ] C4. Escape, the close button, a tap on the scrim and a touch swipe across the sheet leave the ask open, as a frame client reads it (Web test).
- [ ] C5. An ask answered in a second context closes the first context's sheet and folds its row to the outcome, and the row stays until the human leaves the inbox (Web test).
- [ ] C6. At 390x844 an ask card in a thread offers Answer, which opens the same sheet (Web test).
