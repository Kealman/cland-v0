---
id: T-1110
kind: task
title: "The answer gate: one answer per approval, and the first wins"
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-414
blocked_by:
  - T-1109
topic: topic-856
branch: t/T-1110-the-answer-gate-one-answer-per-approval
created: 2026-10-22T15:16:11.165Z
updated: 2026-10-22T15:56:54.000Z
---

## Summary

Add the human's answer to an approval, `approval.answer`, behind one gate in the hub. The first answer from any client wins, a later one is refused naming who answered and when, and nothing answers by default.

## Parent

E-414 (§3.4 "One gate for answers"; the choices, "No answer by default" and "Losing the race"; split from tracer steps 2 and 4).

## What to build

A human client, Neovim or the browser through the web edge, sends `approval.answer` with the record, a choice and an optional note. The choice is Approve once, Always for this command, or Deny with a note. The hub accepts the answer only for a pending record answered in the hub, and only with a choice the record offers. In the same turn it marks the record `answering` with who answered, from where and when, so any later answer is refused with those facts. The hub then hands the answer to the adapter through a new optional contract method, which answers one request with a choice and a note.

When the adapter confirms, the record closes with the outcome, and every client receives the closed record. When the adapter cannot deliver the answer, the record returns to `pending`, the answering client is refused with the reason, and a warn-level event is journaled. A Deny is never turned into an approval. Where the adapter's protocol carries a note, the note goes with the answer. Otherwise the hub posts the note into the session's topic (its item's topic, else General) as the human's message to that session.

A record answered in the TUI refuses answers and says where to answer. An agent session's answer is refused: only the human answers a command approval. The web edge's authority table lists the frame as allowed. Nothing answers on a timer or by default: a record waits until a client or the harness answers it, or the harness withdraws it.

The in-process fake adapter gets a scripted answer path (accept, fail, hold), so the gate is proven without a harness. Splitting the gate out of the relays gives the Codex and OpenCode relays one gate to plug into, so they can run in parallel.

## Acceptance criteria

- [ ] C1. A frame client's Approve once on a fake adapter's request reaches the adapter once. Both that client and a second frame client read the record closed as "once", by the human, with where and when (test).
- [ ] C2. When two frame clients answer the same request in one tick, the adapter gets one answer and one outcome is recorded. The second client is refused with who answered and when (test).
- [ ] C3. An answer is refused, and the record left unchanged, when its choice is not offered, when the record is closed, or when the record is answered in the TUI (test).
- [ ] C4. An agent session's `approval.answer` is refused, and a browser client holding the cookie answers through the web edge (test).
- [ ] C5. When the adapter fails to deliver an answer, the record returns to pending, the client is refused with the reason, and a warn-level event is journaled (test).
- [ ] C6. Deny with a note, to an adapter whose protocol carries no note, delivers a deny to the adapter and posts the note into the session's topic as the human's message to that session (test).
- [ ] C7. A pending request stays pending with no answer sent to the adapter after the fake clock advances 24 hours (test).
- [ ] C8. `hub/README.md` describes `approval.answer`, the gate, the refusal naming the winner and the rule that nothing answers by default (docs).
