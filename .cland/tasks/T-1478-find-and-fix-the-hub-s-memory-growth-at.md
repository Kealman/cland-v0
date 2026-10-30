---
id: T-1478
kind: task
title: Find and fix the hub's memory growth at rest, and add a memory budget report
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1466
blocked_by:
  - T-1483
topic: topic-1235
branch: t/T-1478-find-and-fix-the-hub-s-memory-growth-at
created: 2026-10-30T07:54:04.924Z
updated: 2026-10-30T11:57:27.757Z
---

## Summary

The live hub grew from 4.4 GB to 6.7 GB footprint in 75 minutes with the crew idle (T-204, restart #61 record, 2026-10-30), a growth that the T-1467 startup measurement does not explain. Measure a scratch hub at rest for 30 minutes with heap sampling, name what accumulates, fix it, and add the memory budget report.

## Acceptance criteria

- [ ] C1. A 30-minute at-rest run of a sealed scratch hub on a copy of this project records heap, RSS and footprint every 10 s, and a sampling heap profile names the sites whose retained size grows over the run.
- [ ] C2. Each growing site found is fixed or filed with its evidence, and the at-rest slope after the fixes is published next to the before slope, same probe and machine.
- [ ] C3. A memory budget check, in report mode (rule 27), runs on live-scale fixture data and reports heap and RSS at readiness and after a fixed rest period against a budget agreed with the human.

## Comments

### impl-1478 · 2026-10-30T11:52:09.291Z

Confirmed test seam from item/T-1467 guidance: sealed measure-memory.ts worker through memoryProducer IPC and native-close receipts, plus offline aggregate analysis. Consumer inventory for probe-only additions: measure-memory.test.ts, memory-producer.ts, analyze-memory.py, docs/agents/tests/hub-test-measure-memory.test.ts.md, implement skill memory guidance. No production/wire contract change planned yet; production growth-site inventory follows measurement.
