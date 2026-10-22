---
id: T-1117
kind: task
title: The human's message kinds and Withdraw in the hub
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-417
blocked_by: []
topic: null
branch: t/T-1117-the-human-s-message-kinds-and-withdraw
created: 2026-10-22T15:16:12.522Z
updated: 2026-10-22T15:17:06.018Z
---

## Summary

`topic.send` gains the kind of the human's message (Message, Decision, Question), and the protocol gains a withdraw for a message that waits for a busy session and has not reached its turn yet. Neovim shows a withdrawn message as it shows a dropped one.

## Parent

E-417 (§3.4 the composer; choices "The human's kinds" and "Withdraw"; the hub half of tracer step 4).

## What to build

The human's `topic.send` takes an optional kind, `message` by default, `decision` or `question`; the message records it, and history reads and the `message` delta carry it so both clients can name it in the header. A Question addressed to a session leaves the topic waiting for that addressee; a Message and a Decision keep today's rule, under which every human message leaves the topic waiting for its addressees.A new request withdraws one of the human's own messages while no addressee's delivery has been injected: the deliveries move to the new stage `withdrawn`, nothing reaches the session, the message delta reports the stage, and the result returns the text so the client can put it back into its composer. Once any delivery is injected the withdraw is refused naming the stage. An agent cannot withdraw; the web edge allows the request for the human. Neovim draws the `withdrawn` stage with the dropped glyph and colour. The wire types gain the kind and the stage in the shared module the web imports.

## Acceptance criteria

- [ ] C1. A Decision and a Question sent by the human carry their kind on the message, in a later history read and in the delta a second frame client receives (test).
- [ ] C2. A Question addressed to a session leaves the topic waiting for that session, as `cland` reads the topic (test).
- [ ] C3. Withdrawing a message queued for a busy fake session moves it to `withdrawn`, returns its text, and the session never receives it, also after the turn ends (test).
- [ ] C4. A withdraw after the message was injected is refused naming the stage, and an agent's withdraw and another sender's message are refused (test).
- [ ] C5. Neovim's thread shows a withdrawn message with the dropped glyph and colour (test).
- [ ] C6. `hub/README.md` and `nvim/README.md` describe the kinds and the withdraw (docs).
