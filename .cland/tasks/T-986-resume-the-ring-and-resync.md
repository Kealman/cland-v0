---
id: T-986
kind: task
title: Resume, the ring and resync
state: closed
status: done
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by:
  - T-985
topic: topic-794
branch: t/T-986-resume-the-ring-and-resync
created: 2026-10-20T16:50:00.557Z
updated: 2026-10-21T11:28:00.508Z
closed: 2026-10-21T11:28:00.508Z
---

## Summary

A reconnecting client sends `resume` with its epoch and number. It receives the missed deltas from the hub's in-memory ring, or a fresh snapshot when the ring no longer covers them or the epoch changed. A connection that falls too far behind has its model stream resynced.

## What to build

The ring holds the last 15 minutes of deltas, at most 4 MiB. A hub restart starts a new epoch. On `resume` with a number the ring still covers, the hub sends exactly the missed deltas, then the live ones. Otherwise it sends a fresh snapshot. A connection whose unsent bytes pass 4 MiB has its model stream closed with `resync`, and the client resumes from its number.

## Acceptance criteria

- [x] C1. A featured client dropped while five items change sends `resume` and receives exactly those five deltas in order, then live ones (test).
  - done: impl-986 · 2026-10-21T10:48:13.425Z
  - verified: rev-26 [reviewer] · run rev-20261021-986-final-1 · 2026-10-21T11:09:20.493Z · commit e48d14f883201244acf1df5ebc6e775a98f467f9
  - verified: rev-26 [reviewer] · run rev-20261021-986-final-2 · 2026-10-21T11:22:47.884Z · commit 31637af300875cd5aa75d1256ddcf503b11742ab
- [x] C2. A `resume` whose number the ring no longer covers, or whose epoch differs, receives a fresh snapshot in the current epoch (test, both cases).
  - done: impl-986 · 2026-10-21T10:42:57.415Z
  - verified: rev-26 [reviewer] · run rev-20261021-986-final-1 · 2026-10-21T11:09:20.493Z · commit e48d14f883201244acf1df5ebc6e775a98f467f9
  - verified: rev-26 [reviewer] · run rev-20261021-986-final-2 · 2026-10-21T11:22:47.884Z · commit 31637af300875cd5aa75d1256ddcf503b11742ab
- [x] C3. A hub restart starts a new epoch, and a client resuming across it receives a fresh snapshot (test with two hub starts).
  - done: impl-986 · 2026-10-21T10:59:01.131Z
  - verified: rev-26 [reviewer] · run rev-20261021-986-final-1 · 2026-10-21T11:09:20.493Z · commit e48d14f883201244acf1df5ebc6e775a98f467f9
  - verified: rev-26 [reviewer] · run rev-20261021-986-final-2 · 2026-10-21T11:22:47.884Z · commit 31637af300875cd5aa75d1256ddcf503b11742ab
- [x] C4. The ring keeps at most 15 minutes and 4 MiB of deltas (fake-clock test at both bounds).
  - done: impl-986 · 2026-10-21T10:42:57.462Z
  - verified: rev-26 [reviewer] · run rev-20261021-986-final-1 · 2026-10-21T11:09:20.493Z · commit e48d14f883201244acf1df5ebc6e775a98f467f9
  - verified: rev-26 [reviewer] · run rev-20261021-986-final-2 · 2026-10-21T11:22:47.884Z · commit 31637af300875cd5aa75d1256ddcf503b11742ab
- [x] C5. A connection whose unsent bytes pass 4 MiB gets `resync` on its model stream and resumes from its number (test with a stalled reader).
  - done: impl-986 · 2026-10-21T10:59:01.156Z
  - verified: rev-26 [reviewer] · run rev-20261021-986-final-1 · 2026-10-21T11:09:20.493Z · commit e48d14f883201244acf1df5ebc6e775a98f467f9
  - verified: rev-26 [reviewer] · run rev-20261021-986-final-2 · 2026-10-21T11:22:47.884Z · commit 31637af300875cd5aa75d1256ddcf503b11742ab
