---
id: T-1953
kind: task
title: "The T1 import-graph scanner throws \"incomplete import graph: indirect require\" on suite-remote-budget.test.ts's require-shaped fixture text, forcing conservative fallback"
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-17T21:19:05.454Z
updated: 2026-11-17T21:19:05.454Z
---

## Summary

Scanning T1 reachability over the current checkout, `importingTests` throws "Error: incomplete import graph: indirect require [hub/test/suite-remote-budget.test.ts]" at hub/test/suite-import-parser.ts:144, before any test runs. The file embeds a require-shaped fixture string that the scanner takes for a real indirect require. Selection then falls back to conservative inclusion. Found by impl-1950 during T-1950 (topic-1605, 2026-11-17). Every batch's interaction report lists the same fallback class for six other files: mod-bridge, plan-approval, sqlite-contention, suite-accounting, task-worktrees and nvim plan-component. So each batch selects about 470 files instead of its real importers.

## What to build

The scanner tells module-loading syntax apart from string and template content, or a test declares its fixture text explicitly, so require-shaped data no longer marks a file's import graph incomplete. Genuinely indirect loaders still fall back.

## Acceptance criteria

- [ ] C1. suite-remote-budget.test.ts scans as complete, while a real indirect require in a fixture test file still reports "incomplete import graph" (test).
- [ ] C2. The six other fallback files are each classified as either a real indirect loader that stays a fallback or a false positive that is fixed, and the change in batch selection count is reported (test or artifact).
