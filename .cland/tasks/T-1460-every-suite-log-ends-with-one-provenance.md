---
id: T-1460
kind: task
title: Every suite log ends with one provenance footer
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by:
  - T-1476
topic: topic-1237
branch: t/T-1460-every-suite-log-ends-with-one-provenance
created: 2026-10-30T05:44:57.980Z
updated: 2026-10-30T11:53:00.678Z
---

## Summary

Every suite log, local and droplet, ends with one provenance footer: head, verification tree, executor and platform, occasion, browser binary and version; a platform skip without a reason fails the run. The macOS cover log A-14135 omitted the occasion and the browser version (qa-677, E-1444 audit). Sources: qa-677, T-1318. Rule batch 4 C8 (A-14151).

## Acceptance criteria

- [ ] C1. Local and droplet logs carry the same footer fields, checked by one test on each executor.

## Comments

### impl-1460 · 2026-10-30T11:53:00.678Z

Consumer inventory (rule 20), searched suite-log prefixes, duration/skip/browser fields and readers across hub/src, hub/test, nvim/test, web/test, qa and skills: hub result parser suiteSummary/suite-log semantic reduction; durations.ts refresh exact timing/start/progress prefixes; dev-t3-probe.ts culprit platformExclusions exact suite skip prefix; QA recorder record-nvim-frames.ts records UI frames, not suite logs; QA evidence readers use durable raw log artifact; CLI summaries use suiteSummary timing/phase prefixes. Additive footer leaves old records intact; retain new browser/provenance records through suite-log reduction. No existing wire/reply shape changes. Proposed seam is final scheduler collection on both local and scripted droplet executors, using existing suiteUnit fixture; browser receipt is candidate runner prerequisite probe. Skip reason check is report-only, never changes outcome.
