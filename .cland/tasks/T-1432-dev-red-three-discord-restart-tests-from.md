---
id: T-1432
kind: task
title: "Dev red: three Discord restart tests from T-1406 wait on T-1403's 5 s identify budget after restart"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
regression_of: T-1403
topic: topic-1158
branch: t/T-1432-dev-red-three-discord-restart-tests-from
created: 2026-10-28T18:24:49.928Z
updated: 2026-10-28T18:54:54.728Z
closed: 2026-10-28T18:54:28.458Z
---

## Summary

Dev 341a071e is red in T2: three `hub/test/discord-messages.test.ts` restart cases from T-1406 fail since T-1403 (identify budget, 5 s between identifies) landed after T-1406. "Discord stored and delivered reactions survive a restart exactly once" and its lost-delivery-frame variant fail with "restart READY: not within 1500 ms" (line 459). "Discord cursor waits for the durable hub result and survives duplicate replay after restart" hangs (180 s locally; stalled 10 min in mode-free runs). All three pass at 31834220 (T-1406 landed, before T-1403) and fail at 341a071e, locally on macOS and on Linux droplets (T-1424 f026a128 A-13395, T-1407 2b6968fd A-13396). The restart's new identify now waits for the budget, and the tests' bounds and fakes don't model it. Each landing's merge batch ran T1 only, so neither caught the interaction.

## Acceptance criteria

- [x] C1. The three restart cases pass at dev with T-1403's budget in force: the tests drive the identify spacing through the injected clock, or seed an identify history older than 5 s, so READY after restart arrives within their bounds, with no weakening of the reaction-once, cursor and duplicate-replay assertions and no change to the product budget.
  - done: impl-1432 · 2026-10-28T18:28:28.146Z
  - verified: rev-26 [reviewer] · run rev-20261028-1432-evidence-1 · 2026-10-28T18:47:52.908Z · commit 9854070b148fb1c230cc62f18c3457ec5bac6a4f
- [x] C2. The whole of hub/test/discord-messages.test.ts and discord-messenger.test.ts passes on Linux (mode-free) and 10/10 for the three cases under two workers plus CPU load on macOS.
  - done: impl-1432 · 2026-10-28T18:46:34.069Z
  - verified: rev-26 [reviewer] · run rev-20261028-1432-evidence-1 · 2026-10-28T18:47:52.908Z · commit 9854070b148fb1c230cc62f18c3457ec5bac6a4f

## Notes

Shared defect: blocks T-1424 and T-1407 (their mode-free runs hang on the cursor case). If the budget itself proves wrong for restarts (the spec says 5 s apart between identifies, back-off only after failures), stop and report to coord before changing product code.

## Comments

### coord · 2026-10-28T18:25:22.731Z

Moved into 0.3 (R-1278) on the answer to ask 40a404c0 (2026-10-28 18:25Z), under the human's standing yes of 05:04Z.

### impl-1432 · 2026-10-28T18:28:10.089Z

Tests-only scope; no shared contract or production change. Existing T2 frame/fake regressions supply red: both generated stored/delivered restart cases fail `restart READY: not within 1500 ms`; cursor bounded run times out during startup. Advance shared FakeClock downtime by 5000ms after old hub stop before recreating it: ages persisted Identify and REST pacing before recovery, keeps reaction-once/cursor/duplicate assertions. Dedicated 4999/5000 boundary remains discord-messenger.test.ts. macOS Node24.21 stress 10 rounds ×2 processes ×3 generated cases with busy CPU Worker: 60/60 executions and 20/20 exits pass. Root typecheck passed; full files/Linux pending.

### rev-26 · 2026-10-28T18:30:10.080Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1432-source-1
commit: 9854070b148fb1c230cc62f18c3457ec5bac6a4f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13401 source1 clear: only injected downtime before replacement startup and per-file guidance change; cursor/reaction-once/duplicate/old-wire assertions preserved, product budgets unchanged and dedicated 4999/5000 persisted spacing boundary retained. No reviewer workloads. A-13399 independently proves60 named local passes/20 native exits, but observed overlap/CPU progress/join/source metadata absent (lead8174c236 acknowledges). C1/C2 remain unverified; C2 pending Linux whole two files plus load-condition receipts. Exact-head mode-free task verification may proceed; no full run requested.

### impl-1432 · 2026-10-28T18:31:25.339Z

Reviewed head 9854070b148fb1c230cc62f18c3457ec5bac6a4f, Source1 clear rev-20261028-1432-source-1 / A-13401. Mode-free c561e678-976c-456b-8a9f-ccf582cfce5d submitted after clear. Coordinator explicitly authorized concurrent local receipt-complete stress repeat. A-13403 log + A-13404 driver: macOS arm64 Node24.21.0, 10/10 rounds, two child test processes plus busy CPU Worker, 60 named passes/20 exits0; each round positive lifespan overlap (min698.356ms) and CPU progress (min20,021 batches of10,000 iterations), explicit native CPU exit1 from intentional terminate and matching joined termination receipt; driver exit0. Secret scan with positive control clean. Local slot released; Linux result/final review pending. Whole local messages24/24, messenger38/38; root typecheck and wording lint passed.

### coord · 2026-10-28T18:32:46.709Z

Attribution confirmed by the periodic dev T3 9f628820 at 31834220 (A-13405): T0, T2, T3 and Web all green, discord-messages.test.ts included, on the dev just before T-1403 landed. The red starts at 341a071e (T-1403).

### rev-26 · 2026-10-28T18:47:52.908Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261028-1432-evidence-1
commit: 9854070b148fb1c230cc62f18c3457ec5bac6a4f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-13408 final clear verifies C1/C2 from original A-13407 plus A-13403/A-13404. Linux3968 ordinary passes+25 separate site loads, messages24/24/messenger38/38, three changed restart names and dedicated4999/5000 boundary allpass. Supplemental macOS60 named passes/20 exits0,10 rounds positive child overlap+CPU progress, observed CPU termination and joined exit; initial A-13399 limits retained. T0/T1/all fallbackT2/Web green, T3/T4 absent; actual Linux/browser/host-gate reuse/report-only timing limits recorded. No reviewer workloads, no source/product budget change.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-28T18:54:28.458Z

Merged 4d16ea1339dbcda77da72c8a33a86d9eceb017fa onto dev.

### coord · 2026-10-28T18:54:54.728Z

Post-landing check by coord: at dev 4d16ea13, hub/test/discord-messages.test.ts 24/24 and hub/test/discord-messenger.test.ts 38/38 pass (macOS, local). Dev is green on these T2 files again.
