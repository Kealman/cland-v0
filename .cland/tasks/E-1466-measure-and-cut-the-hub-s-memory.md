---
id: E-1466
kind: epic
title: Measure and cut the hub's memory footprint
state: closed
criterion_seq: 3
labels: []
assignee: null
parent: R-1465
blocked_by: []
topic: topic-1260
branch: null
created: 2026-10-30T06:38:36.448Z
updated: 2026-10-31T06:05:07.812Z
closed: 2026-10-31T06:05:07.812Z
---

## Goal

The hub's resident memory on this project drops from about 3 GB to a measured budget that suits a consumer machine running two or three projects, with a test that holds it there.

## Contents

1. Measure where the memory goes, at startup and at rest, on a scratch copy of this project's live data: heap by retainer, external buffers, SQLite and native memory.
2. Fix the largest holders found. The fix tickets are cut from the measurement's findings.
3. Add a memory budget check, in report mode first per rule 27, on a copy of live-scale data.

## Definition of done

- [ ] C1. A measurement artifact names the top retainers of the hub's heap and its non-heap memory at startup and at rest on a scratch copy of the live project, with sizes and code paths.
  - verified: qa-677 [qa] · run qa-2026-10-30-677-1466 · 2026-10-30T22:54:19.892Z · commit 3cc3d62e8ed9c8142938e6746fa693453d304aa6
  - verified: qa-677 [qa] · run qa-2026-10-31-677-1466 · 2026-10-31T04:01:28.716Z · commit 7f0e3353b523efd4ca497d0a1d0e3fcef73f933d
  - verified: qa-677 [qa] · run qa-2026-10-31-677-1466-2 · 2026-10-31T06:04:19.597Z · commit e5b310a7882d7354118984e7137e586b071b45e0
- [ ] C2. The hub's RSS at rest on the same scratch copy falls to the budget agreed with the human after the measurement, shown before and after on the same machine.
  - verified: qa-677 [qa] · run qa-2026-10-30-677-1466 · 2026-10-30T22:54:19.892Z · commit 3cc3d62e8ed9c8142938e6746fa693453d304aa6
  - verified: qa-677 [qa] · run qa-2026-10-31-677-1466 · 2026-10-31T04:01:28.716Z · commit 7f0e3353b523efd4ca497d0a1d0e3fcef73f933d
  - verified: qa-677 [qa] · run qa-2026-10-31-677-1466-2 · 2026-10-31T06:04:19.597Z · commit e5b310a7882d7354118984e7137e586b071b45e0
- [ ] C3. A memory budget test runs on live-scale fixture data and reports the hub's heap and RSS at startup and at rest against the budget.
  - verified: qa-677 [qa] · run qa-2026-10-30-677-1466 · 2026-10-30T22:54:19.893Z · commit 3cc3d62e8ed9c8142938e6746fa693453d304aa6
  - verified: qa-677 [qa] · run qa-2026-10-31-677-1466 · 2026-10-31T04:01:28.716Z · commit 7f0e3353b523efd4ca497d0a1d0e3fcef73f933d
  - verified: qa-677 [qa] · run qa-2026-10-31-677-1466-2 · 2026-10-31T06:04:19.597Z · commit e5b310a7882d7354118984e7137e586b071b45e0

## Plan

```yaml
stages:
  - name: measure and startup fixes
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1467
      - - T-1476
      - - T-1477
  - name: at-rest growth and budget
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1478
```

## Comments

### qa-677 · 2026-10-30T22:54:19.893Z

verdict: qa
result: clear
by: qa-677 [qa]
run: qa-2026-10-30-677-1466
commit: 3cc3d62e8ed9c8142938e6746fa693453d304aa6
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| case | surface | result | evidence |
| --- | --- | --- | --- |
| M1 / C1 | hub-api | PASS | A-14729/M1-artifacts.md; A-14160/14157/14167/14226/14701/14690 audited |
| M2 / C2 | hub-api | PASS with comparison limitation | A-14729/M2-audit.log; original A-14699 numerical audit exit0 |
| M3 / C3 | hub-api | PASS | A-14729/M3-tests.log and M3-required-cases.json:57/57,0 fail/cancel/skip; ten required identities executed |
| M4 / C3 | hub-api | PASS | A-14729/M4-summary.json and original numeric/native receipts |
| M5 | hub-api | PASS under Coordinator amendments | A-14729/M5-audit.json, M5-hub.json, M5-landings.log |

No high/medium/low product findings in amended scope. C1,C2,C3 established. Artifact A-14729, durable entry /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14729-e-1466-definition-of-done-qa-evidence-run-qa-2026-10-30-677-1466-at-3cc3d62e8-cl/report.md;43 declared hashes independently match the published copy.

Actual QA execution: local macOS arm64 Nodev24.21.0, clean detached 3cc3d62e8ed9c8142938e6746fa693453d304aa6; read-only Python original-record audit, one targeted T3 file node --test hub/test/measure-memory.test.ts, dry inventory and one granted600s live-scale scratch-copy probe. No full suite, browser, droplet lease/cost, native real harness, pre-fix rerun or live-hub memory probe. No enforced memory gate.

