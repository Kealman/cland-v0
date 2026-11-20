---
id: E-1888
kind: epic
title: Verification and flow improvements from the v0.4.0 retro (0.4.1)
state: open
labels:
  - v0.4.1
assignee: null
parent: R-1880
blocked_by: []
topic: topic-1533
branch: null
created: 2026-11-16T07:28:34.087Z
updated: 2026-11-20T17:40:49.433Z
---

## Goal

The verification and flow improvements the human approved on 2026-11-16 (ask 8e3dd5ab) from the v0.4.0 retrospective (A-19803, overview AzfEFdvyR3T1ifQWAqgu5d): load-aware waits, flaky-identity receipts, epic-level macOS covers, a lighter landing, fewer periodic runs, faster full runs, delivery fail-fast, release preflight, an enqueue preflight, Coordinator wake-ups, a review-class analysis and QA kit checks. The human approved the changes to decisions H-3 to H-8 explicitly.

## Contents

Items from the R-1880 triage A-19813 (approved by the human on 2026-11-16 at 07:25Z, ask 8e3dd5ab): T-1876, T-1877, T-1878, T-1859, T-1528, T-1868, plus the new tickets H-1 to H-15 filed under this epic. Stages, lanes and hot files are in the triage's epic table; the plan follows plan-epic and rule 30 (at most three after-stage gates).

## Definition of done

QA reads each child's verified criteria and the epic's cover evidence on dev, and records a clear verdict on this epic.

- [ ] C1. Every child item is closed with its criteria verified, or closed with a recorded reason (merged, fixed elsewhere, deferred by the human).
- [ ] C2. A green Linux droplet cover and, at the epic's close, a green macOS cover exist at one dev tree that contains every child's landing (evidence).

## Plan

```yaml
stages:
  - name: stage 1
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1889
      - - T-1876
        - T-1899
      - - T-1877
      - - T-1878
      - - T-1859
      - - T-1528
      - - T-1900
  - name: stage 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1890
      - - T-1891
      - - T-1894
        - T-1895
      - - T-1898
      - - T-1903
      - - T-1868
  - name: stage 3
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1893
        - T-1896
      - - T-1901
      - - T-1892
      - - T-1897
        - T-2036
      - - T-2035
```
