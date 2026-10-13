---
id: T-234
kind: task
title: "cland verify queue view and metrics: holder, waiters, waits, ETA, in the
  CLI and the workbench"
state: closed
status: done
criterion_seq: 4
labels:
  - v0.1.1
  - ready-for-agent
assignee: impl-234
parent: E-230
blocked_by:
  - T-232
topic: topic-157
branch: t/T-234-cland-verify-queue-view-and-metrics
created: 2026-10-11T17:48:35.460Z
updated: 2026-10-11T23:52:33.887Z
---

## What to build

Queue metrics and a queue view for `cland verify`:
- `cland verify queue [--json]` shows the holder, the waiters in order, each one's wait so far, and an ETA from recent run durations.
- The workbench shows a queue line, with holder, waiters and the next ETA, in the sessions panel or the top bar.
- The hub records per-run wait and run times and exposes them in `hub status` and the journal.

## Acceptance criteria

- [x] C1. The CLI view lists holder, waiters, waits and ETA; the JSON form is stable.
  - done: impl-234 · 2026-10-11T22:37:21.733Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-234-3 · 2026-10-11T22:38:09.757Z · commit e20f21a65d11a32b92a69093418215cef26fb0fe
  - verified: rev-18 [reviewer] · run rev-18-20261011-234-5 · 2026-10-11T23:31:53.690Z · commit 382d0d8355d5925e7ed71cd8a382d3249dec7ba7
- [x] C2. The workbench line updates live from hub events (headless test).
  - done: impl-234 · 2026-10-11T21:51:14.246Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-234-1 · 2026-10-11T21:53:46.239Z · commit bc002cc920cc4a76413fef6a943d71997415cbb1
  - verified: rev-18 [reviewer] · run rev-18-20261011-234-3 · 2026-10-11T22:38:09.757Z · commit e20f21a65d11a32b92a69093418215cef26fb0fe
  - verified: rev-18 [reviewer] · run rev-18-20261011-234-5 · 2026-10-11T23:31:53.690Z · commit 382d0d8355d5925e7ed71cd8a382d3249dec7ba7
- [x] C3. Wait and run times are recorded per run and summarised (median and p90 over the last N runs).
  - done: impl-234 · 2026-10-11T21:51:14.396Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-234-1 · 2026-10-11T21:53:46.239Z · commit bc002cc920cc4a76413fef6a943d71997415cbb1
  - verified: rev-18 [reviewer] · run rev-18-20261011-234-3 · 2026-10-11T22:38:09.757Z · commit e20f21a65d11a32b92a69093418215cef26fb0fe
  - verified: rev-18 [reviewer] · run rev-18-20261011-234-5 · 2026-10-11T23:31:53.690Z · commit 382d0d8355d5925e7ed71cd8a382d3249dec7ba7
- [x] C4. `npm run typecheck && npm test` pass.
  - verified: rev-18 [reviewer] · run rev-18-20261011-234-5 · 2026-10-11T23:51:22.028Z · commit 382d0d8355d5925e7ed71cd8a382d3249dec7ba7
  - done: impl-234 · 2026-10-11T23:51:42.478Z

## Comments

### impl-234 · 2026-10-11T21:37:31.694Z

Claimed from dev badc088; read T-232/T-233 tracker handovers and final verdict evidence. Proposed public CLI/protocol plus headless workbench event/render seams. Will use T-232 durable timestamps, zero-duration cache hits, bounded recent-window statistics; inspect landed T-215 before final suite.

### impl-234 · 2026-10-11T21:42:12.955Z

Confirmed seams by coord 51bab979. First two red→green public protocol slices pass: hand holder/ordered waiters/CLI JSON+text/restart, and persisted wait/run timings with separate cached completion, zero cache time, journal and median/p90. ETA uses actual executions by effective mode while cache hits remain zero in aggregate metrics. Building headless workbench live-event/refresh-race coverage next.

### impl-234 · 2026-10-11T21:51:14.759Z

Implementation committed and pushed bc002cc920cc4a76413fef6a943d71997415cbb1; final origin/dev fetch+merge is up to date at badc088, T-215 not landed. C1–C3 done; public red→green queue/timing/window/cumulative ETA tests, held-probe/priority regressions, headless event/refresh race, typecheck/diff and old-hub upgrade smoke pass. A-1401: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1401-t-234-queue-view-and-timing-implementation-at-bc002cc.md. Complete protocol file running; C4 awaits final full suite.

### impl-234 · 2026-10-11T21:52:29.709Z

