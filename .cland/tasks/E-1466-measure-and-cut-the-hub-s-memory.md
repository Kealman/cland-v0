---
id: E-1466
kind: epic
title: Measure and cut the hub's memory footprint
state: open
labels: []
assignee: null
parent: R-1465
blocked_by: []
topic: null
branch: null
created: 2026-10-30T06:38:36.448Z
updated: 2026-10-30T06:38:47.113Z
---

## Goal

The hub's resident memory on this project drops from about 3 GB to a measured budget that suits a consumer machine running two or three projects, with a test that holds it there.

## Contents

1. Measure where the memory goes, at startup and at rest, on a scratch copy of this project's live data: heap by retainer, external buffers, SQLite and native memory.
2. Fix the largest holders found. The fix tickets are cut from the measurement's findings.
3. Add a memory budget check, in report mode first per rule 27, on a copy of live-scale data.

## Definition of done

- [ ] C1. A measurement artifact names the top retainers of the hub's heap and its non-heap memory at startup and at rest on a scratch copy of the live project, with sizes and code paths.
- [ ] C2. The hub's RSS at rest on the same scratch copy falls to the budget agreed with the human after the measurement, shown before and after on the same machine.
- [ ] C3. A memory budget test runs on live-scale fixture data and reports the hub's heap and RSS at startup and at rest against the budget.

## Plan

```yaml
stages:
  - name: measure
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1467
```
