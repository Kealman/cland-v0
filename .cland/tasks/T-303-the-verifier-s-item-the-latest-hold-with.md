---
id: T-303
kind: task
title: "The verifier's item: the latest hold with +N, and a pending request dimmed until the hold"
state: open
status: backlog
labels:
  - v0.1.2
  - ready-for-agent
  - hub
  - nvim
assignee: null
parent: T-275
blocked_by: []
topic: null
branch: null
created: 2026-10-12T21:34:30.315Z
updated: 2026-10-12T21:35:01.682Z
---

## Summary

The sessions panel's item column tells the truth about a verifier. A Reviewer or QA with several holds shows its latest hold and `+N`. A verifier that has only been sent `review request <id>` or `qa request <id>` shows that item dimmed until it takes the hold.

## Parent

T-275: Sessions: stopped sessions, verifiers' items, the queue line. Spec: `docs/spec/v0.1.2.md` §3.4 (decided in T-239; the held item itself was built as T-168).

## What to build

**The hub: holds in time order.** A session's holds in the process view (`HarnessProcessView.holds`, `SessionHold`) carry the time each verifier hold was taken. The tracker index already stores it as `held_at`; today `sessionHolds` returns holds in item order. The view returns the Implementer's or Lead's claim first, as T-168 does, then the verifier holds newest first, each with its `heldAt`. Older clients that ignore the new field keep working.

**The hub: the pending item.** The process view gains the item a verifier was last asked to verify and does not hold yet, for example `pending: { item, kind: 'review' | 'qa' }`, or nothing.

- It comes from the first line of the latest message delivered to that session that reads `review request <id>` or `qa request <id>`. This is the form the crew already uses (`docs/review-and-qa.md`, the role clauses in `hub/src/roles/default-roles.ts`). `qa request <epic> stage <name>` names the epic.
- The id may carry any kind prefix (`T-`, `E-` and the others of §3.1). The hub resolves it by its number, so the prefix migration of T-269 does not break it. An id that names no item is ignored.
- A newer request replaces it. The session taking a hold on that item clears it, and so do the session's verdict on that item and the session's stop or death.
- It is recorded when the message is delivered, and it survives a hub restart. It is never derived by scanning messages when a session list or process view is built.
- A change publishes the session's `session.process` frame once, coalesced per tick with the hold changes that already republish it.

**The panel.** In `session_row` (the sessions panel in `nvim/lua/cland/panels.lua`):

- A verifier with one hold reads as today: the item and its role tag.
- With several holds, the column shows the latest hold and `+N`, where N counts the other holds. The epic's demo reads `T-b +1`. Keep the latest hold's role tag between them when it fits, for example `T-b review +1`.
- The selected row's detail lines list every hold, with its role, newest first.
- With no hold and a pending item, the column shows the pending item dimmed (`ClandFaint` or `ClandDim`, not `ClandTeal`), with its kind. When the hold arrives, the pending item gives way to the held item in the normal colour.
- A session that holds something and also has a pending request for another item shows its holds. The pending item shows only while the session holds nothing.
- A claim (role `item`) keeps the T-168 rendering.

**Demo** (the epic's words). A Reviewer holding two items reads `T-b +1`, and a QA sent `qa request T-c` shows `T-c` dimmed until it takes the hold.

**Out of scope.** Resume, archive and the queue line (later tickets of this epic). Any change to how requests are routed to a pool member. The human inbox's `request` kind of T-283: crew requests stay first-line `report` messages.

**Constraints.**

- Tests go through the frame protocol first: a real hub, real spokes and the CLI on a temporary project (`hub/test/harness.ts`). The fake harnesses in `hub/test/fakes/` come second. The Neovim UI is tested headless on the stub hub (`nvim/test/stub-hub.ts`), read with `screenstring()`.
- No new seams inside the hub. New test helpers go in the test file or a new helper module, never in `hub/test/harness.ts`, which the hub lane is rewriting.
- A test that reads `hub.log` or `journal.jsonl` after an action first waits on the `hub.status` `flushLogs` barrier.
- Any recompute driven by hub events is coalesced once per tick (T-293). Nothing scans the message table per event or per view.
- Every key and action goes through the action registry.
- Suites run through `cland verify`. Run suite-weight work only when `cland verify queue --json` shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [ ] C1. A verifier with two or more holds shows its latest hold and `+N` in the sessions panel, and its selected row lists every hold with its role, newest first. A claim still renders as in T-168.
- [ ] C2. A verifier delivered `review request <id>` or `qa request <id>` with no hold shows that item dimmed. Its hold on the item, its verdict on it, or its stop clears the pending item, and a newer request replaces it. The id resolves with any kind prefix.
- [ ] C3. A hub test on a real hub with fake sessions proves both of these: the `heldAt` order of `session.list` holds, and the pending item's set, replace and clear paths, including a hub restart.
- [ ] C4. A regression test on a store with thousands of messages proves that a burst of deliveries and `session.list` calls never scans the message table. It uses SQLite tracing, as T-284's C7 test does.
- [ ] C5. A Neovim headless test on the stub hub shows `T-b +1` for a two-hold Reviewer and a dimmed `T-c` that turns normal when the hold frame arrives.
- [ ] C6. `hub/README.md` describes `holds[].heldAt` and the pending field in the process view. `nvim/README.md`'s session section describes `+N` and the dimmed pending item.
