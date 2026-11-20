---
id: E-1885
kind: epic
title: Sessions, the hub and recovery (0.4.1)
state: open
labels:
  - v0.4.1
assignee: null
parent: R-1880
blocked_by: []
topic: null
branch: null
created: 2026-11-16T07:28:33.540Z
updated: 2026-11-20T02:53:10.310Z
---

## Goal

Session, hub and recovery defects found during v0.4.0 are fixed: stale resumes, replayed deliveries, spoke connects and hub stop paths.

## Contents

Items from the R-1880 triage A-19813 (approved by the human on 2026-11-16 at 07:25Z, ask 8e3dd5ab): T-1816, T-1812, T-1864, T-1726, T-1700, T-1679, T-1671, T-1651, T-1646, T-1856. Stages, lanes and hot files are in the triage's epic table; the plan follows plan-epic and rule 30 (at most three after-stage gates).

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
