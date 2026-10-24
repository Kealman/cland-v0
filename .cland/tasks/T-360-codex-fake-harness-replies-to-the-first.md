---
id: T-360
kind: task
title: Codex fake harness replies to the first channel block of a digest instead of the message addressed to it
state: open
status: backlog
size: S
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: null
branch: null
created: 2026-10-13T21:06:21.500Z
updated: 2026-10-24T06:46:22.743Z
---

## Summary

The Codex fake harness (`hub/test/fakes/codex`) takes the topic and msg_id it replies to from the first channel block of the whole input. When a digest starts with an Agents event and then carries the human's General message, the fake answers into Agents with no `to`, and its `send` is refused with `forbidden send:human`.

## Evidence

- Found by QA run qa-2026-10-13-27-8 (E-270 demo, M24) at dev a3469c0 in a scratch project.
- The digest delivered to the fake held a task-status event in Agents first, then the human's General message.
- The fake's reply took the Agents topic and was refused `send:human`, so the expected pong never arrived. QA used the brief's topic-history fallback.

## What to fix

The fake should reply to the delivery that addressed it, the last human or agent message in the digest rather than the first channel block, and should skip hub event entries. Add a test where a digest starts with an event and ends with a General message.
