---
id: E-2076
kind: epic
title: Sessions, the hub and recovery (0.4.1 re-triage)
state: open
labels:
  - v0.4.1
assignee: null
parent: R-1880
blocked_by: []
topic: null
branch: null
created: 2026-11-24T09:00:21.102Z
updated: 2026-11-24T13:49:31.346Z
---

## Goal

Session stop and landing follow-ups, delivery, hub storage and recovery paths stay correct and bounded under load.

## Contents

From the 0.4.1 re-triage A-22763, which the human approved on 2026-11-24 at 08:58Z (ask 0d31338f): T-1912, T-1926, T-1961, T-1971, T-1972, T-1995, T-2043, T-2005, T-2062, T-1959, T-1989, T-2014. Hot files, size adjustments and same-file chains are in A-22763, section 5. The plan follows plan-epic and rule 30 (at most three after-stage gates).

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
      - - T-1995
        - T-2043
        - T-2088
      - - T-2014
      - - T-1961
      - - T-1971
  - name: stage 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1912
      - - T-1959
      - - T-2062
      - - T-1926
        - T-1989
  - name: stage 3
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1972
      - - T-2005
```
