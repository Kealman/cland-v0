---
name: handover
description: Hand this session's Coordinator role or claimed Lead node to another session. Drafts the handover note in its four sections from the current work and calls `role.handover` through the cland spoke. Use when the human asks you to hand over, or when you must stop leading your node.
argument-hint: "The session that takes the role, and anything the note must say"
disable-model-invocation: true
---

The next holder continues from the note and the hub. It never sees your transcript (spec 4.4, ADR 0001). Write the note so that a session which has seen none of this conversation can pick up the work.

## 1. Find the receiver

The argument names the session that takes the role. Call `who`. The receiver must be connected, or be a session launched through the hub (`session.list`).

- A Coordinator asks the human when no receiver is named. If the human wants a fresh receiver, launch it with `session.launch` and give it no role; the role arrives with the handover.
- A Lead's receiver must hold no item claim. If a receiver must be chosen or launched, send a question to `lead T-<n>` for your claimed node, naming the missing receiver; the question climbs to the supervising Lead or Coordinator.

Leads hand over their own claimed node; other Leads keep theirs.

## 2. Gather what the note rests on

Take the facts from the hub and the tracker, not from memory alone:

- `role.state`: the topics waiting for the role, the open asks and the claims you hold. For a Lead, confirm its `item` and single node claim; state belongs to that node.
- `task.list` for the open items and the ones assigned to or claimed by you, and `task.view` for the ones in flight.
- `history`, plus `history` with a `topic` for each topic that is waiting.

## 3. Draft the note

Write four sections in this order, none of them empty. Keep the lines short. Name items by id (`T-12`), sessions by name and topics by id. Point at items, files and topics instead of copying them.

```markdown
## Goals now
What your project or claimed node is driving at right now: the one to three outcomes the next holder steers toward.

## Work in flight
Each piece of work in your node that is moving: the item, who does it, where it stands, what comes next.

## Open decisions
What is still undecided, the options on the table, and who decides (the human through `ask`, or the Coordinator).

## Waiting on
What is blocked on someone else: the human, a Reviewer or QA verdict, a session's reply. Name who, and since when.
```

If a section truly has nothing in it, say so in one line (`Nothing waiting.`). The hub refuses an empty section.

If the human asked for the handover, show them the draft and apply their changes.

## 4. Hand over

Call the spoke tool `role.handover` with `to` and `note`. The note is the Markdown above, or an object with `goals_now`, `work_in_flight`, `open_decisions` and `waiting_on`. Pass `then: "implementer"` only when the human wants you to stay on as an Implementer.

- If the result is `{ ok: false, code: "note-incomplete", missing }`, fill in the named sections and call again.
- For any other refusal, tell the human what it says. Do not retry it another way.

## 5. Stop

When the handover succeeds, the hub sends you a "role revoked" event (with `then`, your Implementer clause instead). From that moment you no longer act in the handed-over role: no messages on its behalf, no item edits, no launches. The Coordinator's claims, or the Lead's node claim and default subscriptions, have moved to the new holder. Continue only in the role named by the new clause or on a new assignment.
