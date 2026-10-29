---
id: T-1430
kind: task
title: "web Inbox: reading a message with d can show the 'left Inbox' outcome when the removal delta beats the read reply"
state: open
status: review
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1189
branch: t/T-1430-web-inbox-reading-a-message-with-d-can
created: 2026-10-28T14:41:32.173Z
updated: 2026-10-29T16:04:11.947Z
---

## Summary

`web/test/inbox.test.ts` "selected request and message unfold, physical d declines to the sender or reads exactly that row" failed once in T-1405's mode-free run 39c1dc54 at 166b2937 (A-13347, Linux droplet c-8 lon1, Web tier): "The input did not match the regular expression /read/. Input: '✓ general · left Inbox'" at inbox.test.ts:89. After `d` reads the message row, the row's outcome showed the "left Inbox" text, not "read". Likely race: the inbox delta that removes the row lands before the read confirmation, so the outcome is labelled as an external removal. T-1405 has no web/ change. First sighting.

## Acceptance criteria

- [ ] C1. The cause is attributed from receipts: the order of the read reply and the removal delta, and which one sets the outcome text.
- [ ] C2. An own `d` read always shows the read outcome, whichever of the reply and the delta arrives first (a product fix if the label is wrong; a test fix only if "left Inbox" is the specified outcome), with 10/10 Web repetitions under load.

## Notes

Shared-defect candidate (flaky-rerun rule: T-1405 gets one resubmit). If it's red again anywhere, it becomes a fix item in 0.3.

## Comments

### impl-1430 · 2026-10-29T16:02:18.265Z

Controlled red on dev 6a24facf8 (macOS, isolated pinned Headless Shell): node --test --test-name-pattern='own Inbox read outcome' web/test/inbox.test.ts. Reply-first fails actual '✓ general · left Inbox', expected /read/; captured successful result has departures=[], captured held delta has reason=read. Delta-first passes. Ranked hypotheses: (1) successful reply applies row removal without departure metadata (predict reply-first red, delta-first green); (2) newer delta generation causes reply metadata loss (predict delta-first red); (3) read is incorrectly persisted as another reason (predict archive/delta reason differs). Receipts support (1), disprove (2)/(3). Production read stores 'read', schedules its metadata-bearing push after 250 fake ms, returns list without departures; connectHub applies that list immediately; InboxArea's fallback labels missing departure 'left Inbox'. No shared wire/authority change is planned.
