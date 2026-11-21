---
id: E-1885
kind: epic
title: Sessions, the hub and recovery (0.4.1)
state: closed
criterion_seq: 2
labels:
  - v0.4.1
assignee: null
parent: R-1880
blocked_by: []
topic: topic-1702
branch: null
created: 2026-11-16T07:28:33.540Z
updated: 2026-11-21T07:43:33.865Z
closed: 2026-11-21T07:43:33.865Z
---

## Goal

Session, hub and recovery defects found during v0.4.0 are fixed: stale resumes, replayed deliveries, spoke connects and hub stop paths.

## Contents

Items from the R-1880 triage A-19813 (approved by the human on 2026-11-16 at 07:25Z, ask 8e3dd5ab): T-1816, T-1812, T-1864, T-1726, T-1700, T-1679, T-1671, T-1651, T-1646, T-1856. Stages, lanes and hot files are in the triage's epic table; the plan follows plan-epic and rule 30 (at most three after-stage gates).

## Definition of done

QA reads each child's verified criteria and the epic's cover evidence on dev, and records a clear verdict on this epic.

- [ ] C1. Every child item is closed with its criteria verified, or closed with a recorded reason (merged, fixed elsewhere, deferred by the human).
  - verified: qa-1880 [qa] · run qa-20261121-1885-1 · 2026-11-21T07:43:29.455Z · commit 792d643d8642f3735a977ca8b997c750bba32eef
- [ ] C2. A green Linux droplet cover and, at the epic's close, a green macOS cover exist at one dev tree that contains every child's landing (evidence).
  - verified: qa-1880 [qa] · run qa-20261121-1885-1 · 2026-11-21T07:43:29.455Z · commit 792d643d8642f3735a977ca8b997c750bba32eef

## Plan

```yaml
stages:
  - name: stage 1
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1816
      - - T-1812
      - - T-1864
      - - T-1726
      - - T-1700
      - - T-1919
      - - T-1922
      - - T-1924
  - name: stage 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1679
        - T-1671
      - - T-1651
      - - T-1646
      - - T-1856
```

## Comments

### qa-1880 · 2026-11-21T07:43:29.455Z

verdict: qa
result: clear
by: qa-1880 [qa]
run: qa-20261121-1885-1
commit: 792d643d8642f3735a977ca8b997c750bba32eef
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Evidence-only DoD at 792d643d8642f3735a977ca8b997c750bba32eef. Run qa-20261121-1885-1. Brief qa/briefs/E-1885.md and kit pin d2592a5cc850e6b4558c47a8f359479c6666248e. Detached HEAD clean, ancestry confirmed; demo freshness.current=true. Approval not required in task.view. No suite/demo/browser launched.

|Case|Result|Observation|
|---|---|---|
|M1|PASS|CLI open list: no items|
|M2|PASS|13 closed children; 26 verified criteria on 12 merged children with ancestral exact Item trailers; T-1651 closed with recorded fixed-elsewhere reason naming T-1924|
|M3|PASS|Linux droplet epic 72b09606 / A-22368: exit0, 9547 pass,14 skip,0 fail/cancel/todo|
|M4|PASS|macOS local epic 95763c91 / A-22361: exit0,9556 pass,1 skip,0 fail/cancel/todo|

Both source logs and owner results inspected in this session; shared detailed cover audit A-22380. Both head exactly requested, tree39bc3d598962995ac040455aa1618675905e901d; T0-T4/Web complete, extra T4 repetitions skipped (18 base files). Budget/lint/ratchet report-only. Uncached Linux x64 6.8.0-149 and Darwin arm64 27.0.0; Node24.21.0/Nvim0.12.5; Chrome Headless Shell1248 / Google Chrome for Testing156.0.8078.4. Linux lifetimes2559s/$0.1777 and2451s/$0.1702, total$0.3479 (executor accounting, not case wall time). Skips stay unexecuted; no new runtime proof. Earlier failed cover remains failed.

Commands: live root node hub/bin/cland.ts task list --under E-1885 --state open/closed; task.view each child; git log -1 --first-parent --format=%H --grep exact Item trailer at build; read source logs and producer outcomes. Findings none. C1,C2 checked.

- T-1646: 3/3 verified. Merged 3e99d425bbc520b9daeeb277db76a425fe740c30 onto dev.
- T-1651: 0/3 verified. Fixed by T-1924 (f25977d1d, landed 2026-11-17 00:32Z, live since hub restart #80 at 01:29:52Z). Cause and code path, per T-1924's diagnosis (topic-1569): delivered roots whose Claude turn receipt never confirmed stayed pending, and re-entered Sessions.#retry through `uninjected` on every reconnect or restart. The Claude mod had already consumed those ids, so it acknowledged them again without a new turn, and they were replayed as new. T-1924 moves a timed-out submitted Claude input to the persisted `uncertain` state, which is outside `uninjected` and the startup pass.

Observed after restart #80 (hub operator v0-6a): coord's 79 pending 'delivered' rows all became 'uncertain', none remain 'delivered' or 'queued', and zero inject-unconfirmed events fired for coord at startup; restart #79 had fired 195. Coord's reconnect at 01:30:17Z delivered no old messages; before the fix, restart #79 replayed 07:38Z–22:04Z traffic. C1 and C2 are covered by T-1924's regressions (200 deliveries, zero restart replays, exact receipts settle only their own row). C3 rests on T-1924's diagnosis; the 2026-11-03 incident ids were not traced individually from storage.
- T-1671: 2/2 verified. Merged 6ba2a156c89d3cdfdcf9547f345c85f3f36d6a8f onto dev.
- T-1679: 2/2 verified. Merged de3eceb22aae64a3348c26303e8b9d447b4188d9 onto dev.
- T-1700: 2/2 verified. Merged 8d769e25315d4a78ec371ef6907182f3bcc4cad4 onto dev.
- T-1726: 1/1 verified. Merged 5657450ed04a2cacc84e386a9d50f3e7f6b20ae5 onto dev.
- T-1812: 3/3 verified. Merged 50bf074d8a41fad8c18da1181d0d5d8bab766bed onto dev.
- T-1816: 2/2 verified. Merged 2a5df555f66b85901a7995d78dd56a74f495a93f onto dev.
- T-1856: 2/2 verified. Merged cf15fe685323f69ab13821a284b401e4b71a6a18 onto dev.
- T-1864: 2/2 verified. Merged 8b087645798832cefd09b81bcb0ff4a41ecef238 onto dev.
- T-1919: 2/2 verified. Merged 2bdf1ff0f584f52e4ca28b84d0391cfd650ecc62 onto dev.
- T-1922: 2/2 verified. Merged c74b7141f343adea41472bef0935b1c2d8b4bc38 onto dev.
- T-1924: 3/3 verified. Merged f25977d1d59f33611ffaf060f5a895fa9fd56739 onto dev.
Evidence A-22382 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22382-e-1885-evidence-only-qa-at-792d643.md

Criteria: C1 verified, C2 verified.

### coord · 2026-11-21T07:43:33.865Z

Definition of done met: QA clear qa-20261121-1885-1 (qa-1880, A-22382) at dev 792d643d8, with C1 and C2 verified. 13 children are closed: 12 landed, and T-1651 closed as fixed by T-1924. The epic cover pair is green at that commit: Linux droplet 72b09606 (A-22368) and macOS local 95763c91 (A-22361).
