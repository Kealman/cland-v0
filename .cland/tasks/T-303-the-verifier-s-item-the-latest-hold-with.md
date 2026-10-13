---
id: T-303
kind: task
title: "The verifier's item: the latest hold with +N, and a pending request
  dimmed until the hold"
state: closed
status: done
criterion_seq: 6
labels:
  - v0.1.2
  - ready-for-agent
  - hub
  - nvim
assignee: null
parent: E-275
blocked_by: []
topic: topic-185
branch: t/T-303-the-verifier-s-item-the-latest-hold-with
created: 2026-10-12T21:34:30.315Z
updated: 2026-10-12T23:31:51.527Z
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

- [x] C1. A verifier with two or more holds shows its latest hold and `+N` in the sessions panel, and its selected row lists every hold with its role, newest first. A claim still renders as in T-168.
  - done: impl-303 · 2026-10-12T23:11:51.829Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-303-2 · 2026-10-12T23:31:35.203Z · commit cad64e3178055386f85c104da988ec7596f26b67
- [x] C2. A verifier delivered `review request <id>` or `qa request <id>` with no hold shows that item dimmed. Its hold on the item, its verdict on it, or its stop clears the pending item, and a newer request replaces it. The id resolves with any kind prefix.
  - done: impl-303 · 2026-10-12T23:11:52.568Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-303-2 · 2026-10-12T23:31:35.203Z · commit cad64e3178055386f85c104da988ec7596f26b67
- [x] C3. A hub test on a real hub with fake sessions proves both of these: the `heldAt` order of `session.list` holds, and the pending item's set, replace and clear paths, including a hub restart.
  - done: impl-303 · 2026-10-12T23:19:32.329Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-303-2 · 2026-10-12T23:31:35.203Z · commit cad64e3178055386f85c104da988ec7596f26b67
- [x] C4. A regression test on a store with thousands of messages proves that a burst of deliveries and `session.list` calls never scans the message table. It uses SQLite tracing, as T-284's C7 test does.
  - done: impl-303 · 2026-10-12T23:19:32.816Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-303-2 · 2026-10-12T23:31:35.203Z · commit cad64e3178055386f85c104da988ec7596f26b67
- [x] C5. A Neovim headless test on the stub hub shows `T-b +1` for a two-hold Reviewer and a dimmed `T-c` that turns normal when the hold frame arrives.
  - done: impl-303 · 2026-10-12T23:11:54.535Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-303-2 · 2026-10-12T23:31:35.203Z · commit cad64e3178055386f85c104da988ec7596f26b67
- [x] C6. `hub/README.md` describes `holds[].heldAt` and the pending field in the process view. `nvim/README.md`'s session section describes `+N` and the dimmed pending item.
  - done: impl-303 · 2026-10-12T23:11:55.205Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-303-2 · 2026-10-12T23:31:35.203Z · commit cad64e3178055386f85c104da988ec7596f26b67

## Comments

### impl-303 · 2026-10-12T23:00:00.728Z

Implementing the verifier column and persisted pending requests. Test seams are those specified by the item: real hub/spoke frame protocol, SQLite tracing for message-table scan regression, and headless Neovim on the stub hub. Panel edits stay within verifier item rendering.

### impl-303 · 2026-10-12T23:12:10.021Z

Implementation committed and pushed to origin at cebc5342fa1de84f3451d77805a3e72d5ce63e9a. C1–C6 done. Typecheck, 7 session-hold/lifecycle tests, 4 inbox workload tests (including C7), and the Neovim verifier-column test pass. Review evidence: A-1674 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1674-t-303-implementation-and-verification.md. Final full suite is queued only after requesting review.

### rev-23 · 2026-10-12T23:14:31.991Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-303-1
commit: cebc5342fa1de84f3451d77805a3e72d5ce63e9a

Medium — hub/src/hub/core.ts:969: #publishPresence rebuilds all sessions for every accepted delivery; alternating requests emit one full presence per ack despite process-frame coalescing, violating once-per-tick event-driven recompute.
Medium — hub/test/session-holds.test.ts:124: timestamp migration dropped the existing exact role/cardinality precondition; restore those checks rather than first-item-only equality.
Full verification pending. Evidence A-1676: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1676-t-303-review-presence-burst-recompute-and-weakened-hold-precondition.md.

Criteria: C4 failed (Accepted deliveries synchronously rebuild/publish whole presence per ack; alternating bursts emit many presence snapshots while the regression only bounds process frames.), C3 failed (Shutdown test replaces exact one review hold with first-item-only precondition; restore role/cardinality strength with heldAt.).

### impl-303 · 2026-10-12T23:19:44.192Z

Review findings A-1676 corrected and pushed at cad64e3178055386f85c104da988ec7596f26b67. Work-driven presence is now coalesced; the native tracer asserts bounded metadata reads and presence frames. Restored exact shutdown hold assertion. Reproduced and fixed the cancelled suite's teardown failures; targeted artifact/journal/ask tests and typecheck pass. A-1681 records the correction. New full suite follows the corrected review request.

### impl-303 · 2026-10-12T23:31:19.698Z

Exact-head full verification passed at cad64e3178055386f85c104da988ec7596f26b67: run c33afbb8-c948-42c1-affa-7648ce207451, exit 0, 1698/1698 tests passed with no failures, cancellations or skips. Durable log A-1685: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1685-suite-c33afbb8-c948-42c1-affa-7648ce207451-all-at-cad64e3.log. Source re-review was clear in A-1682; awaiting the Reviewer's exact-head verdict and hub ready event.

### rev-23 · 2026-10-12T23:31:35.203Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-303-2
commit: cad64e3178055386f85c104da988ec7596f26b67

No high or medium findings remain. Both A-1676 findings are fixed, and late close paths are guarded. Exact-head full c33afbb8 passed typecheck and all 1698/1698 tests, with zero failures/cancellations/skips. C1–C6 verified. Evidence A-1686: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1686-t-303-final-review-at-cad64e3.md; source A-1682 and full log A-1685.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-12T23:31:51.527Z

Merged 6a8a5652fdd3e013b3b3b514e2b11f4756385c8f onto dev.
