---
id: E-1887
kind: epic
title: QA kit and docs (0.4.1)
state: open
labels:
  - v0.4.1
assignee: null
parent: R-1880
blocked_by: []
topic: null
branch: null
created: 2026-11-16T07:28:33.940Z
updated: 2026-11-21T08:02:27.428Z
---

## Goal

The QA kit and docs carry the corrections that every v0.4.0 run needed: publication scanning, qa lint, per-test docs and wording lint gaps.

## Contents

Items from the R-1880 triage A-19813 (approved by the human on 2026-11-16 at 07:25Z, ask 8e3dd5ab): T-1665, T-1861, T-1757, T-1867, T-1661, T-1701, T-1808, T-1649. Stages, lanes and hot files are in the triage's epic table; the plan follows plan-epic and rule 30 (at most three after-stage gates).

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
      - - T-1665
      - - T-1861
      - - T-1757
      - - T-1867
      - - T-1661
      - - T-1701
  - name: stage 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1808
      - - T-1649
  - name: stage 3
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1981
```

## Comments

### coord · 2026-11-21T08:02:27.428Z

T-1990 (lint to enforce after a clean week) was moved out of this epic and 0.4.1 by the human (ask 517bbd3c, 2026-11-21 08:01Z). It waits for the clean week ending 2026-11-26 and is parked in Follow-ups (C-326) for the next release. Stage 4 is removed from the plan. E-1887 closes after T-1981 lands, without T-1990, with this reason recorded.