Final all suite f9ca6b78-8541-4f01-9d36-1dadefccd1cc submitted at unchanged bc002cc after review request and origin/dev merge, reporting to topic-157/rev-18/impl-234; worker PID 70302, queue position 4. Targeted evidence A-1405: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1405-t-234-targeted-verification-42-protocol-headless-upgrade.md. Complete protocol 42/42, final changed timing/ETA/window test 1/1, headless 1/1, typecheck/diff and public old-hub upgrade smoke pass. C4 pending; claim/head retained, going idle for hub result.

### rev-18 · 2026-10-11T21:53:46.239Z

verdict: review
result: clear
by: rev-18 [reviewer]
run: rev-18-20261011-234-1
commit: bc002cc920cc4a76413fef6a943d71997415cbb1

No high or medium findings. Checked versioned CLI queue/ordering/ETA, live workbench event and refresh replay, durable per-request timings/journal and last-20 median/p90. Cache completion stays separate from expiry, and compatibility display uses bounded asynchronous probes. C1–C3 checked with source and supplied public protocol/headless/upgrade evidence A-1401/A-1405. C4 remains pending exact-head managed all suite; final readiness is not asserted. Standards and Spec details: A-1407 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1407-t-234-review-at-bc002cc-queue-workbench-and-timing-clear.md

Criteria: C1 verified, C2 verified, C3 verified.

### rev-18 · 2026-10-11T22:33:26.908Z

verdict: review
result: not clear
by: rev-18 [reviewer]
run: rev-18-20261011-234-2
commit: bc002cc920cc4a76413fef6a943d71997415cbb1

Medium — hub/src/suite-lock.ts:18: display probe rejection escapes queue/status. report.ts:71 calls finish before timer initialization when spawn throws; sandboxed stdio status fails with that exact error in A-1417. Preserve unknown-holder display when discovery is unavailable. Medium — hub/test/journal-async.test.ts:165/:239 and hub/test/journal-flush.test.ts:24: immediate response inspection no longer matches asynchronous hub.status; await frames while retaining all responsiveness/budget/drain checks. C4 fails (typecheck pass; 1284/1288 hub, four failures, Neovim omitted). Details: A-1418 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1418-t-234-failed-full-suite-review-denied-probe-and-async-status-assertions.md

Criteria: C1 failed (Queue/status propagates denied process probe: report.ts finish accesses timer before initialization when spawn throws; sandboxed UI status fails.), C4 failed (A-1417 full suite exits 1: 1284/1288 hub, four sandbox/journal/status failures; Neovim not run.).

### impl-234 · 2026-10-11T22:36:01.132Z

Diagnosed A-1417/A-1418: all four failures reproduce red in targeted edges/journal files. Fix 50b1f32 initializes probe timer before synchronous denied spawn and updates journal tests to await status response frames while preserving responsiveness/budget/counter/drain/repetition/timeout assertions. Journal async 14/14, flush 1/1, sandbox stdio 1/1 and typecheck/diff pass. Merged origin/dev ef576e8 (T-129) cleanly; head e20f21a. T-215 not landed. Final merged-head targeted probes/queue/edges/typecheck underway, then fresh re-review/all suite.

### impl-234 · 2026-10-11T22:37:37.714Z

Corrected clean head e20f21a65d11a32b92a69093418215cef26fb0fe pushed; final origin/dev ef576e8 fetched and merged before full suite. Re-review request resolved to rev-18. Fresh all suite bcd301ab-ec65-4650-a97b-8098fec27674 submitted after review request, worker PID 45139/queue position 4, reports to topic-157/rev-18/impl-234. A-1420 durable correction evidence: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1420-t-234-review-fixes-at-e20f21a-denied-probes-and-asynchronous-status.md. Targeted journal 14/14 + flush 1/1, integrated edges 5/5 + deadline cleanup 1/1 + queue/held-probe 4/4, typecheck/diff pass. C1 restored done; C4 remains incomplete until managed result. Going idle with claim/head retained.

### rev-18 · 2026-10-11T22:38:09.757Z

verdict: review
result: clear
by: rev-18 [reviewer]
run: rev-18-20261011-234-3
commit: e20f21a65d11a32b92a69093418215cef26fb0fe

No high or medium source findings remain. Optional timer initialization makes synchronous denied spawn return unknown rather than reject queue/status. Journal tests await frames and preserve all held-gate/budget/counter/drain/deadline assertions. Queue/workbench/timing paths are byte-identical to bc002cc, and the T-129 integration introduces no task-local resolution changes there. C1–C3 freshly verified using source plus A-1420 correction/integrated evidence and prior unchanged UI evidence. C4 remains pending successful exact-head managed full suite. Details: A-1421 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1421-t-234-corrected-head-review-at-e20f21a-c1-c3-clear.md

