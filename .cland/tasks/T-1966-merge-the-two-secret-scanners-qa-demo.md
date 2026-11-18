---
id: T-1966
kind: task
title: Merge the two secret scanners (qa-demo-policy assertPublishable and site capture-safety scanCapture) into one shared scanner policy
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-18T11:20:29.787Z
updated: 2026-11-18T11:20:29.787Z
---

## Summary

Found by impl-1808 while building T-1808's scan-and-publish helper (2026-11-18). The repo has two secret scanners with different pattern sets. `assertPublishable` (.agents/skills/qa/qa-demo-policy.ts) covers provider keys, private keys and decoded spellings. `scanCapture` (site/scripts/capture-safety.ts) adds private paths and broad token and Bearer forms. T-1808 calls both unchanged, so a match in either refuses publication, but every other caller uses only one of them.

## What to build

One shared scanner policy holding the union of both pattern sets, with both existing entry points delegating to it, and every caller unchanged in behaviour except that it now catches the other scanner's patterns.

## Acceptance criteria

- [ ] C1. Every pattern either scanner caught before is caught through the shared policy, proven by a positive-control fixture for each pattern family, generated per run and never a real-looking token committed to the repo (test).
- [ ] C2. Every caller of both scanners (QA kit, site captures, T-1808's helper) is listed with its disposition (rule 41) and passes unchanged.
