---
id: T-1917
kind: task
title: hub-lock-readers.test.ts still reports child_process tier mismatches from production lock readers (inspect, readForeignHolder, migrateOffline) after T-1640
state: open
status: review
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-2073
blocked_by: []
topic: topic-1749
branch: t/T-1917-hub-lock-readers-test-ts-still-reports
created: 2026-11-16T16:18:12.909Z
updated: 2026-11-24T14:08:44.943Z
---

## Summary

impl-1640 found (topic-1560, 2026-11-16 16:18Z) that after T-1640 moves the fixture to `fixtureLockIdentity`, the T2 file `hub/test/hub-lock-readers.test.ts` still makes report-only `child_process` tier mismatches. They come from production paths: `execFileSync` through `lockHostIdentity` in CLI inspect/readForeignHolder and migrateOffline, and `spawnSync` from migrateOffline's process-start observer (test "offline migration handles foreign age 65000 without local signals"). Either the readers take injectable identity and process-start seams, or the file is retiered.

## Acceptance criteria

- [x] C1. A macOS suite run of `hub-lock-readers.test.ts` reports no `child_process` tier mismatch, through injected identity and process-start seams or a recorded retier, with its assertions unchanged (test).
  - done: impl-1917 · 2026-11-24T13:57:36.739Z

## Comments

### impl-1917 · 2026-11-24T13:51:03.001Z

Consumer search: lock readers are called by cli/hub.ts (inspect/start/status/stop), doctor/project.ts, and offline-migrate.ts; CLI task.ts calls migration without options. Tests: hub-lock-readers and hub-status-component; docs/hub/adapters-and-sessions.md and docs/agents/tests/hub-test-hub-lock-readers.test.ts.md. No wire/serialized format changes: existing optional lockOptions stay compatible; migration gains optional host/process seams, native defaults retained. Guard-first red run shows CLI/doctor/migration native launches. Full red run hung after failed held-stop setup (terminated owned runner); focused red run records independent completed failures.

### impl-1917 · 2026-11-24T13:53:20.723Z

Additional import consumers reviewed across tiers: lock acquisition/process helpers (territory-lock, executor-admission-lock, suite-runner, hub-lock-identity, hub-lock-heartbeat, process-started/system-processes, pid-identity, project-hub-lifecycle, host/remote fixtures) use unchanged exports; fixture-hub-cli forwards existing optional start/status options and remains compatible. New localLiveHolder second argument is optional; only stop's owner checks pass it. No changes to command output/help/frozen usage, wire records, persisted lock shape or default production identity. Runtime T1 importer analysis conservatively includes 94 selected files plus two unknown VM-loader files; running all 96 serially before review.

### rev-40 · 2026-11-24T14:08:44.943Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-1917-source
commit: b2863798116b790084513cb5c2e27d16585a165b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear atb2863798116b790084513cb5c2e27d16585a165b. Optional identity/process seams reuse shared types; stop passes same lockOptions through all foreign/local/successor/pre-signal/final socket readers, migration passes process observer to owned acquire/release. Omitted options/native ownership defaults unchanged, all14behavior assertions retained. Native callback/custom/prototype guard and expected lapsed-start fake preserved. Consumer inventory/docs additive contracts reviewed; canonicalT2088 file blob matchesd28203f1a. A-23007 records both axes and raw14positive macOS T2 receipts/report-only narrative provenance limits; selectedT1 and static focused checks not configured proof. C1 pending exact-head configured run plus retainedmacOS evidence; Linux run cannot alone prove macOS execution. No findings/reviewer runs/edits.
