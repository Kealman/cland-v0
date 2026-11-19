---
id: E-1882
kind: epic
title: Test fixtures, T2 hygiene and TMPDIR residue (0.4.1)
state: open
labels:
  - v0.4.1
assignee: null
parent: R-1880
blocked_by: []
topic: topic-1544
branch: null
created: 2026-11-16T07:28:32.898Z
updated: 2026-11-19T02:34:49.768Z
---

## Goal

Test fixtures clean up after themselves (TMPDIR, owner registries, sockets), and T2 hygiene items stop giving false reds in targeted and full runs.

## Contents

Items from the R-1880 triage A-19813 (approved by the human on 2026-11-16 at 07:25Z, ask 8e3dd5ab): T-1768, T-1640, T-1769, T-1767, T-1817, T-1677, T-1680, T-1669, T-1676, T-1805, T-1865. Stages, lanes and hot files are in the triage's epic table; the plan follows plan-epic and rule 30 (at most three after-stage gates).

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
      - - T-1768
        - T-1640
      - - T-1769
      - - T-1767
      - - T-1817
      - - T-1677
      - - T-1905
      - - T-1904
      - - T-1923
        - T-1915
  - name: stage 2
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1680
      - - T-1669
      - - T-1676
      - - T-1805
      - - T-1932
      - - T-1933
      - - T-1988
  - name: stage 3
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1865
```
