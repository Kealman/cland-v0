---
id: T-1257
kind: task
title: Automatic suite reports and their log chips land in General and drown the human's dialogue
state: open
status: in progress
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
topic: topic-993
branch: t/T-1257-automatic-suite-reports-and-their-log
created: 2026-10-24T18:41:42.785Z
updated: 2026-10-24T18:42:15.145Z
---

## Summary

General is meant for the human's dialogue with the Coordinator, but the hub posts every automatic run there: periodic dev T3 results, each culprit-search probe rerun, the search summary, executor prepare reports, and the log artifact chip that goes with each. The topic is hard-coded to 'general' (hub/src/hub/suites.ts periodic and dev starts, hub/src/hub/dev-t3-probe.ts probes, the executor.prepare default in dispatch.ts) and is also the default for `cland verify` without `--report`. On 2026-10-24 this put dozens of full suite logs into General (human, 18:40Z).

## Acceptance criteria

- [ ] C1. Periodic dev T3 runs, culprit-search probes and their summaries, executor prepare reports and verify runs without `--report` report to the Agents topic, still addressed to the coordinator, and their log artifact chips go to the same topic, never General (test).
- [ ] C2. A test plants each automatic run kind and asserts that General receives no message or artifact chip from it (test).
- [ ] C3. Help and docs name Agents as the default report topic, and --report still chooses any topic explicitly; no role clause grows (test).
