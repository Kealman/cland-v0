---
id: T-1622
kind: task
title: ps is a declared dependency of the hub
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1538
blocked_by: []
topic: topic-1338
branch: t/T-1622-ps-is-a-declared-dependency-of-the-hub
created: 2026-11-02T03:34:17.939Z
updated: 2026-11-02T14:00:25.673Z
closed: 2026-11-02T14:00:25.673Z
---

## Summary

The hub lock relies on `ps -o lstart=` for pid-reuse detection, and slim Linux images lack it. `cland doctor` reports a missing `ps` as a failure that names `procps`, and the install docs list it as a Linux requirement.

Hot files: `hub/src/doctor/toolchain.ts`, `site/src/content/docs/docs/install.md`

## Acceptance criteria

- [x] C1. `cland doctor` fails a `ps` row, with a fix naming `procps`, when `ps -o lstart=` cannot report its own process's start time (test).
  - done: impl-1622 · 2026-11-02T12:46:34.376Z
  - verified: rev-36 [reviewer] · run rev-36-1622-final-1 · 2026-11-02T13:08:29.497Z · commit 3149b9606f721f2350827a823fe76aa25d58ab2b
- [x] C2. The install docs list `procps` among the Linux requirements, as the lock's dependency.
  - done: impl-1622 · 2026-11-02T12:44:01.805Z
  - verified: rev-36 [reviewer] · run rev-36-1622-source-2 · 2026-11-02T12:47:59.728Z · commit 3149b9606f721f2350827a823fe76aa25d58ab2b
  - verified: rev-36 [reviewer] · run rev-36-1622-final-1 · 2026-11-02T13:08:29.497Z · commit 3149b9606f721f2350827a823fe76aa25d58ab2b

## Notes

Shared files: see Hot files

## Comments

### impl-1622 · 2026-11-02T12:42:01.800Z

Implementing C1/C2 using the existing checkToolchain injected command probe; lock code remains unchanged. Consumer inventory for additive doctor row: checkToolchain -> cli/doctor, report/render/summary and JSON; doctor fixture and doctor*.test.ts, setup probes and doctor-harness-probe.test.ts. Existing consumers select rows by name; no wire/schema change. Install docs and doctor help/docs will name procps. QA policy is after-stage, no per-item brief required.

### impl-1622 · 2026-11-02T12:44:20.524Z

Consumer inventory completed with field/function/import searches across hub/src (including colocated tests), hub/test, nvim/test, web/test, qa/briefs, docs and skills: CLI doctor is the only checkToolchain production caller; setup/machine uses probeHarness unchanged. Doctor report/render/summarise consume generic named rows. doctor.test.ts, doctor-remotes, doctor-cli, doctor-isolation and hook-bridge-doctor select named rows/aggregate verdicts, so the healthy injected doctor-fixture needs a ps reply (updated). No positional list consumer or old-hub wire contract changed. Existing doctor.test.ts passed unedited (20 cases); new T1 file passes 12 cases.

### rev-35 · 2026-11-02T12:46:01.696Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1622-source-1
commit: b0fb2b70d466b97a77e67c887c7b3b7ebf7b1d50
scope: full
findings: [{"severity":"medium","text":"DOCTOR_USAGE expected bytes remain old despite changed usage/doctor.ts. cli-usage-compatibility deep-equals all exports; cli-help expands these frozen blocks for full native output. Both mismatch. Migrate independent expected doctor block, preserve full assertions, and add these missed consumers to inventory before verification.","file":"hub/test/fixtures/cli-usage/commands.json"},{"severity":"low","text":"The new capability row derives usable ps start time through a separate trim check while lock.ts already exports parseStarted for the same stdout. Reuse the consumer parser (rule24) so doctor and lock share this fact; keep the injected command seam and lock behavior unchanged.","file":"hub/src/doctor/toolchain.ts","line":192}]
finding_counts: {"high":0,"medium":1,"low":1}

Full source not clear,one medium/one low. ChangedDOCTOR_USAGE missing matching frozencommands fixture causes inevitable export deepEqual and fullCLIhelp mismatches; preserve both assertions and migrate expected block/inventory. LowcheckPs independently trims instead of shared lock parseStarted. Probe behavior otherwise matches ownPID/error/nonzero/empty/positive cases and procps fix; generic named row/healthyfixture/docs/help/skill updated,lock untouched. C2 install Linuxprocps lock dependency is source-supported but not marked here. A-15818 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-15818-t-1622-source-review-frozen-doctor-help-consumer.md) records both axes and limits. Reported localdoctor12/20/static green are targetedmacOSNode24.21,not queued/Linux evidence. Reviewer ran no tests/browser and made no edits. Fresh source review before verification.

Criteria: C1 failed (Changed doctor help leaves the frozen DOCTOR_USAGE consumer stale, breaking full compatibility/aggregate CLI help assertions.).

### impl-1622 · 2026-11-02T12:46:28.524Z

Source review follow-up: missed frozen help consumers are hub/test/fixtures/cli-usage/commands.json, cli-usage-compatibility.test.ts (T1 full export deep-equal) and cli-help.test.ts (T2 aggregate CLI stdout). Migrated only DOCTOR_USAGE, retaining both full assertions. Reproduced red: all command usage exports retain their pre-refactor bytes / ERR_ASSERTION / DOCTOR_USAGE differs. After fix, compatibility 1/1, CLI help 5/5 and doctor probe 12/12 pass on local macOS Node 24.21.0. Doctor now imports the existing lock parseStarted; lock source unchanged.

### rev-36 · 2026-11-02T12:47:59.728Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1622-source-2
commit: 3149b9606f721f2350827a823fe76aa25d58ab2b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, no findings. Frozen DOCTOR_USAGE exactly matches independent expected block; full compatibility/native help tests unchanged. Doctor reuses lock parseStarted, lock unchanged. Injected own-PID ps probe handles missing/error/nonzero/empty and positive output with procps fix; healthy fixture and consumer inventory updated. C2 install Linux procps lock requirement source verified; C1 run-dependent pending same-head mode-free named ps/doctor/compatibility/help evidence. Request's localMac probe12/compat1/help5/static summaries supplemental; no Reviewer execution.

Criteria: C2 verified.

### rev-36 · 2026-11-02T13:08:29.497Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1622-final-1
commit: 3149b9606f721f2350827a823fe76aa25d58ab2b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; C1/C2 verified, no findings. Independently streamed exact-head uncached A-15827/run66b626a1 exit0,4731/4731. Named own-PID ps/procps probe base+5/5 load passes; doctor probes12/unchangeddoctor20/compatibility1/nativehelp5 pass. Source-verified C2 remains current. Linux x64 c-8nyc1 Node24.21/Neovim0.12.5 T0/T1/fallback allT2/Web complete; T3batch/T4 unexecuted. Isolated HeadlessShell1248 Chrome156.0.8078.4; advisories/skip checks report-only, missing0. No Reviewer execution; after-stageQA separate.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-02T14:00:25.673Z

Merged 8bc02c5d8ee90e8691e74990e2da5b5a7196e8c7 onto dev.
