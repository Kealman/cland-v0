---
id: E-1881
kind: epic
title: Load and timing flakes (0.4.1)
state: open
criterion_seq: 3
labels:
  - v0.4.1
assignee: null
parent: R-1880
blocked_by: []
topic: topic-1532
branch: null
created: 2026-11-16T07:28:32.737Z
updated: 2026-11-17T23:17:49.947Z
---

## Goal

Load and timing flakes stop reddening covers and batches. Setup waits scale with load (H-1 in E-1888 lands first), and each listed item fixes its own fixed wait or deadline, or is re-measured after H-1 and closed with evidence.

## Contents

Items from the R-1880 triage A-19813 (approved by the human on 2026-11-16 at 07:25Z, ask 8e3dd5ab): T-1697, T-1731, T-1703, T-1724, T-1841, T-1796, T-1736, T-1641, T-1689, T-1758, T-1761, T-1798, T-1642, T-1643, T-1634, T-1873, T-1695, T-1875. Stages, lanes and hot files are in the triage's epic table; the plan follows plan-epic and rule 30 (at most three after-stage gates).

## Definition of done

QA reads each child's verified criteria and the epic's cover evidence on dev, and records a clear verdict on this epic.

- [ ] C1. Every child item is closed with its criteria verified, or closed with a recorded reason (merged, fixed elsewhere, deferred by the human).
- [ ] C2. A green Linux droplet cover and, at the epic's close, a green macOS cover exist at one dev tree that contains every child's landing (evidence).

- [ ] C3. The macOS covers on dev before T-1889 (the v0.4.0 baseline: 29 of 63 red, A-19803 §8.4) and after T-1889's landing name the load-timing failures each had, and the after-covers show the shared load-scaled waits removing that class (evidence, Coordinator; moved from T-1889 C3 on 2026-11-16).

## Plan

```yaml
stages:
  - name: stage 1
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1697
      - - T-1731
      - - T-1703
      - - T-1724
      - - T-1796
        - T-1841
  - name: stage 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1736
        - T-1641
      - - T-1689
        - T-1758
      - - T-1761
      - - T-1798
      - - T-1642
      - - T-1643
      - - T-1634
      - - T-1873
      - - T-1695
      - - T-1875
      - - T-1906
      - - T-1937
      - - T-1947
      - - T-1951
      - - T-1939
```
