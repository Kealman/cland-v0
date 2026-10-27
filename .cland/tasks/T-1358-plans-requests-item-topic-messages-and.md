---
id: T-1358
kind: task
title: Plans, requests, item-topic messages and Claude Code approvals arrive as 📥 notices, and a reply goes to their topic
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1310
blocked_by:
  - T-1353
topic: null
branch: null
created: 2026-10-27T05:43:02.026Z
updated: 2026-10-27T11:28:09.462Z
---

## Summary

The other needs-you rows arrive marked 📥 and without buttons: a plan waiting for approval, a request for a review, a QA run or a handover, a message to the human in an item topic, and a Claude Code approval answered in its TUI. A reply to a notice goes to its topic, and the remote does not follow that thread.

## What to build

The card model gains notices, rendered as entities text with no keyboard and sent as `card` jobs when their inbox row appears:
- a plan names its epic and title, says plans are approved in the workbench, and links the web through `[web] origin` when one is set (never a `web.link` credential);
- a request names its kind, sender and item;
- an item-topic message names its sender and item and shows the text, truncated;
- a Claude Code approval (`answerIn = "tui"`) names the session and command and says to answer in its terminal.

Each notice is mapped in `remote_messages` with its topic and source message. A reply then goes through the inbound's reply path as `topic.send` with `replyTo` into that topic, which the gateway's authority already allows. The mirror stays General-only, so later messages in that topic reach the chat only as new cards and notices. Pairing rows never appear (`gatewayInbox`). Spec §3.5 and §3.4; v0.2 §3.8.

## Acceptance criteria

- [ ] C1. A Claude Code approval, a waiting plan, a review request and an item-topic message to the human each arrive once as a notice starting with 📥 with no `reply_markup`, and the plan notice offers no approve action (test).
- [ ] C2. A reply to the item-topic notice lands in that topic as a reply to its message "via Telegram", and the agent's ordinary answer in that topic is not sent to the chat (test).
- [ ] C3. A plan notice carries the `[web] origin` link when one is set and no link without one, and no notice contains a web credential (test).
