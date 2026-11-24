---
id: E-2074
kind: epic
title: Merge queue, verification and suite reporting (0.4.1 re-triage)
state: open
labels:
  - v0.4.1
assignee: null
parent: R-1880
blocked_by: []
topic: null
branch: null
created: 2026-11-24T09:00:01.516Z
updated: 2026-11-24T14:04:26.017Z
---

## Goal

Verification admits quickly, selects and reports correctly, and the merge queue doesn't rebuild or refuse needlessly.

## Contents

From the 0.4.1 re-triage A-22763, which the human approved on 2026-11-24 at 08:58Z (ask 0d31338f): T-1945, T-1962, T-1953, T-1942, T-2023, T-2027, T-2037, T-1928, T-2044, T-2045, T-1909, T-1929, T-1936, T-1938, T-2002, T-2003, T-2029, T-2057, T-2065. Hot files, size adjustments and same-file chains are in A-22763, section 5. The plan follows plan-epic and rule 30 (at most three after-stage gates).

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
      - - T-2084
        - T-1928
        - T-2037
      - - T-1945
        - T-1962
      - - T-1953
      - - T-1942
      - - T-2027
      - - T-2065
      - - T-2057
        - T-2089
  - name: stage 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-2044
        - T-2029
      - - T-1936
      - - T-1938
      - - T-1909
      - - T-2045
      - - T-1929
  - name: stage 3
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-2023
      - - T-2002
        - T-2003
```
