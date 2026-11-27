---
id: E-2072
kind: epic
title: Load and timing flakes, cleanup fences (0.4.1 re-triage)
state: open
labels:
  - v0.4.1
assignee: null
parent: R-1880
blocked_by: []
topic: null
branch: null
created: 2026-11-24T08:59:42.733Z
updated: 2026-11-26T23:38:25.112Z
---

## Goal

Load- and timing-sensitive tests stop reddening covers, and fixture cleanup is fenced so a failed teardown can't leak processes or restore seams early.

## Contents

From the 0.4.1 re-triage A-22763, which the human approved on 2026-11-24 at 08:58Z (ask 0d31338f): T-2001, T-2016, T-2060, T-1918, T-2017, T-2031, T-1955, T-1979, T-2022, T-1963, T-2067, T-1997, T-2018, T-1994. Hot files, size adjustments and same-file chains are in A-22763, section 5. The plan follows plan-epic and rule 30 (at most three after-stage gates).

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
      - - T-2001
      - - T-1918
      - - T-2018
      - - T-1994
      - - T-1955
        - T-2067
  - name: stage 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-2079
      - - T-2016
      - - T-2060
      - - T-2017
      - - T-1979
        - T-2096
  - name: stage 3
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-2031
      - - T-1963
      - - T-1997
      - - T-2022
      - - T-2099
      - - T-2114
      - - T-2115
```