M4: grant b70f13a2 22:37–22:58Z; native close22:47:45.356Z code0/signalnull, worker complete/stoppedtrue, no forced/incomplete/write failures.62 rest samples span600.571234s. Readiness heap153.022560/RSS575.750000MiB; rest129.185318/562.531250MiB, all within report-only256/768MiB. Immutable live endpoint equals report bytes. Observed intermediate rest maximum heap294.316017/RSS653.125MiB remains explicit: endpoint budget success is not continuous heap-under256 proof. Native pressure always1, unchanged swap-outs80848688, max observed load2.241699. Other local jobs held; live hub streamed T-1473 remote logs. Slot released. Automatic exit profile diagnostic “V8 sampling heap profiler was not started” retained separately from present required numeric/boundary receipts.

C1 limits: coarse1MiB sampled surviving allocations are attribution estimates, not retained sizes; native SQLite allocation remains explicitly unknown. No universal leak exclusion; positive historical RSS/footprint slopes retained.

C2 limitation: original after aa8e5ecdf endpoint99.482605MiB heap/549.140625MiB RSS is under256/768; audit reproduces182samples and slopes. Before c8defa34d3833.65/1633.4MiB is STARTUP readiness, with intermediate c51f9984b1009.79/525.27MiB. Same Mac, fresh snapshots, not byte-identical data or same-probe at-rest before. No controlled at-rest before/after or fixed-leak claim. Accepted exactly under the brief's explicit limitation.

M5: all5 children closed/done and Item trailers on pinned dev. Four have same-source-head clear review plus passed verify. T-1478 final0c2236271 is waiver-qualified: parent aa8e5ecdf green6946de51/A-14709; final28 targeted receipts337passes/A-14714 and clear deltaA-14715. No final-head full verify claimed. Original Linux skips remain separately listed, not passes. Decisions b70f13a2/72cd395e amend brief: both stages OPEN, covers pending and Coordinator-owned; not a C1–C3 failure. No stage closure or integrated stage/release pass claimed.

Final demo status freshness.current=true, state none. Artifact publication in Agents was refused to QA; action stopped, Coordinator published A-14729 with its authority. Five QA ledger rows recorded. Hold/worktree cleanup follows this verdict.

Criteria: C1 verified, C2 verified, C3 verified.

### qa-677 · 2026-10-31T04:01:28.716Z

verdict: qa
result: clear
by: qa-677 [qa]
run: qa-2026-10-31-677-1466
commit: 7f0e3353b523efd4ca497d0a1d0e3fcef73f933d
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Check | Executor / surface | Result | Evidence |
| --- | --- | --- | --- |
| M1 / C1 | local macOS / hub-api | PASS, historical review rechecked | A-14815/M1-M2-reuse.json; A-14729 original attribution/native/rest review |
| M2 / C2 | local macOS / hub-api | PASS with comparison limitation | A-14815/M2-audit.log; A-14729 comparison |
| M3 / C3 | local macOS / hub-api | PASS | A-14815/M3-tests.log, required-cases.json, assertions.json |
| M4 / C3 | local macOS / hub-api | PASS | A-14815/M4-summary.json and original numeric/native receipts |
| M5 | hub records / read-only Git | PASS under request dispositions | A-14815/M5-audit.json, hub/plan/landing records |

Findings: none (high/medium/low). Clear for C1, C2, C3 at 7f0e3353b523efd4ca497d0a1d0e3fcef73f933d. Evidence A-14815: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14815-e-1466-final-0-3-1-dod-qa-at-7f0e3353-57-passes-and-completed-600-s-memory-probe/report.md.

M1/M2/M5 explicitly reuse A-14729 historical evidence with original artifacts, current source names, five child views and dev Item trailers rechecked at this build. The original A-14699 read-only numeric audit was rerun and reproduced endpoint/slopes. C2 limitation remains: the before is startup readiness on this Mac, not a same-probe pre-fix at-rest before. The accepted comparison does not prove a controlled same-probe at-rest reduction.

M3: node --test hub/test/measure-memory.test.ts, one isolated T3 file, 57/57 pass, zero fail/cancel/skip/todo; all ten required names matched current source and passing output; assertions checked separately. Node v24.21.0, Darwin arm64. No suite, Web/browser, real harness, remotes or duration-gate run. No demo lease; local droplet lifetime/cost not applicable.

M4: one authorized --rest-seconds 600 probe in slot 03:47–04:08Z, actual launch 03:47:10.427Z; native close 03:57:53.355Z code 0/signal null, confirmed, forced:false/incomplete:false. 62 samples over 601.154666 s; worker complete/stopped, no write failures or guard stop. Report-only budget 256 MiB heap/768 MiB RSS: readiness 170.044159/585.781250; rest endpoint 133.968185/351.109375, all within. Observed rest maxima 148.278793/559.671875 MiB (boundaries plus ten-second samples, not continuous peaks; readiness outside that interval). Budget bytes match the live-hub endpoint before stop. Source script hash matches the tested worktree. Native level only 1, swap-outs unchanged, max load1 2.855957 and allocated swap 74.923%. Coordinator Linux stage covers and live hub log streaming are recorded as background activity. Slot released after native close.

