---
id: T-1430
kind: task
title: "web Inbox: reading a message with d can show the 'left Inbox' outcome when the removal delta beats the read reply"
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-28T14:41:32.173Z
updated: 2026-10-28T14:41:32.173Z
---

## Summary

`web/test/inbox.test.ts` "selected request and message unfold, physical d declines to the sender or reads exactly that row" failed once in T-1405's mode-free run 39c1dc54 at 166b2937 (A-13347, Linux droplet c-8 lon1, Web tier): "The input did not match the regular expression /read/. Input: '✓ general · left Inbox'" at inbox.test.ts:89. After `d` reads the message row, the row's outcome showed the "left Inbox" text, not "read". Likely race: the inbox delta that removes the row lands before the read confirmation, so the outcome is labelled as an external removal. T-1405 has no web/ change. First sighting.

## Acceptance criteria

- [ ] C1. The cause is attributed from receipts: the order of the read reply and the removal delta, and which one sets the outcome text.
- [ ] C2. An own `d` read always shows the read outcome, whichever of the reply and the delta arrives first (a product fix if the label is wrong; a test fix only if "left Inbox" is the specified outcome), with 10/10 Web repetitions under load.

## Notes

Shared-defect candidate (flaky-rerun rule: T-1405 gets one resubmit). If it's red again anywhere, it becomes a fix item in 0.3.
