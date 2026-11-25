---
id: T-2094
kind: task
title: A failing diagnostic sink (run.log appendFile, prepare's final catch log) can replace the selected provider or install error in droplet acquisition and preparation
state: closed
status: done
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-2075
blocked_by: []
topic: topic-1777
branch: t/T-2094-a-failing-diagnostic-sink-run-log
created: 2026-11-25T01:59:23.108Z
updated: 2026-11-25T09:22:54.773Z
closed: 2026-11-25T09:22:54.773Z
---

## Summary

This is a reviewer aside from T-1970 (rev-41, reported by impl-1970) and lies outside T-1970's release and checkpoint scope. In hub/src/executor/droplet/droplet.ts, the regional-422 catch writes to run.log with appendFile. In hub/src/executor/droplet/prepare.ts, the final catch writes a log line. If either sink rejects, its error can replace the provider or install error that was selected as primary, the rule 39 pattern that T-1995 and T-1970 fix elsewhere.

## What to build

Route both sink writes through the shared cleanup-failure helper (withCleanupFailure), so the selected primary error survives and a sink rejection is attached as a secondary diagnostic.

## Acceptance criteria

- [x] C1. With a fake run.log sink that rejects, a regional-422 acquisition failure and a prepare install failure each surface their original primary error, with the sink rejection attached as its cause (test, red before).
  - done: impl-2094 · 2026-11-25T07:12:46.487Z
  - verified: rev-35 [reviewer] · run rev-35-2094-evidence-1 · 2026-11-25T08:35:48.382Z · commit 55e2fb44986466a5ca7574a205b32fd2a34944ea

## Comments

### impl-2094 · 2026-11-25T07:11:20.515Z

C1 red-before-green: regional append rejection returned Error: run log sink rejected instead of exact DigitalOceanError(422); prepare final-log rejection returned prepare diagnostic sink rejected instead of install: prepare failed (exit 8). Both now pass individually using guardedLeaseCase and withCleanupFailure. No wire, command, settings or permission contract changed; existing aggregate cause shape retained.

### rev-35 · 2026-11-25T07:16:51.674Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2094-source-1
commit: 55e2fb44986466a5ca7574a205b32fd2a34944ea
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-23315 records full fixed-base audit. Regional append rejection uses existing withCleanupFailure and retains exact DigitalOceanError class/status/id/message through existing checkpoint/release. Final preparation diagnostic callback preserves selected install error in unchanged wrapper, adds exact sink as secondary aggregate, leaves log fields/message stable. Two meaningful producer-bound fakeT2 regressions have whole-case guards/named setup+operation waits, exact primary/cause identity and no remaining fake resources/recovery record. All-tier source/helper/event/field consumer census finds no required migration; no CLI/config/wire/dependency change. Reported57 local/fulltypecheck/lint and736+18unknown import diagnostic are scoped authored evidence, not configured green/full closure. C1 final verification pending exact-head configured producer/reader and selected-phase receipts. Hold released; request Coordinator window before one mode-free verify.

### impl-2094 · 2026-11-25T08:34:30.137Z

Configured run b2a54175-ac99-48e0-8426-69efe35e4b77 passed at 55e2fb449; A-23332. Structured finish receipts show each new named sink regression passed base T2 plus five load-gate repetitions. Changed file 57 passed; helper cleanup-failure 4, admission 13, prepare-key 10 passed. T0/T1/T2/T3/Web exit 0; T4 unexecuted. Linux x64 droplet c-8 nyc1 workers 2, Node v24.21.0, Chrome for Testing Headless Shell 156.0.8078.4. Budget/skip-reason checks report mode; platform skips recorded. Reviewer has same-head result for C1 settlement.

### rev-35 · 2026-11-25T08:35:48.382Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2094-evidence-1
commit: 55e2fb44986466a5ca7574a205b32fd2a34944ea
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; C1 verified. A-23334 independently audits A-23332/runb2a54175: durable code0/causeempty, complete T0(two)/T1/T2/T3/Web and zero unfinished. Both exact primary/sink cause regressions basepass20380/20458 plus5/5 loaded each; changed component57/57 and helper4/admission13/runrules15/key10/retry5/retirement2/nativeprepare6/droplet13+Macskip/safety17 positive. Paired9694 basepass/12skip+10loadedpass; known3F2 excluded. PositiveT1 249/T2 449/T3 251/Web55;24 otherT3 deferred,18T4 unexecuted. Linuxx64 Node24.21/Headless1248v156, cacheunknown; Git3cdfd... and verification7b2e1... literal distinct trees at reviewedhead. No new finding/sourcechange/probe/run requested; audit hold released for normalready/merge gate.

Criteria: C1 verified.

### coord · 2026-11-25T09:22:54.773Z

Merged a6ff2853b872fe41f4862e018d0f692caffb28b9 onto dev.
