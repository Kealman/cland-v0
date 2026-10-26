---
id: T-1323
kind: task
title: Remote state lives in hub.db with TEXT ids, and a poller lease keeps one gateway per project
state: open
status: ready
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1307
blocked_by:
  - T-1321
topic: topic-1077
branch: t/T-1323-remote-state-lives-in-hub-db-with-text
created: 2026-10-26T02:28:46.856Z
updated: 2026-10-26T04:52:59.365Z
---

## Summary

A remote's state lives in `hub.db`, with no separate file: pairings, waiting codes and per-stranger reply counts, cursors, the poller lease, Discord's identify count, the outbox tables and the map from chat messages to cland messages, topics and asks. One gateway per project consumes a token, enforced by a lease.

## What to build

Store migrations add the remote tables. Discord ids are stored as TEXT, since they exceed JavaScript's safe integers and `node:sqlite` reads 64-bit integers back lossily. The poller lease records the pid and start time. A gateway that meets a held lease at start waits for it for up to 60 seconds and kills nothing; reuse the hub's precise process identity (T-543) for the liveness check. Spec §3.1 and §3.9.

## Acceptance criteria

- [x] C1. Remote state written before a hub restart reads back unchanged after it, a chat id above 2^53 included, with no state file outside `hub.db` (test).
  - done: impl-1323 · 2026-10-26T04:25:24.056Z
  - verified: rev-26 [reviewer] · run rev-20261026-1323-evidence-1 · 2026-10-26T04:52:59.008Z · commit 7cd3b8251f088ff3764ed89840d8c06af5a28b35
- [x] C2. A second gateway on the same `hub.db` waits on the held lease for up to 60 seconds, signals and stops nothing, and takes the lease once it is released or its holder is provably dead (test).
  - done: impl-1323 · 2026-10-26T04:37:34.426Z
  - verified: rev-26 [reviewer] · run rev-20261026-1323-evidence-1 · 2026-10-26T04:52:59.008Z · commit 7cd3b8251f088ff3764ed89840d8c06af5a28b35

## Comments

### impl-1323 · 2026-10-26T03:43:46.593Z

Pre-change consumer inventory (rule 20): new Gateway() callers are hub/src/hub/daemon.ts (normal and stdio startup) and hub/test/gateway.test.ts (direct held-start regression). gatewayRemotes flows through hub/test/harness.ts ProjectHubOptions into serveProject. Remote.start(send), existing frame replies/snapshots/lists and the protocol authority table remain unchanged; messenger.ts and all production/UI clients retain the previous wire shape, exercised by gateway.test.ts. Storage readers are Store and its store.test.ts/openDatabase injection consumers; remote tables are additive on the same handle, with no dropped/retyped columns or separate state file. No shipped remote persisted-record consumer yet exists outside the gateway (prototype branch is not shipped). Docs/skill consumers: hub/README.md gateway section, docs/agents/tests/hub-test-gateway.test.ts.md and .agents/skills/implement/SKILL.md. QA briefs, startup probes, T3/T4, nvim, web and shared wire have no gateway constructor or remote table readers; existing old-hello regression stays. Planned additions: RemoteState/RemoteStore on Store.remotes, typed TEXT identity columns, extensible outbox/attempt tables, singleton owner-UUID poller lease with pid/start/native birth identity, and optional injected acquire/release Gateway lease port. Lease uses fake time/process facts in T1 and projectHub frame receipts in T2; no real platform/token or native harness.

### impl-1323 · 2026-10-26T03:57:08.423Z

Consumer inventory and red/green provenance published as A-12264 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12264-t-1323-storage-and-gateway-consumer-inventory.md). All independent implementation/docs are prepared; root typecheck and closed-item wording lint pass on local macOS arm64 Node 24.21.0. First source review is deliberately held under Coordinator decision 4bd6a555 until T-1326 lands and I am told to merge dev, wire Store.remotes as its state sink, and make the prepared 60s daemon-conflict regression green. No full-suite/Linux/browser evidence is claimed.

### rev-26 · 2026-10-26T04:28:17.445Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261026-1323-source-1
commit: 35fff674afe93ffe7ee78e8ce1176ebadf254ece
scope: full
findings: [{"severity":"medium","text":"M1: HUB_USAGE changed without updating its owning frozen commands.json row; existing compatibility/full-help guards fail. Correct only that row and preserve original red/green receipts.","file":"hub/src/cli/usage.ts","line":24},{"severity":"medium","text":"M2: Held native-probe and gateway held-stop receipt tests rely on unbounded entered.promise plus lexical finally; missing setup receipts/test cancellation can bypass barrier release, abort, underlying operation drain and Store.close. The timeout-case inspected.promise is likewise never settled on failure before caseDeadlines drainage. Register unconditional pre-trigger disposal, independently bound/cancel waits, and prove missed-receipt cleanup while retaining every assertion.","file":"hub/test/poller-lease.test.ts","line":157},{"severity":"medium","text":"M3: Timeout-containment WebSocket is acquired before disposal registration, cleanup terminates without a close receipt, and welcome/result waits can outlive the test cancellation. Register nullable socket ownership before acquisition, use shorter independent frame waits, and drain client closure before hub/database/root disposal while preserving authenticated web status assertions.","file":"hub/test/gateway-state.test.ts","line":198}]
finding_counts: {"high":0,"medium":3,"low":0}

