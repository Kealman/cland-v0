---
id: T-1861
kind: task
title: qa lint reads a per-test docs path (.test.ts.md) as a missing test file
state: open
status: backlog
size: XS
labels:
  - needs-triage
  - qa-found
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-15T01:02:32.118Z
updated: 2026-11-15T01:02:32.118Z
---

## Summary

`cland qa lint` reports `test file docs/agents/tests/hub-test-skills-onboarding.test.ts is absent from the build` for `qa/briefs/E-1313.md`. The brief actually names `docs/agents/tests/hub-test-skills-onboarding.test.ts.md`, and that file exists. The lint reads a `.test.ts` test name out of a per-test docs path that ends in `.test.ts.md`. T-1832's replay note (0d1390dde) added this reference. Found while drafting the E-1537 stage-4 QA brief, at 0a5e25c7d.

## What to build

When the lint extracts test-file references, it treats a `docs/agents/tests/*.test.ts.md` path as a docs reference, checks that file exists, and never strips it to a test name. Real missing test files are still reported.

## Acceptance criteria

- [ ] C1. A brief naming an existing `docs/agents/tests/<name>.test.ts.md` gets no absent-test finding, and a brief naming a missing one gets one absent-file finding for that docs path (test).
- [ ] C2. `cland qa lint qa/briefs/E-1313.md` at the fix head no longer reports `hub-test-skills-onboarding.test.ts`, and its other findings are unchanged (test).
