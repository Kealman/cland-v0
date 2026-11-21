---
id: E-1882
kind: epic
title: Test fixtures, T2 hygiene and TMPDIR residue (0.4.1)
state: closed
criterion_seq: 2
labels:
  - v0.4.1
assignee: null
parent: R-1880
blocked_by: []
topic: topic-1544
branch: null
created: 2026-11-16T07:28:32.898Z
updated: 2026-11-21T07:42:51.142Z
closed: 2026-11-21T07:42:51.142Z
---

## Goal

Test fixtures clean up after themselves (TMPDIR, owner registries, sockets), and T2 hygiene items stop giving false reds in targeted and full runs.

## Contents

Items from the R-1880 triage A-19813 (approved by the human on 2026-11-16 at 07:25Z, ask 8e3dd5ab): T-1768, T-1640, T-1769, T-1767, T-1817, T-1677, T-1680, T-1669, T-1676, T-1805, T-1865. Stages, lanes and hot files are in the triage's epic table; the plan follows plan-epic and rule 30 (at most three after-stage gates).

## Definition of done

QA reads each child's verified criteria and the epic's cover evidence on dev, and records a clear verdict on this epic.

- [ ] C1. Every child item is closed with its criteria verified, or closed with a recorded reason (merged, fixed elsewhere, deferred by the human).
  - verified: qa-1880 [qa] · run qa-20261121-1882-1 · 2026-11-21T07:41:58.637Z · commit 792d643d8642f3735a977ca8b997c750bba32eef
- [ ] C2. A green Linux droplet cover and, at the epic's close, a green macOS cover exist at one dev tree that contains every child's landing (evidence).
  - verified: qa-1880 [qa] · run qa-20261121-1882-1 · 2026-11-21T07:41:58.637Z · commit 792d643d8642f3735a977ca8b997c750bba32eef

## Plan

```yaml
stages:
  - name: stage 1
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1768
        - T-1640
      - - T-1769
      - - T-1767
      - - T-1817
      - - T-1677
      - - T-1905
      - - T-1904
      - - T-1923
        - T-1915
  - name: stage 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1680
      - - T-1669
      - - T-1676
      - - T-1805
      - - T-1932
      - - T-1933
      - - T-1988
  - name: stage 3
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1865
```

## Comments

### qa-1880 · 2026-11-21T07:41:58.637Z

verdict: qa
result: clear
by: qa-1880 [qa]
run: qa-20261121-1882-1
commit: 792d643d8642f3735a977ca8b997c750bba32eef
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Evidence-only DoD; A-22380 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22380-e-1882-evidence-only-qa-at-792d643.md).

| Case | Result | Observation |
|---|---|---|
| M1 | PASS | Live CLI: no open children |
| M2 | PASS | 18 closed ids; 39/39 criteria verified; all exact Item trailers ancestral, matching closing commits |
| M3 | PASS | Linux droplet epic 72b09606/A-22368: exact head/tree, owner exit0, fail0, 9547 pass/14 skip |
| M4 | PASS | macOS local epic 95763c91/A-22361: exact head/tree, owner exit0, fail0, 9556 pass/1 skip |

T0–T4/Web completed in existing covers; T4 extra repetitions skipped, base18 files ran. Budget/lint/ratchet notices report-only. Both Node24.21/Nvim0.12.5; HeadlessShell1248/ChromeTesting156.0.8078.4. Linux x64 6.8.0-149, macOS arm64 27.0.0. Linux lifetimes2559s/$0.1777 and2451s/$0.1702, total$0.3479, executor accounting not case wall time. No QA suite/demo/browser execution. Freshness current true. Brief/kit d2592a5cc850e6b4558c47a8f359479c6666248e. Recorder's unsupported Node25 attempt appended nothing; supported Node24 recording succeeded. Export scanner rejected provenance lines; replaced by ids/hashes and published only after scan passed. Findings none; C1,C2 verified.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-21T07:42:51.142Z

Definition of done met: QA clear qa-20261121-1882-1 (qa-1880, A-22380) at dev 792d643d8, with C1 and C2 verified. 18 children are closed. The epic cover pair is green at that commit: Linux droplet 72b09606 (A-22368) and macOS local 95763c91 (A-22361).
