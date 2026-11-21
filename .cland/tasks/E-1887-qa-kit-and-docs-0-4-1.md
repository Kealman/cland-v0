---
id: E-1887
kind: epic
title: QA kit and docs (0.4.1)
state: closed
criterion_seq: 2
labels:
  - v0.4.1
assignee: null
parent: R-1880
blocked_by: []
topic: topic-1705
branch: null
created: 2026-11-16T07:28:33.940Z
updated: 2026-11-21T18:04:56.669Z
closed: 2026-11-21T18:04:56.669Z
---

## Goal

The QA kit and docs carry the corrections that every v0.4.0 run needed: publication scanning, qa lint, per-test docs and wording lint gaps.

## Contents

Items from the R-1880 triage A-19813 (approved by the human on 2026-11-16 at 07:25Z, ask 8e3dd5ab): T-1665, T-1861, T-1757, T-1867, T-1661, T-1701, T-1808, T-1649. Stages, lanes and hot files are in the triage's epic table; the plan follows plan-epic and rule 30 (at most three after-stage gates).

## Definition of done

QA reads each child's verified criteria and the epic's cover evidence on dev, and records a clear verdict on this epic.

- [ ] C1. Every child item is closed with its criteria verified, or closed with a recorded reason (merged, fixed elsewhere, deferred by the human).
  - verified: qa-1880 [qa] · run qa-20261121-1887-1 · 2026-11-21T18:04:51.626Z · commit 767b8ce4f2b6935b20f660f073f022a94128dd85
- [ ] C2. A green Linux droplet cover and, at the epic's close, a green macOS cover exist at one dev tree that contains every child's landing (evidence).
  - verified: qa-1880 [qa] · run qa-20261121-1887-1 · 2026-11-21T18:04:51.627Z · commit 767b8ce4f2b6935b20f660f073f022a94128dd85

## Plan

```yaml
stages:
  - name: stage 1
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1665
      - - T-1861
      - - T-1757
      - - T-1867
      - - T-1661
      - - T-1701
  - name: stage 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1808
      - - T-1649
  - name: stage 3
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1981
```

## Comments

### coord · 2026-11-21T08:02:27.428Z

T-1990 (lint to enforce after a clean week) was moved out of this epic and 0.4.1 by the human (ask 517bbd3c, 2026-11-21 08:01Z). It waits for the clean week ending 2026-11-26 and is parked in Follow-ups (C-326) for the next release. Stage 4 is removed from the plan. E-1887 closes after T-1981 lands, without T-1990, with this reason recorded.

### qa-1880 · 2026-11-21T18:04:51.627Z

verdict: qa
result: clear
by: qa-1880 [qa]
run: qa-20261121-1887-1
commit: 767b8ce4f2b6935b20f660f073f022a94128dd85
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# E-1887 QA qa-20261121-1887-1

Build 767b8ce4f2b6935b20f660f073f022a94128dd85; clean detached HEAD and ancestry checked. Brief correction 8f9e77d2aafed0c8fe937a3af28f3dc5fb783088 accepts stage or epic Linux cover, confirmed by Coordinator decision 46056b30. Kit pin 767b8ce4f2b6935b20f660f073f022a94128dd85; Node24.21.0 satisfies shipped >=24.13.0 <25. Later dev diff only qa/briefs. Approval not required; demo freshness.current=true. Evidence-only, no new suite/demo/browser execution.

Covers: Linux 5c6edd0d-1af8-41ae-baa5-b955d3ef9c35 (A-22521), macOS 811111ae-aa47-489a-ab99-a05643eeba51 (A-22525). Read producer result.json for aggregate, both Linux shards and macOS: code0, empty cause. Read structured command-end/finish receipts, provenance and owner hub results in topic-1631. Same requested head and tree885833ace636f29c911c696f4207b0ae369d71af, cached null. T0–T4/Web completed, extra T4 repetitions skipped (18 base files). Linux stage, x64 6.8.0-149-generic; macOS epic, arm64 27.0.0; Node24.21/Nvim0.12.5. Browser Chrome Headless Shell1248 / Google Chrome for Testing156.0.8078.4; exact binary paths retained in source logs A-22521/A-22525. Linux owner totals9619 tests/9605 pass/14 skip; macOS9615/9614/1; both0 fail/cancel/todo. Extra structured finish records include load repetitions, not added to owner totals: Linux9893 test pass/14 skip/1319 file pass; macOS9902/1/1319. Budget/lint/ratchet/skip checker report-only. Skips not counted as passes. Linux shard lifetimes2455s/$0.1705 and2517s/$0.1748, total$0.3453, executor accounting not case wall time. No controlled performance comparison.

|Case|Result|Observation|
|---|---|---|
|M1|PASS|CLI open list no items|
|M2|PASS|9 closed children; 17 verified criteria; all9 own landing ancestors|
|M3|PASS|Linux stage exact head/tree producer code0 fail0|
|M4|PASS|macOS epic exact head/tree producer code0 fail0|

T-1990 task.view parent C-326 Follow-ups, outside epic and release; Coordinator closing comment records human ask517bbd3c. Excluded from this run as requested.

Commands: live root node hub/bin/cland.ts task list --under E-1887 --state open/closed; task.view every child and T-1990; git log -1 --first-parent --format=%H --grep exact Item trailer at requested build; read named logs/structured receipts. Findings none; C1,C2 checked.

- T-1649: 2/2 verified. Merged b287403fd5cf6f7e8986bcff881e1a25c175ba27 onto dev.
- T-1661: 1/1 verified. Merged a1145c3313394a62198c677a96abe20d9e23aef6 onto dev.
- T-1665: 1/1 verified. Merged 58c75d1e3bbea6b149b9a4a2cd85ddaad294f044 onto dev.
- T-1701: 2/2 verified. Merged 3053455033209cf5cab917150edc4c2928e08904 onto dev.
- T-1757: 2/2 verified. Merged b2b220678ca500e4f6329c96416fd7487e447933 onto dev.
- T-1808: 3/3 verified. Merged a343e305a19df293fb9b7fee91a27086a89f8c1a onto dev.
- T-1861: 2/2 verified. Merged e6fb31ce882132d774b2fa18f4ba12db9a3d2a67 onto dev.
- T-1867: 1/1 verified. Merged 020aef2e09bb5c5d929c1ffdc99ef4c9a2207715 onto dev.
- T-1981: 3/3 verified. Merged a28f8ecf978b654c98e28bb7eb738394da7b6022 onto dev.
Evidence A-22529 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22529-e-1887-evidence-only-qa-at-767b8ce.md

Criteria: C1 verified, C2 verified.

### coord · 2026-11-21T18:04:56.669Z

Definition of done met: QA clear qa-20261121-1887-1 (qa-1880, A-22529) at dev 767b8ce4f, with C1 and C2 verified. All 9 children are closed. T-1990 moved to Follow-ups by the human's decision (ask 517bbd3c, 2026-11-21). Cover pair at that commit: Linux droplet stage 5c6edd0d (A-22521) and macOS local epic 811111ae (A-22525).
