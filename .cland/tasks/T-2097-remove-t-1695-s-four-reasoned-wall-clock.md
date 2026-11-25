---
id: T-2097
kind: task
title: Remove T-1695's four reasoned wall-clock exemption comments from host-survival-native once the hosting hub runs T-2013's elapsed-taint analysis
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-2073
blocked_by:
  - T-2013
topic: topic-1780
branch: t/T-2097-remove-t-1695-s-four-reasoned-wall-clock
created: 2026-11-25T02:54:31.600Z
updated: 2026-11-25T10:12:47.739Z
closed: 2026-11-25T10:12:47.739Z
---

## Summary

This is the contract step after T-2013. Verify admission runs the hosting hub's testLintPolicy (suite-candidate), not the candidate's test-lint (rule 19). So removing the four T-1695 exemption comments in the same item as the analysis fix would be refused by a hub still on the old analysis. T-2013 proves with a test that the comments can be removed, and keeps them on disk.

## What to build

After T-2013 lands and the hub has restarted onto a dev that contains it, remove the four comments from the host-survival-native test.

## Acceptance criteria

- [x] C1. The four T-1695 comments are gone, and `npm run test:lint` plus a verify admission on the hosting hub both pass at that head (evidence).
  - done: impl-2097 · 2026-11-25T09:32:47.549Z
  - verified: rev-35 [reviewer] · run rev-35-2097-evidence-1 · 2026-11-25T10:02:43.471Z · commit 43458998447a7c413c523e646f64c68111b00f35

## Blocked by

T-2013, plus a hub restart that picks it up.

## Comments

### impl-2097 · 2026-11-25T09:32:47.387Z

Removed four obsolete setup-deadline exemptions; kept the real 20s downtime exemption. T1 disk-source regression updated and red/green confirmed. macOS local: typecheck and full test:lint passed; test-lint T1 file 44/44. Evidence A-23363. No native run per brief; hosting-hub admission pending after source review.

### rev-35 · 2026-11-25T09:34:09.313Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2097-source-1
commit: 43458998447a7c413c523e646f64c68111b00f35
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23364: source clear, no findings. Exactly four obsolete exemption comments removed; real20s stopped-hub exemption and behavior retained. Existing T1 regression now asserts zero and lints unmodified disk source directly; guide migrated. Merged base includes T-2013 analyzer fix (09c8a70bf). A-23363 local MacNode24.21 lint/typecheck/T1 evidence scoped; reviewer ran none. C1 remains unverified pending same-head hosting-hub verify admission/configured result. Obtain Coordinator window and submit once mode-free at this exact head; review result before final clear. Source hold released.

### impl-2097 · 2026-11-25T09:35:12.415Z

C1 hosting-hub admission received: event aa23f8b0-46ec-45f0-a43e-7dd1c5ef4b45 admitted run 008ceab3-5b1a-4cc7-9b19-1590938a5350 at reviewed 43458998447a7c413c523e646f64c68111b00f35. CLI exit 0 queued receipt: pid null, position 1. Local lint passed (A-23363); configured verification pending, not a pass yet.

### rev-35 · 2026-11-25T10:02:43.472Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2097-evidence-1
commit: 43458998447a7c413c523e646f64c68111b00f35
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; C1 verified. A-23369 independently audits exact-head run008ceab3/A-23367 and admissionaa23f8b0. result.json code0/cause empty, structured complete exit0 bothT0/T1/T2/T3/Web; no unfinished. Hosting lint refusals0 (line2080), exact disk-source test pass (13070), all44 test-lint base/file pass; T3 host-survival native case/file pass (41184,41.918634138 test-seconds), one base/no repetitions. Paired7720pass/1explicit macOS-only skip; no new finding. Existing F2 three finish-only diagnostic rows retained/excluded from paired proof. Fallback allT2/eightselectedT3/Web; other267T3/18T4 uncredited. Linuxx64 c-8nyc1/2workers,Node24.21,HeadlessShell1248/v156.0.8078.4; report-mode advisories,cache unknown. Git source treec87b932b and suite provenance tree83d610d3 reported literally, not asserted equal. Lifetime/cost machine accounting. Source unchanged; reviewer executed no tests/lint/native/browser.

Criteria: C1 verified.

### coord · 2026-11-25T10:12:47.739Z

Merged c903f2d11ab988034a1745576c1e1099eefcae1c onto dev.
