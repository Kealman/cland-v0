---
id: T-1321
kind: task
title: "The gateway: an in-process edge serving remotes as the human, with its authority table and a test messenger"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1307
blocked_by: []
topic: null
branch: null
created: 2026-10-26T02:28:46.408Z
updated: 2026-10-26T02:28:57.819Z
---

## Summary

The hub gains the gateway: an in-process edge that serves remotes over one dispatcher conversation as the identity `human`, with a deny-by-default authority table checked before dispatch. A test messenger in the suite stands in for a messenger platform. This is the seam every later v0.3 epic builds on.

## What to build

A gateway module inside the hub process that starts and stops with the hub and runs one remote per active messenger. It receives the frames a client receives (messages, inbox, asks, approvals, delivery stages) and sends a client's requests through the dispatcher as `human`: no new protocol, socket, listener or hub secret. Its authority table allows only `topic.send` into General, or as a reply into the replied-to message's topic, plus `topic.answer`, `approval.answer`, `hub.status`, `task.list` and `inbox.list`. Every other request is refused with a reason naming it, including session launch or stop, release, push, sync, configuration, artifact actions and pairing approval. Model the table on `hub/src/hub/web-authority.ts`. A test messenger fake lives under `hub/test/fakes/` and drives the gateway through the frame protocol (`hub/test/harness.ts`). Spec §3.1. The prototype `prototype/telegram-remote` at 33bf2b2e (`hub/src/remote/authority.ts`, `PROTOTYPE (Q-1292)` marks) may be read but is never merged.

## Acceptance criteria

- [ ] C1. A test messenger behind the gateway receives a General message an agent posts, and its reply reaches the Coordinator as the human's message, with no new socket, listener or hub secret, and the gateway stops with the hub (test).
- [ ] C2. Each allowed request (General send, reply into the replied-to topic, answer, approval, hub.status, task.list, inbox.list) succeeds through the test messenger, and every other request, pairing approval included, is refused before dispatch with a reason naming it (test).
