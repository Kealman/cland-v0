---
id: T-1472
kind: task
title: A `deaf` state for a live harness that cannot take deliveries
state: open
status: review
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1468
blocked_by: []
topic: topic-1256
branch: t/T-1472-a-deaf-state-for-a-live-harness-that
created: 2026-10-30T07:50:18.206Z
updated: 2026-10-30T23:49:56.605Z
---

## Summary

A live process with deliveries held or unconfirmed for minutes looks like `running/busy` today. Retry refuses it and nobody is told. Derive a `deaf` mark and tell the human.

Root cause: A-14159 (deaf-bridge RCA, 2026-10-30). Epic E-1468.

The existing `inject-stalled` alert is the wrong signal today. After each hub restart it fires on a replay of an id that was already delivered or superseded (178eaf76 at 08:43Z, 09:15Z and 11:06Z; merge-batch:334e3a59 at 09:18Z and 11:01Z), while fresh deliveries land within seconds. It reaches the human's Telegram and tells them to relaunch the Coordinator when nothing is wrong, yet the real deaf spell at 06:53Z raised no alert until 07:26Z (cland-impl, 2026-10-30 11:32Z, at the human's question). `deaf` replaces that alert.

## Acceptance criteria

- [x] C1. A running session with a human delivery queued, or a delivery acked but not injected, for over 5 min while its pid is alive shows `deaf` in `cland session list`, `hub.status` and the workbench.
  - done: impl-1472 · 2026-10-30T23:48:45.715Z
- [x] C2. On entering `deaf`, the hub posts one Agents notice and one human inbox entry naming the session, the oldest held message id and the recovery command; for the Coordinator, also one General line.
  - done: impl-1472 · 2026-10-30T23:48:45.830Z
- [x] C3. The `deaf` mark and its inbox entry clear on the session's next `injected` event.
  - done: impl-1472 · 2026-10-30T23:48:45.955Z
- [x] C4. A replayed id the session already confirmed, or one followed by a later `injected` for the same session, raises no `inject-stalled` or `deaf` alert and no human inbox entry. Shown by a restart fixture that replays a confirmed id while fresh deliveries inject.
  - done: impl-1472 · 2026-10-30T23:48:46.285Z

## Comments

### impl-1472 · 2026-10-30T23:22:23.977Z

Contract inventory before changes: session state projection originates in Sessions.view -> HubCore remembered processes/session.process -> hub.status and session.list/frame snapshots/SessionRow. Consumers: CLI sessionLine; web session/workbench rows; Neovim session/workbench rows; InboxBoard messages/count/waits; Telegram/Discord gateway notice paths (hub message kinds/text and inbox/event projections). Persisted delivery readers include Store markDelivered/markInjected/uninjected/retryCandidate and Sessions recovery/retry. Test consumers found by inject-stalled/stateReason/HarnessProcessView searches include inject-stalled.test.ts, codex-delivery.test.ts, human-hold.test.ts, session/CLI/inbox/status/snapshot fixtures and T3/T4 harness lifecycle coverage. Keep existing stateReason and add optional deaf detail; previous wire shapes remain accepted. Replace alarm policy only; retry/backoff contracts stay unchanged. Authorized seams: memory/fake harness + projectHub frames, fake policy clock; no native harness or browser launch.

### impl-1472 · 2026-10-30T23:30:29.789Z

Consumer inventory published as A-14737 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14737-t-1472-session-delivery-contract-consumers.md). Additional migrated consumer found by rendered regression: nvim/lua/cland/state.lua projected process rows without stateReason; now preserves it. Initial C1 red: undefined != deaf. C2/C3 negative controls fail on missing inbox (0 != 1) and retained deaf after injection. C4 watermark negative control raises forbidden notice; restored implementation passes persisted restart replay + fresh injection. Head c1fefbf38; fetched origin/dev and merge reports already up to date. Final source checks underway; no suite run locally.

