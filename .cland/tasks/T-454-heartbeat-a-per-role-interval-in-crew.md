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
updated: 2026-10-15T09:01:53.406Z
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
  - done: impl-454 · 2026-10-15T07:49:11.278Z
- [x] C4. On an idle fake Coordinator a heartbeat starts a turn; on a busy one, or one waiting for approval, it arrives as one entry of the next turn's digest, a newer heartbeat replaces an undelivered older one, and it never steers a running turn.
  - done: impl-454 · 2026-10-15T08:15:18.498Z
- [x] C5. A heartbeat never changes the inbox count or shows as a needs-you, and the events view shows one background-layer row per firing with the session and counts, filtered by key `9` as kind `heartbeat`, proven headless.
  - done: impl-454 · 2026-10-15T07:40:46.443Z
- [x] C6. The connection keepalive is called keepalive in identifiers and comments, and no hub source uses "heartbeat" for it.
  - done: impl-454 · 2026-10-15T07:49:11.736Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-454-2 · 2026-10-15T07:49:57.099Z · commit b64e068182a0bfb027f5fdc2542a764c17e55b56
  - verified: rev-23 [reviewer] · run rev-2026-10-15-454-4 · 2026-10-15T08:16:17.074Z · commit 24ca7ce122bc41ec7075fd9cb0e0da354cec6098
  - verified: rev-23 [reviewer] · run rev-2026-10-15-454-6 · 2026-10-15T08:50:51.662Z · commit bdcddc3c3401dc268eb4eff0b420a8bab9590a62
- [x] C7. The Coordinator's clause, in `default-roles.ts` and the live `.cland/roles.toml`, says what to check, what to repair and when to escalate on a heartbeat, and to end a clean heartbeat without a message.
  - done: impl-454 · 2026-10-15T08:50:11.220Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-454-6 · 2026-10-15T08:50:51.663Z · commit bdcddc3c3401dc268eb4eff0b420a8bab9590a62
- [x] C8. `hub/README.md` describes the `heartbeat` setting, its default, the digest's rows, coalescing and `CLAND_HEARTBEAT_MS`, and `nvim/README.md` lists the `heartbeat` kind and key `9` in the events view.
  - done: impl-454 · 2026-10-15T07:40:48.284Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-454-2 · 2026-10-15T07:49:57.099Z · commit b64e068182a0bfb027f5fdc2542a764c17e55b56
  - verified: rev-23 [reviewer] · run rev-2026-10-15-454-4 · 2026-10-15T08:16:17.075Z · commit 24ca7ce122bc41ec7075fd9cb0e0da354cec6098
  - verified: rev-23 [reviewer] · run rev-2026-10-15-454-6 · 2026-10-15T08:50:51.663Z · commit bdcddc3c3401dc268eb4eff0b420a8bab9590a62

## Comments

### impl-454 · 2026-10-15T07:40:48.729Z

Implemented C1-C8 at 73bd78b8 and pushed the task branch to origin after merging origin/dev 9ec1da30. Targeted frame/fake-harness, configuration, keepalive and headless event checks pass; typecheck and shard lint pass. Evidence: A-2732, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2732-t-454-implementation-and-targeted-evidence.md. Requesting source review before the same-head verification run; no per-item QA policy applies.

### rev-23 · 2026-10-15T07:46:16.889Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-15-454-1
commit: 73bd78b87ddb68ca3c295cad0ffbfef71afe64f5
scope: full

Medium — hub/src/hub/store.ts:432: a known status transition is seeded from item.updated, so watched edits retaining updated can immediately become stale in their new review/ready state. Start an observed transition at now and cover retained-updated hand saves.
Low — hub/src/spoke/hub-client.ts:208/233: connection keepalive still has #startHeartbeat/#stopHeartbeat identifiers and callers, contrary to C6.
Full source review A-2739; no other blocking finding. No full verification clearance at this head; corrected source needs re-review first.

