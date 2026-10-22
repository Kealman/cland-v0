---
id: T-1088
kind: task
title: The startup budget probe rejects T-1081's first payload because it now carries closed containers
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-825
branch: t/T-1088-the-startup-budget-probe-rejects-t-1081
created: 2026-10-22T00:25:33.925Z
updated: 2026-10-22T01:33:13.212Z
closed: 2026-10-22T01:33:13.212Z
---

## Summary

`nvim/test/startup-budget-probe.ts`, E-1006's copied-tracker startup measurement (DOD-07), asserts that Neovim's first payload carries open items only. Since T-1081, that request also returns closed releases and epics, because containers stay in the open snapshot. The probe now fails its id check before it prints a measurement. It is a script, not a suite test, so no run catches it. Found while drafting the E-413 stage 1 QA brief.

## Acceptance criteria

- [x] C1. The probe accepts T-1081's open snapshot (open items plus every container) and prints the first-payload bytes and render time on a copy of the live tracker.
  - done: impl-1088 · 2026-10-22T01:05:15.234Z
  - verified: rev-23 [reviewer] · run rev-20261022-1088-final · 2026-10-22T01:16:06.972Z · commit a55153ba92ccfb640d1270e49e1c9656511495ce
- [x] C2. A test runs the probe's assertion logic on a small fixture, so a future change to the first payload shape fails a test instead of the probe.
  - done: impl-1088 · 2026-10-22T01:05:15.305Z
  - verified: rev-23 [reviewer] · run rev-20261022-1088-final · 2026-10-22T01:16:06.972Z · commit a55153ba92ccfb640d1270e49e1c9656511495ce

## Comments

### impl-1088 · 2026-10-22T01:05:15.157Z

Implemented in a55153ba (tree 0579208b): first-payload and installed-ID checks now accept open items plus every non-task row, with a shared pure assertion tested at T1. 2 unit and 4 targeted real-Neovim startup tests pass locally on darwin/arm64; typecheck passes. Rule-15 copied-live probe now prints 240750 bytes and 40.090 ms (1088 total / 109 open), then correctly fails unchanged 128 KiB budget; separate Bugs/S follow-up reported to lead T-1088. Exact probe output and attribution published in item-topic artifacts. No full-suite receipt yet.

### rev-23 · 2026-10-22T01:06:24.936Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1088-source
commit: a55153ba92ccfb640d1270e49e1c9656511495ce
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Five-file Standards/Spec audit against be198744:shared pure exact-membership assertion matches include_containers snapshot(open||non-task),checks wire+installed arrays without deduplication;T1 fixture covers kinds/states plus missing/extra/duplicates and is registered lexically. Real probe call site and request check use helper;unchanged physical-render/byte guards remain. No findings. A-8823 raw copied-live output prints240750B/40.090ms then fails unchanged128KiB guard;not green budget evidence. Coordinator9efe43bd keeps this task to membership/measurement and assigns growth toT-1089. A-8822 local2/2+4/4/typecheck is summary only;final criteria await exact-head mode-free. QA none. Audit A-8824.

### impl-1088 · 2026-10-22T01:15:29.364Z

Exact-head mode-free verification 79343910-a4bb-4fe6-85a4-1a21a36f2b9a at a55153ba92ccfb640d1270e49e1c9656511495ce passed (exit 0, 2371 tests/pass, 0 failed/cancelled/skipped). Linux x64 droplet c-8 lon1, cland-v0-44eb6f8c; T0 host check, all T1, fallback all T2 in both packages, Web; T3 deferred to periodic/integrated occasions, absent from configured batch tiers. Test lint/duration budgets report-only, with reported budget exceedances; not T3/full integration evidence. Run artifact A-8832. Awaiting Reviewer final settlement; source unchanged.

### rev-23 · 2026-10-22T01:16:06.972Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261022-1088-final
commit: a55153ba92ccfb640d1270e49e1c9656511495ce
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

C1/C2 verified: A-8823 prints copied-live membership/measurement (240750 bytes, 40.090250 ms); unchanged byte guard remains red and assigned to T-1089 by Coordinator 9efe43bd. A-8832 exactly matches reviewed head, task T1/all-T2/Web exit 0 with 2371 ordinary passes; both shared-assertion tests have five distinct load passes and explicit 5/5. Report-only diagnostics retained, T3 deferred. No copied-live byte-budget pass claimed. Final audit artifact posted in topic-825.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-22T01:33:13.212Z

Merged 8a9cb8f6ad101b2401388483bf1261fc833ebdad onto dev.
