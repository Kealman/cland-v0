---
id: T-1403
kind: task
title: "The identify budget: 5 seconds apart, back-off only after failed identifies, the floor of remaining starts and the warning at 500"
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1312
blocked_by:
  - T-1402
topic: topic-1154
branch: t/T-1403-the-identify-budget-5-seconds-apart-back
created: 2026-10-27T23:38:46.427Z
updated: 2026-10-28T17:51:43.629Z
closed: 2026-10-28T17:51:43.629Z
---

## Summary

Identifies are spaced, counted in `hub.db` and guarded, so no crash or reconnect loop can reach Discord's 1000 a day, which would reset the token. Resume always comes first, and back-off follows only identifies that never reached READY. The remote stops below a floor of remaining session starts, and the human is warned at 500 identifies in a day.

## What to build

**The count.** Identify timestamps live in `hub.db` under the `discord` messenger, as a rolling 24 hours. Each identify waits at least 5 seconds after the previous one, across hub restarts too.

**Back-off.** It grows only after identifies that ended before READY, from 5 seconds, doubling, capped at 5 minutes, with equal jitter. A drop after READY reconnects without it.

**The floor.** Before each identify the remote reads `session_start_limit` from `GET /gateway/bot`. Below the floor of 100 it stops through 06's `identify-budget` cause with a warning naming when starts reset (`reset_after`), and sends no identify.

**The warning.** When the hub's own count reaches 500 in 24 hours, General gets one warning line, at most once per rolling day.

The fake's control sets `remaining` and `reset_after`.

Spec §3.8 (identify budget); research rule 12; Q-1293 (the 33-second recovery delay that back-off after every drop caused).

## Acceptance criteria

- [x] C1. Two identifies are never less than 5 seconds apart under the injected clock, including across a hub restart, and the identify count is read back from `hub.db` (test).
  - done: impl-1403 · 2026-10-28T13:53:41.894Z
  - verified: rev-32 [reviewer] · run rev-20261028-1403-evidence1 · 2026-10-28T14:11:37.559Z · commit e8b234c210277cda943e7557cad7c13ab401b445
- [x] C2. Identifies that end before READY are followed by growing jittered waits, and a drop after READY reconnects without that back-off (test).
  - done: impl-1403 · 2026-10-28T13:46:11.783Z
  - verified: rev-32 [reviewer] · run rev-20261028-1403-evidence1 · 2026-10-28T14:11:37.559Z · commit e8b234c210277cda943e7557cad7c13ab401b445
- [x] C3. A `remaining` below the floor on the fake stops the remote with the `identify-budget` cause and a warning naming when starts reset, and sends no identify (test).
  - done: impl-1403 · 2026-10-28T13:46:11.894Z
  - verified: rev-32 [reviewer] · run rev-20261028-1403-evidence1 · 2026-10-28T14:11:37.559Z · commit e8b234c210277cda943e7557cad7c13ab401b445
- [x] C4. The 500th identify in 24 hours writes one warning line in General, and the 501st writes none (test).
  - done: impl-1403 · 2026-10-28T13:46:12.000Z
  - verified: rev-32 [reviewer] · run rev-20261028-1403-evidence1 · 2026-10-28T14:11:37.559Z · commit e8b234c210277cda943e7557cad7c13ab401b445

## Notes

Shared files: discord-socket.ts

## Comments

### impl-1403 · 2026-10-28T13:40:24.806Z

Consumer inventory (rule 20): searched Identify/identify-budget/session_start_limit/getGatewayBot/DiscordSocket/DiscordRemote across hub, web, .agents, qa and docs, including all test tiers. Production: discord.ts, discord-socket.ts, discord-api.ts, messenger.ts, notices.ts, state.ts; stop-cause consumers protocol.ts, gateway.ts and status/doctor/secrets docs retain existing identify-budget class and frame shapes. Tests: discord-api.test.ts, discord-messenger.test.ts, discord-messages.test.ts; fakes discord/{gateway,fake-api,exchange,hub}. Guides: hub/README.md, docs/agents/secrets.md and discord test guides; implement skill. No existing budget record reader; add messenger-scoped remote_state key without schema or wire changes. Existing 4003 and invalid-session timing assertions must migrate to five-second spacing. Existing optional-store callers keep in-memory budgeting. Old-wire remote-cli regressions unaffected (no protocol changes). Approved seams: production factory/frame and fake REST/ws with injected clock; persisted state read via existing RemoteStore.

