---
id: T-918
kind: task
title: "cover-quiet 'release worker admits its cover lease…' fails on macOS: the nested scratch hub socket path exceeds 104 bytes (EINVAL)"
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
regression_of: T-916
found_by: cover
topic: topic-667
branch: t/T-918-cover-quiet-release-worker-admits-its
created: 2026-10-19T23:27:26.190Z
updated: 2026-10-19T23:44:27.637Z
closed: 2026-10-19T23:44:27.637Z
---

## Summary

T-916's new test `hub/test/cover-quiet.test.ts::release worker admits its cover lease before isolated scratch startup` fails 1/1, and 0/5 in the load gate, in stage cover #2's macOS run fb05a8ef at 15f9c308 (A-6795, around line 76849). The nested release.test.ts child fails with `cland: connect EINVAL /private/tmp/cland-suite-effa9041-…/cland-proj-En2kQK/cland-55d4605ca6e3d3ae.sock`. On macOS the nested suite temp root plus the scratch project makes the Unix socket path longer than the 104-byte sun_path limit. Linux allows 108 and passed.

## What to build

Keep the hub socket path of nested fixtures under the macOS limit. Either shorten the temp roots the test and helper create (for example a short `mkdtemp` under `/tmp`), or have socket placement fall back to a short directory when the project path is too long, whichever the code already supports. Check every fixture that nests a project inside a suite temp dir.

## Acceptance criteria

- [x] C1. The cause is confirmed, with the computed socket path length on macOS.
  - done: impl-918 · 2026-10-19T23:29:40.190Z
  - verified: rev-30 [reviewer] · run rev-20261019-918-source · 2026-10-19T23:31:07.533Z · commit c63d2fcd2b1f27a566ef57f5ea3dded68e2e52e7
  - verified: rev-30 [reviewer] · run rev-20261019-918-final · 2026-10-19T23:39:54.879Z · commit c63d2fcd2b1f27a566ef57f5ea3dded68e2e52e7
- [x] C2. The test passes on macOS when run inside a nested suite temp root as long as the integrated run's, either reproduced by setting TMPDIR to an equally long path or by a T2 check of the computed socket path, with the receipt in the report.
  - done: impl-918 · 2026-10-19T23:29:41.152Z
  - verified: rev-30 [reviewer] · run rev-20261019-918-final · 2026-10-19T23:39:54.879Z · commit c63d2fcd2b1f27a566ef57f5ea3dded68e2e52e7
- [x] C3. A mode-free verify at the reviewed head is green.
  - done: impl-918 · 2026-10-19T23:39:37.965Z
  - verified: rev-30 [reviewer] · run rev-20261019-918-final · 2026-10-19T23:39:54.879Z · commit c63d2fcd2b1f27a566ef57f5ea3dded68e2e52e7

## Comments

### impl-918 · 2026-10-19T23:29:41.896Z

Confirmed fallback bug in layout(): final TMPDIR socket was 107 bytes on macOS; staging bind is shorter and succeeds, so the error appears later at connect. Added byte-budgeted /tmp fallback and T1 table covering nested suite/project roots, multibyte TMPDIR, normal temp and project-local sockets. Full cover-quiet file passes 15/15 with integrated-length TMPDIR. Typecheck and static/test lint pass (existing report-only findings). Mode-free verification follows source review.

### rev-30 · 2026-10-19T23:31:07.533Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-918-source
commit: c63d2fcd2b1f27a566ef57f5ea3dded68e2e52e7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, A-6804. Existing100-byte path budget now applies to project-local and TMPDIR placements; final /tmp fallback retains project-specific hash at32bytes. Independent arithmetic confirms reported failing path107bytes; staging/discovery code corroborates bind-before-connect failure mechanism. Pure T1 table covers nested/multibyte temp paths, normal preference, stability/distinctness without new processes; environment restored. C1 verified. C2 original local Mac receipts requested from claimant (A-6801 currently prose); C3 awaits exact-head mode-free green and new T1 actual5/5 without owned budget/resource trips. QA none; no Reviewer tests.

Criteria: C1 verified.

### impl-918 · 2026-10-19T23:39:43.589Z

C3 done: exact reviewed head c63d2fcd2b1f27a566ef57f5ea3dded68e2e52e7, mode-free verify 3c20466e-d6cb-4a23-aa7b-ceff78e66e3d exit 0; 1913/1913 pass, no skipped/cancelled. A-6815: new project-layout identity 5/5 passed at line 41398; pure T1, zero reachable resources, 0.006s ordinary. Executor Linux droplet c-8 lon1; lifetime 454s, cost $0.0315. Original macOS long-TMPDIR receipts A-6807 cover C2. Awaiting final Reviewer evidence verdict; head unchanged.

### rev-30 · 2026-10-19T23:39:54.879Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-918-final
commit: c63d2fcd2b1f27a566ef57f5ea3dded68e2e52e7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear, A-6818. Independently audited A-6815/3c20466e:1913/1913,zero fail/cancel/skip/TODO,new layout ordinary plus five distinct positive repetitions (max .006508428s),explicit5/5 line41398;zero tier/resource mismatch or owned overrun. Original A-6807 Mac receipts confirm red107-byte EINVAL then long-TMPDIR cover-quiet15/15 and release22/22,zero nonpasses/exit0 at reviewed source bytes. C2 native Mac proof and C3 current mode-free green establish remaining criteria; C1 source retained. Known unowned report-only rows need no new aside. QA none; no Reviewer tests or Linux T3 claim.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-19T23:44:27.637Z

Merged 5954e219464729ac9c44738aebc87d6d7c3ad8c0 onto dev.
