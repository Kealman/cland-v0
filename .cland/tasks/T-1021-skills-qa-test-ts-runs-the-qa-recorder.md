---
id: T-1021
kind: task
title: skills-qa.test.ts runs the QA recorder from the live checkout with the inherited HOME
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-20T18:41:42.839Z
updated: 2026-10-20T18:41:42.839Z
---

## Summary

hub/test/skills-qa.test.ts' legacy `record()` helper runs `qa-record.sh` from the repository root and inherits HOME, so its Git build read comes from the live checkout and the human's environment (rule 15). Found by impl-1011 on T-1011, whose new test already uses fixtureEnvironment and a disposable cwd.

## What to build

The legacy helper runs the recorder in a disposable copy with the sealed fixture environment, keeping the committed-build coverage it provides.

## Acceptance criteria

- [ ] C1. Every qa-record.sh invocation in skills-qa.test.ts runs with fixtureEnvironment and a disposable cwd, and a poisoned parent HOME/GIT_DIR does not reach it (test).
- [ ] C2. The committed-build assertions still pass against the disposable copy (test).
