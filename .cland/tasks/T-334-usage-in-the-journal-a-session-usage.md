---
id: T-334
kind: task
title: "Usage in the journal: a session-usage record at each changed session.usage publication and one at stop, with role, item, harness, model, totals and cost or rate-limit share, on all three adapters"
state: open
status: in progress
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-270
blocked_by:
  - T-333
topic: topic-209
branch: t/T-334-usage-in-the-journal-a-session-usage
created: 2026-10-13T14:04:09.872Z
updated: 2026-10-13T16:18:51.704Z
---

## Summary

The journal keeps each session's usage, so a run can be summed per role and per item. The hub writes a `session-usage` record whenever a `session.usage` publication differs from the last record, and one final record at stop. It works the same on Claude Code, Codex and OpenCode.

## Parent

E-270: Status, fields and instrumentation. Spec: `docs/spec/v0.1.2.md` §3.12 (session usage in the journal at each `session.usage` publication and at stop). Decided in T-255. Research: `docs/research/model-performance.md` on `research/model-performance`, sections 7 and 8, with `extract.py`.

## What to build

**The record.** A `session-usage` journal line with these fields:

- `session`, `sessionId`, `role`, `item`, `harness` and `model`.
- `total`: the `UsageCounts` the hub publishes (`hub/src/protocol.ts`), with `cost` when the harness reports it.
- `rateLimits`: the share the harness reports, when it reports one (Codex's rate limits).
- `final`: `true` on the stop record, `false` otherwise.

The role comes from the store and the item from the session's launch item, as `publishUsage` in `hub/src/hub/core.ts` reads them for usage subscriptions. Add `session-usage` to `JOURNALLED` in `hub/src/hub/journal.ts`.

**When it is written.**

- At each publication: `#usageChanged` in `hub/src/adapters/sessions.ts` publishes at most once a second per session. The hub writes a record when the totals or the rate-limit share differ from the last record for that session. An equal publication writes nothing, so the journal grows only with real change.
- At stop: one `final` record with the last totals, when the session ever reported usage. Stop covers `cland session stop`, a harness exit and a relaunch's stop (`session-stopped`, `harness-exited`).
- The last record per session is kept in memory. After a hub restart, the first publication writes a record again.

**Bounded work.** The comparison is constant work per publication. It reads no tracker item and no journal line.

**The three adapters.** Claude Code publishes from the mod's `turn.complete`, Codex from `thread/tokenUsage/updated` and its rate limits, OpenCode from its steps (`hub/src/adapters/usage.ts`). Each fake in `hub/test/fakes/` already reports usage. Extend a fake only where a test needs a second, different publication.

**The CLI.** `cland hub journal --kind session-usage --json` reads the records with no change. `hub/README.md` gives a `jq` line that sums the final records per role and per item.

**Docs.** `hub/README.md`'s journal section describes `session-usage`, its fields, the equal-publication rule and the `jq` line.

**Demo** (the epic's words). A fake Codex session's publications and stop leave records whose sums per role and item a `jq` line prints from `cland hub journal --kind session-usage --json`.

**Out of scope.** The launch's model (T-333). The account on each session and its limits (E-272). The retrospective that reads the records (E-273). Any usage subscription or threshold change.

**Constraints.**

- Tests go through the frame protocol first: a real hub, a real spoke and the CLI on a temporary project (`hub/test/harness.ts`). The fake harnesses in `hub/test/fakes/` come second, launched through `session.launch`.
- No new seams inside the hub. New test helpers go in the test file or a new helper module, never in `hub/test/harness.ts`.
- A test that reads `hub.log` or `journal.jsonl` after an action first waits on the `hub.status` `flushLogs` barrier (T-291).
- Any recompute driven by hub events is coalesced once per tick (T-293), with no synchronous full tracker hydration per event (the T-321 lesson). The record is written on the existing throttled publication, never on a new timer.
- Any panel test waits on state, never on a sleep. Every key goes through the action registry. This ticket adds neither.
- Suites run through `cland verify`, only after a clear source review and at the exact reviewed head (D25). Run suite-weight work only when `cland verify queue --json` shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [ ] C1. A fake Codex session with two different publications and one equal publication leaves two `session-usage` records. Its stop adds one `final` record with the last totals and the rate-limit share.
- [ ] C2. Fake Claude Code and OpenCode sessions leave records the same way, with `cost` where the fake reports it.
- [ ] C3. Each record names the session, its id, role, item, harness and model. A session with no usage leaves no record at stop.
- [ ] C4. A hub test with two roles and two items sums the final records per role and per item and matches the `jq` line in `hub/README.md`, applied to `cland hub journal --kind session-usage --json`.
- [ ] C5. `hub/README.md`'s journal section describes `session-usage`, its fields, the equal-publication rule and the `jq` line.

## Comments

### impl-334 · 2026-10-13T16:18:51.704Z

Implementation started. Test seams: session.launch/stop through the frame protocol with existing fake adapters, journal queries through frames and CLI after flushLogs. Attribution follows launch.item (E-270 decision 11); no tracker hydration.