Criteria: C3 failed (A known status transition retaining an old updated timestamp becomes stale before one full interval in the new state.), C6 failed (Connection keepalive still uses #startHeartbeat/#stopHeartbeat private methods and callers.).

### impl-454 · 2026-10-15T07:49:12.210Z

Fixed source review A-2739 at pushed head b64e0681: known watched state transitions age from observation time, with a red/green watcher regression retaining updated; remaining connection methods use keepalive. Heartbeat tests 9/9, keepalive reconnect case, typecheck and diff check pass. Latest origin/dev 74cddcdd merged (tracker-only). Requesting source re-review before verification.

### rev-23 · 2026-10-15T07:49:57.099Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-454-2
commit: b64e068182a0bfb027f5fdc2542a764c17e55b56
scope: delta

No high or medium findings remain. hub/src/hub/store.ts:433 now ages known transitions from observation; hub/test/heartbeat.test.ts:233 covers watched review and ready transitions retaining an old updated timestamp, including eventual age. hub/src/spoke/hub-client.ts:208/233 and callers now use Keepalive. Incoming dev is tracker-only; prior full source review A-2739 remains applicable. A-2742 records the corrected source review and A-2741 targeted evidence.
C6/C7/C8 verified from source; C1-C5 await post-verdict exact-head verification. Source clear permits no-mode cland verify at b64e0681, without an executor override; this is not final evidence clearance.

Criteria: C6 verified, C7 verified, C8 verified.

### rev-23 · 2026-10-15T08:08:52.820Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-15-454-3
commit: b64e068182a0bfb027f5fdc2542a764c17e55b56
scope: evidence

Medium — hub/src/hub/core.ts:2115 and hub/src/hub/store.ts:1027-1030: unconditional idle-send binding also attaches held progress/events to role-clause roots. Existing progress/subscriptions tests reproduce across all three harnesses; QA relaunch sees injected instead of queued progress. Preserve role-clause exclusion and existing regression assertions.
Medium — hub/src/roles/default-roles.ts:58 and .cland/roles.toml:46: Coordinator clause replies are 8040/8091 bytes, exceeding the existing 7680-byte headroom bound in roles.test.ts:80. Shorten wording preserving all semantics; retain the bound.
Exact-head f3eca6ee/A-2758 is red: 1721/1730 hub tests pass, 9 fail, zero skips; Neovim not reached. Earlier source review missed these integration defects. A-2760 records the trace. No retry at unchanged head; fixes need source re-review.

Criteria: C4 failed (Idle role-clause sends invoke the general digest binder and prematurely inject held progress/events on restart/relaunch.), C7 failed (Default/live Coordinator clause replies exceed the existing 7680-byte headroom guard at 8040/8091 bytes.).

### impl-454 · 2026-10-15T08:15:21.624Z

Corrected A-2758/A-2760 at pushed head 24ca7ce1. Role-clause sends no longer late-bind held notes, and the late binder targets heartbeat rows only. Both Coordinator clauses shortened by 446 bytes without weakening the existing size guard or heartbeat policy. Every one of the nine failed full-run cases now passes targeted; heartbeat 9/9 and typecheck pass. origin/dev 0d04c4b6 merged (tracker-only). New source review requested before a new verification run.

### rev-23 · 2026-10-15T08:16:17.075Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-454-4
commit: 24ca7ce122bc41ec7075fd9cb0e0da354cec6098
scope: delta

Corrected source clear; no high/medium finding remains. core.ts:2115 excludes role roots; store.ts:1027-1037 independently excludes role notices and limits late binding to held heartbeat events, preserving ordinary progress/event batches. Default/live Coordinator clauses retain required heartbeat and existing policy semantics while saving 446 bytes each; unchanged headroom guards pass. Tracker-only dev merge adds no implementation delta.
A-2765 reports red-before/green-after restart reproduction, progress 11/11, three subscription harness cases, QA relaunch, both clause guards, heartbeat 9/9, typecheck/diff green. A-2767 records the delta; earlier reviewed transition-age/keepalive implementation remains unchanged.
C6/C7/C8 refreshed. C1-C5/final evidence await successful exact-head no-mode cland verify without executor override. Retain prior red f3eca6ee/A-2758; no final clearance yet.

Criteria: C6 verified, C7 verified, C8 verified.

### rev-23 · 2026-10-15T08:47:18.855Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-15-454-5
commit: 24ca7ce122bc41ec7075fd9cb0e0da354cec6098
scope: evidence

Medium — hub/src/roles/default-roles.ts:71 and live Coordinator clause: shortened 'first kind of first level' wording fails roles-snapshot.test.ts:32 and roles.test.ts:50, which pin 'first kind of the first level'. Also preserve the ready-event contract pinned at roles.test.ts:54 while retaining unchanged byte headroom. Prior source delta missed these companion contract assertions.
A-2787 / cc871d75 is red: 1727/1730 hub tests pass, no skips, Neovim not reached. All earlier held-digest and clause-size failures pass. Other failure: untouched codex-adapter.test.ts:272 usage equality differs only rateLimitsAt timestamps; Bugs/S outside race candidate requiring lead disposition.
A-2788 records the evidence. No unchanged-head retry; corrected clause source needs re-review and both full role files checked. No new criterion verification.

Criteria: C7 failed (Shortened default/live clauses fail existing first-kind wording contracts; the ready-event wording contract also needs preservation.).

### rev-23 · 2026-10-15T08:50:51.663Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-454-6
commit: bdcddc3c3401dc268eb4eff0b420a8bab9590a62
scope: delta

Corrected source clear. Default/live clauses restore pinned first-kind and ready-status-event wording with original semantics and unchanged byte guard. Claimant reports full roles-snapshot 9/9 and roles 8/8. Heartbeat/delivery logic remains A-2767; no further implementation delta. Incoming dev duration baseline is 3d300562/A-2714, retaining only the previously reviewed heartbeat remote-lifecycle allowance; config remote_budget 2→4 is inherited recorded policy, cap unchanged; other changes tracker.
A-2792 records delta. Directly read f87d70f4: T-465 owns outside Codex usage race; five whole Codex files serially/alone at this corrected head must all pass before the single no-mode verify. Any isolated failure means wait for shared fix. Source clearance does not waive that condition.
C6/C7/C8 refreshed; C1-C5/final evidence pending. Retain prior reds f3eca6ee/A-2758 and cc871d75/A-2787. No executor override.

Criteria: C6 verified, C7 verified, C8 verified.

### impl-454 · 2026-10-15T09:01:53.406Z

At reviewed/pushed bdcddc3c, completed Coordinator-required five serial whole codex-adapter.test.ts runs: 35/35 each (175/175 total), no skips. A-2802 summarizes durable logs A-2793/A-2796/A-2797/A-2799/A-2801. T-465 timestamp race did not reproduce; no outside-scope change. Source review A-2792 is clear; submitting the single authorized no-mode verification resubmit at this unchanged clean head.