- [x] C6. `hub/README.md` documents `resume`, the ring's bounds and `resync`.
  - done: impl-986 · 2026-10-21T10:42:57.524Z
  - verified: rev-26 [reviewer] · run rev-20261021-986-source-2 · 2026-10-21T10:49:02.923Z · commit 869aa5cafa772d2f6275cc7f7b64e724b1b5c361
  - verified: rev-26 [reviewer] · run rev-20261021-986-source-3 · 2026-10-21T10:59:47.788Z · commit e48d14f883201244acf1df5ebc6e775a98f467f9
  - verified: rev-26 [reviewer] · run rev-20261021-986-final-1 · 2026-10-21T11:09:20.493Z · commit e48d14f883201244acf1df5ebc6e775a98f467f9
  - verified: rev-26 [reviewer] · run rev-20261021-986-source-delta-1 · 2026-10-21T11:14:05.731Z · commit 31637af300875cd5aa75d1256ddcf503b11742ab
  - verified: rev-26 [reviewer] · run rev-20261021-986-final-2 · 2026-10-21T11:22:47.885Z · commit 31637af300875cd5aa75d1256ddcf503b11742ab

## Comments

### impl-986 · 2026-10-21T10:33:35.167Z

Confirmed T1/T2 seams with Coordinator. First T2 red→green: hello.resume replays exactly five missed item changes in sequence before the sixth live change. Local Darwin arm64 targeted file only; no suite receipt yet. Implementing retention bounds, fallback epochs and stalled-stream resync.