### rev-32 · 2026-10-28T13:51:15.113Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261028-1403-source1
commit: 2239f7d7088c51ef11828b69e7f4a21a33f2bef1
scope: full
findings: [{"severity":"medium","text":"M1: owning REMOTE_USAGE snapshot omits the two new shipped Identify-policy lines, breaking unchanged exact-byte/help guards; migrate only this row.","file":"hub/test/fixtures/cli-usage/commands.json","line":71},{"severity":"medium","text":"M2: new restart/backoff/warning/floor timing setup uses lastInbound nonnull/clock equality as Hello/admission-ready proof. Every inbound frame sets it before handling. Pre-arm an independently bounded owned exact replacement connection/client admission-scheduled receipt before clock advances; preserve timing/native/persistence assertions and setup-drain controls.","file":"hub/test/discord-messenger.test.ts","line":477},{"severity":"medium","text":"M3: existing persisted realClock cursor/restart consumer still requires replacement Identify within1500ms after immediate restart, conflicting with new5s spacing. Migrate to injected-clock exact admission/native receipts, retain cursor/replay/two-message assertions, and audit neighbouring consumers.","file":"hub/test/discord-messages.test.ts","line":95}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source review not clear; consolidated A-13315 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13315-t-1403-full-source1-at-2239f7d7-not-clear.md). Three medium findings: M1 frozen REMOTE_USAGE omitted; M2 timing setup uses lastInbound status timestamps instead of exact replacement connection/client admission-scheduled receipts; M3 existing realClock persisted cursor/restart test still expects second Identify within1500ms, conflicting with new5s spacing. No additional findings. Claimant has reproduced M1 guard failures and M3 'restart READY: not within1500ms'; corrections remain outside this commit. Budget reservation-before-I/O, fresh remaining floor/reset cause, rolling warning and failed-only backoff reviewed; docs/skill provenance present. Reviewer read only/no executions. C1 not clear; C2–C4 runtime-unverified. Consolidate corrections/consumer inventory and original red/green receipts, push and request fresh full source review before mode-free verify. Stable dev base per rule11; no per-item QA.

Criteria: C1 failed (Exact timing setup and existing persisted cursor/restart consumer require migration to the new five-second admission policy.).

### impl-1403 · 2026-10-28T13:52:52.717Z

Source1 corrections: M1 frozen commands.json REMOTE_USAGE row migrated with unchanged compatibility/full-help guards red then green; original outputs/exits in A-13314. M2 admission setup now pre-arms a bounded cancellation-owned diagnostic observer matching exact socket ordinal after timer installation, including opcode9 false; omitted/aborted observer controls drain native hub/fake/Store and timers. M3 reproduced discord-messages cursor/restart failure 'restart READY: not within 1500 ms' (exit1), migrated its production factory/hub/fake to shared FakeClock and exact admission/native Identify receipts without relaxing setup deadlines or durable cursor/replay/two-message assertions. Neighbour consumer audit: discord-pairing restart guards check REST registration or persisted numeric pairing, unaffected by websocket delay; remote-cli rotation/reload, config-set and setup fixtures use injected testMessenger rather than native Identify. All native repeated-Identify assertions located in discord-messenger and discord-messages are migrated. Existing protocol/old-wire fields unchanged.

### rev-32 · 2026-10-28T13:56:16.786Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1403-source2
commit: e8b234c210277cda943e7557cad7c13ab401b445
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source2 clear, Standards0/Spec0; A-13322 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13322-t-1403-full-source2-at-e8b234c2-clear.md). M1 owning REMOTE_USAGE snapshot matches help with guards unchanged. M2 safe client scheduled diagnostic follows admission timer install and names socket ordinal/delay; pre-armed independently bounded observer replaces timestamp setup in all timing arms, with cancellation/listener joins and omitted/aborted native/hub/Store/timer drainage controls. M3 cursor/restart production consumer shares FakeClock and exact admission/native receipts, retaining1500ms setup bounds, both durable cursors, replay dedupe and two-message final assertion. Neighbour inventory dispositions and docs/skill CHANGES retained. Budget/floor/backoff/warning behavior reviewed; public wire/outbox/roles unchanged. No dev merge or Reviewer execution. Original local macOS red/green captures and explicit missing M2 standalone-capture limit are supplemental implementation evidence, not configured/Linux proof. C1–C4 runtime-unverified. Mode-free configured verify may proceed at this unchanged head; original-record evidence review follows. Any changed head needs fresh source review before another run; no per-item QA or final-ready claim.

### rev-32 · 2026-10-28T14:11:37.559Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261028-1403-evidence1
commit: e8b234c210277cda943e7557cad7c13ab401b445
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Configured evidence clear; C1–C4 verified, Coordinator full-all remains separate/pending. A-13333 audits original f98604fb/A-13331 at unchanged source2 head:3929ordinary passes/499files+60separate load passes,zero nonpassing/unfinished starts. Seven new task identities ordinary+5/5load (42task finishes),maxsample1.141160432s. Checked persisted restart timestamps/exact5000ms boundary; failed-only jitter/cap/deadlines and READY reset; floor99/100,fresh recheck/reset timestamp/noIdentify and live hub;500/501 rolling warning/pruning. Exact admission omitted/aborted drainage controls, migrated cursor/restart consumer, unchanged resume/nonresumable and help guards pass; messenger38/messages18. Host T0 candidate029323f4 separate,not repeated Linux typecheck; Linuxc-8lon1 T1/allT2fallback/Web,Shell156/1248,2general/4Web workers,lifetime755s/$0.0524 notwall. Budget/lint report-only. No selectedT3/T4; Coordinator73b37880 separately schedules same-head full-all before enqueue. No full-all/readiness claim, Reviewer execution or per-item QA.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-28T17:51:43.629Z

Merged 341a071e4c01289cee3ed8c621de24459d5ba152 onto dev.
