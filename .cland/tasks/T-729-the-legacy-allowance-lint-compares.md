---
id: T-729
kind: task
title: The legacy-allowance lint compares against the branch's merge base, not current dev
state: open
status: in progress
size: S
rank: 6580
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by: []
topic: topic-429
branch: t/T-729-the-legacy-allowance-lint-compares
created: 2026-10-17T08:49:03.786Z
updated: 2026-10-17T08:58:19.075Z
---

## Summary

The tier lint's "new duration allowance cannot be legacy" check compares a branch's hub/test/durations.json with current dev. When a migration removes a legacy allowance on dev, every other open branch still holds the old entry untouched, and the lint now refuses that entry as a new legacy allowance. That forced dev merges on T-701, T-696, T-697, T-706 and T-682 on 2026-10-17, each needing a fresh review.

## What to build

The check judges an allowance against the branch's own merge base with dev, not against current dev. An entry the branch didn't add or change is never "new", whatever dev has done to it since. The real rule still holds: a branch that adds a legacy allowance, or turns an existing allowance into one, is refused.

## Acceptance criteria

- [ ] C1. A branch holding an untouched legacy allowance that dev has since removed passes the lint, and a branch that adds a new legacy allowance is still refused, proved by a lint test on a scratch repository with both histories.
  - failed: rev-31 [reviewer] · 2026-10-17T08:58:19.075Z · note The new scratch-history proof needs T2 classification and cancellation-safe ownership/join before deleting its Git repository.
- [x] C2. The same rule holds at verify admission and at the merge gate, proved by the existing admission and merge-gate tests with the new case added.
  - done: impl-729 · 2026-10-17T08:56:37.671Z

## Comments

### impl-729 · 2026-10-17T08:55:33.854Z

Implemented branch-merge-base legacy allowance checks for working and immutable lint, with pinned task/dev history at the merge gate. Scratch-history regression reproduced the original false refusal before the fix. Focused verify and merge-gate cases now pass, retaining all existing refusal assertions and adding new/conversion legacy refusals. Completing serial full-file checks before first review.

### rev-31 · 2026-10-17T08:58:19.075Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261017-729-source-1
commit: c79144d7f9dd7de7a02bf7267f760c19b7d33182
scope: full
findings: [{"severity":"medium","text":"New scratch-history test declares T1 while gitIn and lint seams execute real Git subprocesses; preserve real history proof and classify it T2 under docs/agents/tests.md.","file":"hub/test/duration-legacy.test.ts","line":1},{"severity":"medium","text":"Direct t.after(rm) can remove the scratch repository while unowned native Git work is in flight on test cancellation; stop/join owned writers before root removal.","file":"hub/test/duration-legacy.test.ts","line":13}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear; Standards2medium/Spec0, A-4427. Implementer f3c49c35 accepts real-Git T2 classification and no exception. Cancellation cleanup owner question sent separately; normal awaited success and per-command timeout do not establish test-cancellation writer-before-rm ordering. Core merge-base implementation and pinned synthetic-tree history correct; live owner/schema/date/reason validation unchanged. Admission/merge tables retain positive dev-retirement and new/conversion refusal coverage. Exact origin head/diff whitespace checked; A-4425 local targeted/typecheck/tier checks inspected. C1 failed for the proof's tier/cleanup; C2 source present but final runtime unverified. Fresh corrected source review before diff-selected verify; no Reviewer edits/tests.

Criteria: C1 failed (The new scratch-history proof needs T2 classification and cancellation-safe ownership/join before deleting its Git repository.).
