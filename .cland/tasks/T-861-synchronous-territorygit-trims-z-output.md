---
id: T-861
kind: task
title: Synchronous territoryGit trims -z output, so path censuses can rewrite a whitespace-prefixed filename before path policy
state: open
status: in progress
size: S
labels:
  - needs-triage
  - v0.1.4
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-601
branch: t/T-861-synchronous-territorygit-trims-z-output
created: 2026-10-19T08:23:21.387Z
updated: 2026-10-19T14:50:34.026Z
---

## Summary

The synchronous `territoryGit` runner trims Git's output, including `-z` NUL-delimited output, so a path census can rewrite a first filename that starts with whitespace (for example ` docs/input.ts` → `docs/input.ts`) before path policy is applied. Path policy could then wrongly allow or refuse a path.

## Evidence

Found aside by impl-831 on 2026-10-19 while fixing source-review finding M1 of T-831. T-831 fixes the async adapter used by batch comparison and its async callers; the synchronous runner and other delimited Git consumers are not covered.

## Acceptance criteria

- [ ] C1. The synchronous territory Git runner and every remaining consumer of `-z` or otherwise delimited Git output keep paths byte-exact (no trimming of path content); the audit lists each consumer in the commit, and a regression test with a whitespace-prefixed and a whitespace-suffixed filename fails before the fix.
