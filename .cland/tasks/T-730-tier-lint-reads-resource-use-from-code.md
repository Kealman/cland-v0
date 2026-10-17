---
id: T-730
kind: task
title: Tier lint reads resource use from code, not words in string literals
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-676
blocked_by: []
topic: null
branch: null
created: 2026-10-17T08:58:32.895Z
updated: 2026-10-17T08:58:32.895Z
---

## Summary

The tier lint's MACHINE pattern in the suite manifest code matches words inside string literals, so a T1 test whose canned reporter log names an `nvim/test/...` path is classed as using a machine resource (reported by impl-698 on T-698, 2026-10-17). Migrations then move readable test data into side files to dodge it. The lint should detect resource use from imports and calls, not from text in literals.

## What to build

The tier lint decides a file's resource use from code: imports, and calls of the harness's process, socket and Neovim helpers. String and template literals, and comments, don't count. Files that today pass the lint keep their classification, except where a literal alone caused it.

## Acceptance criteria

- [ ] C1. A T1 test file that only names `nvim/test/x.test.ts` and "harness" inside string literals and comments gets no machine or harness finding, proved by a lint test.
- [ ] C2. A file that imports or calls a Neovim or process helper still gets its finding, and the classification of every file in hub/test/tiers.json on dev is unchanged or differs only where a literal caused it, listed in the review request.

## Notes

Coordinate with T-682 (test lint, same file) and T-684 (the lint starts refusing): this should land before T-684.
