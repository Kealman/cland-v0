---
id: T-1264
kind: task
title: Use a proper source parser for QA brief drift checks if real briefs require unsupported syntax
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
created: 2026-10-24T21:39:34.913Z
updated: 2026-10-24T21:39:34.913Z
---

## Summary

T-1201's `cland qa lint` reads test titles with a bounded, dependency-free lexer under a written drift-detector trust model (review-loop cap, 2026-10-24): repo-real string/template titles of test/it/describe; ambiguous regex/division or brace contexts report unresolved (fail-closed). Promoting typescript to a runtime dependency for its parser was declined (about 23 MB per install).

## Trigger

Pick this up only when real project briefs need literal title validation beyond the documented lexer bounds (unresolved reports on real briefs). Adversarial test-source decoys stay out of scope.

## Acceptance criteria

- [ ] C1. A real brief that the T-1201 lexer reports unresolved is validated exactly, without a new runtime dependency unless the human approves one.
