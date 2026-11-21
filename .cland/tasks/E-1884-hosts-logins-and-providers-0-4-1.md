---
id: E-1884
kind: epic
title: Hosts, logins and providers (0.4.1)
state: closed
criterion_seq: 2
labels:
  - v0.4.1
assignee: null
parent: R-1880
blocked_by: []
topic: topic-1701
branch: null
created: 2026-11-16T07:28:33.288Z
updated: 2026-11-21T07:43:22.353Z
closed: 2026-11-21T07:43:22.353Z
---

## Goal

Host, login and provider defects found during v0.4.0 are fixed on the fakes, including the provider token reaching role shells (T-1705, product-side fix per the human 2026-11-16).

## Contents

Items from the R-1880 triage A-19813 (approved by the human on 2026-11-16 at 07:25Z, ask 8e3dd5ab): T-1626, T-1645, T-1688, T-1802, T-1869, T-1660, T-1662, T-1586, T-1656, T-1672, T-1807, T-1858. Stages, lanes and hot files are in the triage's epic table; the plan follows plan-epic and rule 30 (at most three after-stage gates).

## Definition of done

QA reads each child's verified criteria and the epic's cover evidence on dev, and records a clear verdict on this epic.

- [ ] C1. Every child item is closed with its criteria verified, or closed with a recorded reason (merged, fixed elsewhere, deferred by the human).
  - verified: qa-1880 [qa] · run qa-20261121-1884-1 · 2026-11-21T07:42:53.994Z · commit 792d643d8642f3735a977ca8b997c750bba32eef
- [ ] C2. A green Linux droplet cover and, at the epic's close, a green macOS cover exist at one dev tree that contains every child's landing (evidence).
  - verified: qa-1880 [qa] · run qa-20261121-1884-1 · 2026-11-21T07:42:53.994Z · commit 792d643d8642f3735a977ca8b997c750bba32eef

## Plan

```yaml
stages:
  - name: stage 1
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1626
      - - T-1645
      - - T-1688
      - - T-1802
      - - T-1869
      - - T-1660
      - - T-1662
      - - T-1586
      - - T-1705
      - - T-1930
  - name: stage 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1656
      - - T-1672
      - - T-1807
      - - T-1858
```

## Comments

### qa-1880 · 2026-11-21T07:42:53.994Z

verdict: qa
result: clear
by: qa-1880 [qa]
run: qa-20261121-1884-1
commit: 792d643d8642f3735a977ca8b997c750bba32eef
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Evidence-only DoD at 792d643d8642f3735a977ca8b997c750bba32eef. Run qa-20261121-1884-1. Brief qa/briefs/E-1884.md and kit pin d2592a5cc850e6b4558c47a8f359479c6666248e. Detached HEAD clean, ancestry confirmed; demo freshness.current=true. Approval not required in task.view. No suite/demo/browser launched.

|Case|Result|Observation|
|---|---|---|
|M1|PASS|CLI open list: no items|
|M2|PASS|14 closed children; 30 verified criteria; every exact Item trailer ancestral to requested head|
|M3|PASS|Linux droplet epic 72b09606 / A-22368: exit0, 9547 pass,14 skip,0 fail/cancel/todo|
|M4|PASS|macOS local epic 95763c91 / A-22361: exit0,9556 pass,1 skip,0 fail/cancel/todo|

Both source logs and owner results inspected in this session; shared detailed cover audit A-22380. Both head exactly requested, tree39bc3d598962995ac040455aa1618675905e901d; T0-T4/Web complete, extra T4 repetitions skipped (18 base files). Budget/lint/ratchet report-only. Uncached Linux x64 6.8.0-149 and Darwin arm64 27.0.0; Node24.21.0/Nvim0.12.5; Chrome Headless Shell1248 / Google Chrome for Testing156.0.8078.4. Linux lifetimes2559s/$0.1777 and2451s/$0.1702, total$0.3479 (executor accounting, not case wall time). Skips stay unexecuted; no new runtime proof. Earlier failed cover remains failed.

Commands: live root node hub/bin/cland.ts task list --under E-1884 --state open/closed; task.view each child; git log -1 --first-parent --format=%H --grep exact Item trailer at build; read source logs and producer outcomes. Findings none. C1,C2 checked.

- T-1586: 3/3 verified. Merged d012671e6a6e35a931c4399bb6a45fffb51af2ca onto dev.
- T-1626: 4/4 verified. Merged 1cd9883c0c6c27545aa5c6aa2176a097d9368eff onto dev.
- T-1645: 2/2 verified. Merged 387cc0cf4d507d25677195cb50fefead97637a68 onto dev.
- T-1656: 2/2 verified. Merged 01287db1c2941beac53df1a5895ad6385330e354 onto dev.
- T-1660: 1/1 verified. Merged e248bca68b44d9fb9aa00d069be61e89c2885875 onto dev.
- T-1662: 1/1 verified. Merged ca6c628082b35d94938f87b98f79db00c20037c2 onto dev.
- T-1672: 3/3 verified. Merged dbc64994c67166186167f17964a7af58aeed9310 onto dev.
- T-1688: 2/2 verified. Merged 6959747f4d70aa1119ba48ec4f1b347cff076da9 onto dev.
- T-1705: 2/2 verified. Merged 75e65f1d62b3d068bab5c21af810c30cba637a1f onto dev.
- T-1802: 3/3 verified. Merged 0d5f09307e66669b1aed2b6b0a52603f02ad4998 onto dev.
- T-1807: 2/2 verified. Merged f0cc69a4848dc9625f38accdeae070fb6149964c onto dev.
- T-1858: 2/2 verified. Merged da1cd9a9a525ad5ed0b45a78c1f9a24ba0b162f1 onto dev.
- T-1869: 1/1 verified. Merged c61d75fd52bad659edf90e88a445c30fdf3c15f5 onto dev.
- T-1930: 2/2 verified. Merged 20202e0c99d426bc1734788af5250aa1854cf16d onto dev.
Evidence A-22381 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22381-e-1884-evidence-only-qa-at-792d643.md

Criteria: C1 verified, C2 verified.

### coord · 2026-11-21T07:43:22.353Z

Definition of done met: QA clear qa-20261121-1884-1 (qa-1880, A-22381) at dev 792d643d8, with C1 and C2 verified. 14 children are closed. The epic cover pair is green at that commit: Linux droplet 72b09606 (A-22368) and macOS local 95763c91 (A-22361).