M5: all five children closed/done/landed with hub-sourced clear reviews. T-1478 retains parent aa8e5ecdf full verify A-14709 versus final 0c2236271 targeted 337 passes A-14714 and delta clear A-14715 under rule 6 waiver; never counted as a full verify at final head. Both stages were open with Coordinator-owned covers pending at inspection, not a DoD finding. Historical skips/phases remain explicit; historical droplet lifetime/cost unavailable in this audit, not zero.

Final freshness current:true at 03:58:55Z, final worktree clean/HEAD unchanged. Five PASS ledger rows. Positive-controlled secret scan passed; 45 published files byte-identical to scanned evidence.

Criteria: C1 verified, C2 verified, C3 verified.

### qa-677 · 2026-10-31T06:04:19.597Z

verdict: qa
result: clear
by: qa-677 [qa]
run: qa-2026-10-31-677-1466-2
commit: e5b310a7882d7354118984e7137e586b071b45e0
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Check | Executor / surface | Result | Evidence |
| --- | --- | --- | --- |
| M1 / C1 | local macOS / hub-api | PASS, historical review rechecked | A-14831/M1-M2-recheck.json; A-14815/A-14729 originals |
| M2 / C2 | local macOS / hub-api | PASS with comparison limitation | A-14831/M2-audit.log |
| M3 / C3 | local macOS / hub-api | PASS | A-14831/M3-tests.log and M3-required-cases.json |
| M4 / C3 | local macOS / hub-api | PASS | A-14831/M4-summary.json and numeric/native captures |
| M5 | hub records / read-only Git | PASS, T-1478 waiver-qualified | A-14831/M5 audit/hub/plan/landings, delta.log |

Findings: none (high/medium/low). Clear for C1, C2, C3 at e5b310a7882d7354118984e7137e586b071b45e0. New run qa-2026-10-31-677-1466-2; evidence A-14831, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14831-e-1466-dod-at-e5b310a78-fresh-qa-57-passes-and-completed-memory-probe/report.md.

M1/M2/M5 rechecked at the new head: original artifact/log hashes, current source names, five closed/done children, clear hub reviewer records and dev Item trailers. Original A-14699 numeric audit rerun, same endpoint/slopes. C2 limitation remains explicit: before is historical startup readiness on this Mac; no same-probe pre-fix at-rest before exists. This is the brief's accepted comparison, not proof of controlled same-probe at-rest reduction.

M3 fresh node --test hub/test/measure-memory.test.ts:57/57, zero fail/cancel/skip/todo; all ten required generated names matched source and passing output. Node v24.21.0, Darwin arm64. Probe/test/budget/brief code unchanged from 7f0e3353; duration allowance remains7.925s through2026-11-06, owner/reason changed toE-880 (plus tracker records). No duration gate, full suite, Web/browser, real harness or remote ran in this QA. No demo lease; local droplet lifetime/cost not applicable.

M4 ran once under the05:52–06:20Z slot: launch05:52:12.208Z, confirmed native close06:02:53.677Z code0/signal null, forced:false/incomplete:false. Worker complete/stopped, no write failures/guard stops.62 samples over601.154987s. Report-only heap/RSS MiB versus256/768: readiness125.245529/565.140625; completed rest130.783752/560.093750, all within. Observed rest maxima149.773186/588.296875 use boundaries and ten-second samples, not continuous peaks; readiness is outside that interval. Frozen endpoint matches budget bytes while hubRunning:true. Native level1 only, swap-outs unchanged80848688, max load1 3.978516 and allocated swap74.766797%. Droplet release cover and reported idle foreign orphan processes retained as context. Slot released after native close.

M5 distinguishes T-1478 parent aa8e5ecdf green A-14709 from final0c2236271 targeted337 passes A-14714 and delta clear A-14715; not a full verify at final head. Both stages now closed on recorded Linux95712ae6/macOS22d726c2 cover pair at552255be. Historical phases/skips retained; historical droplet lifetime/cost unavailable in this audit, not zero. The Coordinator owns epic close.

Final freshness.current:true at06:03:24Z; HEAD unchanged and worktree clean. Five PASS ledger rows. Positive-controlled publication scan passed; all47 published files byte-identical to scanned evidence.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-31T06:05:07.812Z

Definition of done clear: qa-677 run qa-2026-10-31-677-1466-2 at e5b310a7882d7354118984e7137e586b071b45e0 (A-14831), C1–C3 verified. Memory at readiness: heap 125.2 MiB, RSS 565.1 MiB. At rest: heap 130.8 MiB, RSS 560.1 MiB, within the 256/768 MiB report-only budget. Both stages are closed and all task children are landed or closed. The measure-memory allowance was re-owned to E-880 (e5b310a78).
