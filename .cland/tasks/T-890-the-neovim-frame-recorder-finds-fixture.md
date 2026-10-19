---
id: T-890
kind: task
title: The Neovim frame recorder finds fixture consumers by a filename substring
state: open
status: review
size: S
labels:
  - v0.1.4
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: topic-630
branch: t/T-890-the-neovim-frame-recorder-finds-fixture
created: 2026-10-19T18:39:30.696Z
updated: 2026-10-19T19:43:03.067Z
---

## Summary

record-nvim-frames.ts finds non-T2 fixture consumers by searching each test file for the literal string 'stub-hub.ts'. A T4 consumer that imports its stub client through a helper is silently left out after a harmless header change. impl-882 found this on 2026-10-19 while working on T-888. T-888 works around it by naming stub-hub.ts in its T4 header.

## Acceptance criteria

- [ ] C1. The recorder discovers fixture consumers from explicit declarations or from the transitive import graph, not from a filename substring. A T1 test shows that a consumer reaching stub-hub.ts only through a helper is refreshed, and that a file which merely mentions the name in a comment is not.

## Comments

### impl-890 · 2026-10-19T19:25:20.052Z

Implementation selects the full-refresh file set from a parsed relative dependency graph, including new URL(..., import.meta.url) subprocess paths. C1 is covered by T1 tests for helper-only consumers, comment/string-only mentions, and cyclic lazy-import helpers. Existing T2 inclusion and explicit-file refresh behavior are preserved. No T-888 thread registrations changed.

### rev-30 · 2026-10-19T19:27:10.342Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-890-source
commit: 7b328f02c60b46fe9b2c53c31d350de49288a8f2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6411 Standards/Spec source clear. Full refresh discovers exact stub-hub dependency through parsed import/re-export/lazy/URL edges, cycles cached/terminated; comments/strings excluded by T1 controls. ExistingT2 inclusion, explicit requested paths/from-recordings/final live contract retained. No T888source changed. Reported3/3+7/7 host proof supporting only; C1 awaits exact-head mode-free test execution, no full52file live-refresh claim.

### impl-890 · 2026-10-19T19:41:37.061Z

Verify 275ac8e8 / A-6458 failed only in the known verify-tool fixture cases. Applied the two Coordinator-posted T-891 shared commits (a7159290 and 67a01b6f) as 644b52d8 and 4d94ac91. Recorder implementation unchanged. Targeted verify-tool.test.ts passes 3/3. Fetch and merge-tree against origin/dev clean before pushing 4d94ac91. Fresh source review requested before retrying mode-free verification.

### rev-30 · 2026-10-19T19:43:03.067Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-890-shared-fixture-source
commit: 4d94ac9183245f9c66475dd1ea838c308cffe011
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Clear source delta A-6468: only cumulative Coordinator-posted T-891 verification fixture changes, exact final blob equals reviewed 67a01b6f; assertions retained, no T-890 source change, tier/allowance/dev merge. Original full source review A-6411 remains. Prior A-6458 is a failed prior-head gate solely on inherited verify-tool controls; own three discovery controls ordinary and 5/5 passed. C1 remains pending a fresh exact-head mode-free green gate at 4d94ac91; this verdict authorizes source progression, not final evidence. QA none.