Criteria: C1 verified, C2 verified, C3 verified.

### rev-18 · 2026-10-11T23:20:31.879Z

verdict: review
result: not clear
by: rev-18 [reviewer]
run: rev-18-20261011-234-4
commit: e20f21a65d11a32b92a69093418215cef26fb0fe

Medium — nvim/test/items.test.ts:100: expected container row is absent; board shows unscheduled. Medium — nvim/test/plan.test.ts:69/:75/:111/:148/:230/:310: six real-hub plan/graph navigation or refresh cases fail to observe expected plan/stage state. Queue line renders, but full UI integration is not green. A-1434 passes typecheck/hub then exits 1 with seven Neovim failures (1580/1587 total). No new root cause or causal attribution to load is established; diagnose startup/status/navigation readiness while preserving original assertions. C4 failed, C1–C3 marks retained. Details: A-1435 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1435-t-234-second-full-suite-failure-neovim-integration-remains-incomplete.md

Criteria: C4 failed (A-1434 full suite exits 1: hub green, seven Neovim real-hub items/plan/graph integration failures (1580/1587 total).).

### impl-234 · 2026-10-11T23:29:31.406Z

A-1434 startup failures reproduced in isolated real-hub item and plan tests. Temporary probes observed tracker levels empty when navigation starts; metadata waiting on OS queue inspection is the cause. Fix 356ef9b restores immediate hub.status from current jobs + latest cached ownership; explicit queue and scheduler refresh remain async/bounded. Reconnect test waits for visible epic before plan navigation, preserving receipt/watch assertions. Initial plan 11/11, items 4/4, queue headless 1/1 and journal 14/14+flush pass. Merged landed T-215 fa3a864 cleanly (ccbc82d), keeping its existing shard duration reports. Integration lint found T-129 launch-recovery missing from T-215 manifest; classified it machine in 382d0d8. Manifest passes on Node 24.21.0 (5 free/117 machine). Explicit sandboxed queue read now has its own live hand-holder fixture. Supported-runtime final targeted checks running before re-review/full suite.

### impl-234 · 2026-10-11T23:31:29.161Z

Final clean/pushed 382d0d8355d5925e7ed71cd8a382d3249dec7ba7 includes origin/dev fa3a864/T-215; fetched/merged immediately before final submission (up to date). Re-review request resolved to rev-18. Managed all suite 74b6c859-73d9-4051-bb29-7f58570cc4d6 submitted after review request through Node 24.21.0, worker PID 43489/queue position 3; reports to topic-157/rev-18/impl-234. Supported-runtime targeted checks pass: plan 11/11, items 4/4, queue headless 1/1, sandbox queue 1/1, journal flush 1/1, typecheck, manifest and diff. A-1438 evidence: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1438-t-234-startup-fix-and-t-215-integration-at-382d0d8.md. C4 still incomplete; going idle with stable head/claim.

### rev-18 · 2026-10-11T23:31:53.690Z

verdict: review
result: clear
by: rev-18 [reviewer]
run: rev-18-20261011-234-5
commit: 382d0d8355d5925e7ed71cd8a382d3249dec7ba7

No high or medium source findings remain. Pure immediate hub.status removes the reproduced tracker metadata/startup navigation dependency; explicit queue/scheduler ownership inspection stays bounded and async. Supported Node 24 plan/items/queue/sandbox checks in A-1438 pass with original assertions retained. T-215 broker/shard reporting remains intact; exact-head manifest covers all 122 files (5 free/117 machine), including T-129 launch recovery. C1–C3 freshly verified; C4 awaits successful exact-head managed full suite. Details: A-1439 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1439-t-234-startup-integration-re-review-at-382d0d8-c1-c3-clear.md

Criteria: C1 verified, C2 verified, C3 verified.

### impl-234 · 2026-10-11T23:52:13.054Z

C4 done: supported Node 24 typecheck and managed all suite 74b6c859-73d9-4051-bb29-7f58570cc4d6 at unchanged clean/pushed 382d0d8355d5925e7ed71cd8a382d3249dec7ba7 exit 0, 1595/1595 pass, zero failures/cancellations/skips. Shards: hub free 30/30 (0.73s), hub machine 1274/1274 (852.85s), Neovim 291/291 (99.38s). Log A-1451: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1451-suite-74b6c859-73d9-4051-bb29-7f58570cc4d6-all-at-382d0d8.log. rev-18 has verified C1–C4 at this exact head under rev-18-20261011-234-5 (A-1452). Claim retained pending hub readiness/merge; no further code changes.

### coord · 2026-10-11T23:52:33.887Z

Merged fae0e78106edd7947c2abb6931627647ec136d70 onto dev.
