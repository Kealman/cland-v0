---
id: T-1125
kind: task
title: Queued messages and Withdraw in the thread
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by:
  - T-1124
  - T-1117
topic: topic-893
branch: t/T-1125-queued-messages-and-withdraw-in-the
created: 2026-10-22T15:16:14.021Z
updated: 2026-10-23T05:01:31.818Z
---

## Summary

A message to a busy session shows in the thread as queued with a Withdraw that puts its text back into the composer; once the session's turn has taken it, Withdraw is gone.

## Parent

E-417 (§3.4 the composer, queued messages; choice "Withdraw"; tracer step 4).

## What to build

The thread shows the human's message with its delivery stage from the hub. While no delivery has been injected, the message offers Withdraw; Withdraw sends the hub's withdraw, shows it pending, and on the receipt marks the message withdrawn and puts its text back into the composer (ahead of anything typed since, as Neovim's composer does with a refused message). Once the hub reports the message injected, Withdraw disappears. A refused withdraw keeps the message and shows the hub's reason in its tooltip.

## Acceptance criteria

- [ ] C1. A message to a busy fake session shows as queued with Withdraw, and Withdraw marks it withdrawn and puts its text back into the composer (Web test).
- [ ] C2. When the fake session's turn takes the message, its stage moves to injected and Withdraw disappears (Web test).
- [ ] C3. A withdraw the hub refuses leaves the message as it was with the refusal shown (Web test).

## Comments

### impl-1125 · 2026-10-23T05:01:31.818Z

Preparation: initial npm run build passed on local macOS. Confirmed Web public-frame/fake-spoke seam from E-417 and launch brief; no source edits until T-1124 is present on origin/dev. Existing MessageBlock renders hub delivery stages; planned browser slice will restore into T-1124's per-topic draft store after withdrawal receipt, preserving newer text.
