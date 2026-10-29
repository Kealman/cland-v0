---
id: T-1446
kind: task
title: "Telegram: approving a pairing from the CLI sends no confirmation to the phone"
state: open
status: backlog
size: S
labels:
  - needs-triage
  - qa-found
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-29T16:50:28.430Z
updated: 2026-10-29T16:50:28.430Z
---

## Summary

Found in the v0.3.0 live run (E-1314, QA qa-677, step L2, topic-1195, A-13818), on the real @cland_app_bot against the sandbox hub at dev 189d5100. The human pressed Start and got the code. `./sbx remote approve telegram <code>` succeeded, and the stored numeric identity matches the phone. But no confirmation reached the phone. The human's words: «Ничего не пришло в бот». At 16:46:59Z the remote's `lastOutbound` still predated the approval, and the outbox was 0, so no confirmation was ever queued.

## What to build

Find why approval queues no "Paired with <project>" line on Telegram. The spec and the prototype send it, and Discord edits its pairing reply to "Approved". Make the approval send exactly one confirmation through the durable outbox, and then send any open cards as the spec says. Cover it with a production-frame test on the fake Bot API that is red before the fix.

## Acceptance criteria

- [ ] C1. After `cland remote approve telegram <code>`, the paired chat receives exactly one confirmation through the outbox, shown by a T2 production-frame test on the fake Bot API, red before the fix.
- [ ] C2. Open cards are sent after the confirmation, in order.
