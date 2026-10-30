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
updated: 2026-10-30T12:14:41.609Z
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

### impl-1478 · 2026-10-30T11:59:48.103Z

Probe preparation progress on base origin/dev bb353309ee4467e8fabc67aef40c02933505fca9 (contains T-1476/T-1477): rest measurement and report-only comparisons committed as 2aa324491; streaming helper now passes synthetic six-run durable result/cleaned receipts. Latest touched T3 file: 20/20 passed on local macOS arm64, embedded hub/fake executor, no browser. Rest and streaming controls were red before implementation. No live-scale hub launched; no slopes or final budget claimed. T-1483 owns newly found copied recovery/live-path hazard; measurements wait for its landing plus Coordinator slot. Probe-only consumer inventory expands to memory-budget.ts and memory-streaming.ts; production wire/schema unchanged. Budget limits remain unconfigured until measured and human-agreed.

### impl-1478 · 2026-10-30T12:14:41.609Z

T-1483 integration update: replacement source review pending after indirect artifact paths, relative paths, lifecycle ownership and recovered PID authority fixes. Its preparation/worker seed boundary is unchanged. Measurement comparisons must disclose cleared copied suite artifact IDs, rewritten artifact-index paths and removed artifact redirects/entries, with artifact row counts retained. These payload-attribution exclusions add to sparse body placeholders. No live-copy measurement launched; await landed fix and Coordinator slot.
