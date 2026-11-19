---
id: E-1883
kind: epic
title: Merge queue, verification, delivery and durations (0.4.1)
state: open
labels:
  - v0.4.1
assignee: null
parent: R-1880
blocked_by: []
topic: topic-1542
branch: null
created: 2026-11-16T07:28:33.146Z
updated: 2026-11-19T10:54:48.013Z
---

## Goal

The merge queue, verification runs, delivery and the duration manifest report and recover correctly: no lost results, no ghost slots, complete footers, and durations that stay valid.

## Contents

Items from the R-1880 triage A-19813 (approved by the human on 2026-11-16 at 07:25Z, ask 8e3dd5ab): T-1725, T-1582, T-1630, T-1633, T-1576, T-1848, T-1850, T-1635, T-1652, T-1843, T-1857, T-1729, T-1728, T-1575, T-1638, T-1809, T-1655. Stages, lanes and hot files are in the triage's epic table; the plan follows plan-epic and rule 30 (at most three after-stage gates).

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
      - - T-1725
      - - T-1582
      - - T-1630
        - T-1633
      - - T-1576
      - - T-1848
      - - T-1850
      - - T-1843
        - T-1916
      - - T-1907
      - - T-1921
      - - T-1925
      - - T-1927
      - - T-1931
        - T-1935
      - - T-1950
      - - T-1954
      - - T-1960
      - - T-1964
      - - T-1968
      - - T-1973
      - - T-1982
      - - T-1984
  - name: stage 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1635
      - - T-1652
      - - T-1857
      - - T-1729
      - - T-1728
      - - T-1575
      - - T-1958
      - - T-1952
      - - T-1957
      - - T-1976
      - - T-1975
      - - T-1993
      - - T-1956
      - - T-1999
      - - T-2004
  - name: stage 3
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1638
      - - T-1809
      - - T-1655
      - - T-1991
        - T-1992
```
