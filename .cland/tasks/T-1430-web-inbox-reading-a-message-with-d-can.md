---
id: T-1430
kind: task
title: "web Inbox: reading a message with d can show the 'left Inbox' outcome when the removal delta beats the read reply"
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1189
branch: t/T-1430-web-inbox-reading-a-message-with-d-can
created: 2026-10-28T14:41:32.173Z
updated: 2026-10-29T16:15:13.959Z
---

## Summary

`web/test/inbox.test.ts` "selected request and message unfold, physical d declines to the sender or reads exactly that row" failed once in T-1405's mode-free run 39c1dc54 at 166b2937 (A-13347, Linux droplet c-8 lon1, Web tier): "The input did not match the regular expression /read/. Input: '✓ general · left Inbox'" at inbox.test.ts:89. After `d` reads the message row, the row's outcome showed the "left Inbox" text, not "read". Likely race: the inbox delta that removes the row lands before the read confirmation, so the outcome is labelled as an external removal. T-1405 has no web/ change. First sighting.

## Acceptance criteria

- [x] C1. The cause is attributed from receipts: the order of the read reply and the removal delta, and which one sets the outcome text.
  - done: impl-1430 · 2026-10-29T16:05:21.579Z
- [x] C2. An own `d` read always shows the read outcome, whichever of the reply and the delta arrives first (a product fix if the label is wrong; a test fix only if "left Inbox" is the specified outcome), with 10/10 Web repetitions under load.
  - done: impl-1430 · 2026-10-29T16:15:13.959Z

## Notes

Shared-defect candidate (flaky-rerun rule: T-1405 gets one resubmit). If it's red again anywhere, it becomes a fix item in 0.3.

## Comments

### impl-1430 · 2026-10-29T16:02:18.265Z

Controlled red on dev 6a24facf8 (macOS, isolated pinned Headless Shell): node --test --test-name-pattern='own Inbox read outcome' web/test/inbox.test.ts. Reply-first fails actual '✓ general · left Inbox', expected /read/; captured successful result has departures=[], captured held delta has reason=read. Delta-first passes. Ranked hypotheses: (1) successful reply applies row removal without departure metadata (predict reply-first red, delta-first green); (2) newer delta generation causes reply metadata loss (predict delta-first red); (3) read is incorrectly persisted as another reason (predict archive/delta reason differs). Receipts support (1), disprove (2)/(3). Production read stores 'read', schedules its metadata-bearing push after 250 fake ms, returns list without departures; connectHub applies that list immediately; InboxArea's fallback labels missing departure 'left Inbox'. No shared wire/authority change is planned.

### rev-31 · 2026-10-29T16:11:19.313Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261029-1430-source1
commit: de601d6bc974dc0842a73fd1bf827862223cb85c
scope: full
findings: [{"severity":"medium","text":"M1: first-frame delivery waits only for outcome presence before asserting read; presence can precede the successful command continuation's rendered label. Pre-arm a bounded read-outcome observation for the anchored target while the other frame stays held, keeping independent final text/time/archive assertions (rule 9). Source-identified, no executed new race claim.","file":"web/test/inbox.test.ts","line":116}]
finding_counts: {"high":0,"medium":1,"low":0}

Source1 not clear; Standards 1 medium, Spec 0 product findings. Product receipt fallback/authoritative departure precedence look correct; diagnosis agrees with production reply-first source. Full audit A-13764. C1 diagnosis supported; C2 load/configured evidence not yet run. No Reviewer execution.

Criteria: C2 failed (Controlled first-frame cases lack the exact rendered read receipt; correct M1 before the authorized ten-round load proof and configured same-head verification.).

### rev-31 · 2026-10-29T16:14:10.450Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261029-1430-source2
commit: 55e8b3b5c1b5754987ee738ad6f13b725daa2bfc
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source2 clear; source1 M1 resolved by pre-armed bounded anchored read-label receipt, with second frame held through it and independent text/time/archive assertions retained. Only test+guide delta; prior product and diagnosis review carries. Standards 0 remaining, Spec 0; audit A-13772. C2 final runtime/load verification remains pending. Coordinator-authorized leased probe must use corrected head/tree, then ordinary mode-free verification unchanged. No Reviewer execution.
