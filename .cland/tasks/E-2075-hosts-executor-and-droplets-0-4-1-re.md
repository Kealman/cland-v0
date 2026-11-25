---
id: E-2075
kind: epic
title: Hosts, executor and droplets (0.4.1 re-triage)
state: open
labels:
  - v0.4.1
assignee: null
parent: R-1880
blocked_by: []
topic: null
branch: null
created: 2026-11-24T09:00:15.242Z
updated: 2026-11-25T01:59:29.996Z
---

## Goal

Executor and host code keeps primary errors, probes liveness correctly and notifies only when action is useful.

## Contents

From the 0.4.1 re-triage A-22763, which the human approved on 2026-11-24 at 08:58Z (ask 0d31338f): T-1940, T-1970, T-2008, T-2071, T-2009, T-1965, T-1978, T-2020. Hot files, size adjustments and same-file chains are in A-22763, section 5. The plan follows plan-epic and rule 30 (at most three after-stage gates).

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
      - - T-1940
      - - T-1978
      - - T-2009
  - name: stage 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1970
        - T-1965
        - T-2094
      - - T-2020
  - name: stage 3
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-2008
        - T-2071
```