### impl-1472 · 2026-10-30T23:34:15.771Z

Coordinator decision 21604701: stage-specific notice recovery supersedes original blanket retry wording. Oldest queued never-attempted input -> cland session retry <session>; delivered/acked-uninjected -> cland session resume <session> --relaunch. Mixed sets name oldest stage and its command. Keep T-1473 eligibility/uncertain fence unchanged; controls execute each displayed command against fake harnesses.

### rev-26 · 2026-10-30T23:35:08.844Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261031-1472-source-1
commit: c1fefbf383cc577bfe765fc298393d58a970dc0a
scope: full
findings: [{"severity":"medium","text":"M1: SESSION_USAGE changes without migrating its owning frozen commands.json row. The complete unchanged CLI compatibility/help guards fail; retain red/green and update only the owning fixture metadata.","file":"hub/src/cli/usage.ts","line":29},{"severity":"medium","text":"M2: the first persisted Store/table/Sessions generation has no registered disposer until after its explicit close and second open; an earlier setup/assertion failure leaves work/storage live during root removal. New Web fixture/UI/spoke acquisition and receipt waits also lack the shared pre-registered bounded owner. Compose shared setup/observation/drain owners, retain final semantic assertions and omitted/aborted cleanup controls.","file":"hub/test/inject-stalled.test.ts","line":397},{"severity":"medium","text":"M3: a still-deaf restart loses the in-memory episode, republishes the same Agents notice through noticeTo and creates a fresh General notice. Early inbox projection can durably depart the old synthetic wait before health re-derives. Persist the episode/notification boundary and preserve one inbox wait until a real clear receipt; prove still-deaf restart, not only superseded replay.","file":"hub/src/adapters/sessions.ts","line":2163},{"severity":"medium","text":"M4: aggregate delivery events clear deaf for every recipient whose stored state is already injected. Another recipient acknowledging an old fan-out therefore clears a currently deaf session without its next injection. Bind clearing to the exact durable session-scoped positive transition and retain cross-recipient negative/own-injection positive controls.","file":"hub/src/adapters/sessions.ts","line":462},{"severity":"medium","text":"M5: all notices advertise session retry, but a delivered/unconfirmed candidate is refused by retry at2186–2201. The displayed command is not recovery for that outage. Resolve stage-appropriate guidance versus explicitly authorized eligibility with Coordinator; preserve existing attempted/uncertain fences and execute the displayed command in queued and delivered controls.","file":"hub/src/adapters/sessions.ts","line":2160},{"severity":"medium","text":"M6: legacy no-watermark fallback picks one injected row by queued_at descending. Equal timestamps can select an earlier sequence and leave a superseded intermediate replay eligible. Derive the latest confirmed sequence and prove prior persisted shape with equal-time confirmations and replay.","file":"hub/src/hub/store.ts","line":1111},{"severity":"medium","text":"M7: explicit synthetic deaf notice id overwrites AGENTS_JOURNAL_CHECKPOINT via core.ts1956–1958 although it has no journal agentsNotice. replayAgentsRecord195–200 then treats that absent checkpoint as beyond the durable prefix and skips pending lifecycle notices. Keep episode dedup separate from lifecycle checkpointing and retain a pending journal-suffix control.","file":"hub/src/adapters/sessions.ts","line":2163},{"severity":"low","text":"L1: owning guide still specifies startup+120/190s alarms and old unconfirmed-duration text, while migrated tests now assert330001/430001ms and oldest-held-message text. Update the owning boundary guidance.","file":"docs/agents/tests/hub-test-codex-delivery.test.ts.md","line":13}]
finding_counts: {"high":0,"medium":7,"low":1}