### rev-26 · 2026-10-21T10:45:49.129Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261021-986-source-1
commit: f2760a3051692855f80e433fbb1ba1959ba82441
scope: full
findings: [{"severity":"medium","text":"M1/Standards: the 2-second resync deadline starts before a paused reader and twelve sequential 700-KiB edits; it measures setup/publication plus drain and can expire before the reader is released. Arm observation first, complete/bound setup, then start the downstream receipt bound after release; keep final assertions (rule 9).","file":"hub/test/connection-resync.test.ts","line":59},{"severity":"medium","text":"M2/Spec: replacing an existing subscription during another client's synchronous publication leaves its old callback captured in core fan-out. Resume replays N, then fan-out invokes the stale callback and delivers N again. Invalidate replaced callbacks or skip removed clients; regress explicit resume of an existing later subscriber, including queued reentrant publication.","file":"hub/src/hub/dispatch.ts","line":1010}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source audit against fixed base 3da31f0f: not clear. Standards M1 at connection-resync.test.ts:59 violates rule 9's setup/receipt deadline separation. Spec M2 at dispatch.ts:1010 lacks a subscription-generation fence, allowing a replaced callback already captured by core.ts:657/:673 to duplicate replayed deltas. Existing new-client reentrant test does not cover replacement of an existing subscriber. Accepted hello.resume design/retention/queue architecture and source docs otherwise match criteria; no other findings. No Reviewer tests or execution; read-only diff check clean. A-8296 is narrative local targeted evidence, raw original receipt supplement requested with provenance limits. Full two-axis audit A-8297 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8297-t-986-source-not-clear-at-f2760a30-subscription-replacement-and-test-boundary.md. C1/C5 failed; no verification marks. Corrected head requires fresh source review before verification.

Criteria: C1 failed (M2: explicit resume can replay a delta then receive it again through the replaced subscription's captured callback.), C5 failed (M2 duplicates resumed model output through stale callbacks; M1 starts the stalled-reader receipt deadline during setup.).

### rev-26 · 2026-10-21T10:49:02.923Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-986-source-2
commit: 869aa5cafa772d2f6275cc7f7b64e724b1b5c361
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; full Standards/Spec audit A-8304 completes A-8297. M1 fixed by observing frames before publication and starting bounded resync drain after acknowledged edits and reader release, retaining final assertions. M2 fixed by subscription-generation fence; new earlier/later-subscriber regression covers both current and queued captured callbacks and exactly-once contiguous replay. Original red mismatch (task/topic duplicated) retained A-8302. No other findings, no post-review dev merge, full diff check clean. C6 documentation source-verified. C1–C5 await post-source exact-head verification. Raw local Darwin targeted receipts A-8301/A-8302 retain precommit and grouped-exit limits; A-8303 has individual command exits for hub typecheck and affected targeted 18/18 at 869aa5ca, no suite/budget/Linux/Web pass inferred. Reviewer did no tests or product execution. Mode-free verification may proceed at this exact reviewed commit.

Criteria: C6 verified.

### rev-26 · 2026-10-21T10:57:44.204Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261021-986-evidence-1
commit: 869aa5cafa772d2f6275cc7f7b64e724b1b5c361
scope: evidence
findings: [{"severity":"medium","text":"M3: exact-head verification failed 'stopping the project clears every hub timer': actual 1, expected 0. This is the shutdown assertion, not TTL delivery. Diagnose the retained timer before classifying/retrying; the new ring timer is a candidate, not an established root cause.","file":"hub/test/project-clock.test.ts","line":76},{"severity":"medium","text":"M4: new owned paused-real-socket resync case takes 3.295201255s ordinary and up to 3.123308046s under load, exceeding the documented T2 2s budget despite report-only duration mode. Reduce setup/publication cost without weakening boundary coverage, or obtain an explicit documented disposition.","file":"hub/test/connection-resync.test.ts","line":44}]
finding_counts: {"high":0,"medium":2,"low":0}

Failed-evidence audit A-8314. A-8311/run faa3882e at unchanged 869aa5ca exits1 on Linux x64 c-8 lon1 droplet, two workers. Actual failure project-clock.test.ts:76: 'stopping the project clears every hub timer', 1 !== 0. No unrelated-flake classification established. All eleven owned test identities functionally pass ordinarily and 5/5, but paused-real-socket case exceeds new T2 budget (3.295s ordinary / 3.123s max load). Structured records: 1,949 ordinary tests, 1,948 pass/1 fail, plus 55 separate load passes. T1 completed; hub T2 failed before fallback completion; no Neovim/Web/T3/T4/stage/QA pass inferred. Duration/test lint/ratchet report-only; host check 44ec0afd not repeated remotely. No new verified marks; source C6 remains current. Lead owns diagnosis/fix or disposition; no unchanged retry requested. Any changed head requires fresh source review.

Criteria: C3 failed (Exact-head gate fails shutdown timer invariant (one timer remains after hub.stop), blocking complete restart/epoch evidence pending diagnosis.), C5 failed (Owned stalled-reader test exceeds T2 budget: 3.295201255s ordinary vs 2s; 3.123308046s max load.).

### rev-26 · 2026-10-21T10:59:47.788Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-986-source-3
commit: e48d14f883201244acf1df5ebc6e775a98f467f9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear after failed-evidence corrections; A-8318 supplements full A-8304. M3 fixed by terminal ModelRing close: clear/drop timer handle and history; late append can supply encoding but cannot retain/rearm; closed after returns null. Pure terminal-close regression plus unchanged project-clock assertion retained; diagnosis/raw red-green A-8316, new committed-head targeted 9/9 and hub typecheck individual exits0 A-8317 (local Darwin arm64, no suite claim). M4 accepted by directly inspected Coordinator bd7c40ec-d2ba-4d58-8a16-29529d87392a: keep paused-reader case under 5s droplet guard. Prior 3.295s ordinary/3.123s max load vs 2s remains an accepted report-only overage, not a budget pass; correct platform is Linux droplet despite message's 'locally' word. No baseline/test allowance changed. Generation fence and prior M1/M2 fixes retained. No post-review dev merge, diff check clean, original clock/resync test files unchanged by this correction. No remaining findings. C6 source-verified; C1–C5 await fresh exact-head completed verification. Failed A-8311 remains historical, not pass evidence.

Criteria: C6 verified.

### rev-26 · 2026-10-21T11:09:20.493Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-986-final-1
commit: e48d14f883201244acf1df5ebc6e775a98f467f9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear; audit A-8325 supplements source A-8318. A-8324/run c1d59f6e exits0, Linux x64 c-8 lon1 droplet, Node24.21/Neovim0.12.5, two machine workers. Independently counted2,264 ordinary passes/347 files plus60 separate load passes; all12 owned identities5/5, no fail/cancel/skip. All T1/full fallbackT2 across hub+Neovim executed. C1 five-missed→live and replacement/reentrant ordering; C2 expired/foreign fallback and non-model exclusion; C3 two-start epoch plus unchanged project-clock zero-timer shutdown and terminal-close regression; C4 fake-clock15min/4MiB; C5 queue/framing guards and applied-cursor stalled-reader replay all pass. Paused reader2.944320141s ordinary/2.900184082s maximumload remains an accepted overage vs report-only2s, below Coordinator bd7c40ec's5s droplet guard; not a2s budget pass. C6 source documentation retained. Host check b2f7d543 not repeated remotely; lint/duration/ratchet report-only, zero lint refusals. Web explicitly NOT RUN/missing Linux libraries/T-993; no T3/T4/stage/QA pass. Directly inspected Coordinator ea443128-e2ce-4e42-b11d-e678b5d22ea2 accepts T1/T2 receipt for enqueue with Web deferred to E-412stage3macOS covers and Coordinator image rebuild after restart37. No remaining findings; allC1–C6 verified at unchanged reviewedhead. Historical A-8311 remains failed.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### rev-26 · 2026-10-21T11:14:05.731Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-986-source-delta-1
commit: 31637af300875cd5aa75d1256ddcf503b11742ab
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear after the one Coordinator-authorized merge: parents e48d14f8 + landed dev80f8f94c; authorization385c558b/e0c73b0d inspected directly. A-8329 audits combined hello conflict and merged interaction. Resume validation/atomic replay/fallback retained; web welcome echoes features/buildStamp; protocol-refusal restart action/hint, liveness/binary/JSON limits and bufferedAmount preserved. Core ring/output and task-owned resume/resync/ring/output/project-clock tests byte-unchanged, including both generation and terminal-close fixes. Shared wire and matching docs retain both contracts. Diff check versus incoming dev clean; inherited keymap EOF warning is not task delta. No findings. A-8328 raw local Darwin root check exit0 plus targeted50/50 in six files audited, report-only132 lint findings/zero refusals; no full task/Web/Linux pass inferred. C6 source-verified at mergehead; C1–C5 await new same-head completed mode-free verification. Old A-8324 is stale for changed tree. Timing disposition and explicit Web coverage limits retained.

Criteria: C6 verified.

### rev-26 · 2026-10-21T11:22:47.885Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-986-final-2
commit: 31637af300875cd5aa75d1256ddcf503b11742ab
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head evidence clear. A-8331 audits A-8330/run f0d501b9 at unchanged source-reviewed 31637af3. Linux x64 c-8 lon1 droplet, Node24.21/Neovim0.12.5, two machine workers; 2,272 ordinary passes in 348 files plus 60 separate load passes, all 12 owned identities 5/5, no fail/cancel/skip. All T1 and full fallback T2 across hub/Neovim completed. C1 exact-five→live/reentrant/replacement ordering, C2 epoch/retention fallback/non-model exclusion, C3 two-start epoch plus unchanged zero-timer shutdown and terminal-close regression, C4 fake-clock/UTF-8 bounds and C5 model-only stalled-reader/framing/resume all pass. Merged T-989 liveness, binary/JSON cap, welcome/build stamp and restart-refusal T2 cases also pass. Paused reader 2.756029463s ordinary/2.338546822s max load remains an accepted overage versus report-only 2s, below Coordinator bd7c40ec's 5s guard; no budget-pass claim. C6 retains source documentation. Host check b1a0ef36 not repeated remotely, lint/durations/ratchet report-only. Web explicitly NOT RUN/missing libraries/T-993 under directly verified Coordinator ea443128 enqueue disposition and E-412 stage 3 macOS Web coverage; no T3/T4/stage/QA/browser pass. Prior-head receipts are not reused. No findings; C1–C6 verified at this exact merged head.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-21T11:28:00.508Z

Merged 40d0583f233a9104e4e23a4d407752d925cc7c4c onto dev.
