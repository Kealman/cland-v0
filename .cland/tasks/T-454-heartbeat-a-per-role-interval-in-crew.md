---
id: T-454
kind: task
title: "Heartbeat: a per-role interval in crew.toml wakes an idle session with a hub-computed digest of what is in flight and what looks stale, folds into the next turn on a busy one, and is never a needs-you"
state: open
status: review
size: L
criterion_seq: 8
labels:
  - v0.1.3
  - hub
  - nvim
assignee: null
parent: E-423
blocked_by: []
topic: topic-275
branch: t/T-454-heartbeat-a-per-role-interval-in-crew
created: 2026-10-15T07:15:15.368Z
updated: 2026-10-15T07:40:59.708Z
---

## Summary

The human keeps an hourly check running outside the hub so that a review nobody requested or an ask nobody answered gets noticed (Q-380). This ticket gives each role an optional `heartbeat` interval in `crew.toml`, with `"1h"` as the Coordinator's default. At each firing the hub computes a digest of what is in flight and what looks stale and delivers it as an event of the new kind `heartbeat`. The delivery starts a turn only on an idle session and is never a needs-you. The Coordinator's clause says what to check, what to repair and when to escalate.

## Parent

E-423 "Rules and rhythm" (R-294), tracer bullet 1 of 7; spec `docs/spec/v0.1.3.md` §3.3; the epic's choices "The heartbeat setting", "The clock", "The digest", "Delivery and coalescing" and "The Coordinator on a heartbeat".

## What to build

**The setting (`hub/src/crew.ts`, `hub/src/cli/crew.ts`).**

- `[crew.<role>]` takes a new key `heartbeat`: a duration string of at least one minute, parsed with `hub/src/duration.ts`, or `"off"`. A shorter or malformed value is refused with a message naming the role and the minimum.
- A Coordinator without the key gets `"1h"`. Any other role without the key has no heartbeat.
- `cland init` writes `heartbeat = "1h"` under `[crew.coordinator]`. `renderCrew`, `crewSummary` and `cland crew show [--json]` list the value per role, marked `(default)` when it comes from the default.
- `cland crew set coordinator.heartbeat 30m` sets it. The next firing of every session in that role uses the new interval, counted from its last firing.
- Tests shorten the interval with `CLAND_HEARTBEAT_MS`, read only from the hub's environment, the way `CLAND_IDLE_NOTIFY_MS` shortens the idle threshold (`hub/src/hub/inbox.ts` `idleNotifyMs`). The one-minute floor applies to `crew.toml`, not to the env var.
- The live project's `.cland/crew.toml` gets `heartbeat = "1h"` under `[crew.coordinator]`.

**The clock (`hub/src/hub/store.ts`, `hub/src/hub/core.ts`).**

- Each session whose role has a heartbeat gets its own schedule, counted from its launch and keyed by its stable identity, never its name. A `--relaunch` resume keeps the schedule. A fresh launch starts a new one. A role change or a revocation re-reads the setting.
- The next firing time is a row in `hub.db`, so a hub restart keeps the schedule.
- A firing that fell due while the hub was down fires once after start, never once per missed interval.

**The digest.** The hub computes it at the firing, from state it already holds. It has two parts, each limited to ten rows with the rest summarised ("and 12 more"), as the v0.1 §3.9 digest is.

- *In flight:* the claimed items by status with their sessions, the running and queued runs (`verify queue`), the open asks and the live leases.
- *Stale*, each row with its age:
  - an item in `review` with no pending review request and no verdict at its head;
  - an item `ready` and not merged;
  - a session idle longer than `[inbox] idle_minutes`;
  - a run past its timeout, or one that ended with no posted result;
  - an ask open longer than the interval.
- An item or an ask counts as stale only after one full interval in that state.

**Delivery and coalescing (ADR 0007).**

- A heartbeat is an event of the new kind `heartbeat` addressed to its session, with the session as its subject. It is not a subscription and needs none.
- `EVENT_KINDS` in `hub/src/protocol.ts` and `nvim/lua/cland/event_kinds.lua` gain `heartbeat` as the ninth kind.
- On an idle session the delivery starts a turn. On a busy session, or one waiting for approval, it waits as one entry of the next turn's digest. A newer heartbeat replaces an undelivered older one. It never steers a running turn.
- It never enters the inbox and never counts as a needs-you.
- The events view (v0.1.2 §3.7) shows one row per firing at the background layer, with the session and the in-flight and stale counts. Key `9` filters `heartbeat`.