A-14740: consolidated source not clear. M1 frozen SESSION_USAGE migration;M2 bounded/pre-owned test acquisition/drain;M3 durable episode/inbox/notice dedup;M4 exact recipient injection clear;M5 actionable recovery guidance pending Coordinator decision;M6 legacy confirmation sequence;M7 deaf id must not overwrite lifecycle journal checkpoint. L1 Codex owning guide stale. C1 runtime unverified;C2/C3/C4failed. Retain all semantic/legacy/fencing controls, complete fixes then fresh pushed-head source review before Coordinator verify all. No Reviewer test/source mutation.

Criteria: C2 failed (Episode/notification state is not restart-stable; delivered outage advertises a refused recovery command, pending Coordinator disposition.), C3 failed (Another recipient's aggregate delivery event can clear this session without its next injection.), C4 failed (Legacy no-watermark equal-time confirmations can leave a superseded replay eligible.).

### rev-26 · 2026-10-30T23:46:09.861Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261031-1472-source-2
commit: a187d38a09f5990dc78acad52d4b20990802df06
scope: full
findings: [{"severity":"medium","text":"M2 remains: the held setup release is registered on the caseDeadlines proxy, whose teardown joins pending work before invoking that hook. A failure before explicit release617 leaves acquisition awaiting a release behind its own join. Pre-register emergency release/join on the real test context before deadline owners/admission, immediately own the assertion promise and retain an early-failure held control plus closed-Store assertion.","file":"hub/test/inject-stalled.test.ts","line":608},{"severity":"medium","text":"M4 remains at the new identity seam: deliverySessionId can be null for retained/provisional rows. A positive injection then skips onInjected, and Store clears the name-keyed episode rather than the durable session-id episode, leaving deaf/inbox stuck. Bind or migrate through the authoritative session-scoped positive receipt; prove null-id legacy recovery and preserve reused-name refusal.","file":"hub/src/hub/core.ts","line":1731}]
finding_counts: {"high":0,"medium":2,"low":0}

A-14742: source2 not clear for remaining M2 early-failure held cleanup cycle and M4 null-recipient persisted compatibility. Original aggregate fanout, durable episode/notices, lifecycle checkpoint, frozen help, equal-time fallback and owning guide issues closed in source; M5 follows independently checked Coordinator21604701 stage-specific decision without retry extension. C3failed; other criteria runtime-unverified. Complete both remaining fixes and fresh pushed-head review before Coordinator verify all; no full-run evidence inferred.

Criteria: C3 failed (Positive injection with retained null recipient identity skips exact callback and leaves durable/in-memory deaf episode uncleared.).

### impl-1472 · 2026-10-30T23:48:27.428Z

Source2 remaining boundaries fixed in pushed55db05668. M2: emergency release/join registered on real t before deadline owners/admission; assertion promise immediately caught/owned; omitted, aborted and early-failure controls pass with final Store-closed receipt. M4: optional confirmedSessionId passed only by adapter's captured session/validated hook/launch receipt; Store validates any existing identity, binds null rows atomically with positive injection and checkpoint/episode settlement, never consults current name holder. New legacy-null own-injection and reused-name negative tests were red (null != captured id; old id incorrectly confirmed new holder), now both green. Optional argument consumers: Sessions #confirm and injection completion, HubCore.completeCarriedBrief; legacy two-argument Store/core tests/journal/verifier-resolver callers remain compatible. Complete inject-stalled20/20 and typecheck pass locally; fresh review pending.

### rev-26 · 2026-10-30T23:49:56.605Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1472-source-3
commit: 55db0566881eae36b45a9a899f39a3b49664ef06
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14746: source3 clear, remaining M2/M4 closed. Real-test emergency release/join precedes deadline owners/admission with immediately owned assertion; held early-failure/closed-Store controls retained. Captured adapter/hook/launch identity atomically binds null recipient rows, refuses conflicting identities and clears exact episode after positive commit; legacy/reused-name controls retained. M1/M3/M5–M7/L1 remain closed; Coordinator21604701 stage-specific guidance without retry extension. C1–C4 done but runtime-unverified. Report ready for Coordinator verify all at frozen55db05668; no duplicate task verify or full-pass claim from local reports.
