---
id: T-1917
kind: task
title: hub-lock-readers.test.ts still reports child_process tier mismatches from production lock readers (inspect, readForeignHolder, migrateOffline) after T-1640
state: closed
status: done
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
updated: 2026-11-24T18:55:59.981Z
closed: 2026-11-24T18:55:59.981Z
---

## Summary

impl-1640 found (topic-1560, 2026-11-16 16:18Z) that after T-1640 moves the fixture to `fixtureLockIdentity`, the T2 file `hub/test/hub-lock-readers.test.ts` still makes report-only `child_process` tier mismatches. They come from production paths: `execFileSync` through `lockHostIdentity` in CLI inspect/readForeignHolder and migrateOffline, and `spawnSync` from migrateOffline's process-start observer (test "offline migration handles foreign age 65000 without local signals"). Either the readers take injectable identity and process-start seams, or the file is retiered.

## Acceptance criteria

- [x] C1. A macOS suite run of `hub-lock-readers.test.ts` reports no `child_process` tier mismatch, through injected identity and process-start seams or a recorded retier, with its assertions unchanged (test).
  - done: impl-1917 · 2026-11-24T13:57:36.739Z
  - verified: rev-40 [reviewer] · run rev-40-20261124-1917-final · 2026-11-24T15:16:48.865Z · commit b2863798116b790084513cb5c2e27d16585a165b

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

### impl-1917 · 2026-11-24T15:16:00.413Z

Exact-head verification completed: 8e67f28c-b92e-4b51-9908-5f58f09e9a39 at b2863798116b790084513cb5c2e27d16585a165b, A-23031. Checked positive phase receipts: T0, T1, T2, selected T3 importers, Web each exit 0; final Finished exit 0. T4 not run. Linux x64 6.8.0-149-generic droplet c-8 sfo2, Node 24.21, Neovim 0.12.5, Chrome Headless Shell (Google Chrome for Testing 156.0.8078.4). Lifetime 3612 s, cost $0.2508, configured workers 2. Duration/tier advisory gates report-only; prerequisite skips retained in provenance (not counted as passes). macOS C1 proof remains distinct A-22995 (14/14 guarded T2 cases under suite tripwire); this droplet result does not substitute for macOS. Worktree still clean and head unchanged; Reviewer has configured result for final settlement.

### rev-40 · 2026-11-24T15:16:48.865Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-1917-final
commit: b2863798116b790084513cb5c2e27d16585a165b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear atunchangedb28637981. Exact-head8e67f28c/A-23031 finished/passed; canonical2867e7f1 executable match.14lock-reader structured base passes23742–23807, no target mismatch rows with source/positive native guard support;7shared-fix basespass. C1 verified alongside retained A-22995macOSarm64 Node24.21 report-only bootstrap14/14 evidence: exact generated names matchLinux and lock implementation/tests unchanged fromcc61f6a07 (only shared-fix file differs). Mac platform/bootstrap provenance is artifact narrative, not a new exact-head configuredMac run; Linux not claimed asMac proof. T0/T1/fallbackT2/254selectedprocessfiles2032positive identities/Webexit0, once/no repetitions; nonselected scope deferred/T4unexecuted/skips retained. NoncachedLinuxx64c8sfo2 workers2 Node24.21/Nvim0.12.5 HeadlessShell1248/CfT156.0.8078.4; budgets advisory. A-23032 records both axes/limits. No findings/reviewer runs/edits.

Criteria: C1 verified.

### coord · 2026-11-24T18:55:59.981Z

Merged 7cd724ba14bf58c11a8bcf65c9ed367ca6ef0085 onto dev.
