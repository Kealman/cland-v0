---
id: E-1468
kind: epic
title: Coordinator delivery never goes silently deaf
state: open
criterion_seq: 3
labels: []
assignee: null
parent: R-1465
blocked_by: []
topic: topic-1261
branch: null
created: 2026-10-30T07:49:58.701Z
updated: 2026-10-31T03:42:28.394Z
---

## Goal

A Claude Code session never goes silently deaf. A human message reaches an idle Coordinator within a minute; a relaunch leaves exactly one harness process; and when delivery is stuck, the human is told and has a command that releases it.

## Contents

Root cause (A-14159, from the read-only RCA of the 2026-10-30 06:53–07:34Z incident, in which the human's Telegram answer waited 41 min):
- The Claude Code poll overrode a pushed idle with busy while a background shell ran.
- Held human messages release only on an idle edge.
- Relaunches left duplicate daemon jobs.
- The daemon's 60-minute idle retirement went undetected.
- The bridge and flush logs were misleading.

The human asked for the investigation and a fix (cland-impl, 07:44Z): «разобрался еще с этим инцидентом почему так произошло и как сделать фикс чтобы так не происходило».

## Definition of done

- [ ] C1. The incident's sequence is replayed in a test: idle hook, then a poll reporting busy, then a human send, then idle. The message is injected within 60 s.
  - verified: qa-677 [qa] · run qa-2026-10-31-677-1468 · 2026-10-31T03:42:28.394Z · commit 7f0e3353b523efd4ca497d0a1d0e3fcef73f933d
- [ ] C2. A relaunch leaves one Claude Code process for the session, and a spoke from an earlier launch is refused.
  - verified: qa-677 [qa] · run qa-2026-10-31-677-1468 · 2026-10-31T03:42:28.394Z · commit 7f0e3353b523efd4ca497d0a1d0e3fcef73f933d
- [ ] C3. A live session holding a human delivery for over 5 minutes is shown as `deaf`, the human is told, and `cland session retry` releases it.
  - verified: qa-677 [qa] · run qa-2026-10-31-677-1468 · 2026-10-31T03:42:28.394Z · commit 7f0e3353b523efd4ca497d0a1d0e3fcef73f933d

## Plan

```yaml
stages:
  - name: delivery and launch fixes
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1469
        - T-1470
        - T-1473
        - T-1472
        - T-1475
      - - T-1471
      - - T-1474
```

## Comments

### qa-677 · 2026-10-31T03:42:28.394Z

verdict: qa
result: clear
by: qa-677 [qa]
run: qa-2026-10-31-677-1468
commit: 7f0e3353b523efd4ca497d0a1d0e3fcef73f933d
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

| Check | Surface / executor | Result | Evidence |
| --- | --- | --- | --- |
| M1, M2 / C1 | hub-api / local macOS | PASS | A-14810/M1.log, M2.log |
| M3 / C2 | hub-api / local macOS | PASS | A-14810/M3-sessions.log, M3-environment.log |
| M4, M5 / C3 | hub-api / local macOS | PASS | A-14810/M4.log, M5.log, reused M2.log |
| M6 | conditional workbench checks | NOT RUN, out of scope | Request did not name them; M6-excluded.json |
| M7 | hub-api / local macOS | PASS | M7.log, M7-wording.json |
| M8 | hub-api / local macOS | PASS | Existing M1/M2 receipts, no repeated execution |
| M-last | hub records / read-only git | PASS, waiver-qualified | M-last-hub/plan/verify-audit/waivers and Item landing trailers |

Findings: none (high/medium/low). Clear for C1, C2, C3 under the committed brief. Evidence A-14810, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14810-e-1468-dod-qa-clear-at-7f0e3353-131-passes-27-required-cases/report.md.

Six sequential file runs: 131 passes, zero fail/cancel/skip/todo; all 27 required generated names verified against final source and actual passing output (required-cases.json). Eight PASS recorder rows. FakeClock establishes the 60 s/five-minute bounds; per-test runner duration is not that bound. Node v24.21.0, Darwin arm64, sealed scratch HOME/XDG/Git via the shared environment builders. No real Claude daemon, real remote, browser binary, full suite or Web phase ran in this QA. No demo lease; local lifetime/cost not applicable.

All seven children closed/done with dev landing trailers and hub-sourced clear reviewer verdicts. Four greens match their reviewed source heads. T-1470: green be5b629ba, final review 6f2ce4b63 (A-14700); T-1472: green dcc7e9fe0, final review 8dd23b345 (A-14784); T-1473: green 1f12b2d48, final review 442717d5d (A-14734). These three are accepted rule 6 parent-head carries with targeted post-merge evidence, not full verifies at final heads. Full source/verify/dev-landing SHAs and original log hashes are in the report. Each historical verify retains eight skips. Historical droplet lifetime/cost was not obtained in this audit (unavailable, not zero).

Stage open: 7/7 members landed; Linux/macOS covers pending at inspection, Coordinator-owned. No stage closure claimed. Freshness current:true at 2026-10-31T03:39:48Z; final worktree clean, HEAD 7f0e3353b523efd4ca497d0a1d0e3fcef73f933d. Shared publication scan passed with positive controls; all 34 artifact files verified byte-identical to the scanned evidence.

Criteria: C1 verified, C2 verified, C3 verified.
