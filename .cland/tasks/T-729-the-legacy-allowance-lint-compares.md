---
id: T-729
kind: task
title: The legacy-allowance lint compares against the branch's merge base, not current dev
state: open
status: in progress
size: S
rank: 6580
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
updated: 2026-10-17T08:49:35.044Z
---

## Summary

The tier lint's "new duration allowance cannot be legacy" check compares a branch's hub/test/durations.json with current dev. When a migration removes a legacy allowance on dev, every other open branch still holds the old entry untouched, and the lint now refuses that entry as a new legacy allowance. That forced dev merges on T-701, T-696, T-697, T-706 and T-682 on 2026-10-17, each needing a fresh review.

## What to build

The check judges an allowance against the branch's own merge base with dev, not against current dev. An entry the branch didn't add or change is never "new", whatever dev has done to it since. The real rule still holds: a branch that adds a legacy allowance, or turns an existing allowance into one, is refused.

## Acceptance criteria

- [ ] C1. A branch holding an untouched legacy allowance that dev has since removed passes the lint, and a branch that adds a new legacy allowance is still refused, proved by a lint test on a scratch repository with both histories.
- [ ] C2. The same rule holds at verify admission and at the merge gate, proved by the existing admission and merge-gate tests with the new case added.
