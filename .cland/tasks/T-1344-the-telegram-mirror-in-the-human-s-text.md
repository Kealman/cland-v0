---
id: T-1344
kind: task
title: "The Telegram mirror in: the human's text, decision and question kinds, replies to topics, and the delivery reactions"
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1309
blocked_by:
  - T-1341
topic: topic-1095
branch: t/T-1344-the-telegram-mirror-in-the-human-s-text
created: 2026-10-26T19:09:06.927Z
updated: 2026-10-26T23:19:34.832Z
---

## Summary

The human's Telegram text reaches General as their message to the Coordinator with `via = "telegram"`. `/decision` and `/question` send the other kinds, a reply goes to its message's topic, formatting is dropped, and 👌 then 👀 confirm delivery.

## What to build

Inbound mapping through the gateway as the human (T-1321) with `via` (T-1322). Mentions resolve as in the workbench, and `@aide` is no mention. A reply to a mirrored message routes through T-1323's chat-message map to its topic. React 👌 once General has the message and 👀 once the addressee's session has it. Spec §3.4.

## Acceptance criteria

- [ ] C1. Free text, `/decision`, `/question` and a message with bold text reach General as the human's messages of the right kind with `via = "telegram"` and the formatting dropped (test).
- [ ] C2. A reply to an agent's mirrored message lands in that message's topic, and the fake sees 👌 then 👀 in that order (test).

## Comments

### impl-1344 · 2026-10-26T23:19:34.832Z

Rule 20 pre-change consumer inventory: native TgMessage/TelegramApi consumed by telegram.ts, telegram-polling.ts, messenger.ts, fake-api.ts, telegram-api.test.ts, telegram-messenger.test.ts, telegram-polling-fixture.ts and telegram-polling/restart tests. Remote.start/frame port is consumed by gateway.ts, configuration.ts, test/fakes/messenger.ts, gateway tests (including old synchronous shape), outbox/gateway-state/gateway-secrets/remote-cli/config-set/project-hub-lifecycle tests and harness injection. Conversation.receive is called by gateway.ts, transport.ts/http.ts and dispatch unit/peer fixtures; its current optional via parameter remains valid. topic.send is consumed by workbench Web/Neovim, CLI, recordings, all-tier topic/send/approval/gateway tests and shipped skill/QA examples; no wire shape or gateway authority change planned. RemoteStore.message maps are read by remote-state/outbox/gateway-state and native mirror-out; keep their schema and semantics additive. Docs/skills: hub README, implement skill, Telegram API/messenger/polling guides; T3 polling-restart fixture and all QA/startup-probe searches included. Planned internal additive admission metadata carries platform chat/message identity separately from frames, atomically stores inbound source map with topic.send and returns original receipt on replay; ordinary legacy frames unaffected. New client regression will keep previous frame shape and prove forged ingress fields cannot choose an identity.