Full Standards/Spec audit complete; A-12285. Standards M1 frozen HUB_USAGE row, M2 unconditional held-operation/missed-receipt disposal, M3 WebSocket acquisition/closure and shorter frame bounds. No additional production persistence/native-identity/CAS/deadline/drainage/timeout-containment findings. A-12264 inventory and A-12280 local summary inspected; M1 reported original red/green A-12281–A-12284 remains uncommitted correction, not part of reviewed head. Preserve original outputs/source limits. Correct all findings and request fresh pushed-head source review before verification. C1/C2 runtime unverified; no reviewer execution/delegation. Coordinator's rule-6 all run remains separate.

Criteria: C2 failed (Poller/stop and authenticated-web fixture cleanup is not safe when expected receipts are missing; correct M2/M3 before same-head runtime settlement.).

### rev-26 · 2026-10-26T04:35:48.474Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1323-source-2
commit: 6fe5aa24adc0e1ff0ff8703ae7e3b0d1d2752f56
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear; A-12288 carries the complete A-12285 audit and correction review. M1 only HUB_USAGE frozen key changed; original guard red/green inspected. M2 unconditional pre-trigger held-operation ownership, independent fake-time/cancellation waits, barrier release and underlying producer/acquisition/stop drainage before SQLite close, including omitted/aborted receipt controls. M3 nullable socket pre-owned, actual close awaited, shorter named/frame bounds and authenticated web/root assertions retained. Production source unchanged; no remaining Standards/Spec findings. Saved local poller9/9 and gateway-state9/9 A-12286/A-12287 inspected with original source/capture limits; no reviewer execution or merged Linux claim. C1/C2 claimant done, runtime unverified. Submit one mode-free verify unchanged then request final same-head evidence; Coordinator separately owns rule-6 all.

### rev-26 · 2026-10-26T04:36:43.926Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261026-1323-admission-1
commit: 6fe5aa24adc0e1ff0ff8703ae7e3b0d1d2752f56
scope: evidence
findings: [{"severity":"medium","text":"M4: The three new tier rows are outside global lexical path order. The mode-free verification was refused by verify-tiers before execution. Move the rows only, retain their tier values and unchanged guard, then obtain fresh source review before retry.","file":"hub/test/tiers.json","line":170}]
finding_counts: {"high":0,"medium":1,"low":0}

Pre-admission evidence not clear; A-12289. Hub refusal verify-tiers at 6fe5aa24a supplies no runtime evidence. Tier ordering was missed in source review. Correct only the three new row positions, preserve refusal and unchanged manifest guard receipt, then request source review before retry. Prior M1–M3 audit remains; no production behavior finding or new execution claim. Coordinator rule-6 all remains separate.

Criteria: C2 failed (Configured verification was refused before execution by tier-map order; fresh source settlement and same-head runtime evidence are required.).

### rev-26 · 2026-10-26T04:38:45.735Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1323-source-3
commit: 7cd3b8251f088ff3764ed89840d8c06af5a28b35
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear; A-12295 carries A-12285/A-12288 and resolves admission M4. Complete correction only reorders three manifest entries; parsed mapping exactly equal and tests globally sorted, all tier values/guard unchanged. A-12290 original red, archived mislabeled A-12291 still red (not proof), actual A-12292 green inspected. No remaining Standards/Spec findings or production change/dev merge. C1/C2 claimant done, no runtime verification yet; initial refusal executed no suite. Retry one mode-free verify at this head then request same-head evidence. Coordinator's rule-6 all remains separate. No reviewer execution.

### impl-1323 · 2026-10-26T04:52:57.945Z

Unchanged head 7cd3b8251f088ff3764ed89840d8c06af5a28b35 has green admitted mode-free run 987f83a2-5ac3-4c48-a5be-955397707670 (A-12296). Linux droplet c-8 lon1, x64 6.8.0-142-generic, Node24.21.0, Neovim0.12.5, workers2, Chrome Headless Shell156.0.8078.4. Completed T0/all T1/fallback all T2/Web: 3363 passed, none failed/cancelled/skipped. T3/T4 did not run; budgets/lint remain report-only. Checked the new tests' generated finish receipts separately from exit status: 20 base cases and 100 scoped load receipts, all pass; maximum new-case observed duration0.389588s (no >=3s new case). Executor lifetime730s/cost$0.0507. Final same-head evidence review requested; Coordinator owns the separate rule-6 verify all prerequisite before enqueue.

### rev-26 · 2026-10-26T04:52:59.008Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1323-evidence-1
commit: 7cd3b8251f088ff3764ed89840d8c06af5a28b35
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head task evidence clear; A-12297. A-12296/run987f83a2 matches source-clear A-12295; independent progress deduplication reconciles3363 ordinary passes/451 file passes and100 separate load test passes (20 new identities ×5), no fail/cancel/skip. Exact restart/TEXT round trips, CAS/dead/reused/unknown identities, exact fake60s, cancellation/held/missed/aborted cleanup, redacted status/log, authenticated web status/root and positive socket close assertions all have named passes. T0/all T1/fallback all T2/Web completed; no T3/T4/full integration claim. New identities below3s, no allowance; host prepared-tree typecheck reuse/report-only limits retained. C1/C2 verified; no remaining findings or reviewer execution. Coordinator separately owns required rule-6 all before enqueue.

Criteria: C1 verified, C2 verified.
