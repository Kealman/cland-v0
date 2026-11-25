---
id: E-2073
kind: epic
title: Test fixture ownership and tier hygiene (0.4.1 re-triage)
state: open
labels:
  - v0.4.1
assignee: null
parent: R-1880
blocked_by: []
topic: null
branch: null
created: 2026-11-24T08:59:52.591Z
updated: 2026-11-25T02:54:36.144Z
---

## Goal

Test fixtures own their resources through the shared helpers, and each test file runs in the tier its process use requires.

## Contents

From the 0.4.1 re-triage A-22763, which the human approved on 2026-11-24 at 08:58Z (ask 0d31338f): T-1944, T-2013, T-1910, T-1913, T-1946, T-1977, T-1996, T-2000, T-2007, T-2010, T-1917, T-1998. Hot files, size adjustments and same-file chains are in A-22763, section 5. The plan follows plan-epic and rule 30 (at most three after-stage gates).

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
      - - T-1910
      - - T-1946
      - - T-1917
      - - T-1977
        - T-1996
  - name: stage 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1913
      - - T-2010
      - - T-1998
      - - T-2013
        - T-2097
  - name: stage 3
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1944
      - - T-2000
      - - T-2007
```