**Naming.** The connection keepalive is called "heartbeat" today: `HEARTBEAT_MS` and the `ping` frame comments in `hub/src/protocol.ts`, and comments in `core.ts`, `store.ts` and `journal.ts`. Rename it to "keepalive" in identifiers and comments, so that the glossary's Heartbeat means one thing. The wire frame `ping` stays as it is.

**The Coordinator's clause.** Edit `hub/src/roles/default-roles.ts` and the live project's `.cland/roles.toml`. On a heartbeat the Coordinator:

- reads the digest;
- repairs what it owns: requests the missing review, merges a ready item through the gate, asks an idle session for its state, requests again a run that never reported;
- escalates to the human with an ask only for a decision, a spend past a cap, or a stale row that survives two heartbeats after its repair;
- ends a heartbeat that has nothing stale without sending a message.

**Tests** run through the frame protocol and the fake harnesses (`hub/test/harness.ts`, `hub/test/fakes/`) with `CLAND_HEARTBEAT_MS`. They need no new seam inside the hub.

## Acceptance criteria

- [x] C1. `heartbeat` in `[crew.<role>]` accepts a duration of at least one minute or `"off"` and refuses anything else with the role and the minimum named; a Coordinator without it gets `1h`, other roles none; `cland init` writes it, and `cland crew show [--json]` and `cland crew set coordinator.heartbeat 30m` read and set it, the next firing using the new interval.
  - done: impl-454 · 2026-10-15T07:40:43.241Z
- [x] C2. Each heartbeat session has its own schedule from its launch, kept in `hub.db` across a hub restart, and a firing due while the hub was down fires exactly once after start, proven by a test with `CLAND_HEARTBEAT_MS`.
  - done: impl-454 · 2026-10-15T07:40:43.928Z
- [x] C3. The digest lists in-flight claimed items, runs, open asks and live leases, and as stale (with ages, only after one full interval) a review item with no request or verdict, a ready unmerged item, a session idle past `idle_minutes`, a run past its timeout or with no posted result, and an unanswered ask, each part capped at ten rows with an "and N more" line.
  - done: impl-454 · 2026-10-15T07:40:44.736Z
- [x] C4. On an idle fake Coordinator a heartbeat starts a turn; on a busy one, or one waiting for approval, it arrives as one entry of the next turn's digest, a newer heartbeat replaces an undelivered older one, and it never steers a running turn.
  - done: impl-454 · 2026-10-15T07:40:45.295Z
- [x] C5. A heartbeat never changes the inbox count or shows as a needs-you, and the events view shows one background-layer row per firing with the session and counts, filtered by key `9` as kind `heartbeat`, proven headless.
  - done: impl-454 · 2026-10-15T07:40:46.443Z
- [x] C6. The connection keepalive is called keepalive in identifiers and comments, and no hub source uses "heartbeat" for it.
  - done: impl-454 · 2026-10-15T07:40:47.232Z
- [x] C7. The Coordinator's clause, in `default-roles.ts` and the live `.cland/roles.toml`, says what to check, what to repair and when to escalate on a heartbeat, and to end a clean heartbeat without a message.
  - done: impl-454 · 2026-10-15T07:40:47.671Z
- [x] C8. `hub/README.md` describes the `heartbeat` setting, its default, the digest's rows, coalescing and `CLAND_HEARTBEAT_MS`, and `nvim/README.md` lists the `heartbeat` kind and key `9` in the events view.
  - done: impl-454 · 2026-10-15T07:40:48.284Z

## Comments

### impl-454 · 2026-10-15T07:40:48.729Z

Implemented C1-C8 at 73bd78b8 and pushed the task branch to origin after merging origin/dev 9ec1da30. Targeted frame/fake-harness, configuration, keepalive and headless event checks pass; typecheck and shard lint pass. Evidence: A-2732, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2732-t-454-implementation-and-targeted-evidence.md. Requesting source review before the same-head verification run; no per-item QA policy applies.
