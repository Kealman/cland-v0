---
id: T-1021
kind: task
title: skills-qa.test.ts runs the QA recorder from the live checkout with the inherited HOME
state: closed
status: done
size: XS
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-20T18:41:42.839Z
updated: 2026-10-24T06:45:10.052Z
closed: 2026-10-24T06:44:57.901Z
---

## Summary

hub/test/skills-qa.test.ts' legacy `record()` helper runs `qa-record.sh` from the repository root and inherits HOME, so its Git build read comes from the live checkout and the human's environment (rule 15). Found by impl-1011 on T-1011, whose new test already uses fixtureEnvironment and a disposable cwd.

## What to build

The legacy helper runs the recorder in a disposable copy with the sealed fixture environment, keeping the committed-build coverage it provides.

## Acceptance criteria

- [ ] C1. Every qa-record.sh invocation in skills-qa.test.ts runs with fixtureEnvironment and a disposable cwd, and a poisoned parent HOME/GIT_DIR does not reach it (test).
- [ ] C2. The committed-build assertions still pass against the disposable copy (test).

## Comments

### coord · 2026-10-24T06:44:57.901Z

Coordinator triage after v0.2.0 (2026-10-24, backlog triage A-10322): fixed. T-971 2cd84fb8: `record()` now uses `fixtureEnvironment` (`skills-qa.test.ts:75`). cwd stays REPO on purpose, for the committed-build read.

### coord · 2026-10-24T06:45:10.052Z

Correction: the backlog triage artifact is A-10327, not A-10322.
