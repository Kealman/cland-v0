---
id: E-2077
kind: epic
title: Workbenches, CLI, QA kit and docs (0.4.1 re-triage)
state: open
labels:
  - v0.4.1
assignee: null
parent: R-1880
blocked_by: []
topic: null
branch: null
created: 2026-11-24T09:00:31.398Z
updated: 2026-11-24T09:01:21.063Z
---

## Goal

The web workbench, CLI, QA kit scanners and docs are corrected where the re-triage found gaps.

## Contents

From the 0.4.1 re-triage A-22763, which the human approved on 2026-11-24 at 08:58Z (ask 0d31338f): T-2070, T-1914, T-1969, T-1966, T-1920, T-2012. Hot files, size adjustments and same-file chains are in A-22763, section 5. The plan follows plan-epic and rule 30 (at most three after-stage gates).

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
      - - T-1920
        - T-1966
      - - T-1914
      - - T-1969
      - - T-2012
  - name: stage 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-2070
```
